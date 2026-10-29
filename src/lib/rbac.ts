/**
 * Control de acceso basado en roles (RBAC) del LUE.
 *
 * Matriz de permisos institucional:
 * | Módulo                                    | Docente    | Preceptor          | Directivo / SOE                   |
 * |-------------------------------------------|------------|--------------------|-----------------------------------|
 * | Datos biográficos y curso                 | Lectura    | Lectura / Edición  | Control total                     |
 * | Contacto familiar (domicilio, tutores)    | Sin acceso | Lectura            | Control total                     |
 * | Trayectoria escolar y alertas tempranas   | Sin acceso | Lectura            | Control total                     |
 * | Calificaciones, promedios y asistencias   | Lectura    | Lectura            | Control total                     |
 * | Indicador CUD / PPI                       | Solo Sí/No | Solo Sí/No         | Diagnóstico y PDF                 |
 * | Régimen de convivencia                    | Sin acceso | Carga y lectura    | Aprobación, quita de puntos, baja |
 * | Informes SOE y carpeta Drive confidencial | Sin acceso | Sin acceso         | Control total                     |
 * | Informes institucionales y exportación    | Sin acceso | Generación         | Generación (incluye SOE)          |
 * | Logs de auditoría y sincronización GEI    | Sin acceso | Sin acceso         | Control total                     |
 *
 * Este módulo es puro (sin dependencias de servidor) para que el modo demostración del
 * dashboard aplique exactamente la misma sanitización que la API.
 *
 * Principio aplicado: lista blanca. Las vistas se construyen campo por campo; nunca se
 * "borra" un campo sensible de un objeto completo, para que un campo nuevo en el esquema
 * no se filtre por accidente.
 */

import {
  TIPOS_INTERVENCION,
  type EstudianteFuente,
  type EstudianteResumen,
  type Fecha,
  type LegajoFuente,
  type LegajoVisible,
  type Rol,
  type TipoIntervencion,
} from "./types";

export const PERMISOS = {
  EDITAR_DATOS_BIOGRAFICOS: ["DIRECTIVO_SOE", "PRECEPTOR"],
  VER_DATOS_CONTACTO: ["DIRECTIVO_SOE", "PRECEPTOR"],
  VER_TRAYECTORIA: ["DIRECTIVO_SOE", "PRECEPTOR"],
  EDITAR_CALIFICACIONES: ["DIRECTIVO_SOE"],
  VER_CONVIVENCIA: ["DIRECTIVO_SOE", "PRECEPTOR"],
  CARGAR_INCIDENTE: ["DIRECTIVO_SOE", "PRECEPTOR"],
  APROBAR_INCIDENTE: ["DIRECTIVO_SOE"],
  VER_DATOS_CONFIDENCIALES: ["DIRECTIVO_SOE"],
  EDITAR_DATOS_CONFIDENCIALES: ["DIRECTIVO_SOE"],
  CARGAR_INTERVENCION_SOE: ["DIRECTIVO_SOE"],
  GENERAR_INFORMES: ["DIRECTIVO_SOE", "PRECEPTOR"],
  VER_AUDITORIA: ["DIRECTIVO_SOE"],
  IMPORTAR_GEI: ["DIRECTIVO_SOE"],
} as const satisfies Record<string, readonly Rol[]>;

export type Permiso = keyof typeof PERMISOS;

export function tienePermiso(rol: Rol, permiso: Permiso): boolean {
  return (PERMISOS[permiso] as readonly Rol[]).includes(rol);
}

export class AccesoDenegadoError extends Error {
  constructor(public readonly permiso: Permiso) {
    super(`Acceso denegado: el rol no posee el permiso ${permiso}`);
    this.name = "AccesoDenegadoError";
  }
}

export function exigirPermiso(rol: Rol, permiso: Permiso): void {
  if (!tienePermiso(rol, permiso)) {
    throw new AccesoDenegadoError(permiso);
  }
}

export const UMBRAL_ALERTA_PUNTOS = 10;
export const UMBRAL_PROMEDIO_BAJO = 6;
export const UMBRAL_ASISTENCIA_RIESGO = 85;

export function enRiesgoPedagogico(e: { promedioGeneral: number; porcentajeAsistencia: number }): boolean {
  return e.promedioGeneral < UMBRAL_PROMEDIO_BAJO || e.porcentajeAsistencia < UMBRAL_ASISTENCIA_RIESGO;
}

