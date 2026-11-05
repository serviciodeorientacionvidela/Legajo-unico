/**
 * Datos FICTICIOS de seguimiento de trayectorias (actuaciones, derivaciones, seguimientos,
 * situaciones especiales, fichas anexas y avisos) para el modo demostración y prisma/seed.ts.
 * Ningún nombre, DNI ni situación corresponde a una persona real.
 *
 * Usa alumnos que ya existen en demoData.ts (se referencian por DNI):
 * - NAVARRO: reproduce la maqueta del legajo (protocolo, citación, derivación, condicionalidad,
 *   escolaridad protegida con un seguimiento vencido y otro en 2 días, fichas anexas).
 * - SOSA: derivación pendiente en la bandeja del SOE.
 * - HERRERA: deportista federado con escolaridad protegida.
 * - CASTRO: escolaridad protegida por salud a punto de vencer, con el seguimiento atrasado.
 * - GONZÁLEZ y FERNÁNDEZ: legajo abierto por PPI.
 * - VIDELA y PONCE: legajo abierto por falta grave, con derivaciones (interna cerrada y externa en curso).
 * - ROJAS: situación restringida (embarazo) sin legajo abierto.
 *
 * Las fechas son fijas (ciclo 2026), como en demoData.ts. Referencia: 03/11/2026.
 */

import type {
  DestinoDerivacion,
  EstadoDerivacion,
  EstadoSeguimiento,
  EstadoSituacion,
  MotivoApertura,
  NivelAcceso,
  TipoActa,
  TipoActuacion,
  TipoFichaAnexa,
  TipoNotificacion,
  TipoSituacion,
} from "./types";

/** Quién registra: se traduce a los usuarios de USUARIOS_DEMO / PROFESIONAL_SOE_DEMO. */
export type AutorDemo = "DIRECTIVO" | "PRECEPTOR" | "SOE";

export type JsonDemo = string | number | boolean | null | JsonDemo[] | { [clave: string]: JsonDemo };

export interface AperturaDemo {
  dni: string;
  fecha: string;
  motivo: MotivoApertura;
  detalle: string | null;
  promedio: number;
  pendientes: number;
  inasistencias: number;
  ice: number;
}

export interface ActuacionDemo {
  id: string;
  dni: string;
  fecha: string;
  cicloLectivo: number;
  tipo: TipoActuacion;
  motivo: string;
  resumen: string;
  tipoActa: TipoActa | null;
  actaLibro: string | null;
  actaFolio: string | null;
  confidencial: boolean;
  puntosIce: number | null;
  /** id del incidente en demoData.ts (`<dni>-inc-<n>`) cuya quita de puntos originó esta actuación. */
  incidenteDemoId: string | null;
  derivacionId: string | null;
  autor: AutorDemo;
}

export interface DerivacionDemo {
  id: string;
  dni: string;
  fecha: string;
  derivadoPor: AutorDemo;
  motivo: string;
  profesionalSoe: AutorDemo | null;
  recibidaEl: string | null;
  accionesSoe: string | null;
  respuesta: string | null;
  destino: DestinoDerivacion | null;
  organismoExterno: string | null;
  estado: EstadoDerivacion;
  cerradaEl: string | null;
}

export interface SeguimientoDemo {
  id: string;
  dni: string;
  fechaProgramada: string;
  descripcion: string;
  estado: EstadoSeguimiento;
  realizadoEl: string | null;
  resultado: string | null;
  derivacionId: string | null;
  situacionId: string | null;
  responsable: AutorDemo | null;
  avisoLue: boolean;
  avisoCorreo: boolean;
}

export interface SituacionDemo {
  id: string;
  dni: string;
  tipo: TipoSituacion;
  forma: string | null;
  aval: string | null;
  estado: EstadoSituacion;
  nivelAcceso: NivelAcceso;
  fechaInicio: string;
  fechaVencimiento: string | null;
  fechaFin: string | null;
  detalle: { [clave: string]: JsonDemo } | null;
  observaciones: string | null;
  actuacionId: string | null;
  derivacionId: string | null;
  registradaPor: AutorDemo;
}

