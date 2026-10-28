import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import {
  tienePermiso,
  UMBRAL_ALERTA_PUNTOS,
  UMBRAL_ASISTENCIA_RIESGO,
  UMBRAL_PROMEDIO_BAJO,
} from "./rbac";
import type { FiltrosEstudiantes, MetricasInstitucionales, Rol } from "./types";

/** Relaciones necesarias para armar el legajo unificado (luego se sanitiza con rbac.sanitizarLegajo). */
export const INCLUDE_LEGAJO = {
  calificaciones: true,
  incidentes: { include: { autor: { select: { nombre: true } } } },
  intervenciones: { include: { profesional: { select: { nombre: true } } } },
  trayectoria: true,
  alertas: true,
  faltasIce: true,
  asistencias: true,
} satisfies Prisma.EstudianteInclude;

export function construirFiltroEstudiantes(filtros: FiltrosEstudiantes): Prisma.EstudianteWhereInput {
  const condiciones: Prisma.EstudianteWhereInput[] = [];

  const q = filtros.q?.trim();
  if (q) {
    condiciones.push(
      /^\d+$/.test(q)
        ? { dni: { startsWith: q } }
        : {
            OR: [
              { apellidos: { contains: q, mode: "insensitive" } },
              { nombres: { contains: q, mode: "insensitive" } },
            ],
          },
    );
  }
  if (filtros.anio !== undefined) condiciones.push({ anio: filtros.anio });
  if (filtros.division) condiciones.push({ division: filtros.division });
  if (filtros.alertaPuntos) condiciones.push({ puntosConvivencia: { lt: UMBRAL_ALERTA_PUNTOS } });
  if (filtros.conCud) condiciones.push({ tieneCud: true });
  if (filtros.promedioBajo) condiciones.push({ promedioGeneral: { lt: UMBRAL_PROMEDIO_BAJO } });

  return condiciones.length > 0 ? { AND: condiciones } : {};
}

export async function obtenerMetricas(rol: Rol): Promise<MetricasInstitucionales> {
  const regulares: Prisma.EstudianteWhereInput = { estadoMatricula: "REGULAR" };
  const [matriculaTotal, conCudOPpi, alertasConvivencia, riesgoPedagogico] = await Promise.all([
    prisma.estudiante.count({ where: regulares }),
    prisma.estudiante.count({ where: { ...regulares, OR: [{ tieneCud: true }, { requierePpi: true }] } }),
    tienePermiso(rol, "VER_CONVIVENCIA")
      ? prisma.estudiante.count({ where: { ...regulares, puntosConvivencia: { lt: UMBRAL_ALERTA_PUNTOS } } })
      : Promise.resolve(null),
    prisma.estudiante.count({
      where: {
        ...regulares,
        OR: [
          { promedioGeneral: { lt: UMBRAL_PROMEDIO_BAJO } },
          { porcentajeAsistencia: { lt: UMBRAL_ASISTENCIA_RIESGO } },
        ],
      },
    }),
  ]);
  return { matriculaTotal, conCudOPpi, alertasConvivencia, riesgoPedagogico };
}
