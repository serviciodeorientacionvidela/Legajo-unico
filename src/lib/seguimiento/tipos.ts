import type {
  TipoActuacion,
  MotivoApertura,
  TipoSituacion,
  EstadoSituacion,
  EstadoMatricula,
} from "../types";
/** JSON del circuito: tipos independientes de Prisma para evitar tipos recursivos en el cliente. */
export interface DatosSeguimiento {
  perfil: string;
  estudiante: {
    id: string;
    dni: string;
    apellidos: string;
    nombres: string;
    anio: number;
    division: string;
    turno: string;
    estadoMatricula: EstadoMatricula;
    promedioGeneral: number;
    puntosConvivencia: number;
    tieneCud: boolean;
    requierePpi: boolean;
    legajoAbiertoEl: string | null;
    motivoApertura: MotivoApertura | null;
    detalleApertura: string | null;
    aperturaPromedio: number | null;
    aperturaPendientes: number | null;
    aperturaInasistencias: number | null;
    aperturaIce: number | null;
    aperturaTrayectoria: unknown;
    calificaciones: { previa: boolean }[];
  };
  inasistencias: number | null;
  actuaciones: {
    id: string;
    fecha: string;
    cicloLectivo: number;
    tipo: TipoActuacion;
    motivo: string;
    resumen: string;
    confidencial: boolean;
    autor: { nombre: string; rol: string };
    createdAt: string;
    anuladaEl: string | null;
    motivoAnulacion?: string | null;
    tipoActa?: string | null;
    actaLibro?: string | null;
    actaFolio?: string | null;
  }[];
  derivaciones: {
    id: string;
    fecha: string;
    motivo: string;
    estado: string;
    respuesta: string | null;
    accionesSoe?: string | null;
    derivadoPor: { nombre: string };
  }[];
  seguimientos: {
    id: string;
    fechaProgramada: string;
    descripcion: string;
    estado: string;
    resultado: string | null;
    responsable: { nombre: string } | null;
  }[];
  situaciones: {
    id: string;
    tipo: TipoSituacion;
    condicion: string;
    estado: EstadoSituacion;
    fechaInicio: string;
    fechaVencimiento: string | null;
    forma: string | null;
    aval: string | null;
    observaciones: string | null;
    detalle: Record<string, unknown> | null;
  }[];
  fichas: { tipo: string; updatedAt: string }[];
  responsables: { id: string; nombre: string }[];
}
export interface DatosBandeja {
  perfil: string;
  avisos: {
    id: string;
    titulo: string;
    mensaje: string;
    enlace: string | null;
    createdAt: string;
  }[];
  estudiantes: {
    id: string;
    dni: string;
    nombre: string;
    anio: number;
    division: string;
    turno: string;
    estadoMatricula: string;
    abierto: boolean;
    inasistencias: number | null;
    ice: number;
    pendientes: number;
    seguimientos: { id: string; fechaProgramada: string }[];
  }[];
}
export interface ReporteDatos {
  titulo: string;
  ciclo: number;
  fecha: string;
  restringido: boolean;
  filas: Record<string, string | number>[];
}
