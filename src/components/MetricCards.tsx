"use client";

import { Accessibility, Lock, ShieldAlert, TrendingDown, Users } from "lucide-react";
import type { ReactNode } from "react";
import type { MetricasInstitucionales } from "@/lib/types";

export type FiltroRapido = "todos" | "cud" | "convivencia" | "riesgo";

interface Props {
  metricas: MetricasInstitucionales | null;
  onFiltroRapido: (filtro: FiltroRapido) => void;
}

function Tarjeta({
  titulo,
  valor,
  detalle,
  icono,
  color,
  onClick,
  bloqueada = false,
}: {
  titulo: string;
  valor: number | null | undefined;
  detalle: string;
  icono: ReactNode;
  color: string;
  onClick?: () => void;
  bloqueada?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={bloqueada}
      className="tarjeta group flex items-start gap-4 p-5 text-left transition hover:-translate-y-0.5 hover:border-institucional-300 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:border-slate-200/70"
    >
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${color}`}>{icono}</span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</span>
        {bloqueada ? (
          <span className="mt-1 flex items-center gap-1 text-sm font-medium text-slate-400">
            <Lock className="h-4 w-4" aria-hidden /> Sin acceso
          </span>
        ) : (
          <span className="mt-0.5 block text-3xl font-bold tabular-nums text-institucional-950">
            {valor === undefined || valor === null ? "—" : valor}
          </span>
        )}
        <span className="block text-xs text-slate-500">{detalle}</span>
      </span>
    </button>
  );
}

export default function MetricCards({ metricas, onFiltroRapido }: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Tarjeta
        titulo="Matrícula total"
        valor={metricas?.matriculaTotal}
        detalle="Estudiantes regulares"
        icono={<Users className="h-5 w-5 text-white" />}
        color="bg-institucional-600"
        onClick={() => onFiltroRapido("todos")}
      />
      <Tarjeta
        titulo="Con CUD / PPI"
        valor={metricas?.conCudOPpi}
        detalle="Requieren adaptación"
        icono={<Accessibility className="h-5 w-5 text-violet-700" />}
        color="bg-violet-50"
        onClick={() => onFiltroRapido("cud")}
      />
      <Tarjeta
        titulo="Alertas de convivencia"
        valor={metricas?.alertasConvivencia}
        detalle="Menos de 10 puntos"
        icono={<ShieldAlert className="h-5 w-5 text-amber-700" />}
        color="bg-amber-50"
        bloqueada={metricas !== null && metricas.alertasConvivencia === null}
        onClick={() => onFiltroRapido("convivencia")}
      />
      <Tarjeta
        titulo="Riesgo pedagógico"
        valor={metricas?.riesgoPedagogico}
        detalle="Promedio < 6 o asistencia < 85%"
        icono={<TrendingDown className="h-5 w-5 text-red-700" />}
        color="bg-red-50"
        onClick={() => onFiltroRapido("riesgo")}
      />
    </div>
  );
}
