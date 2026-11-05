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

/** Cargo institucional del usuario. Define el nivel de acceso (rol) y la función en el seguimiento. */
export const CARGOS = [
  "DIRECTOR",
  "VICEDIRECTOR",
  "REGENTE",
  "ASESOR_PEDAGOGICO",
  "COORDINADOR_PEDAGOGICO",
  "COORDINADOR_PEDAGOGICO_1",
  "COORDINADOR_PEDAGOGICO_2",
  "COORDINADOR_PEDAGOGICO_3",
  "ORIENTADOR_SOCIAL",
  "ORIENTADOR_PSICOPEDAGOGICO",
  "JEFE_PRECEPTORES",
  "PRECEPTOR",
  "DOCENTE",
] as const;
export type Cargo = (typeof CARGOS)[number];

export const CARGO_ETIQUETA: Record<Cargo, string> = {
  DIRECTOR: "Director/a",
  VICEDIRECTOR: "Vicedirector/a",
  REGENTE: "Regente",
  ASESOR_PEDAGOGICO: "Asesor/a pedagógico/a",
  COORDINADOR_PEDAGOGICO: "Coordinador/a pedagógico/a",
  COORDINADOR_PEDAGOGICO_1: "Coordinador/a pedagógico/a 1.er año",
  COORDINADOR_PEDAGOGICO_2: "Coordinador/a pedagógico/a 2.º año",
  COORDINADOR_PEDAGOGICO_3: "Coordinador/a pedagógico/a 3.er año",
  ORIENTADOR_SOCIAL: "Orientador/a social",
  ORIENTADOR_PSICOPEDAGOGICO: "Orientador/a psicopedagógico/a",
  JEFE_PRECEPTORES: "Jefe/a de preceptores/as",
  PRECEPTOR: "Preceptor/a",
  DOCENTE: "Docente",
};

/** Todos los cargos de conducción y orientación tienen acceso Directivo / SOE; preceptores y docentes no. */
export const CARGO_ROL: Record<Cargo, Rol> = {
  DIRECTOR: "DIRECTIVO_SOE",
  VICEDIRECTOR: "DIRECTIVO_SOE",
  REGENTE: "DIRECTIVO_SOE",
  ASESOR_PEDAGOGICO: "DIRECTIVO_SOE",
  COORDINADOR_PEDAGOGICO: "DIRECTIVO_SOE",
  COORDINADOR_PEDAGOGICO_1: "DIRECTIVO_SOE",
  COORDINADOR_PEDAGOGICO_2: "DIRECTIVO_SOE",
  COORDINADOR_PEDAGOGICO_3: "DIRECTIVO_SOE",
  ORIENTADOR_SOCIAL: "DIRECTIVO_SOE",
  ORIENTADOR_PSICOPEDAGOGICO: "DIRECTIVO_SOE",
  JEFE_PRECEPTORES: "DIRECTIVO_SOE",
  PRECEPTOR: "PRECEPTOR",
  DOCENTE: "DOCENTE",
};

/** Función en el circuito de seguimiento que corresponde a cada cargo (null: sin circuito). */
export const CARGO_FUNCION: Record<Cargo, "DIRECCION" | "SOE" | "PRECEPTORIA" | null> = {
  DIRECTOR: "DIRECCION",
  VICEDIRECTOR: "DIRECCION",
  REGENTE: "DIRECCION",
  ASESOR_PEDAGOGICO: "SOE",
  COORDINADOR_PEDAGOGICO: "SOE",
  COORDINADOR_PEDAGOGICO_1: "SOE",
  COORDINADOR_PEDAGOGICO_2: "SOE",
  COORDINADOR_PEDAGOGICO_3: "SOE",
  ORIENTADOR_SOCIAL: "SOE",
  ORIENTADOR_PSICOPEDAGOGICO: "SOE",
  JEFE_PRECEPTORES: "SOE",
  PRECEPTOR: "PRECEPTORIA",
  DOCENTE: null,
};

/** Etiqueta del cargo, o del rol si el usuario todavía no tiene cargo asignado. */
export function etiquetaCargo(cargo: string | null | undefined, rol?: Rol): string {
  if (cargo && cargo in CARGO_ETIQUETA) return CARGO_ETIQUETA[cargo as Cargo];
  return rol ? ROL_ETIQUETA[rol] : "";
}

export const TIPOS_INCIDENTE = ["LEVE", "MODERADA", "GRAVE", "ACUERDO_PEDAGOGICO"] as const;
export type TipoIncidente = (typeof TIPOS_INCIDENTE)[number];

