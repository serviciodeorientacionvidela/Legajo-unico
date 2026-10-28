/**
 * Parseo de la ficha del alumno del GEI (alumno/ver/{id}).
 * El scraper extrae las celdas de texto de las tablas "Trayectoria" y "Sistema de Alertas Tempranas";
 * este módulo (puro, sin dependencias de servidor) las convierte en registros tipados.
 */

/** Celdas de texto de una ficha (alumno/ver) y de su escritorio G.E.I. PAD, ya extraídas del HTML. */
export interface FichaGei {
  dni: string;
  trayectoria: string[][];
  alertas: string[][];
  /** null si no se pudo leer el escritorio PAD: no se toca lo ya importado. */
  pad: PadGei | null;
}

export interface PadGei {
  /** "Total: 25" del bloque Puntos ICE. */
  totalIce: number | null;
  /** Puntos cargados: Fecha | Puntos | Tipo de falta. */
  faltas: string[][];
  /** Puntos dados de baja: Fecha | Puntos | Tipo de falta | Fecha baja. */
  faltasBaja: string[][];
  /** Una tabla por período: Mes | J | I | Total del mes | Asistencia | % (el mes cerrado termina en "🔒"). */
  asistencia: { periodo: string; filas: string[][] }[];
}

export interface FaltaIceGei {
  fecha: Date | null;
  puntos: number;
  tipo: string;
  dadaDeBaja: boolean;
  fechaBaja: Date | null;
}

export interface AsistenciaMensualGei {
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

export const MARCA_MES_CERRADO = "🔒";

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

function numeroGei(valor: string | undefined): number | null {
  const t = (valor ?? "").replace("%", "").trim();
  if (!/^-?\d+(?:[.,]\d+)?$/.test(t)) return null;
  return Number(t.replace(",", "."));
}

/** Faltas vigentes y dadas de baja del bloque Puntos ICE. */
export function parsearFaltasIce(pad: PadGei): FaltaIceGei[] {
  const vigentes = pad.faltas.flatMap((c) => {
    const puntos = numeroGei(c[1]);
    return puntos === null ? [] : [{ fecha: parsearFechaCorta(c[0]), puntos, tipo: c[2]?.trim() || "—", dadaDeBaja: false, fechaBaja: null }];
  });
  const bajas = pad.faltasBaja.flatMap((c) => {
    const puntos = numeroGei(c[1]);
    return puntos === null
      ? []
      : [{ fecha: parsearFechaCorta(c[0]), puntos, tipo: c[2]?.trim() || "—", dadaDeBaja: true, fechaBaja: parsearFechaCorta(c[3]) }];
  });
  return [...vigentes, ...bajas];
}

/** Meses con datos de los cuadros de asistencia del PAD, en orden de aparición. */
export function parsearAsistenciaMensual(pad: PadGei): AsistenciaMensualGei[] {
  let orden = 0;
  return pad.asistencia.flatMap(({ periodo, filas }) =>
    filas.flatMap((c) => {
      const cerrado = (c[0] ?? "").includes(MARCA_MES_CERRADO);
      const mes = (c[0] ?? "").replace(MARCA_MES_CERRADO, "").trim();
      const valores = [c[1], c[2], c[3], c[4], c[5]].map(numeroGei);
      if (!mes || valores.every((v) => v === null)) return [];
      const [justificadas, injustificadas, totalInasistencias, diasAsistidos, porcentaje] = valores;
      return [
        {
          periodo: periodo.replace(/\s*-\s*\d{2}\/.*$/, "").trim(),
          orden: orden++,
          mes,
          justificadas: justificadas ?? null,
          injustificadas: injustificadas ?? null,
          totalInasistencias: totalInasistencias ?? null,
          diasAsistidos: diasAsistidos ?? null,
          porcentaje: porcentaje ?? null,
          cerrado,
        },
      ];
    }),
  );
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
