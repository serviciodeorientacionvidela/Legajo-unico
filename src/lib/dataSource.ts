/**
 * Fuente de datos del dashboard.
 * - crearFuenteApi(): consume la API REST real (sesión por cookie, RBAC en el servidor).
 * - crearFuenteDemo(rol): opera en memoria sobre datos semilla, aplicando exactamente las mismas
 *   funciones de rbac.ts que usa la API, para mostrar en vivo qué recibe cada rol.
 */

import { PUNTOS_INICIALES, validarPuntos } from "./convivencia";
import { CICLO_DEMO, crearLegajosDemo, USUARIOS_DEMO } from "./demoData";
import {
  AccesoDenegadoError,
  enRiesgoPedagogico,
  exigirPermiso,
  expusoDatosConfidenciales,
  resumirEstudiante,
  sanitizarLegajo,
  tienePermiso,
  UMBRAL_ALERTA_PUNTOS,
  UMBRAL_PROMEDIO_BAJO,
  type Permiso,
} from "./rbac";
import type {
  AccionAuditoria,
  EstudianteResumen,
  FiltrosEstudiantes,
  LegajoFuente,
  LegajoVisible,
  MetricasInstitucionales,
  RegistroAuditoriaVisible,
  Rol,
  TipoIncidente,
} from "./types";
import type { ResultadoImportacionGei } from "@/services/geiParser";

export const POR_PAGINA = 50;

export interface ResultadoListado {
  estudiantes: EstudianteResumen[];
  total: number;
  metricas: MetricasInstitucionales;
}

export interface NuevoIncidente {
  dni: string;
  tipo: TipoIncidente;
  puntosDescontados: number;
  motivo: string;
  descargoAlumno: string | null;
  medidaAdoptada: string | null;
  notificadoFamilia: boolean;
  actaDriveUrl: string | null;
}

export interface ResultadoIncidente {
  incidenteId: string;
  aprobado: boolean;
  puntosDescontados: number;
  puntosConvivencia: number;
}

export interface FuenteDatosLegajo {
  listar(filtros: FiltrosEstudiantes, pagina: number): Promise<ResultadoListado>;
  obtenerLegajo(dni: string): Promise<LegajoVisible>;
  cargarIncidente(datos: NuevoIncidente): Promise<ResultadoIncidente>;
  resolverIncidente(incidenteId: string, accion: "APROBAR" | "ANULAR"): Promise<{ puntosConvivencia: number }>;
  obtenerAuditoria(): Promise<RegistroAuditoriaVisible[]>;
  importarGei(archivo: File): Promise<ResultadoImportacionGei>;
}

export class ErrorFuenteDatos extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ErrorFuenteDatos";
  }
}

// ===========================================================================
// API real
// ===========================================================================

async function solicitar<T>(url: string, init?: RequestInit): Promise<T> {
  const esJson = typeof init?.body === "string";
  const res = await fetch(url, {
    ...init,
    credentials: "same-origin",
    headers: esJson ? { "Content-Type": "application/json" } : undefined,
  });
  const cuerpo = (await res.json().catch(() => ({}))) as { error?: string; detalles?: { mensaje: string }[] };
  if (!res.ok) {
    const detalle = cuerpo.detalles?.map((d) => d.mensaje).join(" · ");
    throw new ErrorFuenteDatos(
      [cuerpo.error ?? `Error ${res.status}`, detalle].filter(Boolean).join(" "),
      res.status,
    );
  }
  return cuerpo as T;
}

export function crearFuenteApi(): FuenteDatosLegajo {
  return {
    listar(filtros, pagina) {
      const params = new URLSearchParams({ pagina: String(pagina), porPagina: String(POR_PAGINA) });
      if (filtros.q) params.set("q", filtros.q);
      if (filtros.anio !== undefined) params.set("anio", String(filtros.anio));
      if (filtros.division) params.set("division", filtros.division);
      if (filtros.alertaPuntos) params.set("alertaPuntos", "true");
      if (filtros.conCud) params.set("conCud", "true");
      if (filtros.promedioBajo) params.set("promedioBajo", "true");
      return solicitar<ResultadoListado>(`/api/estudiantes?${params.toString()}`);
    },
    obtenerLegajo(dni) {
      return solicitar<LegajoVisible>(`/api/estudiantes/${encodeURIComponent(dni)}`);
    },
    cargarIncidente(datos) {
      return solicitar<ResultadoIncidente>("/api/convivencia", { method: "POST", body: JSON.stringify(datos) });
    },
    resolverIncidente(incidenteId, accion) {
      return solicitar<{ puntosConvivencia: number }>("/api/convivencia", {
        method: "PATCH",
        body: JSON.stringify({ incidenteId, accion }),
      });
    },
    async obtenerAuditoria() {
      const { registros } = await solicitar<{ registros: RegistroAuditoriaVisible[] }>("/api/auditoria?limite=200");
      return registros;
    },
    importarGei(archivo) {
      const formulario = new FormData();
      formulario.set("archivo", archivo);
      return solicitar<ResultadoImportacionGei>("/api/gei/import", { method: "POST", body: formulario });
    },
  };
}

