"use client";

/**
 * Gráficos del legajo: indicadores principales, asistencia mensual y rendimiento por ciclo/materia.
 * SVG propio (sin librerías): una sola serie por gráfico, color institucional, umbrales en gris y
 * los valores por debajo del umbral marcados en rojo con etiqueta (nunca solo por color).
 */

import { AlertTriangle, BookOpen, CalendarCheck, ShieldAlert, TrendingUp } from "lucide-react";
import { useState, type ReactNode } from "react";
import { nivelAlertaPuntos, PUNTOS_INICIALES } from "@/lib/convivencia";
import { formatearNota } from "@/lib/formato";
import { UMBRAL_ASISTENCIA_RIESGO, UMBRAL_PROMEDIO_BAJO } from "@/lib/rbac";
import type { AsistenciaMensualVisible, CalificacionVisible, LegajoVisible } from "@/lib/types";

const COLOR_SERIE = "#1f57b3"; // institucional-600
const COLOR_RIESGO = "#b91c1c"; // red-700

/** Nota que resume una materia: la final si existe, si no el último período cerrado. */
export function notaVigente(c: CalificacionVisible): number | null {
  return c.notaFinal ?? c.segundoCuatrimestre ?? c.primerCuatrimestre;
}

function promedio(valores: number[]): number | null {
  return valores.length ? Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 100) / 100 : null;
}

// ---------------------------------------------------------------------------
// Indicadores
// ---------------------------------------------------------------------------

function Indicador({
  titulo,
  valor,
  detalle,
  icono,
  alerta,
}: {
  titulo: string;
  valor: string;
  detalle?: ReactNode;
  icono: ReactNode;
  alerta?: string | null;
}) {
  return (
    <div className={`rounded-lg border bg-white p-3 ${alerta ? "border-red-200" : "border-slate-200"}`}>
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
        {icono}
        {titulo}
      </div>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${alerta ? "text-red-700" : "text-slate-900"}`}>{valor}</p>
      {alerta && (
        <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-red-700">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> {alerta}
        </p>
      )}
      {detalle && <div className="mt-1 text-xs text-slate-500">{detalle}</div>}
    </div>
  );
}

export function IndicadoresLegajo({ legajo }: { legajo: LegajoVisible }) {
  const e = legajo.estudiante;
  const cicloActual = Math.max(0, ...legajo.calificaciones.map((c) => c.cicloLectivo));
  const delCiclo = legajo.calificaciones.filter((c) => c.cicloLectivo === cicloActual);
  const enRiesgo = delCiclo.filter((c) => {
    const nota = notaVigente(c);
    return nota !== null && nota < UMBRAL_PROMEDIO_BAJO;
  }).length;
  const puntos = legajo.convivencia?.puntos ?? null;
  const nivelPuntos = puntos === null ? null : nivelAlertaPuntos(puntos);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Indicador
        titulo="Promedio del ciclo"
        valor={e.promedioGeneral > 0 ? formatearNota(e.promedioGeneral) : "—"}
        icono={<TrendingUp className="h-3.5 w-3.5" aria-hidden />}
        alerta={e.promedioGeneral > 0 && e.promedioGeneral < UMBRAL_PROMEDIO_BAJO ? `Menor a ${UMBRAL_PROMEDIO_BAJO}` : null}
      />
      <Indicador
        titulo="Asistencia"
        valor={`${e.porcentajeAsistencia.toLocaleString("es-AR")}%`}
        icono={<CalendarCheck className="h-3.5 w-3.5" aria-hidden />}
        alerta={e.porcentajeAsistencia < UMBRAL_ASISTENCIA_RIESGO ? `Menor a ${UMBRAL_ASISTENCIA_RIESGO}%` : null}
      />
      <Indicador
        titulo="Materias bajo 6"
        valor={delCiclo.length ? String(enRiesgo) : "—"}
        detalle={delCiclo.length ? `de ${delCiclo.length} materias en ${cicloActual}` : "Sin notas importadas"}
        icono={<BookOpen className="h-3.5 w-3.5" aria-hidden />}
        alerta={enRiesgo >= 3 ? "Riesgo pedagógico" : null}
      />
      {puntos !== null && (
        <Indicador
          titulo="Puntos ICE (GEI)"
          valor={`${puntos} / ${PUNTOS_INICIALES}`}
          icono={<ShieldAlert className="h-3.5 w-3.5" aria-hidden />}
          alerta={nivelPuntos === "critico" ? "Crítico" : nivelPuntos === "atencion" ? "Requiere atención" : null}
          detalle={
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(Math.max(0, puntos) / PUNTOS_INICIALES) * 100}%`,
                  background: nivelPuntos === "ok" ? COLOR_SERIE : COLOR_RIESGO,
                }}
              />
            </div>
          }
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Barras verticales con umbral (asistencia mensual, promedio por ciclo)
// ---------------------------------------------------------------------------