export interface FichaAnexaDemo {
  id: string;
  dni: string;
  tipo: TipoFichaAnexa;
  fecha: string;
  datos: { [clave: string]: JsonDemo };
  cargadaPor: AutorDemo;
}

export interface NotificacionDemo {
  id: string;
  para: AutorDemo;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  dni: string;
  seguimientoId: string | null;
  derivacionId: string | null;
  leida: boolean;
  fecha: string;
}

export interface SeguimientoDemoCompleto {
  aperturas: AperturaDemo[];
  derivaciones: DerivacionDemo[];
  actuaciones: ActuacionDemo[];
  situaciones: SituacionDemo[];
  seguimientos: SeguimientoDemo[];
  fichas: FichaAnexaDemo[];
  notificaciones: NotificacionDemo[];
}

/** Alumnos de demoData.ts que tienen datos de seguimiento (el seed los limpia y regenera). */
export const DNIS_SEGUIMIENTO_DEMO = [
  "49688745", // NAVARRO
  "52874410", // SOSA
  "49854116", // HERRERA
  "50833561", // CASTRO
  "53214877", // GONZÁLEZ
  "53398120", // FERNÁNDEZ
  "51876245", // VIDELA
  "50912377", // PONCE
  "49987023", // ROJAS
] as const;

const dia = (fecha: string): string => `${fecha}T12:00:00.000Z`;
const diaONull = (fecha: string | undefined): string | null => (fecha ? dia(fecha) : null);

// ---------------------------------------------------------------------------
// Especificación compacta (se completa con valores por defecto más abajo).
// ---------------------------------------------------------------------------

type Spec<T, Obligatorios extends keyof T> = Pick<T, Obligatorios> & Partial<Omit<T, Obligatorios>>;

const APERTURAS: AperturaDemo[] = [
  { dni: "49688745", fecha: "2026-03-14", motivo: "PROTOCOLO", detalle: "Intervención del SOE", promedio: 6.4, pendientes: 0, inasistencias: 9, ice: 25 },
  { dni: "52874410", fecha: "2026-10-30", motivo: "DERIVACION_SOE", detalle: null, promedio: 6.9, pendientes: 0, inasistencias: 12, ice: 23 },
  { dni: "49854116", fecha: "2026-03-15", motivo: "DEPORTISTA_FEDERADO", detalle: null, promedio: 7.3, pendientes: 0, inasistencias: 3, ice: 25 },
  { dni: "50833561", fecha: "2026-08-10", motivo: "ESCOLARIDAD_PROTEGIDA", detalle: "Escolaridad protegida por salud", promedio: 8.8, pendientes: 0, inasistencias: 2, ice: 25 },
  { dni: "53214877", fecha: "2026-03-18", motivo: "PPI", detalle: "Ingreso a 1° año con CUD y PPI", promedio: 7.2, pendientes: 0, inasistencias: 1, ice: 25 },
  { dni: "53398120", fecha: "2026-04-07", motivo: "PPI", detalle: null, promedio: 6.4, pendientes: 0, inasistencias: 4, ice: 25 },
  { dni: "51876245", fecha: "2026-05-14", motivo: "FALTA_GRAVE", detalle: null, promedio: 6.3, pendientes: 0, inasistencias: 11, ice: 25 },
  { dni: "50912377", fecha: "2026-04-10", motivo: "FALTA_GRAVE", detalle: null, promedio: 6.1, pendientes: 0, inasistencias: 10, ice: 25 },
];

