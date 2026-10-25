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
  type ResultadoImportacionGei,
} from "./geiParser";
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
  const matricula = deduplicarPorDni(analisis.matricula);
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
  for (const lote of enLotes(calificacionesValidas, TAMANO_LOTE)) {
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
    resultado.calificacionesActualizadas += lote.length;
  }

  // Recalcular el promedio general del ciclo para los alumnos con notas nuevas.
  const idsAfectados = [...new Set(calificacionesValidas.map((c) => c.estudianteId))];
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