export function urlCarpetaDrive(folderId: string | null): string | null {
  return folderId ? `https://drive.google.com/drive/folders/${encodeURIComponent(folderId)}` : null;
}

export function normalizarTipoIntervencion(tipo: string): TipoIntervencion {
  return (TIPOS_INTERVENCION as readonly string[]).includes(tipo) ? (tipo as TipoIntervencion) : "OTRA";
}

function iso(fecha: Fecha): string {
  return typeof fecha === "string" ? fecha : fecha.toISOString();
}

function isoONull(fecha: Fecha | null): string | null {
  return fecha === null ? null : iso(fecha);
}

/** Fila del listado institucional, sanitizada para el rol. */
export function resumirEstudiante(
  e: EstudianteFuente & { materiasPrevias: number },
  rol: Rol,
): EstudianteResumen {
  return {
    id: e.id,
    dni: e.dni,
    apellidos: e.apellidos,
    nombres: e.nombres,
    anio: e.anio,
    division: e.division,
    turno: e.turno,
    promedioGeneral: e.promedioGeneral,
    porcentajeAsistencia: e.porcentajeAsistencia,
    tieneCud: e.tieneCud,
    requierePpi: e.requierePpi,
    estadoMatricula: e.estadoMatricula,
    puntosConvivencia: tienePermiso(rol, "VER_CONVIVENCIA") ? e.puntosConvivencia : null,
    materiasPrevias: e.materiasPrevias,
  };
}