const DERIVACIONES: Spec<DerivacionDemo, "id" | "dni" | "fecha" | "derivadoPor" | "motivo" | "estado">[] = [
  {
    id: "demo-der-49688745-0", dni: "49688745", fecha: "2026-09-02", derivadoPor: "PRECEPTOR", estado: "EN_CURSO",
    motivo: "Alcanzó 15 inasistencias. La familia no responde a los llamados.",
    profesionalSoe: "SOE", recibidaEl: "2026-09-03",
    accionesSoe: "Llamado telefónico y entrevista con la madre. Se acuerda aviso diario de cada falta.",
    respuesta: "Se informó a la preceptora. La familia se compromete a justificar con certificado.",
    destino: "INTERNA_PSICOPEDAGOGICA",
  },
  {
    id: "demo-der-52874410-0", dni: "52874410", fecha: "2026-10-30", derivadoPor: "PRECEPTOR", estado: "PENDIENTE",
    motivo: "Llega tarde casi todos los días y se duerme en clase. Comenta que trabaja de noche con el padre.",
  },
  {
    id: "demo-der-51876245-0", dni: "51876245", fecha: "2026-05-15", derivadoPor: "DIRECTIVO", estado: "CERRADA",
    motivo: "Agresión física a un compañero en el recreo. Refiere que lo venían molestando desde hacía semanas.",
    profesionalSoe: "SOE", recibidaEl: "2026-05-16", cerradaEl: "2026-07-03",
    accionesSoe: "Entrevistas con el estudiante y con el compañero. Se trabaja con el curso la posible situación de hostigamiento.",
    respuesta: "Se informó a Dirección. No se confirma hostigamiento; se acuerda un taller de convivencia en 3° 1ª.",
    destino: "INTERNA_SOCIAL",
  },
  {
    id: "demo-der-50912377-0", dni: "50912377", fecha: "2026-06-20", derivadoPor: "PRECEPTOR", estado: "EN_CURSO",
    motivo: "Reiteración de faltas de convivencia. Cambio de domicilio reciente.",
    profesionalSoe: "SOE", recibidaEl: "2026-06-22",
    accionesSoe: "Entrevista con el estudiante y la madre. Espacio de escucha quincenal en el SOE.",
    respuesta: "Se informó a preceptoría. Se articula con el CAPS de la zona.",
    destino: "EXTERNA_ORGANISMO", organismoExterno: "CAPS de la zona (ficticio)",
  },
];

