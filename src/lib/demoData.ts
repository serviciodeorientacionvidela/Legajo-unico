/**
 * Datos semilla FICTICIOS para el modo demostración y para prisma/seed.ts.
 * Ningún nombre, DNI ni diagnóstico corresponde a una persona real.
 *
 * Casos incluidos para la presentación ante Dirección:
 * - CUD + PPI (TEA) con informe SOE y acuerdos docentes
 * - PPI sin CUD (dislexia)
 * - CUD próximo a vencer (hipoacusia)
 * - Alertas de convivencia (8 y 5 puntos) con actas
 * - Incidente cargado por preceptoría pendiente de aprobación
 * - Materias previas y riesgo pedagógico (promedio / asistencia)
 * - Alumna con pase a otra escuela
 */

import { PUNTOS_INICIALES } from "./convivencia";
import type {
  CalificacionFuente,
  EstadoMatricula,
  IncidenteFuente,
  IntervencionFuente,
  LegajoFuente,
  Rol,
  TipoIncidente,
  UsuarioSesion,
} from "./types";

export const CICLO_DEMO = 2026;

export const USUARIOS_DEMO: Record<Rol, UsuarioSesion> = {
  DIRECTIVO_SOE: { id: "demo-directivo", email: "direccion@escuela-demo.edu.ar", nombre: "Lic. Mariana Godoy", rol: "DIRECTIVO_SOE" },
  PRECEPTOR: { id: "demo-preceptor", email: "preceptoria@escuela-demo.edu.ar", nombre: "Diego Funes", rol: "PRECEPTOR" },
  DOCENTE: { id: "demo-docente", email: "docente@escuela-demo.edu.ar", nombre: "Prof. Laura Ibáñez", rol: "DOCENTE" },
};

export const PROFESIONAL_SOE_DEMO: UsuarioSesion = {
  id: "demo-soe",
  email: "soe@escuela-demo.edu.ar",
  nombre: "Lic. Carolina Aguirre (Psicopedagoga SOE)",
  rol: "DIRECTIVO_SOE",
};

const MATERIAS_CICLO_BASICO = [
  "Lengua",
  "Matemática",
  "Ciencias Naturales",
  "Ciencias Sociales",
  "Inglés",
  "Educación Física",
  "Educación Artística",
  "Educación Tecnológica",
];
const MATERIAS_CICLO_ORIENTADO = [
  "Lengua y Literatura",
  "Matemática",
  "Física",
  "Química",
  "Historia",
  "Geografía",
  "Inglés",
  "Educación Física",
];

interface SpecIncidente {
  fecha: string;
  tipo: TipoIncidente;
  puntos: number;
  motivo: string;
  descargo?: string;
  medida?: string;
  notificado?: boolean;
  acta?: boolean;
  pendiente?: boolean;
  autor?: Rol;
}

interface SpecIntervencion {
  fecha: string;
  motivo: string;
  informe: string;
  acuerdos: string;
}

interface SpecAlumno {
  dni: string;
  apellidos: string;
  nombres: string;
  nacimiento: string;
  anio: number;
  division: string;
  base: number;
  asistencia: number;
  estado?: EstadoMatricula;
  cud?: { vencimiento: string };
  ppi?: boolean;
  diagnostico?: string;
  observaciones?: string;
  previas?: { materia: string; nota: number }[];
  incidentes?: SpecIncidente[];
  intervenciones?: SpecIntervencion[];
}

