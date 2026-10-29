/**
 * Tipos de dominio compartidos entre servidor y cliente.
 * Los valores de los enums coinciden exactamente con los de prisma/schema.prisma,
 * pero se declaran aquí para que el bundle del navegador no dependa de @prisma/client.
 */

export const ROLES = ["DIRECTIVO_SOE", "PRECEPTOR", "DOCENTE"] as const;
export type Rol = (typeof ROLES)[number];

export const ROL_ETIQUETA: Record<Rol, string> = {
  DIRECTIVO_SOE: "Nivel 3 · Directivo / SOE",
  PRECEPTOR: "Nivel 2 · Preceptor",
  DOCENTE: "Nivel 1 · Docente",
};

export const TIPOS_INCIDENTE = ["LEVE", "MODERADA", "GRAVE", "ACUERDO_PEDAGOGICO"] as const;
export type TipoIncidente = (typeof TIPOS_INCIDENTE)[number];

export const ESTADOS_MATRICULA = ["REGULAR", "PASE", "EGRESADO"] as const;
export type EstadoMatricula = (typeof ESTADOS_MATRICULA)[number];

export const ACCIONES_AUDITORIA = [
  "VER_LEGAJO",
  "VER_CUD_SOE",
  "CARGAR_ACTA",
  "IMPORTAR_GEI",
  "CARGAR_INTERVENCION",
  "EDITAR_CONFIDENCIAL",
  "GENERAR_INFORME",
] as const;
export type AccionAuditoria = (typeof ACCIONES_AUDITORIA)[number];

export const TIPOS_INTERVENCION = [
  "ENTREVISTA_ESTUDIANTE",
  "ENTREVISTA_FAMILIA",
  "REUNION_DOCENTES",
  "OBSERVACION_AULICA",
  "DERIVACION_EXTERNA",
  "OTRA",
] as const;
export type TipoIntervencion = (typeof TIPOS_INTERVENCION)[number];

export const TIPO_INTERVENCION_ETIQUETA: Record<TipoIntervencion, string> = {
  ENTREVISTA_ESTUDIANTE: "Entrevista con el estudiante",
  ENTREVISTA_FAMILIA: "Entrevista con la familia",
  REUNION_DOCENTES: "Reunión con docentes",
  OBSERVACION_AULICA: "Observación áulica",
  DERIVACION_EXTERNA: "Derivación externa",
  OTRA: "Otra intervención",
};

/** Fechas: Date en el servidor (Prisma), string ISO en el cliente / JSON. */
export type Fecha = Date | string;

// ---------------------------------------------------------------------------
// Fuentes completas (lo que existe en la base). NUNCA se envían tal cual al cliente.
// ---------------------------------------------------------------------------

export interface EstudianteFuente {
  id: string;
  dni: string;
  cuil: string | null;
  apellidos: string;
  nombres: string;
  fechaNacimiento: Fecha | null;
  genero: string | null;
  anio: number;
  division: string;
  turno: string;
  promedioGeneral: number;
  porcentajeAsistencia: number;
  puntosConvivencia: number;
  direccion: string | null;
  localidad: string | null;
  familiares: string | null;
  telefonosFamiliares: string | null;
  emailsFamiliares: string | null;
  emailContacto: string | null;
  tieneCud: boolean;
  vencimientoCud: Fecha | null;
  requierePpi: boolean;
  diagnosticoReservado: string | null;
  cudUrl: string | null;
  observacionesConfidenciales: string | null;
  driveFolderId: string | null;
  driveDocumentacionFolderId: string | null;
  driveConvivenciaFolderId: string | null;
  driveConfidencialFolderId: string | null;
  estadoMatricula: EstadoMatricula;
  updatedAt: Fecha;
}

export interface CalificacionFuente {
  id: string;
  materia: string;
  cicloLectivo: number;
  primerCuatrimestre: number | null;
  segundoCuatrimestre: number | null;
  notaFinal: number | null;
  previa: boolean;
}

