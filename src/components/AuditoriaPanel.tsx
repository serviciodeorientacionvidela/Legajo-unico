"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { formatearFechaHora } from "@/lib/formato";
import { ROL_ETIQUETA, type AccionAuditoria, type RegistroAuditoriaVisible } from "@/lib/types";
import { Insignia, MensajeError, Modal } from "./ui";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  cargar: () => Promise<RegistroAuditoriaVisible[]>;
}

const ACCIONES: Record<AccionAuditoria, { etiqueta: string; tono: "azul" | "violeta" | "ambar" | "verde" }> = {
  VER_LEGAJO: { etiqueta: "Consultó legajo", tono: "azul" },
  VER_CUD_SOE: { etiqueta: "Vio datos CUD / SOE", tono: "violeta" },
  CARGAR_ACTA: { etiqueta: "Convivencia / acta", tono: "ambar" },
  IMPORTAR_GEI: { etiqueta: "Importó GEI", tono: "verde" },
};

export default function AuditoriaPanel({ abierto, onCerrar, cargar }: Props) {
  const [registros, setRegistros] = useState<RegistroAuditoriaVisible[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actualizar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setRegistros(await cargar());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCargando(false);
    }
  }, [cargar]);

  useEffect(() => {
    if (abierto) void actualizar();
  }, [abierto, actualizar]);

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Logs de auditoría"
      subtitulo="Registro de accesos a legajos y acciones sensibles (Ley 25.326)"
      ancho="xl"
    >
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={() => void actualizar()}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
        >
          {cargando ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden />}
          Actualizar
        </button>
      </div>
      {error && <MensajeError mensaje={error} />}
      {!error && registros.length === 0 && !cargando && (
        <p className="py-8 text-center text-sm text-slate-500">Todavía no hay registros. Abra un legajo para generar el primero.</p>
      )}
      {registros.length > 0 && (
        <div className="max-h-[60vh] overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-white text-left text-xs text-slate-500">
              <tr>
                <th className="py-2 pr-3 font-medium">Fecha y hora</th>
                <th className="py-2 pr-3 font-medium">Usuario</th>
                <th className="py-2 pr-3 font-medium">Acción</th>
                <th className="py-2 pr-3 font-medium">DNI</th>
                <th className="py-2 font-medium">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {registros.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap py-2 pr-3 tabular-nums text-slate-600">{formatearFechaHora(r.createdAt)}</td>
                  <td className="py-2 pr-3">
                    <div className="text-slate-900">{r.usuarioNombre}</div>
                    <div className="text-xs text-slate-500">{ROL_ETIQUETA[r.usuarioRol]}</div>
                  </td>
                  <td className="py-2 pr-3">
                    <Insignia tono={ACCIONES[r.accion].tono}>{ACCIONES[r.accion].etiqueta}</Insignia>
                  </td>
                  <td className="py-2 pr-3 tabular-nums text-slate-700">{r.estudianteDni ?? "—"}</td>
                  <td className="py-2 text-xs text-slate-500">{r.ipAddress ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
