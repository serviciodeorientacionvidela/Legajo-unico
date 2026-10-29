"use client";

import { FileDown, Loader2, Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { REGLAS_INCIDENTE, PUNTOS_INICIALES } from "@/lib/convivencia";
import { edad, etiquetaCurso, formatearFecha, formatearNota } from "@/lib/formato";
import { notaVigenteDe } from "@/lib/informes";
import { UMBRAL_PROMEDIO_BAJO } from "@/lib/rbac";
import { TIPO_INTERVENCION_ETIQUETA, type LegajoVisible } from "@/lib/types";
import { BloqueInforme, DocumentoInforme, nombreArchivo, useImpresion, ZonaImpresion } from "./Imprimible";
import { MensajeError, Modal } from "./ui";

// ---------------------------------------------------------------------------
// Tipos de informe y secciones
// ---------------------------------------------------------------------------

const SECCIONES = {
  datos: "Datos personales y curso",
  contacto: "Contacto familiar",
  academico: "Calificaciones del ciclo",
  historial: "Historial de rendimiento por ciclo",
  asistencia: "Asistencia mensual",
  convivencia: "Régimen de convivencia",
  trayectoria: "Trayectoria escolar y alertas",
  acuerdos: "Acuerdos pedagógicos del SOE",
  soe: "Informes y datos reservados del SOE",
} as const;
type Seccion = keyof typeof SECCIONES;

interface Plantilla {
  titulo: string;
  descripcion: string;
  secciones: Seccion[];
  firmas: string[];
  confidencial: boolean;
  /** Para la familia solo se informan incidentes aprobados y sin datos internos. */
  paraFamilia: boolean;
}

const PLANTILLAS = {
  SEGUIMIENTO: {
    titulo: "Informe de seguimiento pedagógico",
    descripcion: "Para el equipo docente, preceptoría y reuniones de acompañamiento.",
    secciones: ["datos", "academico", "historial", "asistencia", "convivencia", "trayectoria", "acuerdos"],
    firmas: ["Preceptor/a", "Directivo/a"],
    confidencial: false,
    paraFamilia: false,
  },
  FAMILIA: {
    titulo: "Informe para la familia",
    descripcion: "Rendimiento, asistencia y convivencia, con espacio de notificación.",
    secciones: ["datos", "academico", "asistencia", "convivencia"],
    firmas: ["Preceptor/a", "Directivo/a", "Madre / Padre / Tutor (notificado)"],
    confidencial: false,
    paraFamilia: true,
  },
  SOE: {
    titulo: "Informe del Servicio de Orientación Escolar",
    descripcion: "Uso interno del SOE y Dirección: incluye diagnóstico e intervenciones.",
    secciones: ["datos", "contacto", "academico", "asistencia", "convivencia", "trayectoria", "acuerdos", "soe"],
    firmas: ["Profesional del SOE", "Directivo/a"],
    confidencial: true,
    paraFamilia: false,
  },
  PASE: {
    titulo: "Informe de trayectoria escolar",
    descripcion: "Para pases, articulación entre niveles o solicitudes externas.",
    secciones: ["datos", "historial", "trayectoria", "academico", "asistencia"],
    firmas: ["Secretario/a", "Directivo/a"],
    confidencial: false,
    paraFamilia: false,
  },
} satisfies Record<string, Plantilla>;
type TipoPlantilla = keyof typeof PLANTILLAS;

function seccionDisponible(legajo: LegajoVisible, s: Seccion): boolean {
  switch (s) {
    case "contacto":
      return legajo.contacto !== null;
    case "convivencia":
      return legajo.convivencia !== null;
    case "trayectoria":
      return legajo.trayectoria !== null;
    case "soe":
      return legajo.confidencial !== null;
    default:
      return true;
  }
}

// ---------------------------------------------------------------------------
// Contenido del documento
// ---------------------------------------------------------------------------

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-slate-500">{etiqueta}</dt>
      <dd className="text-sm font-medium text-slate-900">{valor}</dd>
    </div>
  );
}