const ACTUACIONES: Spec<ActuacionDemo, "id" | "dni" | "fecha" | "tipo" | "motivo" | "resumen" | "autor">[] = [
  // --- NAVARRO: línea de tiempo de la maqueta ---
  {
    id: "demo-act-49688745-0", dni: "49688745", fecha: "2024-09-12", tipo: "FAMILIA", autor: "SOE",
    motivo: "Cambio de turno pedido por la familia",
    resumen: "Pasa del turno mañana al turno tarde por el trabajo de la madre.",
    tipoActa: "Entrevista con familia", actaLibro: "1", actaFolio: "30",
  },
  {
    id: "demo-act-49688745-1", dni: "49688745", fecha: "2025-06-05", tipo: "SALUD", autor: "PRECEPTOR",
    motivo: "Ausencias por tratamiento médico",
    resumen: "Se justifican con certificado. Se acuerda la entrega de actividades a la familia.",
  },
  {
    id: "demo-act-49688745-2", dni: "49688745", fecha: "2025-11-18", tipo: "CONVIVENCIA_ICE", autor: "PRECEPTOR",
    motivo: "Pelea con un compañero · falta leve",
    resumen: "Se escucha a ambos y se registra el descargo. Se acuerda una reparación con el compañero.",
    tipoActa: "Acta", actaLibro: "2", actaFolio: "77", puntosIce: 3,
  },
  {
    id: "demo-act-49688745-3", dni: "49688745", fecha: "2026-03-14", tipo: "PROTOCOLO", autor: "SOE", confidencial: true,
    motivo: "Activación del Decreto 1187",
    resumen: "Se activa el protocolo por una situación familiar. Se informa a Supervisión. El detalle está en el informe confidencial.",
    tipoActa: "Intervención territorial", actaLibro: "1", actaFolio: "12",
  },
  {
    id: "demo-act-49688745-4", dni: "49688745", fecha: "2026-08-19", tipo: "FAMILIA", autor: "SOE",
    motivo: "Citación por 10 faltas",
    resumen: "La madre asiste. Refiere problemas laborales y de traslado. Se acuerda aviso diario de cada inasistencia.",
    tipoActa: "Citación con familia", actaLibro: "3", actaFolio: "41",
  },
  {
    id: "demo-act-49688745-5", dni: "49688745", fecha: "2026-09-02", tipo: "INASISTENCIAS", autor: "PRECEPTOR",
    motivo: "Derivación al SOE por 15 faltas",
    resumen: "Alcanzó 15 inasistencias y la familia no responde a los llamados. Pasa a orientación psicopedagógica.",
    derivacionId: "demo-der-49688745-0",
  },
  {
    id: "demo-act-49688745-6", dni: "49688745", fecha: "2026-10-22", tipo: "INASISTENCIAS", autor: "DIRECTIVO",
    motivo: "Condicional por inasistencias (21 faltas)",
    resumen: "Supervisión revisó los antecedentes y avaló la condicionalidad. Se ofreció escolaridad protegida.",
    tipoActa: "Acta", actaLibro: "3", actaFolio: "58",
  },
  // --- SOSA ---
  {
    id: "demo-act-52874410-0", dni: "52874410", fecha: "2026-10-30", tipo: "OTRA", autor: "PRECEPTOR",
    motivo: "Derivación al SOE",
    resumen: "Llega tarde casi todos los días y se duerme en clase. Se deriva al SOE.",
    derivacionId: "demo-der-52874410-0",
  },
  // --- HERRERA ---
  {
    id: "demo-act-49854116-0", dni: "49854116", fecha: "2026-03-15", tipo: "DEPORTISTA_FEDERADO", autor: "DIRECTIVO",
    motivo: "Escolaridad protegida por deporte federado",
    resumen: "La familia presenta la constancia de la federación. Dirección avala la escolaridad protegida hasta el 30/11.",
    tipoActa: "Acta", actaLibro: "3", actaFolio: "9",
  },
  // --- CASTRO ---
  {
    id: "demo-act-50833561-0", dni: "50833561", fecha: "2026-08-10", tipo: "SALUD", autor: "DIRECTIVO",
    motivo: "Escolaridad protegida por salud",
    resumen: "La familia presenta certificado médico. Dirección avala la escolaridad protegida hasta el 10/11 con entrega semanal de actividades.",
    tipoActa: "Acta", actaLibro: "3", actaFolio: "22",
  },
  // --- GONZÁLEZ ---
  {
    id: "demo-act-53214877-0", dni: "53214877", fecha: "2026-03-18", tipo: "INCLUSION_PPI", autor: "SOE",
    motivo: "Acuerdo de PPI con adecuaciones de acceso",
    resumen: "Se recibe el informe de la primaria y del equipo tratante. Se acuerda un PPI con adecuaciones de acceso.",
    tipoActa: "Entrevista con familia", actaLibro: "1", actaFolio: "5",
  },
  // --- FERNÁNDEZ ---
  {
    id: "demo-act-53398120-0", dni: "53398120", fecha: "2026-04-07", tipo: "INCLUSION_PPI", autor: "SOE",
    motivo: "Incorporación a PPI",
    resumen: "El informe psicopedagógico externo confirma la evaluación. Se acuerdan tiempo extendido y evaluación oral complementaria.",
  },
  // --- VIDELA ---
  {
    id: "demo-act-51876245-0", dni: "51876245", fecha: "2026-05-14", tipo: "CONVIVENCIA_ICE", autor: "DIRECTIVO",
    motivo: "Agresión física a un compañero · falta grave",
    resumen: "Se cita a la familia y se firma un acta de acuerdo. Se deriva al SOE.",
    tipoActa: "Acta", actaLibro: "2", actaFolio: "103", puntosIce: 10,
    incidenteDemoId: "51876245-inc-0", derivacionId: "demo-der-51876245-0",
  },
  // --- PONCE ---
  {
    id: "demo-act-50912377-0", dni: "50912377", fecha: "2026-04-10", tipo: "CONVIVENCIA_ICE", autor: "DIRECTIVO",
    motivo: "Daño al mobiliario del laboratorio · falta grave",
    resumen: "Reconoce el hecho. La familia repone el material y se firma un acta de compromiso.",
    tipoActa: "Acta", actaLibro: "2", actaFolio: "88", puntosIce: 8,
    incidenteDemoId: "50912377-inc-0",
  },
  {
    id: "demo-act-50912377-1", dni: "50912377", fecha: "2026-06-20", tipo: "CONVIVENCIA_ICE", autor: "PRECEPTOR",
    motivo: "Derivación al SOE por reiteración de faltas",
    resumen: "Tercera falta en el año y cambio de domicilio reciente. Se deriva al SOE.",
    derivacionId: "demo-der-50912377-0",
  },
];

