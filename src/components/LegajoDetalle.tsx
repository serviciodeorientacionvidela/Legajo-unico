"use client";

import {
  Accessibility,
  BookOpen,
  Braces,
  CalendarCheck,
  Check,
  FileText,
  FolderOpen,
  HeartPulse,
  Loader2,
  Phone,
  Plus,
  School,
  ShieldAlert,
  Trash2,
  TriangleAlert,
  User,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { nivelAlertaPuntos, PUNTOS_INICIALES, REGLAS_INCIDENTE } from "@/lib/convivencia";
import { rutaCarpetaEstudiante, SUBCARPETAS } from "@/lib/driveNombres";
import { diasHasta, edad, etiquetaCurso, formatearFecha, formatearNota } from "@/lib/formato";
import { tienePermiso } from "@/lib/rbac";
import { ROL_ETIQUETA, type IncidenteVisible, type LegajoVisible, type TipoIncidente } from "@/lib/types";
import { GraficoAsistenciaMensual, GraficoMaterias, GraficoPromediosPorCiclo, IndicadoresLegajo } from "./LegajoGraficos";
import { Bloqueado, Insignia, MensajeError, Seccion } from "./ui";

interface Props {
  abierto: boolean;
  legajo: LegajoVisible | null;
  cargando: boolean;
  error: string | null;
  modoDemo: boolean;
  /** Simulador de rol (solo demo): cambiar de rol con el legajo abierto lo vuelve a pedir con el nuevo perfil. */
  selectorRol?: ReactNode;
  incidenteEnProceso: string | null;
  onCerrar: () => void;
  onCargarIncidente: () => void;
  onResolverIncidente: (incidenteId: string, accion: "APROBAR" | "ANULAR") => void;
}

const TONO_TIPO: Record<TipoIncidente, "ambar" | "rojo" | "azul" | "neutro"> = {
  LEVE: "neutro",
  MODERADA: "ambar",
  GRAVE: "rojo",
  ACUERDO_PEDAGOGICO: "azul",
};

function esEnlaceDemo(url: string): boolean {
  return url.includes("DEMO-");
}

function Enlace({ url, modoDemo, children }: { url: string; modoDemo: boolean; children: ReactNode }) {
  const clase = "inline-flex items-center gap-1 text-sm font-medium text-institucional-700 hover:underline";
  if (modoDemo && esEnlaceDemo(url)) {
    return (
      <span className={`${clase} cursor-help`} title="Enlace simulado en modo demostración">
        {children}
      </span>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={clase}>
      {children}
    </a>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{etiqueta}</dt>
      <dd className="text-sm font-medium text-slate-900">{valor}</dd>
    </div>
  );
}

function AvisoVencimientoCud({ vencimiento }: { vencimiento: string }) {
  const dias = diasHasta(vencimiento);
  if (dias < 0) return <Insignia tono="rojo">Vencido</Insignia>;
  if (dias <= 60) return <Insignia tono="ambar">Vence en {dias} días</Insignia>;
  return null;
}

function TarjetaIncidente({
  incidente,
  puedeResolver,
  enProceso,
  modoDemo,
  onResolver,
}: {
  incidente: IncidenteVisible;
  puedeResolver: boolean;
  enProceso: boolean;
  modoDemo: boolean;
  onResolver: (accion: "APROBAR" | "ANULAR") => void;
}) {
  return (
    <li className={`rounded-lg border p-3 ${incidente.anulado ? "border-slate-200 bg-slate-50 opacity-70" : "border-slate-200"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs tabular-nums text-slate-500">{formatearFecha(incidente.fecha)}</span>
        <Insignia tono={TONO_TIPO[incidente.tipo]}>{REGLAS_INCIDENTE[incidente.tipo].etiqueta}</Insignia>
        {incidente.puntosDescontados > 0 && (
          <span className={`text-xs font-semibold tabular-nums ${incidente.anulado ? "text-slate-400 line-through" : "text-red-700"}`}>
            −{incidente.puntosDescontados} pts
          </span>
        )}
        {incidente.anulado ? (
          <Insignia tono="neutro">Dado de baja</Insignia>
        ) : incidente.aprobado ? (
          <Insignia tono="verde">Aprobado</Insignia>
        ) : (
          <Insignia tono="ambar">Pendiente de aprobación</Insignia>
        )}
      </div>
      <p className="mt-2 text-sm text-slate-800">{incidente.motivo}</p>
      {incidente.descargoAlumno && (
        <p className="mt-1 text-xs text-slate-600">
          <span className="font-medium">Descargo:</span> {incidente.descargoAlumno}
        </p>
      )}
      {incidente.medidaAdoptada && (
        <p className="mt-1 text-xs text-slate-600">
          <span className="font-medium">Medida:</span> {incidente.medidaAdoptada}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span>Cargó: {incidente.autorNombre}</span>
          <span>{incidente.notificadoFamilia ? "✓ Familia notificada" : "Familia sin notificar"}</span>
          {incidente.actaDriveUrl && (
            <Enlace url={incidente.actaDriveUrl} modoDemo={modoDemo}>
              <FileText className="h-3.5 w-3.5" aria-hidden /> Acta
            </Enlace>
          )}
        </div>
        {puedeResolver && !incidente.anulado && (
          <div className="flex gap-1">
            {!incidente.aprobado && (
              <button
                type="button"
                disabled={enProceso}
                onClick={() => onResolver("APROBAR")}
                className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                <Check className="h-3.5 w-3.5" aria-hidden /> Aprobar y descontar
              </button>
            )}
            <button
              type="button"
              disabled={enProceso}
              onClick={() => onResolver("ANULAR")}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200 hover:bg-red-50 disabled:opacity-60"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden /> Dar de baja
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

export default function LegajoDetalle({
  abierto,
  legajo,
  cargando,
  error,
  modoDemo,
  selectorRol,
  incidenteEnProceso,
  onCerrar,
  onCargarIncidente,
  onResolverIncidente,
}: Props) {
  const [verPayload, setVerPayload] = useState(false);
  const [cicloNotas, setCicloNotas] = useState<number | null>(null);
  const ciclosNotas = [...new Set((legajo?.calificaciones ?? []).map((c) => c.cicloLectivo))].sort((a, b) => b - a);
  // Por defecto (o si el legajo cambió y el ciclo elegido no existe) se muestra el ciclo más reciente.
  const cicloVisible = cicloNotas !== null && ciclosNotas.includes(cicloNotas) ? cicloNotas : (ciclosNotas[0] ?? null);
  const notasVisibles = (legajo?.calificaciones ?? []).filter((c) => c.cicloLectivo === cicloVisible);

  useEffect(() => {
    if (!abierto) return;
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  const rol = legajo?.rolConsulta;
  const e = legajo?.estudiante;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/30" onClick={onCerrar}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Legajo Único del Estudiante"
        className="flex h-full w-full max-w-5xl flex-col bg-slate-50 shadow-2xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
          {e && rol ? (
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-institucional-600">Legajo Único del Estudiante</p>
              <h2 className="truncate text-lg font-semibold text-slate-900">
                {e.apellidos}, {e.nombres}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-slate-600">
                <span className="tabular-nums">DNI {e.dni}</span>
                <span>·</span>
                <span>
                  {etiquetaCurso(e.anio, e.division)} · {e.turno}
                </span>
                <Insignia tono={e.estadoMatricula === "REGULAR" ? "verde" : "neutro"}>{e.estadoMatricula}</Insignia>
                {e.tieneCud && <Insignia tono="violeta">CUD</Insignia>}
                {e.requierePpi && <Insignia tono="azul">PPI</Insignia>}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Legajo Único del Estudiante</p>
          )}
          <div className="flex shrink-0 items-center gap-1">
            {legajo && (
              <button
                type="button"
                onClick={() => setVerPayload((v) => !v)}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium ring-1 ring-inset ${
                  verPayload ? "bg-slate-900 text-white ring-slate-900" : "text-slate-600 ring-slate-300 hover:bg-slate-100"
                }`}
                title="Ver el JSON exacto que recibió el navegador"
              >
                <Braces className="h-4 w-4" aria-hidden /> JSON recibido
              </button>
            )}
            <button type="button" onClick={onCerrar} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Cerrar legajo">
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>
        {selectorRol && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-5 py-2">
            <span className="text-xs text-amber-900">Demo · ver este legajo como:</span>
            {selectorRol}
          </div>
        )}

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {cargando && (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Cargando legajo…
            </div>
          )}
          {error && !cargando && <MensajeError mensaje={error} />}

          {legajo && e && rol && !cargando && (
            <>
              {verPayload && (
                <div className="rounded-lg bg-slate-900 p-4 text-slate-100">
                  <p className="mb-2 text-xs text-slate-300">
                    Payload recibido para <strong className="text-white">{ROL_ETIQUETA[rol]}</strong>. Los datos que el rol no puede
                    ver <strong className="text-white">no existen</strong> en la respuesta (no están ocultos con CSS).
                  </p>
                  <pre className="max-h-80 overflow-auto text-[11px] leading-relaxed">{JSON.stringify(legajo, null, 2)}</pre>
                </div>
              )}

              <IndicadoresLegajo legajo={legajo} />

              {(e.tieneCud || e.requierePpi) && (
                <Seccion titulo="Alerta pedagógica" icono={<Accessibility className="h-4 w-4 text-violet-600" aria-hidden />}>
                  <div className="flex flex-wrap gap-2">
                    <Insignia tono={e.tieneCud ? "violeta" : "neutro"}>CUD: {e.tieneCud ? "Sí" : "No"}</Insignia>
                    <Insignia tono={e.requierePpi ? "azul" : "neutro"}>PPI: {e.requierePpi ? "Sí" : "No"}</Insignia>
                  </div>
                  {legajo.confidencial ? (
                    <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <dt className="text-xs text-slate-500">Diagnóstico reservado</dt>
                        <dd className="text-sm text-slate-900">{legajo.confidencial.diagnosticoReservado ?? "—"}</dd>
                      </div>
                      {legajo.confidencial.vencimientoCud && (
                        <Dato
                          etiqueta="Vencimiento del CUD"
                          valor={
                            <span className="flex items-center gap-2">
                              {formatearFecha(legajo.confidencial.vencimientoCud)}
                              <AvisoVencimientoCud vencimiento={legajo.confidencial.vencimientoCud} />
                            </span>
                          }
                        />
                      )}
                      {legajo.confidencial.cudUrl && (
                        <Dato
                          etiqueta="Certificado"
                          valor={
                            <Enlace url={legajo.confidencial.cudUrl} modoDemo={modoDemo}>
                              <FileText className="h-4 w-4" aria-hidden /> CUD.pdf
                            </Enlace>
                          }
                        />
                      )}
                      {legajo.confidencial.observacionesConfidenciales && (
                        <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-inset ring-amber-200 sm:col-span-2">
                          <span className="font-medium">Observaciones confidenciales: </span>
                          {legajo.confidencial.observacionesConfidenciales}
                        </div>
                      )}
                    </dl>
                  ) : (
                    <div className="mt-3">
                      <Bloqueado texto="El diagnóstico y el certificado son reservados al nivel Directivo / SOE (Ley 25.326 y Ley 26.061). Consulte los acuerdos pedagógicos para adaptar sus clases." />
                    </div>
                  )}
                </Seccion>
              )}

              {legajo.acuerdosSoe.length > 0 && (
                <Seccion titulo="Acuerdos pedagógicos del SOE" icono={<BookOpen className="h-4 w-4 text-institucional-600" aria-hidden />}>
                  <ul className="space-y-2">
                    {legajo.acuerdosSoe.map((a) => (
                      <li key={a.id} className="rounded-md bg-institucional-50 px-3 py-2 text-sm text-slate-800">
                        <span className="mr-2 text-xs tabular-nums text-slate-500">{formatearFecha(a.fecha)}</span>
                        {a.acuerdosDocentes}
                      </li>
                    ))}
                  </ul>
                </Seccion>
              )}

              <Seccion
                titulo="Rendimiento académico"
                icono={<BookOpen className="h-4 w-4 text-slate-500" aria-hidden />}
                accion={
                  ciclosNotas.length > 1 ? (
                    <div className="flex gap-1" role="group" aria-label="Ciclo lectivo">
                      {ciclosNotas.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCicloNotas(c)}
                          aria-pressed={c === cicloVisible}
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums ring-1 ring-inset ${
                            c === cicloVisible
                              ? "bg-institucional-600 text-white ring-institucional-600"
                              : "text-slate-600 ring-slate-300 hover:bg-slate-100"
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  ) : undefined
                }
              >
                {legajo.calificaciones.length === 0 ? (
                  <p className="text-sm text-slate-500">Sin calificaciones importadas desde el GEI.</p>
                ) : (
                  <div className="space-y-5">
                    <div className="grid gap-5 lg:grid-cols-2">
                      <div>
                        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Nota vigente por materia · {cicloVisible}
                        </h4>
                        <GraficoMaterias calificaciones={notasVisibles} />
                      </div>
                      {ciclosNotas.length > 1 && (
                        <div>
                          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Promedio por ciclo</h4>
                          <GraficoPromediosPorCiclo calificaciones={legajo.calificaciones} />
                        </div>
                      )}
                    </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="text-left text-xs text-slate-500">
                        <tr>
                          <th className="py-1.5 pr-3 font-medium">Materia</th>
                          <th className="py-1.5 pr-3 text-right font-medium">1° Per.</th>
                          <th className="py-1.5 pr-3 text-right font-medium">2° Per.</th>
                          <th className="py-1.5 pr-3 text-right font-medium">Final</th>
                          <th className="py-1.5 font-medium">
                            <span className="sr-only">Estado</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {notasVisibles.map((c) => (
                          <tr key={c.id} className={c.previa ? "bg-amber-50" : ""}>
                            <td className="py-1.5 pr-3 text-slate-800">{c.materia}</td>
                            {[c.primerCuatrimestre, c.segundoCuatrimestre, c.notaFinal].map((nota, i) => (
                              <td
                                key={i}
                                className={`py-1.5 pr-3 text-right tabular-nums ${nota !== null && nota < 6 ? "font-semibold text-red-700" : "text-slate-700"}`}
                              >
                                {formatearNota(nota)}
                              </td>
                            ))}
                            <td className="py-1.5">{c.previa && <Insignia tono="ambar">Previa</Insignia>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  </div>
                )}
              </Seccion>

              <Seccion titulo="Asistencia mensual" icono={<CalendarCheck className="h-4 w-4 text-slate-500" aria-hidden />}>
                <GraficoAsistenciaMensual meses={legajo.asistenciaMensual} />
              </Seccion>

              <Seccion
                titulo="Régimen de convivencia"
                icono={<ShieldAlert className="h-4 w-4 text-amber-600" aria-hidden />}
                accion={
                  legajo.convivencia && tienePermiso(rol, "CARGAR_INCIDENTE") && e.estadoMatricula === "REGULAR" ? (
                    <button
                      type="button"
                      onClick={onCargarIncidente}
                      className="inline-flex items-center gap-1 rounded-md bg-institucional-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-institucional-700"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden /> Cargar incidente
                    </button>
                  ) : undefined
                }
              >
                {legajo.convivencia ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={`h-full ${
                            { ok: "bg-emerald-500", atencion: "bg-amber-500", critico: "bg-red-500" }[nivelAlertaPuntos(legajo.convivencia.puntos)]
                          }`}
                          style={{ width: `${(legajo.convivencia.puntos / PUNTOS_INICIALES) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-slate-900">
                        {legajo.convivencia.puntos} / {PUNTOS_INICIALES} pts ICE
                      </span>
                    </div>

                    <div>
                      <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Faltas cargadas en el GEI</h4>
                      {legajo.convivencia.faltasIce.length === 0 ? (
                        <p className="text-sm text-slate-500">Sin faltas en Puntos ICE.</p>
                      ) : (
                        <table className="min-w-full text-sm">
                          <thead className="text-left text-xs text-slate-500">
                            <tr>
                              <th className="py-1 pr-3 font-medium">Fecha</th>
                              <th className="py-1 pr-3 font-medium">Tipo</th>
                              <th className="py-1 pr-3 text-right font-medium">Puntos</th>
                              <th className="py-1 font-medium">
                                <span className="sr-only">Estado</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {legajo.convivencia.faltasIce.map((f) => (
                              <tr key={f.id} className={f.dadaDeBaja ? "text-slate-400 line-through" : ""}>
                                <td className="py-1 pr-3 tabular-nums">{formatearFecha(f.fecha)}</td>
                                <td className="py-1 pr-3">
                                  <Insignia tono={/grave/i.test(f.tipo) ? "rojo" : /moderada/i.test(f.tipo) ? "ambar" : "neutro"}>{f.tipo}</Insignia>
                                </td>
                                <td className="py-1 pr-3 text-right font-semibold tabular-nums">−{f.puntos}</td>
                                <td className="py-1 text-xs no-underline">
                                  {f.dadaDeBaja && <span className="no-underline">Dada de baja {formatearFecha(f.fechaBaja)}</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>

                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Incidentes y actas del LUE</h4>
                    {legajo.convivencia.incidentes.length === 0 ? (
                      <p className="text-sm text-slate-500">Sin incidentes registrados en el ciclo.</p>
                    ) : (
                      <ul className="space-y-2">
                        {legajo.convivencia.incidentes.map((i) => (
                          <TarjetaIncidente
                            key={i.id}
                            incidente={i}
                            modoDemo={modoDemo}
                            puedeResolver={tienePermiso(rol, "APROBAR_INCIDENTE")}
                            enProceso={incidenteEnProceso === i.id}
                            onResolver={(accion) => onResolverIncidente(i.id, accion)}
                          />
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <Bloqueado texto="El régimen de convivencia (puntos, sanciones y actas) no está disponible para el rol Docente." />
                )}
              </Seccion>

              {legajo.trayectoria && (
                <Seccion titulo="Trayectoria escolar" icono={<School className="h-4 w-4 text-slate-500" aria-hidden />}>
                  {legajo.trayectoria.ciclos.length === 0 ? (
                    <p className="text-sm text-slate-500">Sin trayectoria importada desde el GEI.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="text-left text-xs text-slate-500">
                          <tr>
                            <th className="py-1.5 pr-3 font-medium">Ciclo</th>
                            <th className="py-1.5 pr-3 font-medium">Escuela</th>
                            <th className="py-1.5 pr-3 font-medium">Curso</th>
                            <th className="py-1.5 pr-3 font-medium">Condición</th>
                            <th className="py-1.5 pr-3 font-medium">Resultado</th>
                            <th className="py-1.5 text-right font-medium">Inasist.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {legajo.trayectoria.ciclos.map((t) => {
                            const repitio = /PERMANENCIA/i.test(t.motivoEgreso ?? "");
                            return (
                              <tr key={t.id} className={repitio ? "bg-amber-50" : ""}>
                                <td className="py-1.5 pr-3 tabular-nums text-slate-500">{t.cicloLectivo}</td>
                                <td className="py-1.5 pr-3 text-slate-800">{t.escuela}</td>
                                <td className="py-1.5 pr-3 text-slate-700">{t.division ?? "—"}</td>
                                <td className="py-1.5 pr-3 text-slate-700">{t.condicion ?? "—"}</td>
                                <td className="py-1.5 pr-3">
                                  {t.activo ? (
                                    <Insignia tono="azul">En curso</Insignia>
                                  ) : repitio ? (
                                    <Insignia tono="ambar" titulo={`Egreso ${formatearFecha(t.fechaEgreso)}`}>
                                      Permanencia (repitió)
                                    </Insignia>
                                  ) : (
                                    <span className="text-xs text-slate-600" title={`Egreso ${formatearFecha(t.fechaEgreso)}`}>
                                      {t.motivoEgreso ?? "—"}
                                    </span>
                                  )}
                                </td>
                                <td className="py-1.5 text-right tabular-nums text-slate-700">
                                  {t.inasistencias === null ? "—" : t.inasistencias.toLocaleString("es-AR")}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Seccion>
              )}

              {legajo.trayectoria && legajo.trayectoria.alertas.length > 0 && (
                <Seccion
                  titulo="Alertas tempranas (GEI)"
                  icono={<TriangleAlert className="h-4 w-4 text-amber-600" aria-hidden />}
                >
                  <ul className="space-y-3">
                    {legajo.trayectoria.alertas.map((a) => (
                      <li key={a.id} className="rounded-md border border-slate-200 p-3 text-sm">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="font-medium text-slate-800">{a.causas}</p>
                          <span className="text-xs tabular-nums text-slate-500">{formatearFecha(a.fecha)}</span>
                        </div>
                        {a.planIntervencion && <p className="mt-1 text-slate-700">Plan: {a.planIntervencion}</p>}
                        {a.observaciones && <p className="mt-1 text-slate-600">{a.observaciones}</p>}
                        {a.escuela && <p className="mt-1 text-xs text-slate-500">{a.escuela}</p>}
                      </li>
                    ))}
                  </ul>
                </Seccion>
              )}

              <Seccion titulo="Datos biográficos" icono={<User className="h-4 w-4 text-slate-500" aria-hidden />}>
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Dato etiqueta="DNI" valor={<span className="tabular-nums">{e.dni}</span>} />
                  <Dato etiqueta="CUIL" valor={<span className="tabular-nums">{e.cuil ?? "—"}</span>} />
                  <Dato
                    etiqueta="Nacimiento"
                    valor={`${formatearFecha(e.fechaNacimiento)}${edad(e.fechaNacimiento) !== null ? ` (${edad(e.fechaNacimiento)} años)` : ""}`}
                  />
                  <Dato etiqueta="Género" valor={e.genero ?? "—"} />
                  <Dato etiqueta="Curso" valor={`${etiquetaCurso(e.anio, e.division)} · ${e.turno}`} />
                  <Dato etiqueta="Promedio general" valor={formatearNota(e.promedioGeneral)} />
                  <Dato etiqueta="Asistencia" valor={`${e.porcentajeAsistencia.toLocaleString("es-AR")}%`} />
                  <Dato etiqueta="Última actualización" valor={formatearFecha(e.updatedAt)} />
                </dl>
              </Seccion>

              {legajo.contacto && (
                <Seccion titulo="Contacto familiar" icono={<Phone className="h-4 w-4 text-slate-500" aria-hidden />}>
                  <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Dato
                      etiqueta="Domicilio"
                      valor={
                        [legajo.contacto.direccion, legajo.contacto.localidad].filter(Boolean).join(" · ") || "—"
                      }
                    />
                    <Dato etiqueta="Email de contacto" valor={legajo.contacto.emailContacto ?? "—"} />
                    <Dato
                      etiqueta="Madre / Padre / Tutor"
                      valor={<span className="whitespace-pre-line">{legajo.contacto.familiares ?? "—"}</span>}
                    />
                    <Dato
                      etiqueta="Teléfonos"
                      valor={<span className="whitespace-pre-line tabular-nums">{legajo.contacto.telefonosFamiliares ?? "—"}</span>}
                    />
                    <Dato
                      etiqueta="Emails de familiares"
                      valor={<span className="whitespace-pre-line break-all">{legajo.contacto.emailsFamiliares ?? "—"}</span>}
                    />
                  </dl>
                </Seccion>
              )}

              <Seccion titulo="Informes del SOE" icono={<HeartPulse className="h-4 w-4 text-rose-600" aria-hidden />}>
                {legajo.confidencial ? (
                  legajo.confidencial.intervenciones.length === 0 ? (
                    <p className="text-sm text-slate-500">Sin intervenciones registradas.</p>
                  ) : (
                    <ul className="space-y-3">
                      {legajo.confidencial.intervenciones.map((i) => (
                        <li key={i.id} className="rounded-lg border border-rose-100 bg-rose-50/40 p-3">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="tabular-nums">{formatearFecha(i.fecha)}</span>
                            <span>·</span>
                            <span>{i.profesionalNombre}</span>
                          </div>
                          <p className="mt-1 text-sm font-medium text-slate-900">{i.motivo}</p>
                          <p className="mt-1 text-sm text-slate-700">{i.informeConfidencial}</p>
                          {i.archivoDriveUrl && (
                            <div className="mt-2">
                              <Enlace url={i.archivoDriveUrl} modoDemo={modoDemo}>
                                <FileText className="h-3.5 w-3.5" aria-hidden /> Informe completo
                              </Enlace>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )
                ) : (
                  <Bloqueado texto="Los informes confidenciales del SOE son de acceso exclusivo del nivel Directivo / SOE." />
                )}
              </Seccion>

              <Seccion titulo="Carpetas en Google Drive" icono={<FolderOpen className="h-4 w-4 text-emerald-600" aria-hidden />}>
                <p className="mb-3 break-words font-mono text-[11px] text-slate-500">📁 {rutaCarpetaEstudiante(e).join(" / ")}</p>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {(
                    [
                      ["Carpeta del alumno", legajo.drive.carpetaAlumno],
                      [SUBCARPETAS.documentacion, legajo.drive.documentacion],
                      [SUBCARPETAS.convivencia, legajo.drive.convivencia],
                      [SUBCARPETAS.confidencial, legajo.drive.confidencial],
                    ] as const
                  ).map(([nombre, url]) => (
                    <li key={nombre} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
                      <span className="truncate text-xs font-medium text-slate-700">📁 {nombre}</span>
                      {url ? (
                        <Enlace url={url} modoDemo={modoDemo}>
                          Abrir
                        </Enlace>
                      ) : (
                        <span className="text-xs text-slate-400">🔒 Sin acceso</span>
                      )}
                    </li>
                  ))}
                </ul>
              </Seccion>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
