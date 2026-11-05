"use client";

import { AlertTriangle, Bell, ClipboardList, Download, FileText, Phone, Scale } from "lucide-react";
import { useState } from "react";
import { documentoNormativo, guiaProtocolo, NORMATIVA, type SituacionProtocolo } from "@/lib/protocolos";

/** Paso a paso del protocolo elegido como causa de la actuación. */
export function GuiaProtocoloPanel({ causa }: { causa: string }) {
  const guia = guiaProtocolo(causa);
  const [situacionId, setSituacionId] = useState("");
  if (!guia) return null;
  const varias = guia.situaciones.length > 1;
  const situacion = varias ? guia.situaciones.find((s) => s.id === situacionId) : guia.situaciones[0];

  return (
    <aside className="rounded-xl border-2 border-amber-300 bg-amber-50/70 p-4" aria-label="Cómo proceder">
      <p className="flex items-center gap-2 font-bold text-amber-900">
        <Scale className="h-5 w-5" aria-hidden /> Cómo proceder · {guia.titulo}
      </p>
      <p className="mt-1 text-sm text-amber-900">{guia.resumen}</p>

      {varias && (
        <label className="mt-3 block text-sm font-semibold text-slate-800">
          Situación
          <select
            value={situacionId}
            onChange={(e) => setSituacionId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Elegir la situación para ver el procedimiento</option>
            {guia.situaciones.map((s) => (
              <option key={s.id} value={s.id}>
                {s.titulo}
              </option>
            ))}
          </select>
        </label>
      )}
      {situacion && <Procedimiento situacion={situacion} mostrarTitulo={!varias} />}

      <div className="mt-3 flex flex-wrap gap-2">
        {guia.documentos.map((archivo) => {
          const d = documentoNormativo(archivo);
          return (
            <a
              key={archivo}
              href={archivo}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-300 hover:bg-amber-100"
            >
              <FileText className="h-3.5 w-3.5" aria-hidden /> {d?.titulo ?? archivo}
            </a>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-amber-800">
        Guía resumida. Ante dudas, manda el texto oficial y la consulta a Dirección o al SOE.
      </p>
    </aside>
  );
}

function Procedimiento({ situacion, mostrarTitulo }: { situacion: SituacionProtocolo; mostrarTitulo: boolean }) {
  return (
    <div className="mt-3 space-y-3">
      {mostrarTitulo && <p className="font-semibold text-slate-900">{situacion.titulo}</p>}
      {situacion.cuando && <p className="text-xs italic text-slate-600">{situacion.cuando}</p>}
      <ol className="space-y-2">
        {situacion.pasos.map((p, i) => (
          <li key={p.titulo} className="flex gap-3">
            <span
              aria-hidden
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-600 text-xs font-bold text-white"
            >
              {i + 1}
            </span>
            <div className="text-sm">
              <p className="font-semibold text-slate-900">{p.titulo}</p>
              {p.detalle && <p className="text-slate-600">{p.detalle}</p>}
            </div>
          </li>
        ))}
      </ol>
      <div className="grid gap-2 sm:grid-cols-2">
        {situacion.avisar && (
          <div className="rounded-lg bg-white p-2 text-xs ring-1 ring-amber-200">
            <p className="flex items-center gap-1 font-semibold text-slate-800">
              <Bell className="h-3.5 w-3.5" aria-hidden /> Avisar a
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {situacion.avisar.map((a) => (
                <span key={a} className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900">
                  {a}
                </span>
              ))}
            </div>
          </div>
        )}
        {situacion.registrar && (
          <div className="rounded-lg bg-white p-2 text-xs ring-1 ring-amber-200">
            <p className="flex items-center gap-1 font-semibold text-slate-800">
              <ClipboardList className="h-3.5 w-3.5" aria-hidden /> Registrar
            </p>
            <p className="mt-1 text-slate-700">{situacion.registrar}</p>
          </div>
        )}
      </div>
      {situacion.evitar && (
        <div className="rounded-lg bg-red-50 p-2 text-xs ring-1 ring-red-200">
          <p className="flex items-center gap-1 font-semibold text-red-800">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Tener en cuenta
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-red-900">
            {situacion.evitar.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {situacion.telefonos && (
        <p className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
          <Phone className="h-3.5 w-3.5" aria-hidden />
          {situacion.telefonos.join(" · ")}
        </p>
      )}
    </div>
  );
}

/** Normativa descargable (decretos, protocolos y modelos de acta). */
export function NormativaPanel() {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
        <Scale className="h-5 w-5 text-institucional-700" aria-hidden /> Normativa y protocolos
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Documentos oficiales para descargar. Al registrar una actuación de tipo Protocolo, el sistema muestra el
        procedimiento resumido de cada uno.
      </p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {NORMATIVA.map((d) => (
          <li key={d.archivo} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-3">
            <div className="min-w-0">
              <p className="font-semibold text-slate-900">{d.titulo}</p>
              <p className="text-xs text-slate-600">{d.descripcion}</p>
            </div>
            <a href={d.archivo} download className="boton-secundario shrink-0" aria-label={`Descargar ${d.titulo}`}>
              <Download className="h-4 w-4" aria-hidden /> Descargar
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