const SITUACIONES: Spec<SituacionDemo, "id" | "dni" | "tipo" | "fechaInicio" | "registradaPor">[] = [
  // --- NAVARRO ---
  {
    id: "demo-sit-49688745-0", dni: "49688745", tipo: "CONDICIONAL_INASISTENCIAS", fechaInicio: "2026-10-22", registradaPor: "DIRECTIVO",
    aval: "Supervisión", detalle: { faltas: 21 }, actuacionId: "demo-act-49688745-6",
  },
  {
    id: "demo-sit-49688745-1", dni: "49688745", tipo: "EXTENSION_INASISTENCIAS", fechaInicio: "2026-10-29", registradaPor: "DIRECTIVO",
    estado: "PENDIENTE", detalle: { pedidaPor: "Familia", actaLibro: "3", actaFolio: "60" },
    observaciones: "Falta el aval de Supervisión.",
  },
  {
    id: "demo-sit-49688745-2", dni: "49688745", tipo: "ESCOLARIDAD_PROTEGIDA", fechaInicio: "2026-10-22", registradaPor: "DIRECTIVO",
    forma: "INASISTENCIAS", aval: "Supervisión", fechaVencimiento: "2026-12-15",
    actuacionId: "demo-act-49688745-6", derivacionId: "demo-der-49688745-0",
  },
  {
    id: "demo-sit-49688745-3", dni: "49688745", tipo: "DEPORTISTA_FEDERADO", fechaInicio: "2026-03-20", registradaPor: "DIRECTIVO",
    detalle: { resolucion: "Res. 711/2024", deporte: "Básquet", federacion: "Federación de Básquet (ficticia)", entrenamientosSemanales: 3, evaluacionesFormativas: ["Junio", "Noviembre"] },
  },
  // --- HERRERA ---
  {
    id: "demo-sit-49854116-0", dni: "49854116", tipo: "DEPORTISTA_FEDERADO", fechaInicio: "2026-03-15", registradaPor: "DIRECTIVO",
    detalle: { resolucion: "Res. 711/2024", deporte: "Hockey sobre patines", federacion: "Federación de Patín (ficticia)", entrenamientosSemanales: 5, evaluacionesFormativas: ["Junio", "Noviembre"] },
    actuacionId: "demo-act-49854116-0",
  },
  {
    id: "demo-sit-49854116-1", dni: "49854116", tipo: "ESCOLARIDAD_PROTEGIDA", fechaInicio: "2026-03-15", registradaPor: "DIRECTIVO",
    forma: "DEPORTISTA_FEDERADO", aval: "Dirección", fechaVencimiento: "2026-11-30", actuacionId: "demo-act-49854116-0",
  },
  // --- CASTRO ---
  {
    id: "demo-sit-50833561-0", dni: "50833561", tipo: "ESCOLARIDAD_PROTEGIDA", fechaInicio: "2026-08-10", registradaPor: "DIRECTIVO",
    forma: "SALUD", aval: "Dirección", fechaVencimiento: "2026-11-10",
    detalle: { motivo: "Reposo indicado con certificado médico" }, actuacionId: "demo-act-50833561-0",
  },
  // --- FERNÁNDEZ ---
  {
    id: "demo-sit-53398120-0", dni: "53398120", tipo: "ENFERMEDAD_APRENDIZAJE", fechaInicio: "2026-04-07", registradaPor: "SOE",
    nivelAcceso: "RESTRINGIDO",
    detalle: {
      tipoSituacion: "Aprendizaje",
      respaldo: "Informe psicopedagógico externo (03/2026)",
      adecuaciones: "Tiempo extendido (+30%) y evaluación oral complementaria",
      equipoTratante: "Psicopedagoga externa",
    },
    actuacionId: "demo-act-53398120-0",
  },
  // --- PONCE ---
  {
    id: "demo-sit-50912377-0", dni: "50912377", tipo: "JUDICIALIZADO", fechaInicio: "2026-06-18", registradaPor: "SOE",
    nivelAcceso: "RESTRINGIDO",
    detalle: { medida: "Prohibición de acercamiento de un adulto", organismo: "Juzgado de Familia (ficticio)", denunciaPodes: true },
    derivacionId: "demo-der-50912377-0",
  },
  // --- ROJAS ---
  {
    id: "demo-sit-49987023-0", dni: "49987023", tipo: "EMBARAZO_PATERNIDAD_LACTANCIA", fechaInicio: "2026-09-01", registradaPor: "SOE",
    nivelAcceso: "RESTRINGIDO",
    detalle: {
      situacion: "Embarazo",
      fechaProbable: "2027-01-20",
      adecuacionesAsistencia: "Se justifican los controles médicos",
      adecuacionesEvaluacion: "Fechas flexibles en noviembre y diciembre",
    },
  },
];

