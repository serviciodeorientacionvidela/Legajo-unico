"use client";

import { Loader2, ShieldAlert } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import type { DatosConfidenciales } from "@/lib/dataSource";
import type { LegajoVisible } from "@/lib/types";
import { MensajeError, Modal } from "./ui";

interface Props {
  abierto: boolean;
  legajo: LegajoVisible | null;
  onCerrar: () => void;
  onGuardar: (dni: string, datos: DatosConfidenciales) => Promise<void>;
}

function soloFecha(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

export default function ConfidencialModal({ abierto, legajo, onCerrar, onGuardar }: Props) {
  const [tieneCud, setTieneCud] = useState(false);
  const [vencimiento, setVencimiento] = useState("");
  const [cudUrl, setCudUrl] = useState("");
  const [requierePpi, setRequierePpi] = useState(false);
  const [diagnostico, setDiagnostico] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto || !legajo) return;
    const c = legajo.confidencial;
    setTieneCud(legajo.estudiante.tieneCud);
    setRequierePpi(legajo.estudiante.requierePpi);
    setVencimiento(soloFecha(c?.vencimientoCud ?? null));
    setCudUrl(c?.cudUrl ?? "");
    setDiagnostico(c?.diagnosticoReservado ?? "");
    setObservaciones(c?.observacionesConfidenciales ?? "");
    setError(null);
  }, [abierto, legajo]);

  if (!legajo) return null;
  const e = legajo.estudiante;

  const enviar = async (ev: FormEvent) => {
    ev.preventDefault();
    if (tieneCud && cudUrl && !/^https:\/\/(drive|docs)\.google\.com\//.test(cudUrl)) {
      return setError("El certificado debe ser un enlace de Google Drive (https://drive.google.com/...).");
    }
    setGuardando(true);
    setError(null);
    try {
      await onGuardar(e.dni, {
        tieneCud,
        vencimientoCud: tieneCud ? vencimiento || null : null,
        cudUrl: tieneCud ? cudUrl.trim() || null : null,
        requierePpi,
        diagnosticoReservado: diagnostico.trim() || null,
        observacionesConfidenciales: observaciones.trim() || null,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  const casilla = "h-4 w-4 rounded border-slate-300 text-institucional-600 focus:ring-institucional-500";

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Inclusión y salud (reservado)"
      subtitulo={`${e.apellidos}, ${e.nombres} · DNI ${e.dni}`}
      ancho="lg"
    >
      <form onSubmit={enviar} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3">
            <input type="checkbox" checked={tieneCud} onChange={(ev) => setTieneCud(ev.target.checked)} className={`mt-0.5 ${casilla}`} />
            <span>
              <span className="block text-sm font-semibold text-slate-800">Posee CUD</span>
              <span className="block text-xs text-slate-500">Certificado Único de Discapacidad. Los docentes solo ven «Sí / No».</span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3">
            <input type="checkbox" checked={requierePpi} onChange={(ev) => setRequierePpi(ev.target.checked)} className={`mt-0.5 ${casilla}`} />
            <span>
              <span className="block text-sm font-semibold text-slate-800">Requiere PPI</span>
              <span className="block text-xs text-slate-500">Proyecto Pedagógico Individual / configuraciones de apoyo.</span>
            </span>
          </label>
        </div>

        {tieneCud && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="etiqueta-campo">
              Vencimiento del CUD
              <input type="date" value={vencimiento} onChange={(ev) => setVencimiento(ev.target.value)} className="campo" />
            </label>
            <label className="etiqueta-campo">
              Certificado (PDF en Drive)
              <input
                type="url"
                value={cudUrl}
                onChange={(ev) => setCudUrl(ev.target.value)}
                placeholder="https://drive.google.com/file/d/..."
                className="campo"
              />
            </label>
          </div>
        )}

        <label className="etiqueta-campo">
          Diagnóstico reservado
          <textarea value={diagnostico} onChange={(ev) => setDiagnostico(ev.target.value)} rows={3} className="campo" />
        </label>
        <label className="etiqueta-campo">
          Observaciones confidenciales
          <textarea
            value={observaciones}
            onChange={(ev) => setObservaciones(ev.target.value)}
            rows={3}
            placeholder="Indicaciones de la familia, acompañantes terapéuticos, cuidados especiales…"
            className="campo"
          />
        </label>

        <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-800 ring-1 ring-inset ring-red-200">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Datos de salud de un menor (Ley 25.326, art. 7: datos sensibles). Solo los ve el nivel Directivo / SOE y cada
          modificación queda registrada en auditoría.
        </p>
        {error && <MensajeError mensaje={error} />}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={onCerrar} className="boton-secundario">
            Cancelar
          </button>
          <button type="submit" disabled={guardando} className="boton-primario">
            {guardando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Guardar cambios
          </button>
        </div>
      </form>
    </Modal>
  );
}
