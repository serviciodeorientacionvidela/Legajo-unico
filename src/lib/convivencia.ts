/**
 * Reglas del régimen de convivencia por puntos (Acuerdos Escolares de Convivencia).
 * Cada estudiante inicia el ciclo con 20 puntos. Módulo puro: lo usan la API y la UI.
 */

import type { TipoIncidente } from "./types";

export const PUNTOS_INICIALES = 20;

export const REGLAS_INCIDENTE: Record<
  TipoIncidente,
  { etiqueta: string; sugeridos: number; minimo: number; maximo: number }
> = {
  LEVE: { etiqueta: "Falta leve", sugeridos: 2, minimo: 1, maximo: 3 },
  MODERADA: { etiqueta: "Falta moderada", sugeridos: 5, minimo: 4, maximo: 7 },
  GRAVE: { etiqueta: "Falta grave", sugeridos: 10, minimo: 8, maximo: 20 },
  ACUERDO_PEDAGOGICO: { etiqueta: "Acuerdo pedagógico (sin quita)", sugeridos: 0, minimo: 0, maximo: 0 },
};

export function validarPuntos(tipo: TipoIncidente, puntos: number): string | null {
  const regla = REGLAS_INCIDENTE[tipo];
  if (!Number.isInteger(puntos)) return "Los puntos deben ser un número entero.";
  if (puntos < regla.minimo || puntos > regla.maximo) {
    return regla.minimo === regla.maximo
      ? `Un ${regla.etiqueta.toLowerCase()} descuenta ${regla.minimo} puntos.`
      : `Para ${regla.etiqueta.toLowerCase()} corresponde descontar entre ${regla.minimo} y ${regla.maximo} puntos.`;
  }
  return null;
}

/** Puntos que efectivamente se descuentan: el saldo nunca queda negativo. */
export function descuentoEfectivo(puntosActuales: number, puntosSolicitados: number): number {
  return Math.max(0, Math.min(puntosActuales, puntosSolicitados));
}

export function nivelAlertaPuntos(puntos: number): "ok" | "atencion" | "critico" {
  if (puntos < 6) return "critico";
  if (puntos < 10) return "atencion";
  return "ok";
}