export interface IncidenteFuente {
  id: string;
  fecha: Fecha;
  tipo: TipoIncidente;
  puntosDescontados: number;
  motivo: string;
  descargoAlumno: string | null;
  medidaAdoptada: string | null;
  notificadoFamilia: boolean;
  actaDriveUrl: string | null;
  aprobado: boolean;
  anulado: boolean;
  autor: { nombre: string };
}

export interface IntervencionFuente {
  id: string;
  fecha: Fecha;
  /** String libre en la base; se normaliza a TipoIntervencion al sanitizar. */
  tipo: string;
  participantes: string | null;
  proximoSeguimiento: Fecha | null;
  motivo: string;
  informeConfidencial: string;
  acuerdosDocentes: string;
  archivoDriveUrl: string | null;
  profesional: { nombre: string };
}

export interface TrayectoriaFuente {
  id: string;
  cicloLectivo: number;
  condicion: string | null;
  escuela: string;
  division: string | null;
  fechaIngreso: Fecha | null;
  motivoIngreso: string | null;
  fechaEgreso: Fecha | null;
  motivoEgreso: string | null;
  activo: boolean;
  inasistencias: number | null;
}

export interface AlertaTempranaFuente {
  id: string;
  fecha: Fecha | null;
  escuela: string | null;
  causas: string;
  planIntervencion: string | null;
  observaciones: string | null;
}

export interface FaltaIceFuente {
  id: string;
  cicloLectivo: number;
  fecha: Fecha | null;
  puntos: number;
  tipo: string;
  dadaDeBaja: boolean;
  fechaBaja: Fecha | null;
}

export interface AsistenciaMensualFuente {
  id: string;
  cicloLectivo: number;
  periodo: string;
  orden: number;
  mes: string;
  justificadas: number | null;
  injustificadas: number | null;
  totalInasistencias: number | null;
  diasAsistidos: number | null;
  porcentaje: number | null;
  cerrado: boolean;
}

export interface LegajoFuente extends EstudianteFuente {
  calificaciones: CalificacionFuente[];
  incidentes: IncidenteFuente[];
  intervenciones: IntervencionFuente[];
  trayectoria: TrayectoriaFuente[];
  alertas: AlertaTempranaFuente[];
  faltasIce: FaltaIceFuente[];
  asistencias: AsistenciaMensualFuente[];
}

// ---------------------------------------------------------------------------
// Vistas sanitizadas (lo único que puede salir hacia el cliente).
// ---------------------------------------------------------------------------

export interface EstudianteResumen {
  id: string;
  dni: string;
  apellidos: string;
  nombres: string;
  anio: number;
  division: string;
  turno: string;
  promedioGeneral: number;
  porcentajeAsistencia: number;
  tieneCud: boolean;
  requierePpi: boolean;
  estadoMatricula: EstadoMatricula;
  /** null cuando el rol no tiene acceso al régimen de convivencia (DOCENTE). */
  puntosConvivencia: number | null;
  materiasPrevias: number;
}

export interface CalificacionVisible {
  id: string;
  materia: string;
  cicloLectivo: number;
  primerCuatrimestre: number | null;
  segundoCuatrimestre: number | null;
  notaFinal: number | null;
  previa: boolean;
}

export interface IncidenteVisible {
  id: string;
  fecha: string;
  tipo: TipoIncidente;
  puntosDescontados: number;
  motivo: string;
  descargoAlumno: string | null;
  medidaAdoptada: string | null;
  notificadoFamilia: boolean;
  actaDriveUrl: string | null;
  aprobado: boolean;
  anulado: boolean;
  autorNombre: string;
}

export interface FaltaIceVisible {
  id: string;
  cicloLectivo: number;
  fecha: string | null;
  puntos: number;
  tipo: string;
  dadaDeBaja: boolean;
  fechaBaja: string | null;
}