export const ESTADOS_MATRICULA = ["REGULAR", "PASE", "EGRESADO", "ABANDONO"] as const;
export type EstadoMatricula = (typeof ESTADOS_MATRICULA)[number];

export const ACCIONES_AUDITORIA = [
  "VER_LEGAJO",
  "VER_CUD_SOE",
  "CARGAR_ACTA",
  "IMPORTAR_GEI",
  "CARGAR_INTERVENCION",
  "EDITAR_CONFIDENCIAL",
  "GENERAR_INFORME",
  "GESTIONAR_USUARIO",
  "CARGAR_ACTUACION",
  "CARGAR_DERIVACION",
  "REGISTRAR_SEGUIMIENTO",
  "GESTIONAR_SITUACION",
  "VER_FICHA_ANEXA",
  "EDITAR_FICHA_ANEXA",
  "VER_REPORTE_RESTRINGIDO",
  "GESTIONAR_NORMATIVA",
] as const;
export type AccionAuditoria = (typeof ACCIONES_AUDITORIA)[number];

// ---------------------------------------------------------------------------
// Seguimiento de trayectorias: actuaciones, derivaciones, seguimientos, situaciones y fichas anexas.
// ---------------------------------------------------------------------------

export const TIPOS_ACTUACION = [
  "INASISTENCIAS",
  "CONVIVENCIA_ICE",
  "FAMILIA",
  "SALUD",
  "PROTOCOLO",
  "ESCOLARIDAD_PROTEGIDA",
  "DEPORTISTA_FEDERADO",
  "INCLUSION_PPI",
  "GENERO",
  "ESCUELA_DOMICILIARIA",
  "OTRA",
] as const;
export type TipoActuacion = (typeof TIPOS_ACTUACION)[number];

export const TIPO_ACTUACION_ETIQUETA: Record<TipoActuacion, string> = {
  INASISTENCIAS: "Inasistencias",
  CONVIVENCIA_ICE: "Convivencia / ICE",
  FAMILIA: "Familia",
  SALUD: "Salud",
  PROTOCOLO: "Protocolo (Dec. 1187, bullying, amenazas)",
  ESCOLARIDAD_PROTEGIDA: "Escolaridad protegida",
  DEPORTISTA_FEDERADO: "Deportista federado",
  INCLUSION_PPI: "Inclusión / PPI",
  GENERO: "Género",
  ESCUELA_DOMICILIARIA: "Escuela domiciliaria",
  OTRA: "Otra",
};

/** Causas posibles según el tipo de actuación (Actuacion.causa, texto libre en la base). */
export const CAUSAS_ACTUACION: Record<TipoActuacion, readonly string[]> = {
  INASISTENCIAS: [
    "+5 inasistencias",
    "+15 inasistencias",
    "+20 inasistencias",
    "Condicionalidad",
    "15 inasistencias consecutivas",
    "Extensión de inasistencias",
    "Otros",
  ],
  CONVIVENCIA_ICE: [
    "Falta grave",
    "Falta extremadamente grave",
    "Reiteración de faltas",
    "Falta innegociable",
    "Por Consejo Escolar",
  ],
  FAMILIA: ["Salud física", "Salud mental", "Otros"],
  SALUD: ["Salud física", "Salud mental", "Otros"],
  PROTOCOLO: [
    "Dec. 1187",
    "Bullying",
    "Amenazas virales",
    "Amenazas de intimidación pública",
    "Protocolo de ambulancia",
    "Otros",
  ],
  ESCOLARIDAD_PROTEGIDA: ["Otros"],
  DEPORTISTA_FEDERADO: ["Otros"],
  INCLUSION_PPI: ["Docente acompañante", "Valoración", "PPI"],
  GENERO: ["Otros"],
  ESCUELA_DOMICILIARIA: ["Otros"],
  OTRA: ["Otros"],
};

/** Libros de actas institucionales. */
export const LIBROS_ACTA = [
  "SOE",
  "Gestión",
  "Estudiante",
  "Familia",
  "Preceptoría",
  "Consejo Escolar",
  "Abanderados y escoltas",
] as const;
export const FOLIO_MAX = 200;
export const NUMERO_ACTA_MAX = 500;

/** Valores de Actuacion.tipoActa (texto libre en la base para poder sumar tipos sin migrar). */
export const TIPOS_ACTA = [
  "Acta",
  "Citación con familia",
  "Entrevista con familia",
  "Entrevista con estudiante",
  "Intervención territorial",
  "Otra acta",
] as const;
export type TipoActa = (typeof TIPOS_ACTA)[number];