function SinDatos({ texto }: { texto: string }) {
  return <p className="text-xs italic text-slate-500">{texto}</p>;
}

export function ContenidoInformeLegajo({
  legajo,
  secciones,
  plantilla,
  observaciones,
}: {
  legajo: LegajoVisible;
  secciones: Set<Seccion>;
  plantilla: Plantilla;
  observaciones: string;
}) {
  const e = legajo.estudiante;
  const ciclos = [...new Set(legajo.calificaciones.map((c) => c.cicloLectivo))].sort((a, b) => b - a);
  const cicloActual = ciclos[0] ?? null;
  const notasCiclo = legajo.calificaciones.filter((c) => c.cicloLectivo === cicloActual);
  const cicloAsistencia = legajo.asistenciaMensual[0]?.cicloLectivo ?? null;
  const meses = legajo.asistenciaMensual.filter((m) => m.cicloLectivo === cicloAsistencia);
  const incidentes = (legajo.convivencia?.incidentes ?? []).filter((i) => !i.anulado && (!plantilla.paraFamilia || i.aprobado));

  return (
    <>
      {secciones.has("datos") && (
        <BloqueInforme titulo={SECCIONES.datos}>
          <dl className="grid grid-cols-4 gap-x-4 gap-y-2">
            <div className="col-span-2">
              <Dato etiqueta="Apellido y nombre" valor={`${e.apellidos}, ${e.nombres}`} />
            </div>
            <Dato etiqueta="DNI" valor={e.dni} />
            <Dato etiqueta="CUIL" valor={e.cuil ?? "—"} />
            <Dato
              etiqueta="Nacimiento"
              valor={`${formatearFecha(e.fechaNacimiento)}${edad(e.fechaNacimiento) !== null ? ` (${edad(e.fechaNacimiento)} años)` : ""}`}
            />
            <Dato etiqueta="Curso" valor={`${etiquetaCurso(e.anio, e.division)} · ${e.turno}`} />
            <Dato etiqueta="Condición" valor={e.estadoMatricula === "REGULAR" ? "Regular" : e.estadoMatricula} />
            <Dato etiqueta="Apoyos" valor={[e.tieneCud && "CUD", e.requierePpi && "PPI"].filter(Boolean).join(" · ") || "No"} />
            <Dato etiqueta="Promedio general" valor={formatearNota(e.promedioGeneral)} />
            <Dato etiqueta="Asistencia" valor={`${e.porcentajeAsistencia.toLocaleString("es-AR")}%`} />
            {legajo.convivencia && <Dato etiqueta="Puntos ICE" valor={`${legajo.convivencia.puntos} / ${PUNTOS_INICIALES}`} />}
          </dl>
        </BloqueInforme>
      )}

      {secciones.has("contacto") && legajo.contacto && (
        <BloqueInforme titulo={SECCIONES.contacto}>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
            <Dato etiqueta="Domicilio" valor={[legajo.contacto.direccion, legajo.contacto.localidad].filter(Boolean).join(" · ") || "—"} />
            <Dato etiqueta="Email de contacto" valor={legajo.contacto.emailContacto ?? "—"} />
            <Dato etiqueta="Familiares / tutores" valor={legajo.contacto.familiares?.replace(/\n/g, " · ") ?? "—"} />
            <Dato etiqueta="Teléfonos" valor={legajo.contacto.telefonosFamiliares?.replace(/\n/g, " · ") ?? "—"} />
          </dl>
        </BloqueInforme>
      )}

      {secciones.has("academico") && (
        <BloqueInforme titulo={`${SECCIONES.academico}${cicloActual ? ` ${cicloActual}` : ""}`}>
          {notasCiclo.length === 0 ? (
            <SinDatos texto="Sin calificaciones importadas desde el GEI." />
          ) : (
            <table className="tabla-informe">
              <thead>
                <tr>
                  <th>Espacio curricular</th>
                  <th className="text-right">1° período</th>
                  <th className="text-right">2° período</th>
                  <th className="text-right">Final</th>
                  <th>Situación</th>
                </tr>
              </thead>
              <tbody>
                {notasCiclo.map((c) => {
                  const vigente = notaVigenteDe(c);
                  return (
                    <tr key={c.id}>
                      <td>{c.materia}</td>
                      {[c.primerCuatrimestre, c.segundoCuatrimestre, c.notaFinal].map((n, i) => (
                        <td key={i} className={`text-right tabular-nums ${n !== null && n < UMBRAL_PROMEDIO_BAJO ? "font-bold text-red-700" : ""}`}>
                          {formatearNota(n)}
                        </td>
                      ))}
                      <td>
                        {c.previa
                          ? "Previa"
                          : vigente === null
                            ? "Sin calificar"
                            : vigente < UMBRAL_PROMEDIO_BAJO
                              ? "En riesgo (< 6)"
                              : "Aprobando"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </BloqueInforme>
      )}

      {secciones.has("historial") && (
        <BloqueInforme titulo={SECCIONES.historial}>
          {ciclos.length === 0 ? (
            <SinDatos texto="Sin calificaciones registradas." />
          ) : (
            <table className="tabla-informe">
              <thead>
                <tr>
                  <th>Ciclo lectivo</th>
                  <th className="text-right">Espacios calificados</th>
                  <th className="text-right">Promedio</th>
                  <th className="text-right">Por debajo de 6</th>
                  <th className="text-right">Previas</th>
                </tr>
              </thead>
              <tbody>
                {ciclos.map((ciclo) => {
                  const delCiclo = legajo.calificaciones.filter((c) => c.cicloLectivo === ciclo);
                  const notas = delCiclo.map(notaVigenteDe).filter((n): n is number => n !== null);
                  const promedio = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null;
                  return (
                    <tr key={ciclo}>
                      <td className="tabular-nums">{ciclo}</td>
                      <td className="text-right tabular-nums">{notas.length}</td>
                      <td className="text-right tabular-nums">{promedio === null ? "—" : formatearNota(Math.round(promedio * 100) / 100)}</td>
                      <td className="text-right tabular-nums">{notas.filter((n) => n < UMBRAL_PROMEDIO_BAJO).length}</td>
                      <td className="text-right tabular-nums">{delCiclo.filter((c) => c.previa).length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </BloqueInforme>
      )}

      {secciones.has("asistencia") && (
        <BloqueInforme titulo={`${SECCIONES.asistencia}${cicloAsistencia ? ` ${cicloAsistencia}` : ""}`}>
          {meses.length === 0 ? (
            <SinDatos texto={`Asistencia anual registrada: ${e.porcentajeAsistencia.toLocaleString("es-AR")}%. Sin detalle mensual importado.`} />
          ) : (
            <table className="tabla-informe">
              <thead>
                <tr>
                  <th>Mes</th>
                  <th>Período</th>
                  <th className="text-right">Justificadas</th>
                  <th className="text-right">Injustificadas</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Asistencia</th>
                </tr>
              </thead>
              <tbody>
                {meses.map((m) => (
                  <tr key={m.id}>
                    <td>{m.mes}</td>
                    <td>{m.periodo}</td>
                    <td className="text-right tabular-nums">{m.justificadas?.toLocaleString("es-AR") ?? "—"}</td>
                    <td className="text-right tabular-nums">{m.injustificadas?.toLocaleString("es-AR") ?? "—"}</td>
                    <td className="text-right tabular-nums">{m.totalInasistencias?.toLocaleString("es-AR") ?? "—"}</td>
                    <td className={`text-right tabular-nums ${m.porcentaje !== null && m.porcentaje < 85 ? "font-bold text-red-700" : ""}`}>
                      {m.porcentaje === null ? "—" : `${m.porcentaje.toLocaleString("es-AR")}%`}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={4} className="font-bold">
                    Total del ciclo
                  </td>
                  <td className="text-right font-bold tabular-nums">
                    {meses.reduce((a, m) => a + (m.totalInasistencias ?? 0), 0).toLocaleString("es-AR")}
                  </td>
                  <td className="text-right font-bold tabular-nums">{e.porcentajeAsistencia.toLocaleString("es-AR")}%</td>
                </tr>
              </tbody>
            </table>
          )}
        </BloqueInforme>
      )}

      {secciones.has("convivencia") && legajo.convivencia && (
        <BloqueInforme titulo={SECCIONES.convivencia}>
          <p className="mb-2 text-sm">
            Saldo de Puntos ICE (GEI): <strong>{legajo.convivencia.puntos}</strong> de {PUNTOS_INICIALES} puntos.
          </p>
          {legajo.convivencia.faltasIce.filter((f) => !f.dadaDeBaja).length > 0 && (
            <table className="tabla-informe mb-3">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Falta (GEI)</th>
                  <th className="text-right">Puntos</th>
                </tr>
              </thead>
              <tbody>
                {legajo.convivencia.faltasIce
                  .filter((f) => !f.dadaDeBaja)
                  .map((f) => (
                    <tr key={f.id}>
                      <td className="tabular-nums">{formatearFecha(f.fecha)}</td>
                      <td>{f.tipo}</td>
                      <td className="text-right tabular-nums">−{f.puntos}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
          {incidentes.length === 0 ? (
            <SinDatos texto="Sin actas de convivencia registradas en el LUE." />
          ) : (
            <table className="tabla-informe">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Hecho</th>
                  <th>Medida adoptada</th>
                  {!plantilla.paraFamilia && <th>Estado</th>}
                </tr>
              </thead>
              <tbody>
                {incidentes.map((i) => (
                  <tr key={i.id}>
                    <td className="whitespace-nowrap tabular-nums">{formatearFecha(i.fecha)}</td>
                    <td className="whitespace-nowrap">{REGLAS_INCIDENTE[i.tipo].etiqueta}</td>
                    <td>{i.motivo}</td>
                    <td>{i.medidaAdoptada ?? "—"}</td>
                    {!plantilla.paraFamilia && <td>{i.aprobado ? "Aprobado" : "Pendiente"}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </BloqueInforme>
      )}

      {secciones.has("trayectoria") && legajo.trayectoria && (
        <BloqueInforme titulo={SECCIONES.trayectoria}>
          {legajo.trayectoria.ciclos.length === 0 ? (
            <SinDatos texto="Sin trayectoria importada desde el GEI." />
          ) : (
            <table className="tabla-informe">
              <thead>
                <tr>
                  <th>Ciclo</th>
                  <th>Escuela</th>
                  <th>Curso</th>
                  <th>Resultado</th>
                  <th className="text-right">Inasist.</th>
                </tr>
              </thead>
              <tbody>
                {legajo.trayectoria.ciclos.map((t) => (
                  <tr key={t.id}>
                    <td className="tabular-nums">{t.cicloLectivo}</td>
                    <td>{t.escuela}</td>
                    <td>{t.division ?? "—"}</td>
                    <td>{t.activo ? "En curso" : (t.motivoEgreso ?? "—")}</td>
                    <td className="text-right tabular-nums">{t.inasistencias?.toLocaleString("es-AR") ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {legajo.trayectoria.alertas.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <p className="text-xs font-bold text-slate-700">Alertas tempranas registradas en el GEI</p>
              {legajo.trayectoria.alertas.map((a) => (
                <p key={a.id} className="text-xs text-slate-700">
                  <span className="tabular-nums text-slate-500">{formatearFecha(a.fecha)}</span> · {a.causas}
                  {a.planIntervencion ? ` — Plan: ${a.planIntervencion}` : ""}
                </p>
              ))}
            </div>
          )}
        </BloqueInforme>
      )}

      {secciones.has("acuerdos") && (
        <BloqueInforme titulo={SECCIONES.acuerdos}>
          {legajo.acuerdosSoe.length === 0 ? (
            <SinDatos texto="Sin acuerdos pedagógicos registrados." />
          ) : (
            <ul className="space-y-1.5">
              {legajo.acuerdosSoe.map((a) => (
                <li key={a.id} className="text-sm">
                  <span className="mr-2 text-xs tabular-nums text-slate-500">{formatearFecha(a.fecha)}</span>
                  {a.acuerdosDocentes}
                </li>
              ))}
            </ul>
          )}
        </BloqueInforme>
      )}

      {secciones.has("soe") && legajo.confidencial && (
        <BloqueInforme titulo={SECCIONES.soe}>
          <dl className="mb-3 grid grid-cols-2 gap-x-4 gap-y-2">
            <div className="col-span-2">
              <Dato etiqueta="Diagnóstico reservado" valor={legajo.confidencial.diagnosticoReservado ?? "—"} />
            </div>
            <Dato etiqueta="Vencimiento del CUD" valor={formatearFecha(legajo.confidencial.vencimientoCud)} />
            <Dato etiqueta="Observaciones" valor={legajo.confidencial.observacionesConfidenciales ?? "—"} />
          </dl>
          {legajo.confidencial.intervenciones.length === 0 ? (
            <SinDatos texto="Sin intervenciones registradas." />
          ) : (
            <div className="space-y-3">
              {legajo.confidencial.intervenciones.map((i) => (
                <div key={i.id} className="evitar-corte rounded border border-slate-300 p-2.5">
                  <p className="text-xs text-slate-500">
                    {formatearFecha(i.fecha)} · {TIPO_INTERVENCION_ETIQUETA[i.tipo]} · {i.profesionalNombre}
                    {i.participantes ? ` · Participantes: ${i.participantes}` : ""}
                  </p>
                  <p className="mt-0.5 text-sm font-bold">{i.motivo}</p>
                  <p className="mt-1 whitespace-pre-line text-sm">{i.informeConfidencial}</p>
                  {i.acuerdosDocentes && (
                    <p className="mt-1 text-xs">
                      <strong>Acuerdos:</strong> {i.acuerdosDocentes}
                    </p>
                  )}
                  {i.proximoSeguimiento && <p className="mt-1 text-xs">Próximo seguimiento: {formatearFecha(i.proximoSeguimiento)}</p>}
                </div>
              ))}
            </div>
          )}
        </BloqueInforme>
      )}

      {observaciones.trim() && (
        <BloqueInforme titulo="Observaciones">
          <p className="whitespace-pre-line text-sm">{observaciones.trim()}</p>
        </BloqueInforme>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

interface Props {
  abierto: boolean;
  legajo: LegajoVisible | null;
  emisor: string;
  onCerrar: () => void;
  /** Registra la emisión en auditoría antes de imprimir. */
  onRegistrar: (dni: string) => Promise<void>;
}

export default function InformeLegajoModal({ abierto, legajo, emisor, onCerrar, onRegistrar }: Props) {
  const [tipo, setTipo] = useState<TipoPlantilla>("SEGUIMIENTO");
  const [secciones, setSecciones] = useState<Set<Seccion>>(new Set());
  const [observaciones, setObservaciones] = useState("");
  const [registrando, setRegistrando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { imprimiendo, imprimir } = useImpresion();

  const plantillasDisponibles = useMemo(
    () => (Object.keys(PLANTILLAS) as TipoPlantilla[]).filter((t) => !PLANTILLAS[t].confidencial || legajo?.confidencial),
    [legajo],
  );

  const aplicarPlantilla = (t: TipoPlantilla) => {
    setTipo(t);
    if (legajo) setSecciones(new Set(PLANTILLAS[t].secciones.filter((s) => seccionDisponible(legajo, s))));
  };

  useEffect(() => {
    if (!abierto || !legajo) return;
    setObservaciones("");
    setError(null);
    setTipo("SEGUIMIENTO");
    setSecciones(new Set(PLANTILLAS.SEGUIMIENTO.secciones.filter((s) => seccionDisponible(legajo, s))));
  }, [abierto, legajo]);

  if (!legajo) return null;
  const plantilla = PLANTILLAS[tipo];
  const confidencial = plantilla.confidencial || secciones.has("soe");
  const e = legajo.estudiante;

  const alternar = (s: Seccion) =>
    setSecciones((previas) => {
      const nuevas = new Set(previas);
      if (nuevas.has(s)) nuevas.delete(s);
      else nuevas.add(s);
      return nuevas;
    });

  const generar = async () => {
    setRegistrando(true);
    setError(null);
    try {
      await onRegistrar(e.dni);
      imprimir(nombreArchivo(plantilla.titulo, e.apellidos, e.nombres, e.dni));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRegistrando(false);
    }
  };

  const documento = (
    <DocumentoInforme
      titulo={plantilla.titulo}
      subtitulo={`${e.apellidos}, ${e.nombres} · DNI ${e.dni} · ${etiquetaCurso(e.anio, e.division)} · ${e.turno}`}
      generadoPor={emisor}
      confidencial={confidencial}
      firmas={plantilla.firmas}
    >
      <ContenidoInformeLegajo legajo={legajo} secciones={secciones} plantilla={plantilla} observaciones={observaciones} />
    </DocumentoInforme>
  );

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Generar informe del estudiante" subtitulo={`${e.apellidos}, ${e.nombres}`} ancho="xl">
      <div className="grid gap-5 lg:grid-cols-[17rem_1fr]">
        <div className="space-y-4">
          <fieldset>
            <legend className="etiqueta-campo mb-1.5">Tipo de informe</legend>
            <div className="space-y-1.5">
              {plantillasDisponibles.map((t) => (
                <label
                  key={t}
                  className={`block cursor-pointer rounded-xl border p-2.5 transition ${
                    t === tipo ? "border-institucional-500 bg-institucional-50 ring-1 ring-institucional-500" : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <input type="radio" name="plantilla" className="sr-only" checked={t === tipo} onChange={() => aplicarPlantilla(t)} />
                  <span className="block text-sm font-semibold text-slate-800">{PLANTILLAS[t].titulo}</span>
                  <span className="block text-xs text-slate-500">{PLANTILLAS[t].descripcion}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="etiqueta-campo mb-1.5">Secciones incluidas</legend>
            <div className="space-y-1">
              {(Object.keys(SECCIONES) as Seccion[]).map((s) => {
                const disponible = seccionDisponible(legajo, s);
                return (
                  <label key={s} className={`flex items-center gap-2 text-sm ${disponible ? "text-slate-700" : "text-slate-400"}`}>
                    <input
                      type="checkbox"
                      disabled={!disponible}
                      checked={secciones.has(s)}
                      onChange={() => alternar(s)}
                      className="h-4 w-4 rounded border-slate-300 text-institucional-600"
                    />
                    {SECCIONES[s]}
                    {!disponible && <span className="text-xs">🔒</span>}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <label className="etiqueta-campo">
            Observaciones del informe
            <textarea
              value={observaciones}
              onChange={(ev) => setObservaciones(ev.target.value)}
              rows={4}
              placeholder="Texto libre que se agrega al final del documento."
              className="campo"
            />
          </label>

          {error && <MensajeError mensaje={error} />}
          <button type="button" onClick={() => void generar()} disabled={registrando || imprimiendo || secciones.size === 0} className="boton-primario w-full">
            {registrando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Printer className="h-4 w-4" aria-hidden />}
            Imprimir / Guardar PDF
          </button>
          <p className="flex items-start gap-1.5 text-xs text-slate-500">
            <FileDown className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            En el diálogo de impresión elija «Guardar como PDF» para archivarlo en la carpeta del alumno en Drive. La emisión queda
            registrada en auditoría.
          </p>
        </div>

        <div className="min-w-0">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Vista previa</p>
          <div className="max-h-[65vh] overflow-auto rounded-xl border border-slate-200 bg-slate-100 p-4">
            <div className="rounded bg-white p-6 shadow-sm">{documento}</div>
          </div>
        </div>
      </div>

      {imprimiendo && <ZonaImpresion>{documento}</ZonaImpresion>}
    </Modal>
  );
}