export interface AsistenciaMensualVisible {
  id: string;
  cicloLectivo: number;
  periodo: string;
  mes: string;
  justificadas: number | null;
  injustificadas: number | null;
  totalInasistencias: number | null;
  diasAsistidos: number | null;
  porcentaje: number | null;
  cerrado: boolean;
}

export interface TrayectoriaVisible {
  id: string;
  cicloLectivo: number;
  condicion: string | null;
  escuela: string;
  division: string | null;
  fechaIngreso: string | null;
  motivoIngreso: string | null;
  fechaEgreso: string | null;
  motivoEgreso: string | null;
  activo: boolean;
  inasistencias: number | null;
}

export interface AlertaTempranaVisible {
  id: string;
  fecha: string | null;
  escuela: string | null;
  causas: string;
  planIntervencion: string | null;
  observaciones: string | null;
}

export interface AcuerdoDocenteVisible {
  id: string;
  fecha: string;
  acuerdosDocentes: string;
}

export interface IntervencionVisible {
  id: string;
  fecha: string;
  tipo: TipoIntervencion;
  participantes: string | null;
  proximoSeguimiento: string | null;
  motivo: string;
  informeConfidencial: string;
  acuerdosDocentes: string;
  archivoDriveUrl: string | null;
  profesionalNombre: string;
}

export interface LegajoVisible {
  rolConsulta: Rol;
  estudiante: {
    id: string;
    dni: string;
    cuil: string | null;
    apellidos: string;
    nombres: string;
    fechaNacimiento: string | null;
    genero: string | null;
    anio: number;
    division: string;
    turno: string;
    promedioGeneral: number;
    porcentajeAsistencia: number;
    tieneCud: boolean;
    requierePpi: boolean;
    estadoMatricula: EstadoMatricula;
    updatedAt: string;
  };
  calificaciones: CalificacionVisible[];
  /** Datos de contacto familiar. null para DOCENTE. */
  contacto: {
    direccion: string | null;
    localidad: string | null;
    familiares: string | null;
    telefonosFamiliares: string | null;
    emailsFamiliares: string | null;
    emailContacto: string | null;
  } | null;
  /** Trayectoria escolar y alertas tempranas del GEI. null para DOCENTE. */
  trayectoria: { ciclos: TrayectoriaVisible[]; alertas: AlertaTempranaVisible[] } | null;
  /** Resumen mensual de asistencia del GEI PAD, en orden. Visible para todos los roles. */
  asistenciaMensual: AsistenciaMensualVisible[];
  /** null para DOCENTE (sin acceso al régimen de convivencia). `puntos` es el saldo ICE del GEI. */
  convivencia: { puntos: number; faltasIce: FaltaIceVisible[]; incidentes: IncidenteVisible[] } | null;
  /** Acuerdos pedagógicos del SOE, redactados sin datos clínicos. Visibles para todos los roles. */
  acuerdosSoe: AcuerdoDocenteVisible[];
  /** null salvo para DIRECTIVO_SOE. */
  confidencial: {
    diagnosticoReservado: string | null;
    cudUrl: string | null;
    vencimientoCud: string | null;
    observacionesConfidenciales: string | null;
    intervenciones: IntervencionVisible[];
  } | null;
  drive: {
    carpetaAlumno: string | null;
    documentacion: string | null;
    convivencia: string | null;
    confidencial: string | null;
  };
}

export interface MetricasInstitucionales {
  matriculaTotal: number;
  conCudOPpi: number;
  /** null cuando el rol no tiene acceso a convivencia. */
  alertasConvivencia: number | null;
  riesgoPedagogico: number;
}

export interface FiltrosEstudiantes {
  q?: string;
  anio?: number;
  division?: string;
  alertaPuntos?: boolean;
  conCud?: boolean;
  promedioBajo?: boolean;
}

export interface UsuarioSesion {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
}

export interface RegistroAuditoriaVisible {
  id: string;
  usuarioNombre: string;
  usuarioRol: Rol;
  estudianteDni: string | null;
  accion: AccionAuditoria;
  ipAddress: string | null;
  createdAt: string;
}