// ===========================================================================
// Modo demostración (memoria)
// ===========================================================================

const almacenDemo: { legajos: LegajoFuente[]; auditoria: RegistroAuditoriaVisible[] } = {
  legajos: crearLegajosDemo(),
  auditoria: [],
};

export function reiniciarDemo(): void {
  almacenDemo.legajos = crearLegajosDemo();
  almacenDemo.auditoria = [];
}

function sinTildes(valor: string): string {
  return valor.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function filtrarDemo(legajos: LegajoFuente[], filtros: FiltrosEstudiantes): LegajoFuente[] {
  const q = filtros.q?.trim();
  return legajos
    .filter((l) => {
      if (q) {
        if (/^\d+$/.test(q)) {
          if (!l.dni.startsWith(q)) return false;
        } else if (!sinTildes(`${l.apellidos} ${l.nombres}`).includes(sinTildes(q))) {
          return false;
        }
      }
      if (filtros.anio !== undefined && l.anio !== filtros.anio) return false;
      if (filtros.division && l.division !== filtros.division) return false;
      if (filtros.alertaPuntos && l.puntosConvivencia >= UMBRAL_ALERTA_PUNTOS) return false;
      if (filtros.conCud && !l.tieneCud) return false;
      if (filtros.promedioBajo && l.promedioGeneral >= UMBRAL_PROMEDIO_BAJO) return false;
      return true;
    })
    .sort((a, b) => a.apellidos.localeCompare(b.apellidos, "es") || a.nombres.localeCompare(b.nombres, "es"));
}

function metricasDemo(legajos: LegajoFuente[], rol: Rol): MetricasInstitucionales {
  const regulares = legajos.filter((l) => l.estadoMatricula === "REGULAR");
  return {
    matriculaTotal: regulares.length,
    conCudOPpi: regulares.filter((l) => l.tieneCud || l.requierePpi).length,
    alertasConvivencia: tienePermiso(rol, "VER_CONVIVENCIA")
      ? regulares.filter((l) => l.puntosConvivencia < UMBRAL_ALERTA_PUNTOS).length
      : null,
    riesgoPedagogico: regulares.filter(enRiesgoPedagogico).length,
  };
}

/** Simula la serialización JSON y la latencia de red de la API real. */
function respuesta<T>(valor: T): Promise<T> {
  return new Promise((resolver) => setTimeout(() => resolver(JSON.parse(JSON.stringify(valor)) as T), 150));
}

function verificar(rol: Rol, permiso: Permiso): void {
  try {
    exigirPermiso(rol, permiso);
  } catch (error) {
    if (error instanceof AccesoDenegadoError) {
      throw new ErrorFuenteDatos("No tiene permisos para realizar esta acción.", 403);
    }
    throw error;
  }
}

function nuevoId(prefijo: string): string {
  return `${prefijo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function crearFuenteDemo(rol: Rol): FuenteDatosLegajo {
  const usuario = USUARIOS_DEMO[rol];

  const auditar = (dni: string | null, accion: AccionAuditoria) => {
    almacenDemo.auditoria.unshift({
      id: nuevoId("audit"),
      usuarioNombre: usuario.nombre,
      usuarioRol: rol,
      estudianteDni: dni,
      accion,
      ipAddress: "127.0.0.1 (demo)",
      createdAt: new Date().toISOString(),
    });
  };

  const buscar = (dni: string): LegajoFuente => {
    const legajo = almacenDemo.legajos.find((l) => l.dni === dni);
    if (!legajo) throw new ErrorFuenteDatos("No existe un estudiante con ese DNI.", 404);
    return legajo;
  };

  return {
    async listar(filtros, pagina) {
      if (filtros.alertaPuntos) verificar(rol, "VER_CONVIVENCIA");
      const filtrados = filtrarDemo(almacenDemo.legajos, filtros);
      const pagina_ = filtrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
      return respuesta({
        estudiantes: pagina_.map((l) =>
          resumirEstudiante({ ...l, materiasPrevias: l.calificaciones.filter((c) => c.previa).length }, rol),
        ),
        total: filtrados.length,
        metricas: metricasDemo(almacenDemo.legajos, rol),
      });
    },

    async obtenerLegajo(dni) {
      const legajo = almacenDemo.legajos.find((l) => l.dni === dni);
      auditar(dni, "VER_LEGAJO");
      if (!legajo) throw new ErrorFuenteDatos("No existe un estudiante con ese DNI.", 404);
      if (expusoDatosConfidenciales(legajo, rol)) auditar(dni, "VER_CUD_SOE");
      return respuesta(sanitizarLegajo(legajo, rol));
    },

    async cargarIncidente(datos) {
      verificar(rol, "CARGAR_INCIDENTE");
      const errorPuntos = validarPuntos(datos.tipo, datos.puntosDescontados);
      if (errorPuntos) throw new ErrorFuenteDatos(errorPuntos, 400);
      if (datos.motivo.trim().length < 5) throw new ErrorFuenteDatos("Describa el motivo (mínimo 5 caracteres).", 400);

      const legajo = buscar(datos.dni);
      const aprobado = tienePermiso(rol, "APROBAR_INCIDENTE");
      // Como en la API: el saldo de puntos lo administra el GEI, el incidente no lo modifica.
      const puntos = datos.puntosDescontados;

      const id = nuevoId("inc");
      legajo.incidentes.push({
        id,
        fecha: new Date().toISOString(),
        tipo: datos.tipo,
        puntosDescontados: puntos,
        motivo: datos.motivo.trim(),
        descargoAlumno: datos.descargoAlumno,
        medidaAdoptada: datos.medidaAdoptada,
        notificadoFamilia: datos.notificadoFamilia,
        actaDriveUrl: datos.actaDriveUrl,
        aprobado,
        anulado: false,
        autor: { nombre: usuario.nombre },
      });
      legajo.updatedAt = new Date().toISOString();
      auditar(datos.dni, "CARGAR_ACTA");
      return respuesta({ incidenteId: id, aprobado, puntosDescontados: puntos, puntosConvivencia: legajo.puntosConvivencia });
    },

    async resolverIncidente(incidenteId, accion) {
      verificar(rol, "APROBAR_INCIDENTE");
      const legajo = almacenDemo.legajos.find((l) => l.incidentes.some((i) => i.id === incidenteId));
      const incidente = legajo?.incidentes.find((i) => i.id === incidenteId);
      if (!legajo || !incidente) throw new ErrorFuenteDatos("Incidente inexistente.", 404);
      if (incidente.anulado) throw new ErrorFuenteDatos("El incidente ya fue dado de baja.", 409);

      if (accion === "APROBAR") {
        if (incidente.aprobado) throw new ErrorFuenteDatos("El incidente ya estaba aprobado.", 409);
        incidente.aprobado = true;
      } else {
        incidente.anulado = true;
      }
      legajo.updatedAt = new Date().toISOString();
      auditar(legajo.dni, "CARGAR_ACTA");
      return respuesta({ puntosConvivencia: legajo.puntosConvivencia });
    },

    async obtenerAuditoria() {
      verificar(rol, "VER_AUDITORIA");
      return respuesta(almacenDemo.auditoria.slice(0, 200));
    },

    async importarGei(archivo) {
      verificar(rol, "IMPORTAR_GEI");
      const inicio = Date.now();
      // Carga diferida: el parser de Excel solo se descarga si se usa la importación.
      const { analizarLibroGei, calcularPromedio, deduplicarPorDni } = await import("@/services/geiParser");
      const analisis = analizarLibroGei(new Uint8Array(await archivo.arrayBuffer()), CICLO_DEMO);

      const resultado: ResultadoImportacionGei = {
        archivo: archivo.name,
        hojas: analisis.hojas,
        estudiantesCreados: 0,
        estudiantesActualizados: 0,
        asistenciasActualizadas: 0,
        calificacionesActualizadas: 0,
        carpetasDriveCreadas: 0,
        carpetasDriveMovidas: 0,
        errores: [...analisis.errores],
        advertencias: ["Modo demostración: los cambios se guardan solo en memoria y las carpetas de Drive son simuladas."],
        duracionMs: 0,
      };
      if (analisis.hojas.every((h) => h.tipo === "DESCONOCIDO")) {
        resultado.advertencias.push("No se reconoció ninguna hoja del GEI: verifique que el archivo tenga una columna DNI.");
      }

      const ahora = new Date().toISOString();
      for (const m of deduplicarPorDni(analisis.matricula)) {
        const existente = almacenDemo.legajos.find((l) => l.dni === m.dni);
        const datos = {
          cuil: m.cuil,
          apellidos: m.apellidos,
          nombres: m.nombres,
          fechaNacimiento: m.fechaNacimiento ? m.fechaNacimiento.toISOString() : null,
          anio: m.anio,
          division: m.division,
          turno: m.turno,
          estadoMatricula: m.estadoMatricula,
          updatedAt: ahora,
        };
        const contacto = {
          genero: m.genero,
          direccion: m.direccion,
          localidad: m.localidad,
          familiares: m.familiares,
          telefonosFamiliares: m.telefonosFamiliares,
          emailsFamiliares: m.emailsFamiliares,
          emailContacto: m.emailContacto,
        };
        // Igual que en el servidor: un campo ausente en el reporte no pisa lo ya cargado.
        const contactoPresente = Object.fromEntries(Object.entries(contacto).filter(([, v]) => v !== undefined));
        if (existente) {
          if (existente.anio !== m.anio || existente.division !== m.division) resultado.carpetasDriveMovidas++;
          Object.assign(existente, datos, contactoPresente);
          resultado.estudiantesActualizados++;
        } else {
          almacenDemo.legajos.push({
            id: `demo-${m.dni}`,
            dni: m.dni,
            ...datos,
            genero: contacto.genero ?? null,
            direccion: contacto.direccion ?? null,
            localidad: contacto.localidad ?? null,
            familiares: contacto.familiares ?? null,
            telefonosFamiliares: contacto.telefonosFamiliares ?? null,
            emailsFamiliares: contacto.emailsFamiliares ?? null,
            emailContacto: contacto.emailContacto ?? null,
            promedioGeneral: 0,
            porcentajeAsistencia: 100,
            puntosConvivencia: PUNTOS_INICIALES,
            tieneCud: false,
            vencimientoCud: null,
            requierePpi: false,
            diagnosticoReservado: null,
            cudUrl: null,
            observacionesConfidenciales: null,
            driveFolderId: `DEMO-${m.dni}`,
            driveDocumentacionFolderId: `DEMO-${m.dni}-01`,
            driveConvivenciaFolderId: `DEMO-${m.dni}-02`,
            driveConfidencialFolderId: `DEMO-${m.dni}-03`,
            calificaciones: [],
            incidentes: [],
            intervenciones: [],
            trayectoria: [],
            faltasIce: [],
            asistencias: [],
            alertas: [],
          });
          resultado.estudiantesCreados++;
          resultado.carpetasDriveCreadas++;
        }
      }

      for (const a of deduplicarPorDni(analisis.asistencias)) {
        const legajo = almacenDemo.legajos.find((l) => l.dni === a.dni);
        if (!legajo) {
          resultado.errores.push({ hoja: "Asistencia", fila: 0, motivo: `DNI ${a.dni} no está matriculado` });
          continue;
        }
        legajo.porcentajeAsistencia = a.porcentajeAsistencia;
        resultado.asistenciasActualizadas++;
      }

      const afectados = new Set<LegajoFuente>();
      for (const c of analisis.calificaciones) {
        const legajo = almacenDemo.legajos.find((l) => l.dni === c.dni);
        if (!legajo) {
          resultado.errores.push({ hoja: "Notas", fila: 0, motivo: `DNI ${c.dni} no está matriculado` });
          continue;
        }
        const notas = {
          primerCuatrimestre: c.primerCuatrimestre,
          segundoCuatrimestre: c.segundoCuatrimestre,
          notaFinal: c.notaFinal,
          previa: c.previa,
        };
        const existente = legajo.calificaciones.find((x) => x.materia === c.materia && x.cicloLectivo === c.cicloLectivo);
        if (existente) Object.assign(existente, notas);
        else legajo.calificaciones.push({ id: nuevoId("cal"), materia: c.materia, cicloLectivo: c.cicloLectivo, ...notas });
        afectados.add(legajo);
        resultado.calificacionesActualizadas++;
      }
      for (const legajo of afectados) {
        const promedio = calcularPromedio(legajo.calificaciones.filter((c) => c.cicloLectivo === CICLO_DEMO));
        if (promedio !== null) legajo.promedioGeneral = promedio;
      }

      auditar(null, "IMPORTAR_GEI");
      resultado.duracionMs = Date.now() - inicio;
      return respuesta(resultado);
    },
  };
}
