/**
 * Sincronización de reportes del GEI con PostgreSQL y Google Drive.
 * El parseo de los archivos vive en geiParser.ts; este servicio hace la persistencia:
 * upsert masivo por DNI, asistencia, notas, promedios, carpetas de Drive y auditoría.
 */

import { registrarAuditoria } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import {
  analizarLibroGei,
  calcularPromedio,
  deduplicarPorDni,
  parsearCursoCombinado,
  type CalificacionGei,
  type ResultadoImportacionGei,
} from "./geiParser";
import { parsearAlertas, parsearTrayectoria, type FichaGei } from "./geiFichas";
import {
  analizarAsistenciaMensual,
  analizarPlanillaEvaluaciones,
  claveNombre,
  consolidarAsistencia,
} from "./geiPlanillas";
import {
  driveConfigurado,
  moverCarpetaPorPromocion,
  sincronizarEstructuraDrive,
  type CarpetasEstudiante,
} from "./googleDriveService";

export type { ResultadoImportacionGei } from "./geiParser";

export interface OpcionesImportacionGei {
  usuarioId: string;
  nombreArchivo?: string;
  cicloLectivo?: number;
  sincronizarDrive?: boolean;
  ipAddress?: string | null;
  /** Si se indica, solo se importa la matrícula de estos años (p. ej. [1, 2, 3]). */
  anios?: number[];
}

const TAMANO_LOTE = 100;
const CONCURRENCIA_DRIVE = 4;

function enLotes<T>(items: T[], tamano: number): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < items.length; i += tamano) lotes.push(items.slice(i, i + tamano));
  return lotes;
}

async function conConcurrencia<T>(items: T[], limite: number, tarea: (item: T) => Promise<void>): Promise<void> {
  let siguiente = 0;
  const trabajadores = Array.from({ length: Math.min(limite, items.length) }, async () => {
    while (siguiente < items.length) {
      const item = items[siguiente++];
      if (item !== undefined) await tarea(item);
    }
  });
  await Promise.all(trabajadores);
}

/** Upsert de notas por (estudiante, materia, ciclo) y recálculo del promedio general del ciclo. */
async function guardarCalificaciones(
  calificaciones: (CalificacionGei & { estudianteId: string })[],
  ciclo: number,
): Promise<number> {
  for (const lote of enLotes(calificaciones, TAMANO_LOTE)) {
    await prisma.$transaction(
      lote.map((c) => {
        const notas = {
          primerCuatrimestre: c.primerCuatrimestre,
          segundoCuatrimestre: c.segundoCuatrimestre,
          notaFinal: c.notaFinal,
          previa: c.previa,
        };
        return prisma.calificacionMateria.upsert({
          where: {
            estudianteId_materia_cicloLectivo: {
              estudianteId: c.estudianteId,
              materia: c.materia,
              cicloLectivo: c.cicloLectivo,
            },
          },
          create: { estudianteId: c.estudianteId, materia: c.materia, cicloLectivo: c.cicloLectivo, ...notas },
          update: notas,
        });
      }),
    );
  }

  const idsAfectados = [...new Set(calificaciones.map((c) => c.estudianteId))];
  for (const lote of enLotes(idsAfectados, TAMANO_LOTE)) {
    const notas = await prisma.calificacionMateria.findMany({
      where: { estudianteId: { in: lote }, cicloLectivo: ciclo },
      select: { estudianteId: true, primerCuatrimestre: true, segundoCuatrimestre: true, notaFinal: true },
    });
    const operaciones = lote.flatMap((id) => {
      const promedio = calcularPromedio(notas.filter((n) => n.estudianteId === id));
      return promedio === null ? [] : [prisma.estudiante.update({ where: { id }, data: { promedioGeneral: promedio } })];
    });
    if (operaciones.length > 0) await prisma.$transaction(operaciones);
  }
  return calificaciones.length;
}

/**
 * Asigna el turno de cada división según el listado de divisiones del GEI (la matrícula no lo trae).
 * Debe correr después de importar la matrícula. Devuelve la cantidad de alumnos actualizados.
 */
export async function actualizarTurnosGei(divisiones: { curso: string; turno: string }[]): Promise<number> {
  const operaciones = divisiones.flatMap((d) => {
    const curso = parsearCursoCombinado(d.curso);
    const turno = d.turno.trim();
    if (!curso || !turno) return [];
    return [prisma.estudiante.updateMany({ where: { anio: curso.anio, division: curso.division }, data: { turno } })];
  });
  const resultados = await prisma.$transaction(operaciones);
  return resultados.reduce((total, r) => total + r.count, 0);
}

