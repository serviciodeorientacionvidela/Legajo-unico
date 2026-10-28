/**
 * Parseo de la ficha del alumno del GEI (alumno/ver/{id}).
 * El scraper extrae las celdas de texto de las tablas "Trayectoria" y "Sistema de Alertas Tempranas";
 * este módulo (puro, sin dependencias de servidor) las convierte en registros tipados.
 */

/** Celdas de texto de una ficha, ya extraídas del HTML. */
export interface FichaGei {
  dni: string;
  trayectoria: string[][];
  alertas: string[][];
}

export interface TrayectoriaGei {
  cicloLectivo: number;
  condicion: string | null;
  escuela: string;
  division: string | null;
  fechaIngreso: Date | null;
  motivoIngreso: string | null;
  fechaEgreso: Date | null;
  motivoEgreso: string | null;
  activo: boolean;
  inasistencias: number | null;
}

export interface AlertaTempranaGei {
  fecha: Date | null;
  escuela: string | null;
  causas: string;
  planIntervencion: string | null;
  observaciones: string | null;
}

/** Rótulos de encabezado que identifican cada tabla dentro de la ficha. */
export const ROTULOS_TABLA_TRAYECTORIA = ["C.L.", "Condición", "Legajo", "Inasistencias"];
export const ROTULOS_TABLA_ALERTAS = ["Causas", "Plan de intervención"];

function textoONull(valor: string | undefined): string | null {
  const t = (valor ?? "").trim();
  return t ? t : null;
}

/** "27/02/26" o "27/02/2026" → fecha UTC. */
export function parsearFechaCorta(valor: string | undefined): Date | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec((valor ?? "").trim());
  if (!m) return null;
  const anio = m[3]!.length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const fecha = new Date(Date.UTC(anio, Number(m[2]) - 1, Number(m[1])));
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/**
 * Columnas: C.L. | Condición | Escuela | División | Legajo | Ingreso (fecha, motivo) |
 * Egreso (fecha, motivo) | Estado | Inasistencias | acciones.
 */
export function parsearTrayectoria(filas: string[][]): TrayectoriaGei[] {
  return filas.flatMap((c) => {
    const ciclo = Number(c[0]);
    const escuela = textoONull(c[2]);
    if (!Number.isInteger(ciclo) || ciclo < 1990 || !escuela) return [];
    const inasistencias = Number((c[10] ?? "").replace(/\./g, "").replace(",", "."));
    return [
      {
        cicloLectivo: ciclo,
        condicion: textoONull(c[1]),
        escuela,
        division: textoONull(c[3]),
        fechaIngreso: parsearFechaCorta(c[5]),
        motivoIngreso: textoONull(c[6]),
        fechaEgreso: parsearFechaCorta(c[7]),
        motivoEgreso: textoONull(c[8]),
        activo: (c[9] ?? "").trim().toLowerCase() === "activo",
        inasistencias: c[10]?.trim() && Number.isFinite(inasistencias) ? inasistencias : null,
      },
    ];
  });
}

/** Columnas: Fecha | Escuela | Causas | Plan de intervención | Observaciones. */
export function parsearAlertas(filas: string[][]): AlertaTempranaGei[] {
  return filas.flatMap((c) => {
    const causas = textoONull(c[2]);
    if (!causas) return [];
    return [
      {
        fecha: parsearFechaCorta(c[0]),
        escuela: textoONull(c[1]),
        causas,
        planIntervencion: textoONull(c[3]),
        observaciones: textoONull(c[4]),
      },
    ];
  });
}
