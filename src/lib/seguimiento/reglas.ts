import { z } from "zod";
import {
  CAUSAS_ACTUACION,
  FOLIO_MAX,
  LIBROS_ACTA,
  NUMERO_ACTA_MAX,
  TIPOS_ACTUACION,
  MOTIVOS_APERTURA,
  type MotivoApertura,
  type TipoActuacion,
  TIPOS_SITUACION,
  DESTINOS_DERIVACION,
  ESTADOS_SITUACION,
} from "../types";

export const cursoSchema = z.object({
  anio: z.number().int().min(1).max(5),
  division: z.string().trim().min(1).max(5),
  turno: z.string().trim().min(1).max(30),
});
export const perfilSchema = z.object({
  usuarioId: z.string().min(1),
  funcion: z.enum(["DIRECCION", "SOE", "PRECEPTORIA"]),
  cursos: z.array(cursoSchema).max(50),
});
export type Perfil = z.infer<typeof perfilSchema>;
const texto = z.string().trim().max(4000);
const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Fecha inválida",
  );
export const actuacionSchema = z
  .object({
    tipo: z.enum(TIPOS_ACTUACION),
    fecha,
    motivo: texto.min(5).max(180),
    resumen: texto
      .min(5)
      .max(700)
      .refine(
        (v) => v.split(/\r?\n/).length <= 3,
        "El resumen admite hasta tres líneas",
      ),
    causa: texto.max(100).default(""),
    tipoActa: texto.max(100).default(""),
    actaLibro: texto.max(30).default(""),
    actaFolio: texto.max(30).default(""),
    actaNumero: texto.max(10).default(""),
    confidencial: z.boolean().default(false),
    motivoApertura: z.enum(MOTIVOS_APERTURA).optional(),
    seguimientoFecha: fecha.optional(),
    responsableId: z.string().optional(),
    condicional: z.boolean().default(false),
    puntosIce: z.number().int().min(0).max(25).default(0),
    descargo: texto.default(""),
    resolucion: texto.default(""),
  })
  .refine(
    (d) => CAUSAS_ACTUACION[d.tipo].includes(d.causa),
    "Seleccione una causa válida para el tipo de actuación",
  )
  .refine(
    (d) => !d.tipoActa || !!(d.actaLibro && d.actaFolio),
    "Complete libro y folio del acta",
  )
  .refine(
    (d) => !d.actaLibro || (LIBROS_ACTA as readonly string[]).includes(d.actaLibro),
    "Libro de actas inválido",
  )
  .refine(
    (d) => !d.actaFolio || enRango(d.actaFolio, FOLIO_MAX),
    `El folio debe estar entre 1 y ${FOLIO_MAX}`,
  )
  .refine(
    (d) => !d.actaNumero || enRango(d.actaNumero, NUMERO_ACTA_MAX),
    `El número de acta debe estar entre 1 y ${NUMERO_ACTA_MAX}`,
  )
  .refine(
    (d) => !d.puntosIce || !!(d.descargo && d.resolucion && d.tipoActa),
    "La quita ICE requiere acta, descargo y resolución",
  )
  .refine(
    (d) => !d.seguimientoFecha || d.seguimientoFecha >= d.fecha,
    "El seguimiento no puede ser anterior a la actuación",
  );
export const derivacionSchema = z.object({
  fecha,
  motivo: texto.min(5),
  destinatarioId: z.string().max(40).optional(),
  actuacionId: z.string().max(40).optional(),
  seguimientoFecha: fecha.optional(),
  responsableId: z.string().optional(),
});
export const respuestaSchema = z
  .object({
    id: z.string(),
    accionesSoe: texto.min(5),
    respuesta: texto.min(5),
    destino: z.enum(DESTINOS_DERIVACION),
    organismoExterno: texto.default(""),
    estado: z.enum(["EN_CURSO", "CERRADA"]),
  })
  .refine(
    (d) => d.destino !== "EXTERNA_ORGANISMO" || !!d.organismoExterno,
    "Indique el organismo externo",
  );
