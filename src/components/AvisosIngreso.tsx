"use client";

import { Bell, Check, FolderOpen, X } from "lucide-react";
import { useEffect, useState } from "react";
import { solicitar } from "@/lib/dataSource";
import { formatearFechaHora } from "@/lib/formato";

interface AvisoIngreso {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  createdAt: string;
  dni: string | null;
}

/**
 * Al ingresar, muestra los avisos sin leer del usuario (derivaciones recibidas, seguimientos por vencer).
 * Cada aviso se marca como leído al abrir el legajo o con "Marcar leído".
 */
export default function AvisosIngreso({ onVerLegajo }: { onVerLegajo: (dni: string) => void }) {
  const [avisos, setAvisos] = useState<AvisoIngreso[]>([]);
  const [oculto, setOculto] = useState(false);

  useEffect(() => {
    let activo = true;
    solicitar<{ avisos: AvisoIngreso[] }>("/api/seguimiento?avisos=1")
      .then((r) => {
        if (activo) setAvisos(r.avisos);
      })
      .catch(() => {
        /* Sin circuito habilitado o sin perfil: no se muestran avisos. */
      });
    return () => {
      activo = false;
    };
  }, []);

  const marcarLeido = (id: string) => {
    setAvisos((a) => a.filter((x) => x.id !== id));
    void solicitar("/api/seguimiento", {
      method: "POST",
      body: JSON.stringify({ accion: "LEER_AVISO", datos: { id } }),
    }).catch(() => undefined);
  };

  if (oculto || avisos.length === 0) return null;
  const derivaciones = avisos.filter((a) => a.tipo === "DERIVACION_RECIBIDA").length;

  return (
    <section aria-label="Avisos nuevos" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex flex-wrap items-center gap-2 font-bold text-amber-900">
          <Bell className="h-5 w-5" aria-hidden />
          Tiene {avisos.length} aviso{avisos.length === 1 ? "" : "s"} sin leer
          {derivaciones > 0 && (
            <span className="rounded-full bg-amber-600 px-2 py-0.5 text-xs font-semibold text-white">
              {derivaciones} derivación{derivaciones === 1 ? "" : "es"} nueva{derivaciones === 1 ? "" : "s"}
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={() => setOculto(true)}
          className="rounded-full p-1 text-amber-900 hover:bg-amber-100"
          aria-label="Ocultar avisos"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <ul className="mt-3 space-y-2">
        {avisos.map((a) => (
          <li
            key={a.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-amber-100"
          >
            <div className="min-w-0">
              <p className="font-semibold text-slate-900">{a.titulo}</p>
              <p className="text-slate-600">{a.mensaje}</p>
              <p className="text-xs text-slate-400">{formatearFechaHora(a.createdAt)}</p>
            </div>
            <div className="flex gap-2">
              {a.dni && (
                <button
                  type="button"
                  className="boton-primario"
                  onClick={() => {
                    marcarLeido(a.id);
                    onVerLegajo(a.dni!);
                  }}
                >
                  <FolderOpen className="h-4 w-4" aria-hidden /> Abrir legajo
                </button>
              )}
              <button type="button" className="boton-secundario" onClick={() => marcarLeido(a.id)}>
                <Check className="h-4 w-4" aria-hidden /> Marcar leído
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
