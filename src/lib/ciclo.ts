/**
 * Ciclo lectivo y años que sigue el LUE.
 *
 * En Mendoza el ciclo arranca en marzo: en enero y febrero se sigue trabajando con el ciclo anterior
 * (notas finales, mesas de febrero). El LUE empezó en 2026 con 1.º a 3.º y suma un año por ciclo
 * para acompañar a la cohorte: 2027 → 1.º a 4.º, 2028 → 1.º a 5.º (último año de la escuela).
 */

/** Mes (1-12) en que empieza el ciclo lectivo. */
export const MES_INICIO_CICLO = 3;
export const CICLO_INICIO_LUE = 2026;
export const ANIOS_INICIALES_LUE = 3;
/** Último año de la escuela 4012 (5.º). Configurable en el scraper con GEI_ANIO_MAXIMO. */
export const ANIO_MAXIMO_ESCUELA = 5;

/** Año y mes de una fecha en la hora de Mendoza. */
function anioMesMendoza(fecha: Date): { anio: number; mes: number } {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Mendoza",
    year: "numeric",
    month: "numeric",
  }).formatToParts(fecha);
  const valor = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value);
  return { anio: valor("year"), mes: valor("month") };
}

/** Ciclo lectivo vigente en una fecha (por defecto, hoy). */
export function cicloLectivoActual(fecha: Date = new Date()): number {
  const { anio, mes } = anioMesMendoza(fecha);
  return mes >= MES_INICIO_CICLO ? anio : anio - 1;
}

/** Ciclo lectivo de una fecha AAAA-MM-DD (p. ej. de una actuación). */
export function cicloDeFecha(fechaIso: string): number {
  const anio = Number(fechaIso.slice(0, 4));
  const mes = Number(fechaIso.slice(5, 7));
  return mes >= MES_INICIO_CICLO ? anio : anio - 1;
}

/** Años que sigue el LUE en un ciclo: 2026 → [1,2,3], 2027 → [1,2,3,4]… */
export function aniosSeguidos(ciclo: number, anioMaximo: number = ANIO_MAXIMO_ESCUELA): number[] {
  const hasta = Math.min(anioMaximo, Math.max(ANIOS_INICIALES_LUE, ANIOS_INICIALES_LUE + (ciclo - CICLO_INICIO_LUE)));
  return Array.from({ length: hasta }, (_, i) => i + 1);
}
