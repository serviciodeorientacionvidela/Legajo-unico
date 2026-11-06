"use client";

/**
 * Infraestructura de informes imprimibles: membrete institucional, pie con firmas y aviso legal,
 * y una zona de impresión montada en <body> para que "Imprimir / Guardar como PDF" saque solo el
 * documento (ver reglas @media print en globals.css).
 */

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { formatearFechaHora } from "@/lib/formato";

export const INSTITUCION = {
  nombre: "Escuela N° 4-012 «Ing. Ricardo Videla»",
  dependencia: "Dirección General de Escuelas · Gobierno de Mendoza",
  sistema: "Legajo Único del Estudiante (LUE)",
};

/** Monta el documento en <body> (fuera de modales con scroll) solo mientras se imprime. */
export function ZonaImpresion({ children }: { children: ReactNode }) {
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  if (!montado) return null;
  return createPortal(<div id="zona-impresion">{children}</div>, document.body);
}

/**
 * imprimir(titulo) monta la zona de impresión, abre el diálogo del navegador (el título sugiere el
 * nombre del PDF) y la desmonta al cerrar.
 */
export function useImpresion() {
  const [titulo, setTitulo] = useState<string | null>(null);
  useEffect(() => {
    if (titulo === null) return;
    const previo = document.title;
    // Un instante para que el portal termine de pintar antes de abrir el diálogo.
    const t = window.setTimeout(() => {
      document.title = titulo;
      window.print();
      document.title = previo;
      setTitulo(null);
    }, 80);
    return () => window.clearTimeout(t);
  }, [titulo]);
  return { imprimiendo: titulo !== null, imprimir: setTitulo };
}

export function nombreArchivo(...partes: string[]): string {
  return partes
    .join(" ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}

interface DocumentoProps {
  titulo: string;
  subtitulo?: string;
  generadoPor: string;
  generado?: string;
  confidencial?: boolean;
  firmas?: string[];
  children: ReactNode;
}

export function DocumentoInforme({
  titulo,
  subtitulo,
  generadoPor,
  generado = new Date().toISOString(),
  confidencial = false,
  firmas = [],
  children,
}: DocumentoProps) {
  return (
    <article className="mx-auto max-w-[190mm] bg-white font-sans text-slate-900">
      {/* Membrete: escudo + institución en una sola banda; los datos de emisión van debajo del título
          para que el encabezado no se comprima cuando el documento se muestra angosto. */}
      <header className="flex items-center gap-4 border-b-4 border-institucional-600 pb-3">
        <img
          src="/logo-escuela.jpg"
          alt="Escudo Esc. N° 4-012 Ing. Ricardo Videla"
          width={64}
          height={64}
          className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-institucional-400"
        />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">{INSTITUCION.dependencia}</p>
          <p className="mt-0.5 text-lg font-bold text-institucional-950">{INSTITUCION.nombre}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">{INSTITUCION.sistema}</p>
        </div>
        {confidencial && (
          <p className="shrink-0 self-start rounded border-2 border-red-700 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-red-700">
            Confidencial
          </p>
        )}
      </header>

      <div className="mt-5">
        <h1 className="text-xl font-bold leading-tight text-institucional-950">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-sm text-slate-700">{subtitulo}</p>}
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 border-y border-slate-200 py-1.5 text-[11px] text-slate-600">
          <span>
            <span className="font-semibold text-slate-700">Emitido:</span> {formatearFechaHora(generado)}
          </span>
          <span>
            <span className="font-semibold text-slate-700">Por:</span> {generadoPor}
          </span>
        </p>
      </div>

      <div className="mt-4 space-y-5">{children}</div>

      {firmas.length > 0 && (
        <div className="evitar-corte mt-16 grid gap-10" style={{ gridTemplateColumns: `repeat(${firmas.length}, minmax(0, 1fr))` }}>
          {firmas.map((f) => (
            <div key={f} className="border-t border-slate-500 pt-1 text-center text-[11px] text-slate-600">
              {f}
              <br />
              Firma y aclaración
            </div>
          ))}
        </div>
      )}

      <footer className="mt-8 border-t border-slate-300 pt-2 text-[10px] leading-snug text-slate-500">
        Documento generado por el {INSTITUCION.sistema}. Contiene datos personales de menores protegidos por la Ley 25.326 de
        Protección de Datos Personales y la Ley 26.061 de Protección Integral de Niñas, Niños y Adolescentes: su uso queda
        restringido a fines pedagógicos e institucionales.
        {confidencial && " Contiene información de salud reservada: prohibida su divulgación o reproducción sin autorización del SOE."}
      </footer>
    </article>
  );
}

/** Bloque titulado dentro de un informe impreso. */
export function BloqueInforme({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 border-b border-institucional-200 pb-1 text-sm font-bold uppercase tracking-wide text-institucional-800">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

/** Descarga un texto como archivo (CSV para Excel). */
export function descargarArchivo(nombre: string, contenido: string, tipo = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