export const MOTIVOS_APERTURA = [
  "INASISTENCIAS",
  "ICE_CERO",
  "FALTA_GRAVE",
  "PROTOCOLO",
  "DERIVACION_SOE",
  "CONDICIONALIDAD",
  "ESCOLARIDAD_PROTEGIDA",
  "PPI",
  "DEPORTISTA_FEDERADO",
  "OTRO",
] as const;
export type MotivoApertura = (typeof MOTIVOS_APERTURA)[number];

export const MOTIVO_APERTURA_ETIQUETA: Record<MotivoApertura, string> = {
  INASISTENCIAS: "20 inasistencias",
  ICE_CERO: "ICE en 0",
  FALTA_GRAVE: "Falta grave o extremadamente grave",
  PROTOCOLO: "Activación de protocolo",
  DERIVACION_SOE: "Derivación al SOE",
  CONDICIONALIDAD: "Condicionalidad",
  ESCOLARIDAD_PROTEGIDA: "Escolaridad protegida",
  PPI: "Incorporación a PPI",
  DEPORTISTA_FEDERADO: "Deportista federado",
  OTRO: "Otro motivo",
};

export const DESTINOS_DERIVACION = ["INTERNA_PSICOPEDAGOGICA", "INTERNA_SOCIAL", "EXTERNA_ORGANISMO"] as const;
export type DestinoDerivacion = (typeof DESTINOS_DERIVACION)[number];

export const DESTINO_DERIVACION_ETIQUETA: Record<DestinoDerivacion, string> = {
  INTERNA_PSICOPEDAGOGICA: "Interna: orientación psicopedagógica",
  INTERNA_SOCIAL: "Interna: orientación social",
  EXTERNA_ORGANISMO: "Externa: organismo",
};

export const ESTADOS_DERIVACION = ["PENDIENTE", "EN_CURSO", "CERRADA"] as const;
export type EstadoDerivacion = (typeof ESTADOS_DERIVACION)[number];

export const ESTADOS_SEGUIMIENTO = ["PROGRAMADO", "REALIZADO", "CANCELADO"] as const;
export type EstadoSeguimiento = (typeof ESTADOS_SEGUIMIENTO)[number];

export const TIPOS_SITUACION = [
  "CUD_EVALUACION", "INGRESANTE", "SALIDA", "NO_ASISTE", "CONDICIONAL_ICE",
  "ESCOLARIDAD_PROTEGIDA",
  "DEPORTISTA_FEDERADO",
  "CONDICIONAL_INASISTENCIAS",
  "EXTENSION_INASISTENCIAS",
  "EMBARAZO_PATERNIDAD_LACTANCIA",
  "ENFERMEDAD_APRENDIZAJE",
  "JUDICIALIZADO",
  "ESCUELA_DOMICILIARIA",
  "CAMBIO_GENERO",
  "OTRA",
] as const;
export type TipoSituacion = (typeof TIPOS_SITUACION)[number];

export const TIPO_SITUACION_ETIQUETA: Record<TipoSituacion, string> = {
  CUD_EVALUACION: "CUD o evaluación de capacidades", INGRESANTE: "Ingreso de otra institución", SALIDA: "Pase o abandono", NO_ASISTE: "Matriculado que no asiste", CONDICIONAL_ICE: "Condicionalidad por ICE",
  ESCOLARIDAD_PROTEGIDA: "Escolaridad protegida",
  DEPORTISTA_FEDERADO: "Deportista federado (Res. 711/2024)",
  CONDICIONAL_INASISTENCIAS: "Condicional por inasistencias",
  EXTENSION_INASISTENCIAS: "Extensión de inasistencias",
  EMBARAZO_PATERNIDAD_LACTANCIA: "Embarazo, paternidad o lactancia",
  ENFERMEDAD_APRENDIZAJE: "Enfermedad o problema de aprendizaje",
  JUDICIALIZADO: "Situación judicializada",
  ESCUELA_DOMICILIARIA: "Escuela domiciliaria",
  CAMBIO_GENERO: "Resolución de cambio de género",
  OTRA: "Otra situación",
};

/** Nivel de acceso por defecto de cada tipo (reportes 5, 6 y 10 restringidos; 9 solo dirección). */
export const NIVEL_ACCESO_SITUACION: Record<TipoSituacion, NivelAcceso> = {
  CUD_EVALUACION: "RESTRINGIDO", INGRESANTE: "GENERAL", SALIDA: "GENERAL", NO_ASISTE: "GENERAL", CONDICIONAL_ICE: "GENERAL",
  ESCOLARIDAD_PROTEGIDA: "GENERAL",
  DEPORTISTA_FEDERADO: "GENERAL",
  CONDICIONAL_INASISTENCIAS: "GENERAL",
  EXTENSION_INASISTENCIAS: "GENERAL",
  EMBARAZO_PATERNIDAD_LACTANCIA: "RESTRINGIDO",
  ENFERMEDAD_APRENDIZAJE: "RESTRINGIDO",
  JUDICIALIZADO: "RESTRINGIDO",
  ESCUELA_DOMICILIARIA: "GENERAL",
  CAMBIO_GENERO: "SOLO_DIRECCION",
  OTRA: "GENERAL",
};