const SEGUIMIENTOS: Spec<SeguimientoDemo, "id" | "dni" | "fechaProgramada" | "descripcion">[] = [
  // --- NAVARRO: parte C de la derivación y "Seguimientos pendientes" del legajo ---
  {
    id: "demo-seg-49688745-0", dni: "49688745", fechaProgramada: "2026-09-05", descripcion: "Control de asistencia semanal",
    estado: "REALIZADO", realizadoEl: "2026-09-05", resultado: "Se controla la asistencia de la semana. Mejora parcial.",
    derivacionId: "demo-der-49688745-0", responsable: "SOE",
  },
  {
    id: "demo-seg-49688745-1", dni: "49688745", fechaProgramada: "2026-09-30", descripcion: "Control de asistencia",
    estado: "REALIZADO", realizadoEl: "2026-09-30", resultado: "Nuevas faltas sin aviso. Se cita a la familia.",
    derivacionId: "demo-der-49688745-0", responsable: "SOE",
  },
  {
    id: "demo-seg-49688745-2", dni: "49688745", fechaProgramada: "2026-10-26", descripcion: "Revisar la entrega de actividades",
    situacionId: "demo-sit-49688745-2", responsable: "PRECEPTOR", avisoCorreo: true,
  },
  {
    id: "demo-seg-49688745-3", dni: "49688745", fechaProgramada: "2026-11-05", descripcion: "Entrevista con la familia por escolaridad protegida",
    derivacionId: "demo-der-49688745-0", situacionId: "demo-sit-49688745-2", responsable: "SOE", avisoCorreo: true,
  },
  {
    id: "demo-seg-49688745-4", dni: "49688745", fechaProgramada: "2026-11-28", descripcion: "Evaluar derivación a equipo externo",
    derivacionId: "demo-der-49688745-0", responsable: "SOE", avisoCorreo: true,
  },
  // --- HERRERA ---
  {
    id: "demo-seg-49854116-0", dni: "49854116", fechaProgramada: "2026-06-26", descripcion: "Evaluación formativa de junio",
    estado: "REALIZADO", realizadoEl: "2026-06-26", resultado: "Aprueba 6 de 8 materias. Recupera Química y Física en julio.",
    situacionId: "demo-sit-49854116-1", responsable: "PRECEPTOR",
  },
  {
    id: "demo-seg-49854116-1", dni: "49854116", fechaProgramada: "2026-10-30", descripcion: "Control de asistencia y entrega de actividades",
    estado: "REALIZADO", realizadoEl: "2026-10-30", resultado: "Al día con las actividades.",
    situacionId: "demo-sit-49854116-1", responsable: "PRECEPTOR",
  },
  {
    id: "demo-seg-49854116-2", dni: "49854116", fechaProgramada: "2026-11-20", descripcion: "Evaluación formativa de noviembre",
    situacionId: "demo-sit-49854116-1", responsable: "PRECEPTOR",
  },
  // --- CASTRO: seguimiento atrasado ---
  {
    id: "demo-seg-50833561-0", dni: "50833561", fechaProgramada: "2026-10-05", descripcion: "Control de la entrega de actividades",
    situacionId: "demo-sit-50833561-0", responsable: "PRECEPTOR",
  },
  // --- FERNÁNDEZ ---
  {
    id: "demo-seg-53398120-0", dni: "53398120", fechaProgramada: "2026-11-12", descripcion: "Revisar las adecuaciones con el equipo docente",
    situacionId: "demo-sit-53398120-0", responsable: "SOE",
  },
  // --- VIDELA ---
  {
    id: "demo-seg-51876245-0", dni: "51876245", fechaProgramada: "2026-06-12", descripcion: "Entrevista de seguimiento con el estudiante",
    estado: "REALIZADO", realizadoEl: "2026-06-12", resultado: "Sin nuevos conflictos. Participa del taller de convivencia.",
    derivacionId: "demo-der-51876245-0", responsable: "SOE",
  },
  // --- PONCE: vencido ---
  {
    id: "demo-seg-50912377-0", dni: "50912377", fechaProgramada: "2026-10-27", descripcion: "Espacio de escucha quincenal",
    derivacionId: "demo-der-50912377-0", responsable: "SOE",
  },
  // --- ROJAS ---
  {
    id: "demo-seg-49987023-0", dni: "49987023", fechaProgramada: "2026-11-17", descripcion: "Revisar las adecuaciones de evaluación de diciembre",
    situacionId: "demo-sit-49987023-0", responsable: "SOE",
  },
];