interface Barra {
  clave: string;
  etiqueta: string;
  valor: number;
  detalle: string;
  provisorio?: boolean;
}

function BarrasConUmbral({
  barras,
  maximo,
  umbral,
  etiquetaUmbral,
  formatear,
  descripcion,
}: {
  barras: Barra[];
  maximo: number;
  umbral: number;
  etiquetaUmbral: string;
  formatear: (v: number) => string;
  descripcion: string;
}) {
  const [activa, setActiva] = useState<string | null>(null);
  const alto = 140;
  const anchoBarra = 28;
  const separacion = 14;
  const margenIzq = 4;
  const ancho = margenIzq + barras.length * (anchoBarra + separacion);
  const y = (v: number) => alto - (Math.max(0, Math.min(maximo, v)) / maximo) * alto;
  const seleccionada = barras.find((b) => b.clave === activa);

  return (
    <figure className="relative">
      <div className="overflow-x-auto">
        <svg
          role="img"
          aria-label={descripcion}
          width={ancho}
          height={alto + 36}
          viewBox={`0 0 ${ancho} ${alto + 36}`}
          className="block"
          onMouseLeave={() => setActiva(null)}
        >
          <line x1={0} x2={ancho} y1={alto} y2={alto} stroke="#cbd5e1" strokeWidth={1} />
          <line x1={0} x2={ancho} y1={y(umbral)} y2={y(umbral)} stroke="#94a3b8" strokeWidth={1} strokeDasharray="4 3" />
          {barras.map((b, i) => {
            const x = margenIzq + i * (anchoBarra + separacion);
            const bajo = b.valor < umbral;
            // Mínimo visible de 4px para que un 0% no desaparezca; extremo superior redondeado.
            const top = Math.min(y(b.valor), alto - 4);
            return (
              <g key={b.clave} onMouseEnter={() => setActiva(b.clave)} onFocus={() => setActiva(b.clave)} tabIndex={0}>
                <rect x={x - separacion / 2} y={0} width={anchoBarra + separacion} height={alto + 36} fill="transparent" />
                <path
                  d={`M${x},${alto} V${top + 4} q0,-4 4,-4 h${anchoBarra - 8} q4,0 4,4 V${alto} Z`}
                  fill={bajo ? COLOR_RIESGO : COLOR_SERIE}
                  opacity={b.provisorio ? 0.45 : activa && activa !== b.clave ? 0.55 : 1}
                />
                <text x={x + anchoBarra / 2} y={alto + 14} textAnchor="middle" className="fill-slate-500 text-[10px]">
                  {b.etiqueta}
                </text>
                {bajo && (
                  <text x={x + anchoBarra / 2} y={alto + 28} textAnchor="middle" className="fill-red-700 text-[9px] font-semibold">
                    {formatear(b.valor)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <figcaption className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-0 w-4 border-t border-dashed border-slate-400" aria-hidden /> {etiquetaUmbral}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLOR_RIESGO }} aria-hidden /> Por debajo del umbral
        </span>
        {barras.some((b) => b.provisorio) && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm opacity-45" style={{ background: COLOR_SERIE }} aria-hidden /> Mes sin cerrar
          </span>
        )}
      </figcaption>
      {seleccionada && (
        <div className="pointer-events-none absolute right-0 top-0 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
          <p className="font-semibold text-slate-800">{seleccionada.etiqueta}</p>
          <p className="tabular-nums text-slate-700">{formatear(seleccionada.valor)}</p>
          <p className="text-slate-500">{seleccionada.detalle}</p>
        </div>
      )}
    </figure>
  );
}

const ABREVIATURA_MES: Record<string, string> = {
  Febrero: "Feb",
  Marzo: "Mar",
  Abril: "Abr",
  Mayo: "May",
  Junio: "Jun",
  Julio: "Jul",
  Agosto: "Ago",
  Septiembre: "Sep",
  Octubre: "Oct",
  Noviembre: "Nov",
  Diciembre: "Dic",
};

const formatearPorcentaje = (v: number) => `${v.toLocaleString("es-AR")}%`;

export function GraficoAsistenciaMensual({ meses }: { meses: AsistenciaMensualVisible[] }) {
  const ciclo = Math.max(...meses.map((m) => m.cicloLectivo));
  const delCiclo = meses.filter((m) => m.cicloLectivo === ciclo);
  const barras: Barra[] = delCiclo
    .filter((m) => m.porcentaje !== null)
    .map((m) => ({
      clave: m.id,
      // Julio aparece en los dos períodos (antes y después del receso).
      etiqueta: `${ABREVIATURA_MES[m.mes] ?? m.mes.slice(0, 3)}${m.mes === "Julio" && m.periodo.startsWith("Segundo") ? "²" : ""}`,
      valor: m.porcentaje as number,
      detalle: `${m.periodo} · ${m.totalInasistencias ?? 0} inasist. (${m.justificadas ?? 0} J / ${m.injustificadas ?? 0} I)${m.cerrado ? "" : " · sin cerrar"}`,
      provisorio: !m.cerrado,
    }));
  if (barras.length === 0) return <p className="text-sm text-slate-500">Sin asistencia mensual importada desde el GEI PAD.</p>;

  const totalJ = delCiclo.reduce((t, m) => t + (m.justificadas ?? 0), 0);
  const totalI = delCiclo.reduce((t, m) => t + (m.injustificadas ?? 0), 0);

  return (
    <div className="space-y-2">
      <BarrasConUmbral
        barras={barras}
        maximo={100}
        umbral={UMBRAL_ASISTENCIA_RIESGO}
        etiquetaUmbral={`Umbral de riesgo (${UMBRAL_ASISTENCIA_RIESGO}%)`}
        formatear={formatearPorcentaje}
        descripcion={`Porcentaje de asistencia mensual del ciclo ${ciclo}`}
      />
      <p className="text-xs text-slate-600">
        Inasistencias {ciclo}: <strong className="tabular-nums">{(totalJ + totalI).toLocaleString("es-AR")}</strong> (
        <span className="tabular-nums">{totalJ.toLocaleString("es-AR")}</span> justificadas ·{" "}
        <span className="tabular-nums">{totalI.toLocaleString("es-AR")}</span> injustificadas)
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rendimiento: promedio por ciclo + materias del ciclo seleccionado
// ---------------------------------------------------------------------------

export function GraficoPromediosPorCiclo({ calificaciones }: { calificaciones: CalificacionVisible[] }) {
  const ciclos = [...new Set(calificaciones.map((c) => c.cicloLectivo))].sort((a, b) => a - b);
  const barras: Barra[] = ciclos.flatMap((ciclo) => {
    const notas = calificaciones
      .filter((c) => c.cicloLectivo === ciclo)
      .map(notaVigente)
      .filter((n): n is number => n !== null);
    const valor = promedio(notas);
    return valor === null
      ? []
      : [{ clave: String(ciclo), etiqueta: String(ciclo), valor, detalle: `Promedio de ${notas.length} materias` }];
  });
  if (barras.length < 2) return null;
  return (
    <BarrasConUmbral
      barras={barras}
      maximo={10}
      umbral={UMBRAL_PROMEDIO_BAJO}
      etiquetaUmbral={`Aprobación (${UMBRAL_PROMEDIO_BAJO})`}
      formatear={(v) => formatearNota(v)}
      descripcion="Promedio general por ciclo lectivo"
    />
  );
}

/** Barras horizontales: una por materia, con la nota vigente y la línea de aprobación. */
export function GraficoMaterias({ calificaciones }: { calificaciones: CalificacionVisible[] }) {
  const filas = calificaciones
    .map((c) => ({ c, nota: notaVigente(c) }))
    .filter((f): f is { c: CalificacionVisible; nota: number } => f.nota !== null)
    .sort((a, b) => a.nota - b.nota);
  if (filas.length === 0) return null;
  return (
    <ul className="space-y-1.5" aria-label="Nota vigente por materia">
      {filas.map(({ c, nota }) => {
        const bajo = nota < UMBRAL_PROMEDIO_BAJO;
        return (
          <li key={c.id} className="grid grid-cols-[minmax(0,11rem)_1fr_2.5rem] items-center gap-2 text-xs">
            <span className="truncate text-slate-700" title={c.materia}>
              {c.materia}
            </span>
            <span className="relative h-2.5 rounded-full bg-slate-100">
              <span
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${(nota / 10) * 100}%`, background: bajo ? COLOR_RIESGO : COLOR_SERIE }}
              />
              <span className="absolute inset-y-[-3px] w-px bg-slate-400" style={{ left: `${UMBRAL_PROMEDIO_BAJO * 10}%` }} aria-hidden />
            </span>
            <span className={`text-right tabular-nums ${bajo ? "font-semibold text-red-700" : "text-slate-700"}`}>
              {formatearNota(nota)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