/** Formas de la escolaridad protegida (SituacionEspecial.forma). */
export const FORMAS_ESCOLARIDAD_PROTEGIDA = ["INASISTENCIAS", "SALUD", "DEPORTISTA_FEDERADO", "EMBARAZO", "OTRA"] as const;
export type FormaEscolaridadProtegida = (typeof FORMAS_ESCOLARIDAD_PROTEGIDA)[number];

/** Valores de SituacionEspecial.aval. */
export const AVALES = ["Dirección", "Supervisión"] as const;
export type Aval = (typeof AVALES)[number];

/** "POR_VENCER" y "VENCIDA" no se guardan: se calculan con la fecha de vencimiento. */
export const ESTADOS_SITUACION = ["PENDIENTE", "VIGENTE", "CUMPLIDA", "DENEGADA", "DADA_DE_BAJA"] as const;
export type EstadoSituacion = (typeof ESTADOS_SITUACION)[number];

export const NIVELES_ACCESO = ["GENERAL", "RESTRINGIDO", "SOLO_DIRECCION"] as const;
export type NivelAcceso = (typeof NIVELES_ACCESO)[number];

export const TIPOS_FICHA_ANEXA = ["SALUD", "PSICOSOCIAL"] as const;
export type TipoFichaAnexa = (typeof TIPOS_FICHA_ANEXA)[number];

export const TIPOS_NOTIFICACION = [
  "SEGUIMIENTO_PROXIMO",
  "SEGUIMIENTO_HOY",
  "SEGUIMIENTO_VENCIDO",
  "DERIVACION_RECIBIDA",
  "ALERTA_INASISTENCIAS",
  "LEGAJO_ABIERTO",
  "SITUACION_POR_VENCER",
] as const;
export type TipoNotificacion = (typeof TIPOS_NOTIFICACION)[number];

export const TIPOS_INTERVENCION = [
  "ENTREVISTA_ESTUDIANTE",
  "ENTREVISTA_FAMILIA",
  "REUNION_DOCENTES",
  "OBSERVACION_AULICA",
  "DERIVACION_INTERNA",
  "DERIVACION_EXTERNA",
  "DERIVACION_SUPERVISION",
  "ACUERDO_EQUIPOS_EXTERNOS",
  "OTRA",
] as const;
export type TipoIntervencion = (typeof TIPOS_INTERVENCION)[number];

export const TIPO_INTERVENCION_ETIQUETA: Record<TipoIntervencion, string> = {
  ENTREVISTA_ESTUDIANTE: "Entrevista con el estudiante",
  ENTREVISTA_FAMILIA: "Entrevista con la familia",
  REUNION_DOCENTES: "Reunión con docentes",
  OBSERVACION_AULICA: "Observación áulica",
  DERIVACION_INTERNA: "Derivación interna",
  DERIVACION_EXTERNA: "Derivación externa",
  DERIVACION_SUPERVISION: "Derivación desde supervisión",
  ACUERDO_EQUIPOS_EXTERNOS: "Acuerdo con equipos externos",
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
  actuacion?: { id: string; fecha: Fecha; motivo: string } | null;
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
  actuaciones?: { id: string; fecha: Fecha; tipo: string; motivo: string; anuladaEl: Fecha | null }[];
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
  /** Actuación de la línea de tiempo a la que se vinculó. */
  actuacion: { id: string; fecha: string; motivo: string } | null;
}

/** Actuación resumida para vincular intervenciones del SOE. */
export interface ActuacionVinculable {
  id: string;
  fecha: string;
  tipo: TipoActuacion;
  motivo: string;
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
    actuaciones: ActuacionVinculable[];
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
  /** Cuenta master: administra usuarios. */
  esAdministrador?: boolean;
  /** Marca de la última foto de perfil (para invalidar la imagen), o null si no tiene. */
  fotoVersion?: string | null;
}

/** Usuario del sistema tal como lo ve la cuenta administradora. */
export interface UsuarioAdministrado {
  id: string;
  email: string;
  nombre: string;
  dni: string | null;
  rol: Rol;
  cargo: Cargo | null;
  activo: boolean;
  esAdministrador: boolean;
  fotoVersion: string | null;
  createdAt: string;
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