const FICHAS: FichaAnexaDemo[] = [
  {
    id: "demo-ficha-49688745-salud", dni: "49688745", tipo: "SALUD", fecha: "2026-03-14", cargadaPor: "SOE",
    datos: { cobertura: "Obra social provincial (ficticia)", tratamientos: "Ninguno en curso", medicacion: "No", alergias: "No refiere", contactoEmergencia: "Madre" },
  },
  {
    id: "demo-ficha-49688745-psicosocial", dni: "49688745", tipo: "PSICOSOCIAL", fecha: "2026-03-14", cargadaPor: "SOE",
    datos: { convivencia: "Madre y dos hermanos menores", redDeApoyo: "Abuela materna", organismos: "Intervención territorial", observaciones: "Ver informe confidencial (Decreto 1187)" },
  },
  {
    id: "demo-ficha-50833561-salud", dni: "50833561", tipo: "SALUD", fecha: "2026-08-10", cargadaPor: "SOE",
    datos: { cobertura: "Obra social (ficticia)", tratamientos: "Reposo y kinesiología", medicacion: "Analgésicos indicados por el médico", alergias: "No refiere", contactoEmergencia: "Padre" },
  },
];

const NOTIFICACIONES: NotificacionDemo[] = [
  {
    id: "demo-notif-0", para: "PRECEPTOR", tipo: "SEGUIMIENTO_VENCIDO", dni: "49688745", fecha: "2026-10-27",
    titulo: "Seguimiento vencido: NAVARRO, Bautista",
    mensaje: "Revisar la entrega de actividades (26/10). Registrá el seguimiento o reprogramalo.",
    seguimientoId: "demo-seg-49688745-2", derivacionId: null, leida: false,
  },
  {
    id: "demo-notif-1", para: "DIRECTIVO", tipo: "SEGUIMIENTO_VENCIDO", dni: "49688745", fecha: "2026-10-28",
    titulo: "Seguimiento sin registrar: NAVARRO, Bautista",
    mensaje: "El seguimiento del 26/10 (revisar la entrega de actividades) sigue sin registrarse.",
    seguimientoId: "demo-seg-49688745-2", derivacionId: null, leida: false,
  },
  {
    id: "demo-notif-2", para: "SOE", tipo: "SEGUIMIENTO_PROXIMO", dni: "49688745", fecha: "2026-11-03",
    titulo: "En 2 días: NAVARRO, Bautista",
    mensaje: "Entrevista con la familia por escolaridad protegida (05/11).",
    seguimientoId: "demo-seg-49688745-3", derivacionId: "demo-der-49688745-0", leida: false,
  },
  {
    id: "demo-notif-3", para: "SOE", tipo: "DERIVACION_RECIBIDA", dni: "52874410", fecha: "2026-10-30",
    titulo: "Nueva derivación: SOSA, Benjamín",
    mensaje: "Preceptoría derivó a SOSA, Benjamín (2° 1ª). Está en la bandeja del SOE.",
    seguimientoId: null, derivacionId: "demo-der-52874410-0", leida: false,
  },
  {
    id: "demo-notif-4", para: "DIRECTIVO", tipo: "SITUACION_POR_VENCER", dni: "50833561", fecha: "2026-11-03",
    titulo: "Escolaridad protegida por vencer: CASTRO, Delfina",
    mensaje: "Vence el 10/11. El seguimiento del 05/10 está atrasado.",
    seguimientoId: "demo-seg-50833561-0", derivacionId: null, leida: false,
  },
];