export interface ResultadoFichasGei {
  alumnosActualizados: number;
  ciclosTrayectoria: number;
  alertasTempranas: number;
  /** DNIs de fichas que no están en la base (alumnos sin matrícula importada). */
  sinEstudiante: number;
  duracionMs: number;
}

/**
 * Importa la trayectoria escolar y las alertas tempranas de cada ficha del GEI.
 * El GEI es la fuente de verdad: se reemplazan completas por alumno en cada sincronización.
 */
export async function importarFichasGei(
  fichas: FichaGei[],
  opciones: { usuarioId: string; ipAddress?: string | null },
): Promise<ResultadoFichasGei> {
  const inicio = Date.now();
  const resultado: ResultadoFichasGei = {
    alumnosActualizados: 0,
    ciclosTrayectoria: 0,
    alertasTempranas: 0,
    sinEstudiante: 0,
    duracionMs: 0,
  };
  const alumnos = await prisma.estudiante.findMany({
    where: { dni: { in: fichas.map((f) => f.dni) } },
    select: { id: true, dni: true },
  });
  const idPorDni = new Map(alumnos.map((a) => [a.dni, a.id]));

  await conConcurrencia(fichas, CONCURRENCIA_DRIVE, async (ficha) => {
    const estudianteId = idPorDni.get(ficha.dni);
    if (!estudianteId) {
      resultado.sinEstudiante++;
      return;
    }
    const ciclos = parsearTrayectoria(ficha.trayectoria);
    const alertas = parsearAlertas(ficha.alertas);
    await prisma.$transaction([
      prisma.trayectoriaEscolar.deleteMany({ where: { estudianteId } }),
      prisma.alertaTemprana.deleteMany({ where: { estudianteId } }),
      prisma.trayectoriaEscolar.createMany({ data: ciclos.map((c) => ({ ...c, estudianteId })) }),
      prisma.alertaTemprana.createMany({ data: alertas.map((a) => ({ ...a, estudianteId })) }),
    ]);
    resultado.alumnosActualizados++;
    resultado.ciclosTrayectoria += ciclos.length;
    resultado.alertasTempranas += alertas.length;
  });

  await registrarAuditoria(opciones.usuarioId, null, "IMPORTAR_GEI", opciones.ipAddress ?? null);
  resultado.duracionMs = Date.now() - inicio;
  return resultado;
}

export interface PlanillasGei {
  /** Resúmenes mensuales de asistencia (solo meses cerrados), uno por división y mes. */
  asistencias: { nombre: string; datos: Uint8Array }[];
  /** Resúmenes de evaluaciones, uno por espacio curricular de cada división. */
  evaluaciones: { nombre: string; datos: Uint8Array }[];
}

export interface ResultadoPlanillasGei {
  asistenciasActualizadas: number;
  calificacionesActualizadas: number;
  /** Alumnos de las planillas de notas que no se pudieron cruzar por nombre con la matrícula. */
  sinCruzar: { curso: string; materia: string; nombre: string }[];
  errores: string[];
  duracionMs: number;
}

/**
 * Importa las planillas por división que descarga el scraper: asistencia anual (sumando meses
 * cerrados) por DNI y notas por espacio curricular, cruzadas por nombre dentro de la división.
 * Requiere que la matrícula ya esté importada.
 */
