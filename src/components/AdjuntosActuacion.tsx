"use client";

import { FileImage, FileText, Loader2, Paperclip } from "lucide-react";
import { useRef, useState } from "react";
import { solicitar } from "@/lib/dataSource";

export interface AdjuntoVisible {
  id: string;
  nombreArchivo: string;
  tipoMime: string;
  tamanio: number;
  createdAt: string;
  subidoPor: { nombre: string };
}

const MAXIMO = 4 * 1024 * 1024;

/** Achica una foto del celular (lado mayor 1800 px, JPEG) para que pese unos cientos de KB y se lea bien. */
async function comprimirImagen(archivo: File): Promise<File> {
  if (!archivo.type.startsWith("image/")) return archivo;
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise<HTMLImageElement>((resolver, rechazar) => {
      const i = new Image();
      i.onload = () => resolver(i);
      i.onerror = () => rechazar(new Error("No se pudo leer la imagen."));
      i.src = url;
    });
    const escala = Math.min(1, 1800 / Math.max(img.naturalWidth, img.naturalHeight));
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.round(img.naturalWidth * escala);
    lienzo.height = Math.round(img.naturalHeight * escala);
    lienzo.getContext("2d")?.drawImage(img, 0, 0, lienzo.width, lienzo.height);
    const blob = await new Promise<Blob | null>((r) => lienzo.toBlob(r, "image/jpeg", 0.78));
    if (!blob) return archivo;
    const nombre = archivo.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], nombre, { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Sube la foto o el PDF de un acta en papel a una actuación. */
export async function subirAdjunto(actuacionId: string, archivo: File): Promise<void> {
  const listo = await comprimirImagen(archivo);
  if (listo.size > MAXIMO) throw new Error("El archivo supera los 4 MB. Si es un PDF, escanéelo en menor resolución.");
  const datos = new FormData();
  datos.set("actuacionId", actuacionId);
  datos.set("archivo", listo);
  await solicitar("/api/seguimiento/adjuntos", { method: "POST", body: datos });
}

const tamanio = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

/** Lista de actas escaneadas de una actuación y botón para adjuntar otra. */
export default function AdjuntosActuacion({
  actuacionId,
  adjuntos,
  puedeAdjuntar,
  onSubido,
}: {
  actuacionId: string;
  adjuntos: AdjuntoVisible[];
  puedeAdjuntar: boolean;
  onSubido: () => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const elegir = async (archivo: File | undefined) => {
    if (!archivo) return;
    setSubiendo(true);
    setError(null);
    try {
      await subirAdjunto(actuacionId, archivo);
      onSubido();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubiendo(false);
      if (entrada.current) entrada.current.value = "";
    }
  };

  if (!adjuntos.length && !puedeAdjuntar) return null;
  return (
    <div className="mt-2 space-y-1">
      {adjuntos.map((a) => (
        <a
          key={a.id}
          href={`/api/seguimiento/adjuntos/${encodeURIComponent(a.id)}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-700 ring-1 ring-slate-200 hover:bg-institucional-50"
        >
          {a.tipoMime === "application/pdf" ? (
            <FileText className="h-4 w-4 shrink-0 text-red-700" aria-hidden />
          ) : (
            <FileImage className="h-4 w-4 shrink-0 text-institucional-700" aria-hidden />
          )}
          <span className="truncate font-medium">{a.nombreArchivo}</span>
          <span className="shrink-0 text-slate-400">
            {tamanio(a.tamanio)} · {a.subidoPor.nombre} · {new Date(a.createdAt).toLocaleDateString("es-AR")}
          </span>
        </a>
      ))}
      {puedeAdjuntar && (
        <>
          <input
            ref={entrada}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => void elegir(e.target.files?.[0])}
          />
          <button
            type="button"
            disabled={subiendo}
            onClick={() => entrada.current?.click()}
            className="inline-flex items-center gap-1 text-xs font-semibold text-institucional-700 underline print:hidden"
          >
            {subiendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Paperclip className="h-3.5 w-3.5" aria-hidden />}
            {subiendo ? "Subiendo…" : "Adjuntar acta escaneada (foto o PDF)"}
          </button>
          {error && <p className="text-xs text-red-700">{error}</p>}
        </>
      )}
    </div>
  );
}