export const seguimientoSchema = z.object({
  fechaProgramada: fecha,
  descripcion: texto.min(5),
  responsableId: z.string().min(1),
  derivacionId: z.string().optional(),
  situacionId: z.string().optional(),
  avisoCorreo: z.boolean().default(false),
});
export const situacionSchema = z
  .object({
    seguimientoFecha: fecha.optional(),
    responsableId: z.string().optional(),
    id: z.string().optional(),
    tipo: z.enum(TIPOS_SITUACION),
    forma: texto.max(100).default(""),
    aval: z.enum(["", "Dirección", "Supervisión"]).default(""),
    estado: z.enum(ESTADOS_SITUACION),
    fechaInicio: fecha,
    fechaVencimiento: fecha.optional(),
    observaciones: texto.default(""),
    detalle: z.record(z.string().max(80), texto).default({}),
  })
  .refine(
    (d) => !d.fechaVencimiento || d.fechaVencimiento >= d.fechaInicio,
    "Vencimiento anterior al inicio",
  )
  .refine(
    (d) =>
      d.tipo !== "EXTENSION_INASISTENCIAS" ||
      d.estado !== "VIGENTE" ||
      d.aval === "Supervisión",
    "La extensión otorgada requiere aval de Supervisión",
  );
export const fichaSchema = z.object({
  tipo: z.enum(["SALUD", "PSICOSOCIAL"]),
  datos: z.object({
    apoyos: texto,
    acuerdos: texto,
    contactosInstitucionales: texto,
    documentacion: texto,
  }),
});
export function diaLocal(ahora = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
}
export function diasHastaFecha(fecha: string | Date, hoy = diaLocal()) {
  return Math.round(
    (Date.parse(new Date(fecha).toISOString().slice(0, 10)) - Date.parse(hoy)) /
      86400000,
  );
}
export function estadoVigencia(
  estado: string,
  vencimiento: string | Date | null,
  hoy = diaLocal(),
) {
  if (estado !== "VIGENTE" || !vencimiento) return estado;
  const dias = diasHastaFecha(vencimiento, hoy);
  return dias < 0 ? "VENCIDA" : dias <= 7 ? "POR_VENCER" : "VIGENTE";
}
export function inasistenciasAnuales(
  e: {
    trayectoria: {
      cicloLectivo: number;
      activo: boolean;
      inasistencias: number | null;
    }[];
    asistencias: { cicloLectivo: number; totalInasistencias: number | null }[];
  },
  ciclo: number,
): number | null {
  const oficiales = e.trayectoria.filter(
    (t) => t.cicloLectivo === ciclo && t.activo && t.inasistencias !== null,
  );
  if (oficiales.length)
    return Math.max(...oficiales.map((t) => t.inasistencias!));
  // Los resúmenes mensuales pueden estar incompletos: no se presentan como acumulado anual.
  return null;
}
function enRango(valor: string, max: number) {
  const n = Number(valor);
  return Number.isInteger(n) && n >= 1 && n <= max;
}

/** Motivo de apertura del legajo que corresponde al tipo y la causa de la actuación. */
export function motivoAperturaDesde(tipo: TipoActuacion, causa: string): MotivoApertura {
  if (tipo === "INASISTENCIAS") {
    if (causa === "Condicionalidad") return "CONDICIONALIDAD";
    if (causa === "+20 inasistencias") return "INASISTENCIAS";
    return "OTRO";
  }
  if (tipo === "CONVIVENCIA_ICE")
    return causa === "Falta grave" || causa === "Falta extremadamente grave" ? "FALTA_GRAVE" : "OTRO";
  if (tipo === "PROTOCOLO") return "PROTOCOLO";
  if (tipo === "ESCOLARIDAD_PROTEGIDA") return "ESCOLARIDAD_PROTEGIDA";
  if (tipo === "DEPORTISTA_FEDERADO") return "DEPORTISTA_FEDERADO";
  if (tipo === "INCLUSION_PPI" && causa === "PPI") return "PPI";
  return "OTRO";
}

