"use client";

import { X } from "lucide-react";
import { useEffect, useId, type ReactNode } from "react";

type Tono = "neutro" | "azul" | "verde" | "ambar" | "rojo" | "violeta";

const TONOS: Record<Tono, string> = {
  neutro: "bg-slate-100 text-slate-700 ring-slate-200",
  azul: "bg-institucional-50 text-institucional-700 ring-institucional-100",
  verde: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  ambar: "bg-amber-50 text-amber-800 ring-amber-200",
  rojo: "bg-red-50 text-red-700 ring-red-200",
  violeta: "bg-violet-50 text-violet-700 ring-violet-200",
};

export function Insignia({ tono = "neutro", children, titulo }: { tono?: Tono; children: ReactNode; titulo?: string }) {
  return (
    <span
      title={titulo}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONOS[tono]}`}
    >
      {children}
    </span>
  );
}

interface ModalProps {
  abierto: boolean;
  titulo: string;
  subtitulo?: string;
  onCerrar: () => void;
  children: ReactNode;
  ancho?: "md" | "lg" | "xl";
}

export function Modal({ abierto, titulo, subtitulo, onCerrar, children, ancho = "md" }: ModalProps) {
  const idTitulo = useId();

  useEffect(() => {
    if (!abierto) return;
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, [abierto, onCerrar]);

  if (!abierto) return null;
  const anchos = { md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-institucional-950/50 p-4 backdrop-blur-sm sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        className={`relative w-full ${anchos[ancho]} overflow-hidden rounded-2xl bg-white shadow-2xl`}
      >
        <div className="flex items-start justify-between gap-4 bg-institucional-950 px-5 py-4">
          <div>
            <h2 id={idTitulo} className="text-base font-bold text-white">
              {titulo}
            </h2>
            {subtitulo && <p className="mt-0.5 text-sm text-institucional-200">{subtitulo}</p>}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-full p-1 text-institucional-200 hover:bg-institucional-900 hover:text-white"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function Seccion({
  titulo,
  icono,
  children,
  accion,
}: {
  titulo: string;
  icono?: ReactNode;
  children: ReactNode;
  accion?: ReactNode;
}) {
  return (
    <section className="tarjeta">
      <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
        <h3 className="flex items-center gap-2 text-sm font-bold text-institucional-950">
          {icono}
          {titulo}
        </h3>
        {accion}
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

export function MensajeError({ mensaje }: { mensaje: string }) {
  return <p className="rounded-2xl bg-red-50 px-4 py-2.5 text-sm text-red-700 ring-1 ring-inset ring-red-200">{mensaje}</p>;
}

export function Bloqueado({ texto }: { texto: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-500">
      🔒 {texto}
    </p>
  );
}