/** Legajo unificado sanitizado según el rol de quien consulta. */
export function sanitizarLegajo(legajo: LegajoFuente, rol: Rol): LegajoVisible {
  const verConvivencia = tienePermiso(rol, "VER_CONVIVENCIA");
  const verConfidencial = tienePermiso(rol, "VER_DATOS_CONFIDENCIALES");
  const verContacto = tienePermiso(rol, "VER_DATOS_CONTACTO");
  const verTrayectoria = tienePermiso(rol, "VER_TRAYECTORIA");

  const intervencionesOrdenadas = [...legajo.intervenciones].sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
  );
  const incidentesOrdenados = [...legajo.incidentes].sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
  );

  return {
    rolConsulta: rol,
    estudiante: {
      id: legajo.id,
      dni: legajo.dni,
      cuil: legajo.cuil,
      apellidos: legajo.apellidos,
      nombres: legajo.nombres,
      fechaNacimiento: isoONull(legajo.fechaNacimiento),
      genero: legajo.genero,
      anio: legajo.anio,
      division: legajo.division,
      turno: legajo.turno,
      promedioGeneral: legajo.promedioGeneral,
      porcentajeAsistencia: legajo.porcentajeAsistencia,
      tieneCud: legajo.tieneCud,
      requierePpi: legajo.requierePpi,
      estadoMatricula: legajo.estadoMatricula,
      updatedAt: iso(legajo.updatedAt),
    },
    calificaciones: legajo.calificaciones
      .map((c) => ({
        id: c.id,
        materia: c.materia,
        cicloLectivo: c.cicloLectivo,
        primerCuatrimestre: c.primerCuatrimestre,
        segundoCuatrimestre: c.segundoCuatrimestre,
        notaFinal: c.notaFinal,
        previa: c.previa,
      }))
      .sort((a, b) => b.cicloLectivo - a.cicloLectivo || a.materia.localeCompare(b.materia, "es")),
    contacto: verContacto
      ? {
          direccion: legajo.direccion,
          localidad: legajo.localidad,
          familiares: legajo.familiares,
          telefonosFamiliares: legajo.telefonosFamiliares,
          emailsFamiliares: legajo.emailsFamiliares,
          emailContacto: legajo.emailContacto,
        }
      : null,
    trayectoria: verTrayectoria
      ? {
          ciclos: legajo.trayectoria
            .map((t) => ({
              id: t.id,
              cicloLectivo: t.cicloLectivo,
              condicion: t.condicion,
              escuela: t.escuela,
              division: t.division,
              fechaIngreso: isoONull(t.fechaIngreso),
              motivoIngreso: t.motivoIngreso,
              fechaEgreso: isoONull(t.fechaEgreso),
              motivoEgreso: t.motivoEgreso,
              activo: t.activo,
              inasistencias: t.inasistencias,
            }))
            .sort(
              (a, b) =>
                b.cicloLectivo - a.cicloLectivo ||
                new Date(b.fechaIngreso ?? 0).getTime() - new Date(a.fechaIngreso ?? 0).getTime(),
            ),
          alertas: legajo.alertas
            .map((a) => ({
              id: a.id,
              fecha: isoONull(a.fecha),
              escuela: a.escuela,
              causas: a.causas,
              planIntervencion: a.planIntervencion,
              observaciones: a.observaciones,
            }))
            .sort((a, b) => new Date(b.fecha ?? 0).getTime() - new Date(a.fecha ?? 0).getTime()),
        }
      : null,
    asistenciaMensual: [...legajo.asistencias]
      .sort((a, b) => b.cicloLectivo - a.cicloLectivo || a.orden - b.orden)
      .map((m) => ({
        id: m.id,
        cicloLectivo: m.cicloLectivo,
        periodo: m.periodo,
        mes: m.mes,
        justificadas: m.justificadas,
        injustificadas: m.injustificadas,
        totalInasistencias: m.totalInasistencias,
        diasAsistidos: m.diasAsistidos,
        porcentaje: m.porcentaje,
        cerrado: m.cerrado,
      })),
    convivencia: verConvivencia
      ? {
          puntos: legajo.puntosConvivencia,
          faltasIce: [...legajo.faltasIce]
            .sort((a, b) => new Date(b.fecha ?? 0).getTime() - new Date(a.fecha ?? 0).getTime())
            .map((f) => ({
              id: f.id,
              cicloLectivo: f.cicloLectivo,
              fecha: isoONull(f.fecha),
              puntos: f.puntos,
              tipo: f.tipo,
              dadaDeBaja: f.dadaDeBaja,
              fechaBaja: isoONull(f.fechaBaja),
            })),
          incidentes: incidentesOrdenados.map((i) => ({
            id: i.id,
            fecha: iso(i.fecha),
            tipo: i.tipo,
            puntosDescontados: i.puntosDescontados,
            motivo: i.motivo,
            descargoAlumno: i.descargoAlumno,
            medidaAdoptada: i.medidaAdoptada,
            notificadoFamilia: i.notificadoFamilia,
            actaDriveUrl: i.actaDriveUrl,
            aprobado: i.aprobado,
            anulado: i.anulado,
            autorNombre: i.autor.nombre,
          })),
        }
      : null,
    acuerdosSoe: intervencionesOrdenadas
      .filter((i) => i.acuerdosDocentes.trim().length > 0)
      .map((i) => ({ id: i.id, fecha: iso(i.fecha), acuerdosDocentes: i.acuerdosDocentes })),
    confidencial: verConfidencial
      ? {
          diagnosticoReservado: legajo.diagnosticoReservado,
          cudUrl: legajo.cudUrl,
          vencimientoCud: isoONull(legajo.vencimientoCud),
          observacionesConfidenciales: legajo.observacionesConfidenciales,
          intervenciones: intervencionesOrdenadas.map((i) => ({
            id: i.id,
            fecha: iso(i.fecha),
            tipo: normalizarTipoIntervencion(i.tipo),
            participantes: i.participantes,
            proximoSeguimiento: isoONull(i.proximoSeguimiento),
            motivo: i.motivo,
            informeConfidencial: i.informeConfidencial,
            acuerdosDocentes: i.acuerdosDocentes,
            archivoDriveUrl: i.archivoDriveUrl,
            profesionalNombre: i.profesional.nombre,
          })),
        }
      : null,
    drive: {
      carpetaAlumno: verConfidencial ? urlCarpetaDrive(legajo.driveFolderId) : null,
      documentacion: rol === "DOCENTE" ? null : urlCarpetaDrive(legajo.driveDocumentacionFolderId),
      convivencia: verConvivencia ? urlCarpetaDrive(legajo.driveConvivenciaFolderId) : null,
      confidencial: verConfidencial ? urlCarpetaDrive(legajo.driveConfidencialFolderId) : null,
    },
  };
}

/** Indica si una consulta expuso datos de salud / SOE (para registrar VER_CUD_SOE en auditoría). */
export function expusoDatosConfidenciales(legajo: LegajoFuente, rol: Rol): boolean {
  if (!tienePermiso(rol, "VER_DATOS_CONFIDENCIALES")) return false;
  return (
    legajo.tieneCud ||
    legajo.diagnosticoReservado !== null ||
    legajo.cudUrl !== null ||
    legajo.observacionesConfidenciales !== null ||
    legajo.intervenciones.length > 0
  );
}
