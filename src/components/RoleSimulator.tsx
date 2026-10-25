"use client";

import { ROLES, type Rol } from "@/lib/types";

const ETIQUETAS: Record<Rol, string> = {
  DIRECTIVO_SOE: "Directivo / SOE",
  PRECEPTOR: "Preceptor",
  DOCENTE: "Docente",
};

/** Selector de rol del modo demostración: permite comprobar en vivo qué datos recibe cada perfil. */
export default function RoleSimulator({
  rol,
  onCambiar,
  compacto = false,
}: {
  rol: Rol;
  onCambiar: (rol: Rol) => void;
  compacto?: boolean;
}) {
  return (
    <div className="flex rounded-lg bg-slate-100 p-1" role="radiogroup" aria-label="Simulador de rol">
      {ROLES.map((r) => (
        <button
          key={r}
          type="button"
          role="radio"
          aria-checked={rol === r}
          onClick={() => onCambiar(r)}
          className={`rounded-md font-medium transition ${compacto ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs"} ${
            rol === r ? "bg-white text-institucional-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          {ETIQUETAS[r]}
        </button>
      ))}
    </div>
  );
}
