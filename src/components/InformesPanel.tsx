"use client";

/**
 * Informes institucionales: resumen por curso, rendimiento por materia, estudiantes en seguimiento,
 * convivencia, agenda del SOE y nómina. Cada pestaña se filtra por año/división, se exporta a Excel
 * (CSV) y se imprime / guarda como PDF con membrete institucional.
 */

import {
  AlertTriangle,
  BookOpen,
  ChevronRight,
  FileSpreadsheet,
  HeartPulse,
  LayoutDashboard,
  ListChecks,
  Loader2,
  Printer,
  RefreshCw,
  ShieldAlert,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { REGLAS_INCIDENTE } from "@/lib/convivencia";
import { etiquetaCurso, formatearFecha, formatearNota } from "@/lib/formato";
import {
  aCsv,
  distribucionNotas,
  materiasBajoUmbral,
  motivosDeRiesgo,
  nivelDeRiesgo,
  resumenPorCurso,
  resumenPorMateria,
  resumenTotal,
  tieneNotas,
  type DatosInforme,
  type FilaInforme,
  type IncidenteInforme,
  type IntervencionInforme,
  type NivelRiesgo,
} from "@/lib/informes";
import { UMBRAL_ALERTA_PUNTOS, UMBRAL_ASISTENCIA_RIESGO, UMBRAL_PROMEDIO_BAJO } from "@/lib/rbac";
import { TIPO_INTERVENCION_ETIQUETA, TIPOS_INCIDENTE, TIPOS_INTERVENCION } from "@/lib/types";
import { DocumentoInforme, descargarArchivo, nombreArchivo, useImpresion, ZonaImpresion } from "./Imprimible";
import { Insignia, MensajeError } from "./ui";

type Pestana = "resumen" | "materias" | "riesgo" | "convivencia" | "soe" | "nomina";

const PESTANAS: { id: Pestana; titulo: string; tituloInforme: string; icono: ReactNode }[] = [
  { id: "resumen", titulo: "Resumen", tituloInforme: "Informe institucional por curso", icono: <LayoutDashboard className="h-4 w-4" aria-hidden /> },
  { id: "materias", titulo: "Por materia", tituloInforme: "Rendimiento por espacio curricular", icono: <BookOpen className="h-4 w-4" aria-hidden /> },
  { id: "riesgo", titulo: "En seguimiento", tituloInforme: "Estudiantes que requieren seguimiento", icono: <AlertTriangle className="h-4 w-4" aria-hidden /> },
  { id: "convivencia", titulo: "Convivencia", tituloInforme: "Informe de convivencia escolar", icono: <ShieldAlert className="h-4 w-4" aria-hidden /> },
  { id: "soe", titulo: "SOE", tituloInforme: "Informe del Servicio de Orientación Escolar", icono: <HeartPulse className="h-4 w-4" aria-hidden /> },
  { id: "nomina", titulo: "Nómina", tituloInforme: "Nómina de estudiantes", icono: <Users className="h-4 w-4" aria-hidden /> },
];

const num = (v: number | null | undefined, sufijo = "") => (v === null || v === undefined ? "—" : `${v.toLocaleString("es-AR")}${sufijo}`);
const pct = (parte: number, total: number) => (total ? Math.round((parte / total) * 1000) / 10 : 0);
const curso = (f: { anio: number; division: string }) => etiquetaCurso(f.anio, f.division);
const hoy = () => new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Piezas visuales
// ---------------------------------------------------------------------------

function Kpi({ titulo, valor, detalle, alerta }: { titulo: string; valor: string; detalle?: string; alerta?: boolean }) {
  return (
    <div className={`evitar-corte rounded-2xl border bg-white p-4 ${alerta ? "border-red-200" : "border-slate-200/70"}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${alerta ? "text-red-700" : "text-institucional-950"}`}>{valor}</p>
      {detalle && <p className="mt-0.5 text-xs text-slate-500">{detalle}</p>}
    </div>
  );
}

function Panel({ titulo, accion, children }: { titulo: string; accion?: ReactNode; children: ReactNode }) {
  return (
    <section className="tarjeta evitar-corte overflow-hidden">
      <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
        <h3 className="text-sm font-bold text-institucional-950">{titulo}</h3>
        {accion}
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

interface Barra {
  clave: string;
  etiqueta: string;
  valor: number;
  texto: string;
  riesgo?: boolean;
}

/** Barras horizontales de una sola serie; las que superan el umbral se marcan en rojo con texto. */
function BarrasHorizontales({ barras, maximo }: { barras: Barra[]; maximo?: number }) {
  const tope = maximo ?? Math.max(1, ...barras.map((b) => b.valor));
  if (barras.length === 0) return <p className="text-sm text-slate-500">Sin datos para graficar.</p>;
  return (
    <ul className="space-y-1.5">
      {barras.map((b) => (
        <li key={b.clave} className="grid grid-cols-[minmax(0,11rem)_1fr_4.5rem] items-center gap-3 text-xs" title={`${b.etiqueta}: ${b.texto}`}>
          <span className="truncate text-slate-700">{b.etiqueta}</span>
          <span className="h-3 rounded-full bg-slate-100">
            <span
              className="block h-full rounded-full"
              style={{ width: `${Math.max(1.5, (b.valor / tope) * 100)}%`, backgroundColor: b.riesgo ? "#b91c1c" : "#0b7b83" }}
            />
          </span>
          <span className={`text-right tabular-nums ${b.riesgo ? "font-semibold text-red-700" : "text-slate-700"}`}>{b.texto}</span>
        </li>
      ))}
    </ul>
  );
}

/** Histograma vertical (distribución de notas). */
function Histograma({ columnas }: { columnas: { franja: string; cantidad: number; riesgo: boolean }[] }) {
  const total = columnas.reduce((a, c) => a + c.cantidad, 0);
  const tope = Math.max(1, ...columnas.map((c) => c.cantidad));
  if (total === 0) return <p className="text-sm text-slate-500">Sin calificaciones del ciclo.</p>;
  return (
    <div>
      <div className="flex h-40 items-end gap-2 border-b border-slate-300">
        {columnas.map((c) => (
          <div key={c.franja} className="flex h-full flex-1 flex-col justify-end" title={`${c.franja}: ${c.cantidad} notas (${pct(c.cantidad, total)}%)`}>
            <span className={`mb-1 text-center text-[11px] tabular-nums ${c.riesgo ? "font-semibold text-red-700" : "text-slate-600"}`}>
              {pct(c.cantidad, total)}%
            </span>
            <span
              className="block rounded-t"
              style={{ height: `${(c.cantidad / tope) * 100}%`, minHeight: c.cantidad ? 3 : 0, backgroundColor: c.riesgo ? "#b91c1c" : "#0b7b83" }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-2">
        {columnas.map((c) => (
          <span key={c.franja} className="flex-1 text-center text-[11px] text-slate-500">
            {c.franja}
          </span>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {total.toLocaleString("es-AR")} notas vigentes · en rojo, las franjas por debajo de 6 (no aprobado).
      </p>
    </div>
  );
}

const TONO_NIVEL: Record<NivelRiesgo, "rojo" | "ambar" | "neutro"> = { alto: "rojo", medio: "ambar", bajo: "neutro" };

function BotonLegajo({ dni, onVerLegajo }: { dni: string; onVerLegajo?: (dni: string) => void }) {
  if (!onVerLegajo) return null;
  return (
    <button
      type="button"
      onClick={() => onVerLegajo(dni)}
      className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold text-institucional-700 ring-1 ring-inset ring-institucional-200 hover:bg-institucional-50 print:hidden"
    >
      Legajo <ChevronRight className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Pestañas
// ---------------------------------------------------------------------------

function TabResumen({ filas }: { filas: FilaInforme[] }) {
  const total = resumenTotal(filas);
  const cursos = resumenPorCurso(filas);
  const verPuntos = total.bajoPuntos !== null;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi titulo="Matrícula" valor={num(total.matricula)} detalle={`${cursos.length} cursos`} />
        <Kpi titulo="Promedio general" valor={total.promedio === null ? "—" : formatearNota(total.promedio)} detalle={`${total.sinNotas} sin notas cargadas`} />
        <Kpi titulo="Asistencia media" valor={num(total.asistencia, "%")} detalle={`${total.bajaAsistencia} bajo ${UMBRAL_ASISTENCIA_RIESGO}%`} />
        <Kpi
          titulo="En seguimiento"
          valor={num(total.enRiesgo)}
          detalle={`${pct(total.enRiesgo, total.matricula)}% de la matrícula`}
          alerta={pct(total.enRiesgo, total.matricula) >= 25}
        />
        <Kpi titulo="CUD / PPI" valor={num(total.conCudPpi)} detalle="Con configuraciones de apoyo" />
        {verPuntos ? (
          <Kpi titulo={`Bajo ${UMBRAL_ALERTA_PUNTOS} pts ICE`} valor={num(total.bajoPuntos)} detalle="Requieren intervención" alerta={(total.bajoPuntos ?? 0) > 0} />
        ) : (
          <Kpi titulo="Con previas" valor={num(total.conPrevias)} detalle="Adeudan espacios" />
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel titulo="Distribución de notas del ciclo">
          <Histograma columnas={distribucionNotas(filas)} />
        </Panel>
        <Panel titulo="Estudiantes en seguimiento por curso">
          <BarrasHorizontales
            maximo={100}
            barras={cursos.map((c) => ({
              clave: c.clave,
              etiqueta: `${etiquetaCurso(c.anio, c.division ?? "")}${c.turno ? ` · ${c.turno}` : ""}`,
              valor: pct(c.enRiesgo, c.matricula),
              texto: `${c.enRiesgo} · ${pct(c.enRiesgo, c.matricula)}%`,
              riesgo: pct(c.enRiesgo, c.matricula) >= 30,
            }))}
          />
          <p className="mt-2 text-xs text-slate-500">Porcentaje de la matrícula del curso; en rojo, cursos con 30% o más.</p>
        </Panel>
      </div>

      <Panel titulo="Indicadores por curso">
        <div className="overflow-x-auto">
          <table className="tabla-informe">
            <thead>
              <tr>
                <th>Curso</th>
                <th>Turno</th>
                <th className="text-right">Matrícula</th>
                <th className="text-right">Promedio</th>
                <th className="text-right">Asistencia</th>
                <th className="text-right">Prom. &lt; 6</th>
                <th className="text-right">Asist. &lt; 85%</th>
                {verPuntos && <th className="text-right">ICE &lt; 10</th>}
                <th className="text-right">Con previas</th>
                <th className="text-right">CUD / PPI</th>
                <th className="text-right">En seguimiento</th>
              </tr>
            </thead>
            <tbody>
              {cursos.map((c) => (
                <tr key={c.clave}>
                  <td className="font-semibold">{etiquetaCurso(c.anio, c.division ?? "")}</td>
                  <td>{c.turno ?? "Mixto"}</td>
                  <td className="text-right tabular-nums">{c.matricula}</td>
                  <td className={`text-right tabular-nums ${c.promedio !== null && c.promedio < UMBRAL_PROMEDIO_BAJO ? "font-bold text-red-700" : ""}`}>
                    {c.promedio === null ? "—" : formatearNota(c.promedio)}
                  </td>
                  <td className="text-right tabular-nums">{num(c.asistencia, "%")}</td>
                  <td className="text-right tabular-nums">{c.bajoPromedio}</td>
                  <td className="text-right tabular-nums">{c.bajaAsistencia}</td>
                  {verPuntos && <td className="text-right tabular-nums">{c.bajoPuntos}</td>}
                  <td className="text-right tabular-nums">{c.conPrevias}</td>
                  <td className="text-right tabular-nums">{c.conCudPpi}</td>
                  <td className="text-right font-semibold tabular-nums">
                    {c.enRiesgo} <span className="font-normal text-slate-500">({pct(c.enRiesgo, c.matricula)}%)</span>
                  </td>
                </tr>
              ))}
              <tr className="bg-institucional-50/60">
                <td className="font-bold" colSpan={2}>
                  Total institucional
                </td>
                <td className="text-right font-bold tabular-nums">{total.matricula}</td>
                <td className="text-right font-bold tabular-nums">{total.promedio === null ? "—" : formatearNota(total.promedio)}</td>
                <td className="text-right font-bold tabular-nums">{num(total.asistencia, "%")}</td>
                <td className="text-right font-bold tabular-nums">{total.bajoPromedio}</td>
                <td className="text-right font-bold tabular-nums">{total.bajaAsistencia}</td>
                {verPuntos && <td className="text-right font-bold tabular-nums">{total.bajoPuntos}</td>}
                <td className="text-right font-bold tabular-nums">{total.conPrevias}</td>
                <td className="text-right font-bold tabular-nums">{total.conCudPpi}</td>
                <td className="text-right font-bold tabular-nums">{total.enRiesgo}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          «En seguimiento»: promedio menor a 6, 3 o más materias bajo 6, asistencia menor a 85%
          {verPuntos ? ", menos de 10 puntos ICE" : ""}, materias previas o repitencia.
        </p>
      </Panel>
    </div>
  );
}

function TabMaterias({ filas }: { filas: FilaInforme[] }) {
  const materias = resumenPorMateria(filas);
  const criticas = materias.filter((m) => m.evaluados >= 5).slice(0, 12);
  return (
    <div className="space-y-5">
      <Panel titulo="Espacios curriculares con mayor desaprobación">
        <BarrasHorizontales
          maximo={100}
          barras={criticas.map((m) => ({
            clave: `${m.anio}-${m.materia}`,
            etiqueta: `${m.anio}° · ${m.materia}`,
            valor: m.porcentajeDesaprobados,
            texto: `${m.porcentajeDesaprobados.toLocaleString("es-AR")}%`,
            riesgo: m.porcentajeDesaprobados >= 40,
          }))}
        />
        <p className="mt-2 text-xs text-slate-500">
          Porcentaje de estudiantes con nota vigente menor a 6 (materias con 5 o más evaluados). En rojo, 40% o más.
        </p>
      </Panel>
      <Panel titulo="Detalle por año y espacio curricular">
        {materias.length === 0 ? (
          <p className="text-sm text-slate-500">Sin calificaciones del ciclo.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla-informe">
              <thead>
                <tr>
                  <th>Año</th>
                  <th>Espacio curricular</th>
                  <th className="text-right">Evaluados</th>
                  <th className="text-right">Promedio</th>
                  <th className="text-right">Desaprobados</th>
                  <th className="w-40">% desaprobados</th>
                </tr>
              </thead>
              <tbody>
                {[...materias]
                  .sort((a, b) => a.anio - b.anio || b.porcentajeDesaprobados - a.porcentajeDesaprobados)
                  .map((m) => (
                    <tr key={`${m.anio}-${m.materia}`}>
                      <td className="tabular-nums">{m.anio}°</td>
                      <td>{m.materia}</td>
                      <td className="text-right tabular-nums">{m.evaluados}</td>
                      <td className={`text-right tabular-nums ${m.promedio < UMBRAL_PROMEDIO_BAJO ? "font-bold text-red-700" : ""}`}>{formatearNota(m.promedio)}</td>
                      <td className="text-right tabular-nums">{m.desaprobados}</td>
                      <td>
                        <span className="flex items-center gap-2">
                          <span className="h-2 flex-1 rounded-full bg-slate-100">
                            <span
                              className="block h-full rounded-full"
                              style={{ width: `${m.porcentajeDesaprobados}%`, backgroundColor: m.porcentajeDesaprobados >= 40 ? "#b91c1c" : "#0b7b83" }}
                            />
                          </span>
                          <span className="w-12 text-right tabular-nums">{m.porcentajeDesaprobados.toLocaleString("es-AR")}%</span>
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function filasEnRiesgo(filas: FilaInforme[]) {
  return filas
    .map((f) => ({ fila: f, motivos: motivosDeRiesgo(f) }))
    .filter((r) => r.motivos.length > 0)
    .sort(
      (a, b) =>
        b.motivos.length - a.motivos.length ||
        a.fila.anio - b.fila.anio ||
        a.fila.division.localeCompare(b.fila.division, "es", { numeric: true }) ||
        a.fila.apellidos.localeCompare(b.fila.apellidos, "es"),
    );
}

function TabRiesgo({ filas, onVerLegajo }: { filas: FilaInforme[]; onVerLegajo?: (dni: string) => void }) {
  const enRiesgo = filasEnRiesgo(filas);
  const porNivel = (n: NivelRiesgo) => enRiesgo.filter((r) => nivelDeRiesgo(r.motivos) === n).length;
  const verPuntos = filas.some((f) => f.puntos !== null);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi titulo="En seguimiento" valor={num(enRiesgo.length)} detalle={`${pct(enRiesgo.length, filas.length)}% de ${filas.length}`} />
        <Kpi titulo="Prioridad alta" valor={num(porNivel("alto"))} detalle="3 o más indicadores" alerta={porNivel("alto") > 0} />
        <Kpi titulo="Prioridad media" valor={num(porNivel("medio"))} detalle="2 indicadores" />
        <Kpi titulo="Prioridad baja" valor={num(porNivel("bajo"))} detalle="1 indicador" />
      </div>
      <Panel titulo="Listado priorizado">
        {enRiesgo.length === 0 ? (
          <p className="text-sm text-slate-500">Ningún estudiante presenta indicadores de riesgo con los filtros elegidos.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla-informe">
              <thead>
                <tr>
                  <th>Prioridad</th>
                  <th>Estudiante</th>
                  <th>Curso</th>
                  <th className="text-right">Promedio</th>
                  <th className="text-right">Asistencia</th>
                  {verPuntos && <th className="text-right">ICE</th>}
                  <th>Indicadores</th>
                  <th className="print:hidden" />
                </tr>
              </thead>
              <tbody>
                {enRiesgo.map(({ fila: f, motivos }) => {
                  const nivel = nivelDeRiesgo(motivos);
                  return (
                    <tr key={f.dni}>
                      <td>
                        <Insignia tono={TONO_NIVEL[nivel]}>{nivel === "alto" ? "Alta" : nivel === "medio" ? "Media" : "Baja"}</Insignia>
                      </td>
                      <td>
                        <span className="font-semibold">
                          {f.apellidos}, {f.nombres}
                        </span>
                        <span className="block text-[11px] text-slate-500">DNI {f.dni}</span>
                      </td>
                      <td className="whitespace-nowrap">{curso(f)}</td>
                      <td className={`text-right tabular-nums ${tieneNotas(f) && f.promedio < UMBRAL_PROMEDIO_BAJO ? "font-bold text-red-700" : ""}`}>
                        {tieneNotas(f) ? formatearNota(f.promedio) : "—"}
                      </td>
                      <td className={`text-right tabular-nums ${f.asistencia < UMBRAL_ASISTENCIA_RIESGO ? "font-bold text-red-700" : ""}`}>
                        {num(f.asistencia, "%")}
                      </td>
                      {verPuntos && (
                        <td className={`text-right tabular-nums ${(f.puntos ?? 99) < UMBRAL_ALERTA_PUNTOS ? "font-bold text-red-700" : ""}`}>{num(f.puntos)}</td>
                      )}
                      <td>{motivos.join(" · ")}</td>
                      <td className="print:hidden">
                        <BotonLegajo dni={f.dni} onVerLegajo={onVerLegajo} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function TabConvivencia({
  filas,
  incidentes,
  onVerLegajo,
}: {
  filas: FilaInforme[];
  incidentes: IncidenteInforme[];
  onVerLegajo?: (dni: string) => void;
}) {
  const pendientes = incidentes.filter((i) => !i.aprobado);
  const sinNotificar = incidentes.filter((i) => !i.notificadoFamilia);
  const bajoPuntos = filas.filter((f) => f.puntos !== null && f.puntos < UMBRAL_ALERTA_PUNTOS).sort((a, b) => (a.puntos ?? 0) - (b.puntos ?? 0));
  const faltasIce = filas.reduce((a, f) => a + (f.faltasIce ?? 0), 0);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi titulo="Actas del ciclo (LUE)" valor={num(incidentes.length)} />
        <Kpi titulo="Pendientes de aprobación" valor={num(pendientes.length)} alerta={pendientes.length > 0} />
        <Kpi titulo="Familias sin notificar" valor={num(sinNotificar.length)} alerta={sinNotificar.length > 0} />
        <Kpi titulo="Faltas ICE (GEI)" valor={num(faltasIce)} detalle="Vigentes en el ciclo" />
        <Kpi titulo={`Bajo ${UMBRAL_ALERTA_PUNTOS} pts ICE`} valor={num(bajoPuntos.length)} alerta={bajoPuntos.length > 0} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel titulo="Actas por tipo de falta">
          <BarrasHorizontales
            barras={TIPOS_INCIDENTE.map((t) => {
              const n = incidentes.filter((i) => i.tipo === t).length;
              return { clave: t, etiqueta: REGLAS_INCIDENTE[t].etiqueta, valor: n, texto: String(n), riesgo: t === "GRAVE" && n > 0 };
            })}
          />
        </Panel>
        <Panel titulo={`Estudiantes con menos de ${UMBRAL_ALERTA_PUNTOS} puntos ICE`}>
          {bajoPuntos.length === 0 ? (
            <p className="text-sm text-slate-500">Ningún estudiante por debajo del umbral.</p>
          ) : (
            <table className="tabla-informe">
              <thead>
                <tr>
                  <th>Estudiante</th>
                  <th>Curso</th>
                  <th className="text-right">Puntos</th>
                  <th className="print:hidden" />
                </tr>
              </thead>
              <tbody>
                {bajoPuntos.map((f) => (
                  <tr key={f.dni}>
                    <td>
                      {f.apellidos}, {f.nombres}
                    </td>
                    <td className="whitespace-nowrap">{curso(f)}</td>
                    <td className="text-right font-bold tabular-nums text-red-700">{f.puntos}</td>
                    <td className="print:hidden">
                      <BotonLegajo dni={f.dni} onVerLegajo={onVerLegajo} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      <Panel titulo="Actas del ciclo">
        {incidentes.length === 0 ? (
          <p className="text-sm text-slate-500">Sin actas de convivencia registradas en el LUE.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla-informe">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Estudiante</th>
                  <th>Curso</th>
                  <th>Tipo</th>
                  <th className="text-right">Pts</th>
                  <th>Estado</th>
                  <th>Familia</th>
                  <th>Cargó</th>
                  <th className="print:hidden" />
                </tr>
              </thead>
              <tbody>
                {incidentes.map((i) => (
                  <tr key={i.id}>
                    <td className="whitespace-nowrap tabular-nums">{formatearFecha(i.fecha)}</td>
                    <td>{i.estudiante}</td>
                    <td className="whitespace-nowrap">{curso(i)}</td>
                    <td className="whitespace-nowrap">{REGLAS_INCIDENTE[i.tipo].etiqueta}</td>
                    <td className="text-right tabular-nums">{i.puntos ? `−${i.puntos}` : "—"}</td>
                    <td>{i.aprobado ? <Insignia tono="verde">Aprobado</Insignia> : <Insignia tono="ambar">Pendiente</Insignia>}</td>
                    <td>{i.notificadoFamilia ? "Notificada" : "Sin notificar"}</td>
                    <td className="text-slate-600">{i.autor}</td>
                    <td className="print:hidden">
                      <BotonLegajo dni={i.dni} onVerLegajo={onVerLegajo} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function TabSoe({
  filas,
  intervenciones,
  ciclo,
  onVerLegajo,
}: {
  filas: FilaInforme[];
  intervenciones: IntervencionInforme[];
  ciclo: number;
  onVerLegajo?: (dni: string) => void;
}) {
  const fechaHoy = hoy();
  const delCiclo = intervenciones.filter((i) => i.fecha.startsWith(String(ciclo)));
  // Agenda: el último seguimiento pactado por estudiante (una intervención nueva reemplaza la anterior).
  const ultimaPorAlumno = new Map<string, IntervencionInforme>();
  for (const i of [...intervenciones].sort((a, b) => a.fecha.localeCompare(b.fecha))) ultimaPorAlumno.set(i.dni, i);
  const agenda = [...ultimaPorAlumno.values()]
    .filter((i) => i.proximoSeguimiento !== null)
    .sort((a, b) => (a.proximoSeguimiento ?? "").localeCompare(b.proximoSeguimiento ?? ""));
  const vencidos = agenda.filter((i) => (i.proximoSeguimiento ?? "").slice(0, 10) < fechaHoy);
  const apoyos = filas.filter((f) => f.tieneCud || f.requierePpi);
  const alumnosAtendidos = new Set(delCiclo.map((i) => i.dni)).size;
  const conteoMeses = Array.from({ length: 12 }, (_, m) => {
    const clave = `${ciclo}-${String(m + 1).padStart(2, "0")}`;
    return {
      clave,
      n: delCiclo.filter((i) => i.fecha.startsWith(clave)).length,
      etiqueta: new Intl.DateTimeFormat("es-AR", { month: "long", timeZone: "UTC" }).format(new Date(`${clave}-15T00:00:00Z`)),
    };
  });
  // Del primer al último mes con actividad (los meses intermedios sin intervenciones se muestran en 0).
  const primero = conteoMeses.findIndex((m) => m.n > 0);
  const ultimo = conteoMeses.length - 1 - [...conteoMeses].reverse().findIndex((m) => m.n > 0);
  const meses = primero === -1 ? [] : conteoMeses.slice(primero, ultimo + 1);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi titulo="Intervenciones del ciclo" valor={num(delCiclo.length)} />
        <Kpi titulo="Estudiantes acompañados" valor={num(alumnosAtendidos)} detalle={`${pct(alumnosAtendidos, filas.length)}% de la matrícula`} />
        <Kpi titulo="Seguimientos vencidos" valor={num(vencidos.length)} alerta={vencidos.length > 0} detalle="Fecha pactada ya pasada" />
        <Kpi titulo="Con CUD / PPI" valor={num(apoyos.length)} detalle="Población con apoyos" />
      </div>

      <Panel titulo="Agenda de seguimientos">
        {agenda.length === 0 ? (
          <p className="text-sm text-slate-500">No hay seguimientos programados. Se agendan al registrar una intervención.</p>
        ) : (
          <table className="tabla-informe">
            <thead>
              <tr>
                <th>Fecha pactada</th>
                <th>Estudiante</th>
                <th>Curso</th>
                <th>Última intervención</th>
                <th>Profesional</th>
                <th className="print:hidden" />
              </tr>
            </thead>
            <tbody>
              {agenda.map((i) => {
                const vencido = (i.proximoSeguimiento ?? "").slice(0, 10) < fechaHoy;
                return (
                  <tr key={i.id}>
                    <td className="whitespace-nowrap">
                      <span className="tabular-nums">{formatearFecha(i.proximoSeguimiento)}</span>{" "}
                      {vencido && <Insignia tono="rojo">Vencido</Insignia>}
                    </td>
                    <td>{i.estudiante}</td>
                    <td className="whitespace-nowrap">{curso(i)}</td>
                    <td>
                      {i.motivo}
                      <span className="block text-[11px] text-slate-500">
                        {formatearFecha(i.fecha)} · {TIPO_INTERVENCION_ETIQUETA[i.tipo]}
                      </span>
                    </td>
                    <td className="text-slate-600">{i.profesional}</td>
                    <td className="print:hidden">
                      <BotonLegajo dni={i.dni} onVerLegajo={onVerLegajo} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel titulo="Intervenciones por tipo">
          <BarrasHorizontales
            barras={TIPOS_INTERVENCION.map((t) => {
              const n = delCiclo.filter((i) => i.tipo === t).length;
              return { clave: t, etiqueta: TIPO_INTERVENCION_ETIQUETA[t], valor: n, texto: String(n) };
            })}
          />
        </Panel>
        <Panel titulo="Intervenciones por mes">
          <BarrasHorizontales barras={meses.map((m) => ({ clave: m.clave, etiqueta: m.etiqueta, valor: m.n, texto: String(m.n) }))} />
        </Panel>
      </div>

      <Panel titulo="Estudiantes con CUD o PPI">
        {apoyos.length === 0 ? (
          <p className="text-sm text-slate-500">Ningún estudiante con CUD o PPI registrado. Se marcan desde el legajo (Inclusión y salud).</p>
        ) : (
          <table className="tabla-informe">
            <thead>
              <tr>
                <th>Estudiante</th>
                <th>Curso</th>
                <th>CUD</th>
                <th>PPI</th>
                <th className="text-right">Promedio</th>
                <th className="text-right">Asistencia</th>
                <th className="print:hidden" />
              </tr>
            </thead>
            <tbody>
              {apoyos.map((f) => (
                <tr key={f.dni}>
                  <td>
                    {f.apellidos}, {f.nombres}
                  </td>
                  <td className="whitespace-nowrap">{curso(f)}</td>
                  <td>{f.tieneCud ? "Sí" : "No"}</td>
                  <td>{f.requierePpi ? "Sí" : "No"}</td>
                  <td className="text-right tabular-nums">{tieneNotas(f) ? formatearNota(f.promedio) : "—"}</td>
                  <td className="text-right tabular-nums">{num(f.asistencia, "%")}</td>
                  <td className="print:hidden">
                    <BotonLegajo dni={f.dni} onVerLegajo={onVerLegajo} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel titulo="Registro de intervenciones del ciclo">
        {delCiclo.length === 0 ? (
          <p className="text-sm text-slate-500">Sin intervenciones registradas en el ciclo.</p>
        ) : (
          <table className="tabla-informe">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Estudiante</th>
                <th>Curso</th>
                <th>Tipo</th>
                <th>Motivo</th>
                <th>Profesional</th>
              </tr>
            </thead>
            <tbody>
              {delCiclo.map((i) => (
                <tr key={i.id}>
                  <td className="whitespace-nowrap tabular-nums">{formatearFecha(i.fecha)}</td>
                  <td>{i.estudiante}</td>
                  <td className="whitespace-nowrap">{curso(i)}</td>
                  <td>{TIPO_INTERVENCION_ETIQUETA[i.tipo]}</td>
                  <td>{i.motivo}</td>
                  <td className="text-slate-600">{i.profesional}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Este registro no incluye el contenido de los informes: se consulta en el legajo de cada estudiante.
        </p>
      </Panel>
    </div>
  );
}

function TabNomina({ filas, onVerLegajo }: { filas: FilaInforme[]; onVerLegajo?: (dni: string) => void }) {
  const verPuntos = filas.some((f) => f.puntos !== null);
  return (
    <Panel titulo={`Nómina (${filas.length} estudiantes)`}>
      <div className="overflow-x-auto">
        <table className="tabla-informe">
          <thead>
            <tr>
              <th>#</th>
              <th>Apellido y nombre</th>
              <th>DNI</th>
              <th>Curso</th>
              <th>Turno</th>
              <th className="text-right">Promedio</th>
              <th className="text-right">Mat. &lt; 6</th>
              <th className="text-right">Asistencia</th>
              {verPuntos && <th className="text-right">ICE</th>}
              <th className="text-right">Previas</th>
              <th>Apoyos</th>
              <th className="print:hidden" />
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={f.dni}>
                <td className="tabular-nums text-slate-500">{i + 1}</td>
                <td>
                  {f.apellidos}, {f.nombres}
                </td>
                <td className="tabular-nums">{f.dni}</td>
                <td className="whitespace-nowrap">{curso(f)}</td>
                <td>{f.turno}</td>
                <td className="text-right tabular-nums">{tieneNotas(f) ? formatearNota(f.promedio) : "—"}</td>
                <td className="text-right tabular-nums">{materiasBajoUmbral(f)}</td>
                <td className="text-right tabular-nums">{num(f.asistencia, "%")}</td>
                {verPuntos && <td className="text-right tabular-nums">{num(f.puntos)}</td>}
                <td className="text-right tabular-nums">{f.materiasPrevias}</td>
                <td>{[f.tieneCud && "CUD", f.requierePpi && "PPI"].filter(Boolean).join(" · ")}</td>
                <td className="print:hidden">
                  <BotonLegajo dni={f.dni} onVerLegajo={onVerLegajo} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Exportación
// ---------------------------------------------------------------------------

function csvDePestana(pestana: Pestana, filas: FilaInforme[], incidentes: IncidenteInforme[], intervenciones: IntervencionInforme[]): string {
  const verPuntos = filas.some((f) => f.puntos !== null);
  switch (pestana) {
    case "resumen":
      return aCsv(
        ["Año", "División", "Turno", "Matrícula", "Promedio", "Asistencia %", "Promedio < 6", "Asistencia < 85%", ...(verPuntos ? ["ICE < 10"] : []), "Con previas", "CUD/PPI", "En seguimiento", "Sin notas"],
        resumenPorCurso(filas).map((c) => [
          c.anio,
          c.division,
          c.turno ?? "Mixto",
          c.matricula,
          c.promedio,
          c.asistencia,
          c.bajoPromedio,
          c.bajaAsistencia,
          ...(verPuntos ? [c.bajoPuntos] : []),
          c.conPrevias,
          c.conCudPpi,
          c.enRiesgo,
          c.sinNotas,
        ]),
      );
    case "materias":
      return aCsv(
        ["Año", "Espacio curricular", "Evaluados", "Promedio", "Desaprobados", "% desaprobados"],
        resumenPorMateria(filas).map((m) => [m.anio, m.materia, m.evaluados, m.promedio, m.desaprobados, m.porcentajeDesaprobados]),
      );
    case "riesgo":
      return aCsv(
        ["Prioridad", "Apellidos", "Nombres", "DNI", "Año", "División", "Promedio", "Asistencia %", ...(verPuntos ? ["Puntos ICE"] : []), "Indicadores"],
        filasEnRiesgo(filas).map(({ fila: f, motivos }) => [
          nivelDeRiesgo(motivos),
          f.apellidos,
          f.nombres,
          f.dni,
          f.anio,
          f.division,
          tieneNotas(f) ? f.promedio : null,
          f.asistencia,
          ...(verPuntos ? [f.puntos] : []),
          motivos.join(" · "),
        ]),
      );
    case "convivencia":
      return aCsv(
        ["Fecha", "Estudiante", "DNI", "Año", "División", "Tipo", "Puntos", "Estado", "Familia notificada", "Cargó"],
        incidentes.map((i) => [
          formatearFecha(i.fecha),
          i.estudiante,
          i.dni,
          i.anio,
          i.division,
          REGLAS_INCIDENTE[i.tipo].etiqueta,
          i.puntos,
          i.aprobado ? "Aprobado" : "Pendiente",
          i.notificadoFamilia,
          i.autor,
        ]),
      );
    case "soe":
      return aCsv(
        ["Fecha", "Estudiante", "DNI", "Año", "División", "Tipo", "Motivo", "Profesional", "Próximo seguimiento"],
        intervenciones.map((i) => [
          formatearFecha(i.fecha),
          i.estudiante,
          i.dni,
          i.anio,
          i.division,
          TIPO_INTERVENCION_ETIQUETA[i.tipo],
          i.motivo,
          i.profesional,
          i.proximoSeguimiento ? formatearFecha(i.proximoSeguimiento) : null,
        ]),
      );
    case "nomina":
      return aCsv(
        ["Apellidos", "Nombres", "DNI", "Año", "División", "Turno", "Promedio", "Materias < 6", "Asistencia %", ...(verPuntos ? ["Puntos ICE"] : []), "Previas", "CUD", "PPI"],
        filas.map((f) => [
          f.apellidos,
          f.nombres,
          f.dni,
          f.anio,
          f.division,
          f.turno,
          tieneNotas(f) ? f.promedio : null,
          materiasBajoUmbral(f),
          f.asistencia,
          ...(verPuntos ? [f.puntos] : []),
          f.materiasPrevias,
          f.tieneCud,
          f.requierePpi,
        ]),
      );
  }
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

interface Props {
  cargar: () => Promise<DatosInforme>;
  emisor: string;
  onVerLegajo: (dni: string) => void;
  /** Devuelve true si el error ya se manejó (p. ej. sesión expirada). */
  onError: (error: unknown) => boolean;
}

export default function InformesPanel({ cargar, emisor, onVerLegajo, onError }: Props) {
  const [datos, setDatos] = useState<DatosInforme | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pestana, setPestana] = useState<Pestana>("resumen");
  const [anio, setAnio] = useState<number | null>(null);
  const [division, setDivision] = useState("");
  const { imprimiendo, imprimir } = useImpresion();

  const actualizar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setDatos(await cargar());
    } catch (err) {
      if (!onError(err)) setError((err as Error).message);
    } finally {
      setCargando(false);
    }
  }, [cargar, onError]);

  useEffect(() => {
    void actualizar();
  }, [actualizar]);

  const pestanas = PESTANAS.filter(
    (p) => (p.id !== "convivencia" || datos?.incidentes != null) && (p.id !== "soe" || datos?.intervenciones != null),
  );

  const enFiltro = useCallback(
    (x: { anio: number; division: string }) => (anio === null || x.anio === anio) && (!division || x.division === division),
    [anio, division],
  );
  const filas = useMemo(() => (datos?.filas ?? []).filter(enFiltro), [datos, enFiltro]);
  const incidentes = useMemo(() => (datos?.incidentes ?? []).filter(enFiltro), [datos, enFiltro]);
  const intervenciones = useMemo(() => (datos?.intervenciones ?? []).filter(enFiltro), [datos, enFiltro]);
  const anios = [...new Set((datos?.filas ?? []).map((f) => f.anio))].sort((a, b) => a - b);
  const divisiones = [...new Set((datos?.filas ?? []).filter((f) => anio === null || f.anio === anio).map((f) => f.division))].sort((a, b) =>
    a.localeCompare(b, "es", { numeric: true }),
  );

  const actual = PESTANAS.find((p) => p.id === pestana) ?? PESTANAS[0]!;
  const alcance = anio === null ? "Toda la escuela" : division ? etiquetaCurso(anio, division) : `${anio}° año`;
  const subtitulo = datos ? `Ciclo lectivo ${datos.ciclo} · ${alcance}` : "";

  const contenido = (conAcciones: boolean) => {
    const verLegajo = conAcciones ? onVerLegajo : undefined;
    switch (pestana) {
      case "resumen":
        return <TabResumen filas={filas} />;
      case "materias":
        return <TabMaterias filas={filas} />;
      case "riesgo":
        return <TabRiesgo filas={filas} onVerLegajo={verLegajo} />;
      case "convivencia":
        return <TabConvivencia filas={filas} incidentes={incidentes} onVerLegajo={verLegajo} />;
      case "soe":
        return <TabSoe filas={filas} intervenciones={intervenciones} ciclo={datos?.ciclo ?? new Date().getFullYear()} onVerLegajo={verLegajo} />;
      case "nomina":
        return <TabNomina filas={filas} onVerLegajo={verLegajo} />;
    }
  };

  const exportar = () => {
    if (!datos) return;
    descargarArchivo(`${nombreArchivo(actual.tituloInforme, String(datos.ciclo), alcance)}.csv`, csvDePestana(pestana, filas, incidentes, intervenciones));
  };

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Tipo de informe" className="flex flex-wrap gap-1 self-start rounded-full bg-white p-1 shadow-sm ring-1 ring-slate-200 sm:inline-flex">
        {pestanas.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={p.id === pestana}
            onClick={() => setPestana(p.id)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
              p.id === pestana ? "bg-institucional-600 text-white" : "text-slate-600 hover:bg-institucional-50"
            }`}
          >
            {p.icono}
            {p.titulo}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={anio ?? ""}
          onChange={(e) => {
            setAnio(e.target.value ? Number(e.target.value) : null);
            setDivision("");
          }}
          className="campo-pildora w-auto"
          aria-label="Año"
        >
          <option value="">Todos los años</option>
          {anios.map((a) => (
            <option key={a} value={a}>
              {a}° año
            </option>
          ))}
        </select>
        <select value={division} onChange={(e) => setDivision(e.target.value)} className="campo-pildora w-auto" aria-label="División" disabled={anio === null}>
          <option value="">Todas las divisiones</option>
          {divisiones.map((d) => (
            <option key={d} value={d}>
              {d}° división
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-500">{datos && `Ciclo ${datos.ciclo} · ${filas.length} estudiantes`}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" onClick={() => void actualizar()} className="boton-secundario" disabled={cargando}>
            {cargando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
            Actualizar
          </button>
          <button type="button" onClick={exportar} className="boton-secundario" disabled={!datos}>
            <FileSpreadsheet className="h-4 w-4" aria-hidden /> Exportar Excel
          </button>
          <button
            type="button"
            onClick={() => datos && imprimir(nombreArchivo(actual.tituloInforme, String(datos.ciclo), alcance))}
            className="boton-primario"
            disabled={!datos || imprimiendo}
          >
            <Printer className="h-4 w-4" aria-hidden /> Imprimir / PDF
          </button>
        </div>
      </div>

      {error && <MensajeError mensaje={error} />}
      {!datos && cargando && (
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Generando informe…
        </div>
      )}
      {datos && contenido(true)}

      {datos && (
        <p className="flex items-center gap-1.5 text-xs text-slate-400">
          <ListChecks className="h-3.5 w-3.5" aria-hidden />
          Fuente: datos sincronizados del GEI y registros del LUE. La generación del informe queda registrada en auditoría.
        </p>
      )}

      {imprimiendo && datos && (
        <ZonaImpresion>
          <DocumentoInforme
            titulo={actual.tituloInforme}
            subtitulo={subtitulo}
            generadoPor={emisor}
            generado={datos.generado}
            confidencial={pestana === "soe"}
            firmas={pestana === "soe" ? ["Profesional del SOE", "Directivo/a"] : ["Directivo/a"]}
          >
            {contenido(false)}
          </DocumentoInforme>
        </ZonaImpresion>
      )}
    </div>
  );
}