const ALUMNOS: SpecAlumno[] = [
  { dni: "50123456", apellidos: "PEREZ", nombres: "Juan Ignacio", nacimiento: "2013-04-12", anio: 1, division: "1", base: 7.6, asistencia: 94.2 },
  {
    dni: "53214877", apellidos: "GONZÁLEZ", nombres: "Martina Belén", nacimiento: "2013-08-03", anio: 1, division: "1", base: 7.2, asistencia: 91.5,
    cud: { vencimiento: "2027-05-30" }, ppi: true,
    diagnostico: "Trastorno del Espectro Autista (TEA) nivel 1 de apoyo. Hipersensibilidad auditiva. CUD vigente.",
    observaciones: "La familia solicita expresamente no divulgar el diagnóstico entre compañeros. Acompañante terapéutica externa martes y jueves (ingresa 2° módulo).",
    intervenciones: [{
      fecha: "2026-03-18", motivo: "Ingreso a 1° año: articulación con nivel primario",
      informe: "Se recibe informe de la escuela primaria y del equipo tratante. Presenta dificultades ante cambios imprevistos de rutina y ambientes ruidosos. Buen rendimiento académico con apoyos. Se acuerda PPI con adecuaciones de acceso (no de contenidos).",
      acuerdos: "Anticipar por escrito cambios de rutina y fechas de evaluación (mínimo 1 semana). Consignas segmentadas y por escrito. Permitir salida breve del aula ante sobrecarga, acordada con preceptoría.",
    }],
  },
  {
    dni: "53398120", apellidos: "FERNÁNDEZ", nombres: "Tomás Agustín", nacimiento: "2013-11-21", anio: 1, division: "2", base: 6.4, asistencia: 88.0,
    ppi: true, diagnostico: "Dislexia del desarrollo (informe psicopedagógico externo, 03/2026).",
    intervenciones: [{
      fecha: "2026-04-07", motivo: "Evaluación psicopedagógica",
      informe: "Informe externo confirma dislexia del desarrollo. Velocidad lectora significativamente descendida para la edad; comprensión oral conservada. Se sugiere PPI con adecuaciones de acceso y evaluación.",
      acuerdos: "Tiempo extendido (+30%) en evaluaciones escritas. Priorizar evaluación oral complementaria. No penalizar ortografía en espacios no lingüísticos.",
    }],
  },
  { dni: "53001934", apellidos: "LUCERO", nombres: "Valentina", nacimiento: "2013-02-27", anio: 1, division: "2", base: 8.5, asistencia: 97.1 },
  {
    dni: "52874410", apellidos: "SOSA", nombres: "Benjamín", nacimiento: "2012-06-15", anio: 2, division: "1", base: 6.9, asistencia: 90.3,
    incidentes: [{ fecha: "2026-06-02", tipo: "LEVE", puntos: 2, motivo: "Uso reiterado del celular durante la clase de Matemática pese a las advertencias.", medida: "Retención del dispositivo hasta el final de la jornada.", notificado: true }],
  },
  { dni: "52790553", apellidos: "GIMÉNEZ", nombres: "Catalina", nacimiento: "2012-09-09", anio: 2, division: "1", base: 8.1, asistencia: 95.4 },
  {
    dni: "52655019", apellidos: "MORALES", nombres: "Thiago", nacimiento: "2012-01-30", anio: 2, division: "2", base: 7.0, asistencia: 89.2,
    cud: { vencimiento: "2026-11-20" },
    diagnostico: "Hipoacusia neurosensorial bilateral moderada. Usa audífonos.",
    intervenciones: [{
      fecha: "2026-03-25", motivo: "Adecuaciones de acceso por hipoacusia",
      informe: "Control audiológico al día. El CUD vence en noviembre 2026: se notificó a la familia para iniciar la renovación ante la Junta Evaluadora.",
      acuerdos: "Ubicar en primeras filas. Hablar de frente y sin cubrirse la boca. Apoyar consignas orales por escrito. Usar videos subtitulados.",
    }],
  },
  { dni: "51988302", apellidos: "AGUILERA", nombres: "Sofía Abril", nacimiento: "2011-05-18", anio: 3, division: "1", base: 7.8, asistencia: 93.0 },
  {
    dni: "51876245", apellidos: "VIDELA", nombres: "Lautaro", nacimiento: "2011-10-02", anio: 3, division: "1", base: 6.1, asistencia: 84.1,
    incidentes: [
      { fecha: "2026-05-14", tipo: "GRAVE", puntos: 10, motivo: "Agresión física a un compañero durante el recreo largo.", descargo: "Refiere que el compañero lo venía molestando desde hacía semanas.", medida: "Citación a la familia, acta de acuerdo y derivación al SOE. Tareas comunitarias en biblioteca (3 jornadas).", notificado: true, acta: true },
      { fecha: "2026-08-21", tipo: "LEVE", puntos: 2, motivo: "Ingreso tardío al aula después del recreo en reiteradas oportunidades.", medida: "Llamado de atención por escrito.", notificado: true },
    ],
  },
  {
    dni: "51740118", apellidos: "ORTIZ", nombres: "Milagros", nacimiento: "2011-03-11", anio: 3, division: "2", base: 7.4, asistencia: 92.6,
    incidentes: [{ fecha: "2026-07-01", tipo: "ACUERDO_PEDAGOGICO", puntos: 0, motivo: "Acuerdo de convivencia por conflicto entre compañeras vía redes sociales.", medida: "Mediación escolar con ambas estudiantes y firma de acuerdo.", notificado: true, acta: true }],
  },
  {
    dni: "51690034", apellidos: "CALDERÓN", nombres: "Emma", nacimiento: "2011-12-05", anio: 3, division: "2", base: 7.0, asistencia: 90.0, estado: "PASE",
  },
  {
    dni: "50912377", apellidos: "PONCE", nombres: "Joaquín", nacimiento: "2010-07-24", anio: 4, division: "1", base: 5.9, asistencia: 81.3,
    incidentes: [
      { fecha: "2026-04-10", tipo: "GRAVE", puntos: 8, motivo: "Daño intencional a mobiliario del laboratorio.", descargo: "Reconoce el hecho y se compromete a reparar el daño.", medida: "Reposición del material por parte de la familia y acta de compromiso.", notificado: true, acta: true },
      { fecha: "2026-06-19", tipo: "MODERADA", puntos: 5, motivo: "Falta de respeto verbal a una docente frente al curso.", medida: "Disculpa formal y citación a la familia.", notificado: true, acta: true },
      { fecha: "2026-09-08", tipo: "LEVE", puntos: 2, motivo: "Se retira del aula sin autorización.", notificado: false },
    ],
    intervenciones: [{
      fecha: "2026-06-24", motivo: "Derivación por reiteración de faltas de convivencia",
      informe: "Entrevista con el estudiante y la madre. Situación familiar compleja (cambio de domicilio reciente). Se sugiere espacio de escucha quincenal en el SOE y articulación con el CAPS de la zona.",
      acuerdos: "Seguimiento semanal con preceptoría. Reforzar positivamente la participación en clase. Ante conflictos, derivar al SOE antes de sancionar.",
    }],
  },
  { dni: "50833561", apellidos: "CASTRO", nombres: "Delfina", nacimiento: "2010-02-14", anio: 4, division: "1", base: 8.8, asistencia: 98.0 },
  {
    dni: "50766490", apellidos: "MOLINA", nombres: "Facundo", nacimiento: "2010-11-30", anio: 4, division: "2", base: 5.2, asistencia: 86.4,
    previas: [{ materia: "Matemática", nota: 4 }, { materia: "Física", nota: 5 }],
  },
  {
    dni: "49987023", apellidos: "ROJAS", nombres: "Agustina", nacimiento: "2009-04-08", anio: 5, division: "1", base: 6.8, asistencia: 90.7,
    previas: [{ materia: "Química", nota: 5 }],
  },
  {
    dni: "49854116", apellidos: "HERRERA", nombres: "Santino", nacimiento: "2009-08-19", anio: 5, division: "1", base: 7.1, asistencia: 91.1,
    incidentes: [
      { fecha: "2026-05-28", tipo: "MODERADA", puntos: 6, motivo: "Fuga del establecimiento durante el horario escolar.", medida: "Citación a la familia y acta.", notificado: true, acta: true },
      { fecha: "2026-10-20", tipo: "LEVE", puntos: 2, motivo: "Uso del celular durante una evaluación.", medida: "Se retira la evaluación y se reprograma.", notificado: false, pendiente: true, autor: "PRECEPTOR" },
    ],
  },
  { dni: "49730288", apellidos: "DOMÍNGUEZ", nombres: "Lucía", nacimiento: "2009-01-22", anio: 5, division: "2", base: 9.1, asistencia: 99.0 },
  { dni: "49688745", apellidos: "NAVARRO", nombres: "Bautista", nacimiento: "2009-06-03", anio: 5, division: "2", base: 5.6, asistencia: 77.5 },
];