// ---------------------------------------------------------------------------
// Construcción (fechas a ISO y valores por defecto).
// ---------------------------------------------------------------------------

function cicloDe(fecha: string): number {
  return Number(fecha.slice(0, 4));
}

/** Devuelve una copia nueva de los datos de seguimiento (cada demo arranca desde el mismo estado). */
export function crearSeguimientoDemo(): SeguimientoDemoCompleto {
  return {
    aperturas: APERTURAS.map((a) => ({ ...a, fecha: dia(a.fecha) })),
    derivaciones: DERIVACIONES.map((d) => ({
      id: d.id,
      dni: d.dni,
      fecha: dia(d.fecha),
      derivadoPor: d.derivadoPor,
      motivo: d.motivo,
      profesionalSoe: d.profesionalSoe ?? null,
      recibidaEl: diaONull(d.recibidaEl ?? undefined),
      accionesSoe: d.accionesSoe ?? null,
      respuesta: d.respuesta ?? null,
      destino: d.destino ?? null,
      organismoExterno: d.organismoExterno ?? null,
      estado: d.estado,
      cerradaEl: diaONull(d.cerradaEl ?? undefined),
    })),
    actuaciones: ACTUACIONES.map((a) => ({
      id: a.id,
      dni: a.dni,
      fecha: dia(a.fecha),
      cicloLectivo: cicloDe(a.fecha),
      tipo: a.tipo,
      motivo: a.motivo,
      resumen: a.resumen,
      tipoActa: a.tipoActa ?? null,
      actaLibro: a.actaLibro ?? null,
      actaFolio: a.actaFolio ?? null,
      confidencial: a.confidencial ?? false,
      puntosIce: a.puntosIce ?? null,
      incidenteDemoId: a.incidenteDemoId ?? null,
      derivacionId: a.derivacionId ?? null,
      autor: a.autor,
    })),
    situaciones: SITUACIONES.map((s) => ({
      id: s.id,
      dni: s.dni,
      tipo: s.tipo,
      forma: s.forma ?? null,
      aval: s.aval ?? null,
      estado: s.estado ?? "VIGENTE",
      nivelAcceso: s.nivelAcceso ?? "GENERAL",
      fechaInicio: dia(s.fechaInicio),
      fechaVencimiento: diaONull(s.fechaVencimiento ?? undefined),
      fechaFin: diaONull(s.fechaFin ?? undefined),
      detalle: s.detalle ? structuredClone(s.detalle) : null,
      observaciones: s.observaciones ?? null,
      actuacionId: s.actuacionId ?? null,
      derivacionId: s.derivacionId ?? null,
      registradaPor: s.registradaPor,
    })),
    seguimientos: SEGUIMIENTOS.map((s) => ({
      id: s.id,
      dni: s.dni,
      fechaProgramada: dia(s.fechaProgramada),
      descripcion: s.descripcion,
      estado: s.estado ?? "PROGRAMADO",
      realizadoEl: diaONull(s.realizadoEl ?? undefined),
      resultado: s.resultado ?? null,
      derivacionId: s.derivacionId ?? null,
      situacionId: s.situacionId ?? null,
      responsable: s.responsable ?? null,
      avisoLue: s.avisoLue ?? true,
      avisoCorreo: s.avisoCorreo ?? false,
    })),
    fichas: FICHAS.map((f) => ({ ...f, fecha: dia(f.fecha), datos: structuredClone(f.datos) })),
    notificaciones: NOTIFICACIONES.map((n) => ({ ...n, fecha: dia(n.fecha) })),
  };
}
