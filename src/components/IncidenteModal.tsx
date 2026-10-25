"use client";

import { AlertTriangle, Info, Loader2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { descuentoEfectivo, nivelAlertaPuntos, REGLAS_INCIDENTE, validarPuntos } from "@/lib/convivencia";
import type { NuevoIncidente } from "@/lib/dataSource";
import { tienePermiso } from "@/lib/rbac";
import { TIPOS_INCIDENTE, type Rol, type TipoIncidente } from "@/lib/types";
import { MensajeError, Modal } from "./ui";

interface Props {
  abierto: boolean;
  rol: Rol;
  estudiante: { dni: string; nombreCompleto: string; puntos: number } | null;
  onCerrar: () => void;
  onGuardar: (datos: NuevoIncidente) => Promise<void>;
}

const CLASE_CAMPO =
  "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-institucional-500 focus:outline-none focus:ring-1 focus:ring-institucional-500";

export default function IncidenteModal({ abierto, rol, estudiante, onCerrar, onGuardar }: Props) {
  const [tipo, setTipo] = useState<TipoIncidente>("LEVE");
  const [puntos, setPuntos] = useState(REGLAS_INCIDENTE.LEVE.sugeridos);
  const [motivo, setMotivo] = useState("");
  const [descargo, setDescargo] = useState("");
  const [medida, setMedida] = useState("");
  const [acta, setActa] = useState("");
  const [notificado, setNotificado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) return;
    setTipo("LEVE");
    setPuntos(REGLAS_INCIDENTE.LEVE.sugeridos);
    setMotivo("");
    setDescargo("");
    setMedida("");
    setActa("");
    setNotificado(false);
    setError(null);
  }, [abierto]);

  if (!estudiante) return null;

  const regla = REGLAS_INCIDENTE[tipo];
  const apruebaDirecto = tienePermiso(rol, "APROBAR_INCIDENTE");
  const descuento = descuentoEfectivo(estudiante.puntos, puntos);
  const puntosResultantes = estudiante.puntos - descuento;
  const nivel = nivelAlertaPuntos(puntosResultantes);

  const cambiarTipo = (nuevo: TipoIncidente) => {
    setTipo(nuevo);
    setPuntos(REGLAS_INCIDENTE[nuevo].sugeridos);
  };

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const errorPuntos = validarPuntos(tipo, puntos);
    if (errorPuntos) return setError(errorPuntos);
    if (motivo.trim().length < 5) return setError("Describa el motivo del incidente (mínimo 5 caracteres).");
    if (acta && !/^https:\/\/(drive|docs)\.google\.com\//.test(acta)) {
      return setError("El acta debe ser un enlace de Google Drive (https://drive.google.com/...).");
    }
    setGuardando(true);
    setError(null);
    try {
      await onGuardar({
        dni: estudiante.dni,
        tipo,
        puntosDescontados: puntos,
        motivo: motivo.trim(),
        descargoAlumno: descargo.trim() || null,
        medidaAdoptada: medida.trim() || null,
        notificadoFamilia: notificado,
        actaDriveUrl: acta.trim() || null,
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
      titulo="Cargar incidente de convivencia"
      subtitulo={`${estudiante.nombreCompleto} · DNI ${estudiante.dni}`}
      ancho="lg"
    >
      <form onSubmit={enviar} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Tipo de falta
            <select value={tipo} onChange={(e) => cambiarTipo(e.target.value as TipoIncidente)} className={CLASE_CAMPO}>
              {TIPOS_INCIDENTE.map((t) => (
                <option key={t} value={t}>
                  {REGLAS_INCIDENTE[t].etiqueta}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Puntos a descontar
            <input
              type="number"
              min={regla.minimo}
              max={regla.maximo}
              value={puntos}
              disabled={regla.minimo === regla.maximo}
              onChange={(e) => setPuntos(Number(e.target.value))}
              className={`${CLASE_CAMPO} tabular-nums disabled:bg-slate-100`}
            />
            <span className="mt-1 block text-xs font-normal text-slate-500">
              {regla.minimo === regla.maximo ? "Sin quita de puntos" : `Rango permitido: ${regla.minimo} a ${regla.maximo}`}
            </span>
          </label>
        </div>

        <div
          className={`flex items-center justify-between rounded-lg px-4 py-3 text-sm ring-1 ring-inset ${
            nivel === "critico" ? "bg-red-50 ring-red-200" : nivel === "atencion" ? "bg-amber-50 ring-amber-200" : "bg-slate-50 ring-slate-200"
          }`}
        >
          <span className="text-slate-600">Cálculo automático de puntos</span>
          <span className="font-semibold tabular-nums text-slate-900">
            {estudiante.puntos} − {descuento} = <span className={nivel === "ok" ? "" : "text-red-700"}>{puntosResultantes}</span> pts
          </span>
        </div>
        {nivel !== "ok" && (
          <p className="flex items-start gap-2 text-xs text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            El estudiante quedará con menos de 10 puntos: corresponde intervención del equipo directivo y del SOE.
          </p>
        )}

        <label className="block text-sm font-medium text-slate-700">
          Motivo / descripción del hecho *
          <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} className={CLASE_CAMPO} required />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Descargo del estudiante
            <textarea value={descargo} onChange={(e) => setDescargo(e.target.value)} rows={2} className={CLASE_CAMPO} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Medida adoptada
            <textarea value={medida} onChange={(e) => setMedida(e.target.value)} rows={2} className={CLASE_CAMPO} />
          </label>
        </div>
        <label className="block text-sm font-medium text-slate-700">
          Enlace al acta en Drive (carpeta 02_Convivencia_y_Actas)
          <input
            type="url"
            value={acta}
            onChange={(e) => setActa(e.target.value)}
            placeholder="https://drive.google.com/file/d/..."
            className={CLASE_CAMPO}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={notificado}
            onChange={(e) => setNotificado(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-institucional-600"
          />
          La familia fue notificada
        </label>

        {!apruebaDirecto && (
          <p className="flex items-start gap-2 rounded-md bg-institucional-50 px-3 py-2 text-xs text-institucional-700">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              Como Preceptor/a, el incidente quedará <strong>pendiente de aprobación</strong> por Dirección. Los puntos se descontarán
              cuando sea aprobado.
            </span>
          </p>
        )}
        {error && <MensajeError mensaje={error} />}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={onCerrar} className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando}
            className="inline-flex items-center gap-2 rounded-md bg-institucional-600 px-4 py-2 text-sm font-medium text-white hover:bg-institucional-700 disabled:opacity-60"
          >
            {guardando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {apruebaDirecto ? "Registrar y descontar puntos" : "Enviar a Dirección"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