export async function importarPlanillasGei(
  planillas: PlanillasGei,
  opciones: { usuarioId: string; cicloLectivo?: number; ipAddress?: string | null },
): Promise<ResultadoPlanillasGei> {
  const inicio = Date.now();
  const ciclo = opciones.cicloLectivo ?? new Date().getFullYear();
  const resultado: ResultadoPlanillasGei = {
    asistenciasActualizadas: 0,
    calificacionesActualizadas: 0,
    sinCruzar: [],
    errores: [],
    duracionMs: 0,
  };

  // --- Asistencia anual ----------------------------------------------------
  const meses = planillas.asistencias.flatMap((a) => {
    try {
      return [analizarAsistenciaMensual(a.datos, a.nombre)];
    } catch (error) {
      resultado.errores.push((error as Error).message);
      return [];
    }
  });
  for (const lote of enLotes(consolidarAsistencia(meses), TAMANO_LOTE)) {
    const actualizaciones = await prisma.$transaction(
      lote.map((a) =>
        prisma.estudiante.updateMany({ where: { dni: a.dni }, data: { porcentajeAsistencia: a.porcentajeAsistencia } }),
      ),
    );
    resultado.asistenciasActualizadas += actualizaciones.filter((r) => r.count > 0).length;
  }

  // --- Notas: cruce por nombre dentro de la división -----------------------
  const planillasNotas = planillas.evaluaciones.flatMap((p) => {
    try {
      return [analizarPlanillaEvaluaciones(p.datos, p.nombre)];
    } catch (error) {
      resultado.errores.push((error as Error).message);
      return [];
    }
  });
  const alumnos = await prisma.estudiante.findMany({
    where: { estadoMatricula: "REGULAR" },
    select: { id: true, apellidos: true, nombres: true, anio: true, division: true },
  });
  const idPorCursoYNombre = new Map(
    alumnos.map((e) => [`${e.anio}-${e.division}|${claveNombre(`${e.apellidos} ${e.nombres}`)}`, e.id]),
  );

  const calificaciones = planillasNotas.flatMap((planilla) =>
    planilla.notas.flatMap((n) => {
      const estudianteId = idPorCursoYNombre.get(`${planilla.anio}-${planilla.division}|${claveNombre(n.nombre)}`);
      if (!estudianteId) {
        resultado.sinCruzar.push({ curso: `${planilla.anio}° ${planilla.division}ª`, materia: planilla.materia, nombre: n.nombre });
        return [];
      }
      // Sin ninguna nota cargada todavía no se crea el registro.
      if (n.primerPeriodo === null && n.segundoPeriodo === null && n.notaFinal === null) return [];
      return [
        {
          estudianteId,
          dni: "",
          materia: planilla.materia,
          cicloLectivo: ciclo,
          primerCuatrimestre: n.primerPeriodo,
          segundoCuatrimestre: n.segundoPeriodo,
          notaFinal: n.notaFinal,
          previa: false,
        },
      ];
    }),
  );
  resultado.calificacionesActualizadas = await guardarCalificaciones(calificaciones, ciclo);

  await registrarAuditoria(opciones.usuarioId, null, "IMPORTAR_GEI", opciones.ipAddress ?? null);
  resultado.duracionMs = Date.now() - inicio;
  return resultado;
}

/**
 * Importa un archivo del GEI: upsert masivo por DNI, actualización de asistencia y notas,
 * recálculo de promedios, creación / movimiento de carpetas en Drive y registro en auditoría.
 */