export function validarApertura(
  motivo: string | undefined,
  faltas: number | null,
  ice: number,
  ppi: boolean,
): string | null {
  if (!motivo) return "Seleccione la causa de apertura del legajo.";
  if (
    (motivo === "INASISTENCIAS" || motivo === "CONDICIONALIDAD") &&
    (faltas === null || faltas < 20)
  )
    return "La apertura por inasistencias requiere un acumulado anual confirmado de 20 o más faltas en GEI.";
  if (motivo === "ICE_CERO" && ice > 0)
    return "El saldo oficial ICE todavía es mayor que cero.";
  if (motivo === "PPI" && !ppi)
    return "Primero registre el PPI del estudiante.";
  return null;
}
export const REPORTES = [
  "Escolaridades protegidas",
  "Estudiantes federados",
  "CUD o evaluación de capacidades",
  "Condicionales por inasistencias e ICE",
  "Embarazo, paternidad y lactancia",
  "Enfermedades y problemas de aprendizaje",
  "Ingresantes de otra institución",
  "Salidos con pase o por abandono",
  "Resolución de cambio de género",
  "Estudiantes judicializados",
  "Escuela domiciliaria",
  "Matriculados que no asisten",
];
export const CAMPOS_SITUACION: Record<string, string[]> = {
  CUD_EVALUACION: [
    "Certificado o evaluación",
    "PPI vigente",
    "Referente docente",
    "Vínculo GEI",
    "Documentación pendiente",
  ],
  INGRESANTE: [
    "Escuela de origen",
    "Motivo de ingreso",
    "Documentación pendiente",
    "Antecedentes recibidos",
    "Estado del seguimiento",
  ],
  SALIDA: [
    "Escuela de destino",
    "Motivo (pase o abandono)",
    "Gestiones previas",
    "Última actuación",
    "Documentación",
  ],
  NO_ASISTE: [
    "Fecha desde la que no asiste",
    "Llamados",
    "Visitas",
    "Derivaciones",
    "Denuncia al Juzgado de Paz",
    "Denuncia a PODES",
    "Última actuación",
    "Estado del seguimiento",
  ],
  CONDICIONAL_ICE: [
    "Acta libro y folio",
    "Tipo de falta",
    "Descargo",
    "Resolución del Consejo",
    "Plazos",
    "Fundamento institucional",
  ],
  ESCOLARIDAD_PROTEGIDA: [
    "Preceptora de seguimiento",
    "Derivación",
    "Adecuaciones",
  ],
  DEPORTISTA_FEDERADO: [
    "Deporte",
    "Federación",
    "Entrenamientos semanales",
    "Evaluación junio",
    "Evaluación noviembre",
  ],
  CONDICIONAL_INASISTENCIAS: [
    "Acta libro y folio",
    "Citación a familia",
    "Extensión solicitada",
  ],
  EXTENSION_INASISTENCIAS: [
    "Acta libro y folio",
    "Número de aval",
    "Citación a familia",
  ],
  EMBARAZO_PATERNIDAD_LACTANCIA: [
    "Situación",
    "Fecha probable",
    "Adecuaciones de asistencia",
    "Adecuaciones de evaluación",
  ],
  ENFERMEDAD_APRENDIZAJE: [
    "Certificado o informe",
    "Adecuaciones",
    "Equipo de acompañamiento",
  ],
  JUDICIALIZADO: [
    "Organismo",
    "Medida de protección",
    "Estado",
    "Última actuación",
  ],
  ESCUELA_DOMICILIARIA: ["Motivo", "Docente a cargo", "Continuidad pedagógica"],
  CAMBIO_GENERO: [
    "Número de resolución",
    "Fecha de resolución",
    "Nombre elegido",
  ],
  OTRA: [
    "Categoría",
    "Fecha desde que no asiste",
    "Llamados y visitas",
    "Derivaciones",
    "Denuncia al Juzgado de Paz",
    "Denuncia a PODES",
    "Escuela de origen o destino",
    "Documentación",
    "Última actuación",
  ],
};