/** Generador pseudoaleatorio determinístico (mulberry32): las notas son siempre las mismas. */
function crearAleatorio(semilla: number): () => number {
  let t = semilla >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function redondear(valor: number, decimales = 1): number {
  const factor = 10 ** decimales;
  return Math.round(valor * factor) / factor;
}

function generarCalificaciones(spec: SpecAlumno): CalificacionFuente[] {
  const aleatorio = crearAleatorio(Number(spec.dni));
  const materias = spec.anio <= 2 ? MATERIAS_CICLO_BASICO : MATERIAS_CICLO_ORIENTADO;

  // Ciclo en curso (octubre): 1er cuatrimestre cerrado, 2do en curso.
  const actuales = materias.map((materia, i) => ({
    id: `${spec.dni}-cal-${CICLO_DEMO}-${i}`,
    materia,
    cicloLectivo: CICLO_DEMO,
    primerCuatrimestre: Math.min(10, Math.max(1, redondear(spec.base + (aleatorio() - 0.5) * 3))),
    segundoCuatrimestre: null,
    notaFinal: null,
    previa: false,
  }));

  const previas = (spec.previas ?? []).map((p, i) => ({
    id: `${spec.dni}-cal-${CICLO_DEMO - 1}-previa-${i}`,
    materia: p.materia,
    cicloLectivo: CICLO_DEMO - 1,
    primerCuatrimestre: p.nota,
    segundoCuatrimestre: p.nota,
    notaFinal: p.nota,
    previa: true,
  }));

  return [...actuales, ...previas];
}

function generarIncidentes(spec: SpecAlumno): IncidenteFuente[] {
  return (spec.incidentes ?? []).map((inc, i) => ({
    id: `${spec.dni}-inc-${i}`,
    fecha: `${inc.fecha}T11:30:00.000Z`,
    tipo: inc.tipo,
    puntosDescontados: inc.puntos,
    motivo: inc.motivo,
    descargoAlumno: inc.descargo ?? null,
    medidaAdoptada: inc.medida ?? null,
    notificadoFamilia: inc.notificado ?? false,
    actaDriveUrl: inc.acta ? `https://drive.google.com/file/d/DEMO-ACTA-${spec.dni}-${i}/view` : null,
    aprobado: !inc.pendiente,
    anulado: false,
    autor: { nombre: USUARIOS_DEMO[inc.autor ?? (inc.pendiente ? "PRECEPTOR" : "DIRECTIVO_SOE")].nombre },
  }));
}

function generarIntervenciones(spec: SpecAlumno): IntervencionFuente[] {
  return (spec.intervenciones ?? []).map((int, i) => ({
    id: `${spec.dni}-soe-${i}`,
    fecha: `${int.fecha}T14:00:00.000Z`,
    motivo: int.motivo,
    informeConfidencial: int.informe,
    acuerdosDocentes: int.acuerdos,
    archivoDriveUrl: `https://drive.google.com/file/d/DEMO-INFORME-${spec.dni}-${i}/view`,
    profesional: { nombre: PROFESIONAL_SOE_DEMO.nombre },
  }));
}

function construirLegajo(spec: SpecAlumno): LegajoFuente {
  const calificaciones = generarCalificaciones(spec);
  const incidentes = generarIncidentes(spec);
  const notasCiclo = calificaciones
    .filter((c) => c.cicloLectivo === CICLO_DEMO && c.primerCuatrimestre !== null)
    .map((c) => c.primerCuatrimestre as number);
  const promedio = notasCiclo.length ? redondear(notasCiclo.reduce((a, b) => a + b, 0) / notasCiclo.length, 2) : 0;
  const puntosDescontados = incidentes
    .filter((i) => i.aprobado && !i.anulado)
    .reduce((total, i) => total + i.puntosDescontados, 0);
  const cuilPrefijo = Number(spec.dni) % 2 === 0 ? "20" : "27";

  return {
    id: `demo-${spec.dni}`,
    dni: spec.dni,
    cuil: `${cuilPrefijo}-${spec.dni}-${Number(spec.dni) % 10}`,
    apellidos: spec.apellidos,
    nombres: spec.nombres,
    fechaNacimiento: `${spec.nacimiento}T00:00:00.000Z`,
    anio: spec.anio,
    division: spec.division,
    turno: spec.division === "2" ? "Tarde" : "Mañana",
    promedioGeneral: promedio,
    porcentajeAsistencia: spec.asistencia,
    puntosConvivencia: Math.max(0, PUNTOS_INICIALES - puntosDescontados),
    tieneCud: Boolean(spec.cud),
    vencimientoCud: spec.cud ? `${spec.cud.vencimiento}T00:00:00.000Z` : null,
    requierePpi: spec.ppi ?? false,
    diagnosticoReservado: spec.diagnostico ?? null,
    cudUrl: spec.cud ? `https://drive.google.com/file/d/DEMO-CUD-${spec.dni}/view` : null,
    observacionesConfidenciales: spec.observaciones ?? null,
    driveFolderId: `DEMO-${spec.dni}`,
    driveDocumentacionFolderId: `DEMO-${spec.dni}-01`,
    driveConvivenciaFolderId: `DEMO-${spec.dni}-02`,
    driveConfidencialFolderId: `DEMO-${spec.dni}-03`,
    estadoMatricula: spec.estado ?? "REGULAR",
    updatedAt: "2026-10-20T12:00:00.000Z",
    calificaciones,
    incidentes,
    intervenciones: generarIntervenciones(spec),
  };
}

/** Devuelve una copia nueva de los legajos semilla (cada demo arranca desde el mismo estado). */
export function crearLegajosDemo(): LegajoFuente[] {
  return ALUMNOS.map(construirLegajo);
}
