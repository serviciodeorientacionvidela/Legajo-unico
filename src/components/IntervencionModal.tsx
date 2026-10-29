"use client";

import { Info, Loader2, Lock, Users } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import type { NuevaIntervencion } from "@/lib/dataSource";
import { TIPO_INTERVENCION_ETIQUETA, TIPOS_INTERVENCION, type TipoIntervencion } from "@/lib/types";
import { MensajeError, Modal } from "./ui";

interface Props {
  abierto: boolean;
  estudiante: { dni: string; nombreCompleto: string } | null;
  onCerrar: () => void;
  onGuardar: (datos: NuevaIntervencion) => Promise<void>;
}

/** Fecha local de hoy en formato AAAA-MM-DD (para <input type="date">). */
export function hoyIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function IntervencionModal({ abierto, estudiante, onCerrar, onGuardar }: Props) {
  const [fecha, setFecha] = useState(hoyIso());
  const [tipo, setTipo] = useState<TipoIntervencion>("ENTREVISTA_ESTUDIANTE");
  const [participantes, setParticipantes] = useState("");
  const [motivo, setMotivo] = useState("");
  const [informe, setInforme] = useState("");
  const [acuerdos, setAcuerdos] = useState("");
  const [archivo, setArchivo] = useState("");
  const [seguimiento, setSeguimiento] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) return;
    setFecha(hoyIso());
    setTipo("ENTREVISTA_ESTUDIANTE");
    setParticipantes("");
    setMotivo("");
    setInforme("");
    setAcuerdos("");
    setArchivo("");
    setSeguimiento("");
    setError(null);
  }, [abierto]);

  if (!estudiante) return null;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (motivo.trim().length < 5) return setError("Indique el motivo de la intervención (mínimo 5 caracteres).");
    if (informe.trim().length < 10) return setError("Redacte el informe de la intervención (mínimo 10 caracteres).");
    if (fecha > hoyIso()) return setError("La fecha de la intervención no puede ser futura.");
    if (seguimiento && seguimiento < fecha) return setError("El próximo seguimiento debe ser posterior a la intervención.");
    if (archivo && !/^https:\/\/(drive|docs)\.google\.com\//.test(archivo)) {
      return setError("El informe adjunto debe ser un enlace de Google Drive (https://drive.google.com/...).");
    }
    setGuardando(true);
    setError(null);
    try {
      await onGuardar({
        dni: estudiante.dni,
        fecha,
        tipo,
        participantes: participantes.trim() || null,
        motivo: motivo.trim(),
        informeConfidencial: informe.trim(),
        acuerdosDocentes: acuerdos.trim(),
        archivoDriveUrl: archivo.trim() || null,
        proximoSeguimiento: seguimiento || null,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Registrar intervención del SOE"
      subtitulo={`${estudiante.nombreCompleto} · DNI ${estudiante.dni}`}
      ancho="lg"
    >
      <form onSubmit={enviar} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="etiqueta-campo">
            Fecha
            <input type="date" value={fecha} max={hoyIso()} onChange={(e) => setFecha(e.target.value)} className="campo" required />
          </label>
          <label className="etiqueta-campo sm:col-span-2">
            Tipo de intervención
            <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoIntervencion)} className="campo">
              {TIPOS_INTERVENCION.map((t) => (
                <option key={t} value={t}>
                  {TIPO_INTERVENCION_ETIQUETA[t]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="etiqueta-campo">
            Motivo *
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej.: Seguimiento por inasistencias reiteradas"
              className="campo"
              required
            />
          </label>
          <label className="etiqueta-campo">
            Participantes
            <input
              value={participantes}
              onChange={(e) => setParticipantes(e.target.value)}
              placeholder="Ej.: Estudiante, madre, preceptora"
              className="campo"
            />
          </label>
        </div>

        <label className="etiqueta-campo">
          <span className="flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-red-700" aria-hidden /> Informe confidencial *
          </span>
          <textarea
            value={informe}
            onChange={(e) => setInforme(e.target.value)}
            rows={6}
            placeholder="Situación observada, intervenciones realizadas, evaluación profesional…"
            className="campo"
            required
          />
          <span className="ayuda-campo">Solo lo ve el nivel Directivo / SOE. Queda registrado en auditoría.</span>
        </label>

        <label className="etiqueta-campo">
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-institucional-600" aria-hidden /> Acuerdos pedagógicos para docentes
          </span>
          <textarea
            value={acuerdos}
            onChange={(e) => setAcuerdos(e.target.value)}
            rows={3}
            placeholder="Adecuaciones y estrategias para el aula, sin datos clínicos ni diagnósticos."
            className="campo"
          />
          <span className="ayuda-campo">Visibles para todo el equipo (docentes y preceptores). No incluya información de salud.</span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="etiqueta-campo">
            Informe completo en Drive
            <input
              type="url"
              value={archivo}
              onChange={(e) => setArchivo(e.target.value)}
              placeholder="https://drive.google.com/file/d/..."
              className="campo"
            />
            <span className="ayuda-campo">Carpeta 03_Confidencial_SOE del alumno.</span>
          </label>
          <label className="etiqueta-campo">
            Próximo seguimiento
            <input type="date" value={seguimiento} min={fecha} onChange={(e) => setSeguimiento(e.target.value)} className="campo" />
            <span className="ayuda-campo">Aparece en la agenda del SOE (Informes → SOE).</span>
          </label>
        </div>

        <p className="flex items-start gap-2 rounded-xl bg-institucional-50 px-3 py-2 text-xs text-institucional-800">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Las intervenciones no se modifican una vez registradas: para corregir o ampliar, registre una nueva intervención.
        </p>
        {error && <MensajeError mensaje={error} />}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={onCerrar} className="boton-secundario">
            Cancelar
          </button>
          <button type="submit" disabled={guardando} className="boton-primario">
            {guardando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Registrar intervención
          </button>
        </div>
      </form>
    </Modal>
  );
}