export async function importarArchivoGei(
  datos: ArrayBuffer | Uint8Array,
  opciones: OpcionesImportacionGei,
): Promise<ResultadoImportacionGei> {
  const inicio = Date.now();
  const ciclo = opciones.cicloLectivo ?? new Date().getFullYear();
  const analisis = analizarLibroGei(datos, ciclo);
  const advertencias: string[] = [];
  const errores = [...analisis.errores];

  const resultado: ResultadoImportacionGei = {
    archivo: opciones.nombreArchivo ?? "reporte-gei",
    hojas: analisis.hojas,
    estudiantesCreados: 0,
    estudiantesActualizados: 0,
    asistenciasActualizadas: 0,
    calificacionesActualizadas: 0,
    carpetasDriveCreadas: 0,
    carpetasDriveMovidas: 0,
    errores,
    advertencias,
    duracionMs: 0,
  };

  if (analisis.hojas.every((h) => h.tipo === "DESCONOCIDO")) {
    advertencias.push("No se reconoció ninguna hoja del GEI: verifique que el archivo tenga una columna DNI.");
  }

  // --- 1. Matrícula: upsert masivo por DNI ---------------------------------
  const matricula = deduplicarPorDni(analisis.matricula).filter(
    (m) => !opciones.anios || opciones.anios.includes(m.anio),
  );
  const promociones = new Set<string>();

  for (const lote of enLotes(matricula, TAMANO_LOTE)) {
    const existentes = await prisma.estudiante.findMany({
      where: { dni: { in: lote.map((m) => m.dni) } },
      select: { dni: true, anio: true, division: true, driveFolderId: true },
    });
    const porDni = new Map(existentes.map((e) => [e.dni, e]));

    await prisma.$transaction(
      lote.map((m) => {
        const datosEstudiante = {
          cuil: m.cuil,
          apellidos: m.apellidos,
          nombres: m.nombres,
          fechaNacimiento: m.fechaNacimiento,
          anio: m.anio,
          division: m.division,
          turno: m.turno,
          estadoMatricula: m.estadoMatricula,
          // undefined (columna ausente en el reporte) => Prisma no toca el valor guardado.
          genero: m.genero,
          direccion: m.direccion,
          localidad: m.localidad,
          familiares: m.familiares,
          telefonosFamiliares: m.telefonosFamiliares,
          emailsFamiliares: m.emailsFamiliares,
          emailContacto: m.emailContacto,
        };
        return prisma.estudiante.upsert({
          where: { dni: m.dni },
          create: { dni: m.dni, ...datosEstudiante },
          update: datosEstudiante,
        });
      }),
    );

    for (const m of lote) {
      const previo = porDni.get(m.dni);
      if (!previo) {
        resultado.estudiantesCreados++;
        continue;
      }
      resultado.estudiantesActualizados++;
      if (previo.driveFolderId && (previo.anio !== m.anio || previo.division !== m.division)) {
        promociones.add(m.dni);
      }
    }
  }

  // --- 2. Asistencia -------------------------------------------------------
  const asistencias = deduplicarPorDni(analisis.asistencias);
  for (const lote of enLotes(asistencias, TAMANO_LOTE)) {
    const actualizaciones = await prisma.$transaction(
      lote.map((a) =>
        prisma.estudiante.updateMany({ where: { dni: a.dni }, data: { porcentajeAsistencia: a.porcentajeAsistencia } }),
      ),
    );
    actualizaciones.forEach((r, i) => {
      if (r.count > 0) resultado.asistenciasActualizadas++;
      else errores.push({ hoja: "Asistencia", fila: 0, motivo: `DNI ${lote[i]?.dni} no está matriculado` });
    });
  }

  // --- 3. Calificaciones ---------------------------------------------------
  const dniConNotas = [...new Set(analisis.calificaciones.map((c) => c.dni))];
  const idsPorDni = new Map<string, string>();
  for (const lote of enLotes(dniConNotas, 500)) {
    const encontrados = await prisma.estudiante.findMany({ where: { dni: { in: lote } }, select: { id: true, dni: true } });
    encontrados.forEach((e) => idsPorDni.set(e.dni, e.id));
  }
  dniConNotas
    .filter((dni) => !idsPorDni.has(dni))
    .forEach((dni) => errores.push({ hoja: "Notas", fila: 0, motivo: `DNI ${dni} no está matriculado` }));

  const calificacionesValidas = analisis.calificaciones.flatMap((c) => {
    const estudianteId = idsPorDni.get(c.dni);
    return estudianteId ? [{ ...c, estudianteId }] : [];
  });
  resultado.calificacionesActualizadas += await guardarCalificaciones(calificacionesValidas, ciclo);

  // --- 4. Google Drive -----------------------------------------------------
  const sincronizar = opciones.sincronizarDrive ?? true;
  if (sincronizar && !driveConfigurado()) {
    advertencias.push("Google Drive no está configurado: se omitió la creación de carpetas.");
  } else if (sincronizar) {
    const guardarCarpetas = (dni: string, carpetas: CarpetasEstudiante) =>
      prisma.estudiante.update({ where: { dni }, data: carpetas });

    const aMover = await prisma.estudiante.findMany({
      where: { dni: { in: [...promociones] } },
      select: { dni: true, apellidos: true, nombres: true, anio: true, division: true, driveFolderId: true },
    });
    await conConcurrencia(aMover, CONCURRENCIA_DRIVE, async (e) => {
      try {
        await guardarCarpetas(e.dni, await moverCarpetaPorPromocion(e, e.anio, e.division));
        resultado.carpetasDriveMovidas++;
      } catch (error) {
        advertencias.push(`Drive: no se pudo mover la carpeta de DNI ${e.dni}: ${(error as Error).message}`);
      }
    });

    const sinCarpeta = await prisma.estudiante.findMany({
      where: { driveFolderId: null, estadoMatricula: "REGULAR" },
      select: { dni: true, apellidos: true, nombres: true, anio: true, division: true, driveFolderId: true },
    });
    await conConcurrencia(sinCarpeta, CONCURRENCIA_DRIVE, async (e) => {
      try {
        await guardarCarpetas(e.dni, await sincronizarEstructuraDrive(e));
        resultado.carpetasDriveCreadas++;
      } catch (error) {
        advertencias.push(`Drive: no se pudo crear la carpeta de DNI ${e.dni}: ${(error as Error).message}`);
      }
    });
  }

  // --- 5. Auditoría --------------------------------------------------------
  await registrarAuditoria(opciones.usuarioId, null, "IMPORTAR_GEI", opciones.ipAddress ?? null);

  resultado.duracionMs = Date.now() - inicio;
  return resultado;
}
