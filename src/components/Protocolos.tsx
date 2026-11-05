"use client";

import { AlertTriangle, Bell, ClipboardList, Download, FileText, Loader2, Phone, Scale, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { solicitar } from "@/lib/dataSource";
import { MensajeError } from "./ui";
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

/** Documento subido por dirección / SOE (se guarda en la base). */
interface DocumentoSubido {
  id: string;
  titulo: string;
  descripcion: string | null;
  nombreArchivo: string;
  tipoMime: string;
  tamanio: number;
  createdAt: string;
  subidoPor: { nombre: string };
}

const extension = (nombre: string) => (nombre.split(".").pop() ?? "").toUpperCase().slice(0, 4);
const tamanioLegible = (b: number) =>
  b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;

/** Normativa descargable: documentos oficiales fijos + los que suben dirección y SOE. */
export function NormativaPanel({ puedeGestionar = false, modoDemo = false }: { puedeGestionar?: boolean; modoDemo?: boolean }) {
  const [subidos, setSubidos] = useState<DocumentoSubido[]>([]);
  const [formAbierto, setFormAbierto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aBorrar, setABorrar] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (modoDemo) return;
    try {
      setSubidos((await solicitar<{ documentos: DocumentoSubido[] }>("/api/normativa")).documentos);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [modoDemo]);
  useEffect(() => {
    void cargar();
  }, [cargar]);

  const subir = async (e: FormEvent) => {
    e.preventDefault();
    if (!archivo) return setError("Elija un archivo.");
    if (archivo.size > 4 * 1024 * 1024) return setError("El archivo supera los 4 MB. Comprímalo o súbalo en partes.");
    if (titulo.trim().length < 3) return setError("Escriba un título (mínimo 3 caracteres).");
    const datos = new FormData();
    datos.set("archivo", archivo);
    datos.set("titulo", titulo.trim());
    datos.set("descripcion", descripcion.trim());
    setOcupado(true);
    setError(null);
    try {
      await solicitar("/api/normativa", { method: "POST", body: datos });
      setTitulo("");
      setDescripcion("");
      setArchivo(null);
      setFormAbierto(false);
      await cargar();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  const borrar = async (id: string) => {
    setOcupado(true);
    setError(null);
    try {
      await solicitar(`/api/normativa/${encodeURIComponent(id)}`, { method: "DELETE" });
      setABorrar(null);
      await cargar();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Scale className="h-5 w-5 text-institucional-700" aria-hidden /> Normativa y protocolos
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Documentos para descargar. Al registrar una actuación de tipo Protocolo, el sistema muestra el procedimiento
            resumido de cada uno.
          </p>
        </div>
        {puedeGestionar && !modoDemo && !formAbierto && (
          <button type="button" className="boton-primario" onClick={() => setFormAbierto(true)}>
            <Upload className="h-4 w-4" aria-hidden /> Agregar documento
          </button>
        )}
      </div>

      {formAbierto && (
        <form
          onSubmit={subir}
          className="grid gap-3 rounded-xl border border-institucional-200 bg-institucional-50/50 p-4 sm:grid-cols-2"
        >
          <label className="etiqueta-campo">
            Título *
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              maxLength={150}
              className="campo"
              placeholder="Ej.: Resolución 1234/2026 · Acuerdos de convivencia"
              required
            />
          </label>
          <label className="etiqueta-campo">
            Archivo * (PDF, Word, Excel, JPG o PNG · máx. 4 MB)
            <input
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              className="campo"
              required
            />
          </label>
          <label className="etiqueta-campo sm:col-span-2">
            Descripción breve
            <input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              maxLength={300}
              className="campo"
              placeholder="Para qué sirve o cuándo se usa"
            />
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={ocupado} className="boton-primario">
              {ocupado ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />}
              Subir
            </button>
            <button type="button" className="boton-secundario" onClick={() => setFormAbierto(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
      {error && <MensajeError mensaje={error} />}

      {subidos.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Agregados por la institución</h3>
          <ul className="grid gap-3 sm:grid-cols-2">
            {subidos.map((d) => (
              <li key={d.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-semibold text-slate-900">
                    <span className="rounded bg-institucional-50 px-1.5 py-0.5 font-mono text-[10px] text-institucional-800">
                      {extension(d.nombreArchivo)}
                    </span>
                    <span className="truncate">{d.titulo}</span>
                  </p>
                  {d.descripcion && <p className="text-xs text-slate-600">{d.descripcion}</p>}
                  <p className="text-[11px] text-slate-400">
                    {d.subidoPor.nombre} · {new Date(d.createdAt).toLocaleDateString("es-AR")} · {tamanioLegible(d.tamanio)}
                  </p>
                  {puedeGestionar &&
                    (aBorrar === d.id ? (
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-red-700">¿Quitar este documento?</span>
                        <button
                          type="button"
                          disabled={ocupado}
                          className="font-semibold text-red-700 underline"
                          onClick={() => void borrar(d.id)}
                        >
                          Sí, quitar
                        </button>
                        <button type="button" className="underline" onClick={() => setABorrar(null)}>
                          No
                        </button>
                      </p>
                    ) : (
                      <button
                        type="button"
                        className="mt-1 inline-flex items-center gap-1 text-xs text-red-700 underline"
                        onClick={() => setABorrar(d.id)}
                      >
                        <Trash2 className="h-3 w-3" aria-hidden /> Quitar
                      </button>
                    ))}
                </div>
                <a
                  href={`/api/normativa/${encodeURIComponent(d.id)}`}
                  className="boton-secundario shrink-0"
                  aria-label={`Descargar ${d.titulo}`}
                >
                  <Download className="h-4 w-4" aria-hidden /> Descargar
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Normativa oficial</h3>
        <ul className="grid gap-3 sm:grid-cols-2">
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
      </div>
    </section>
  );
}
