"use client";

import { Clock } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

/** 10 minutos de inactividad de mouse / teclado / táctil. */
export const TIEMPO_INACTIVIDAD_MS = 600_000;
const AVISO_PREVIO_MS = 60_000;
const INTERVALO_LATIDO_MS = 4 * 60_000;

const EVENTOS_ACTIVIDAD = ["mousemove", "mousedown", "keydown", "wheel", "scroll", "touchstart"] as const;

interface OpcionesInactividad {
  timeoutMs?: number;
  onTimeout: () => void;
  /** Se invoca como máximo cada 4 min mientras haya actividad (renueva la sesión del servidor). */
  onLatido?: () => void;
  activo?: boolean;
}

/**
 * Hook de seguridad: devuelve los milisegundos restantes antes del cierre por inactividad.
 * La actividad se registra en una ref (sin re-render por cada movimiento del mouse).
 */
export function useInactividad({
  timeoutMs = TIEMPO_INACTIVIDAD_MS,
  onTimeout,
  onLatido,
  activo = true,
}: OpcionesInactividad): { restanteMs: number; reiniciar: () => void } {
  const ultimaActividad = useRef(Date.now());
  const ultimoLatido = useRef(Date.now());
  const vencido = useRef(false);
  const [restanteMs, setRestanteMs] = useState(timeoutMs);

  const callbacks = useRef({ onTimeout, onLatido });
  useEffect(() => {
    callbacks.current = { onTimeout, onLatido };
  }, [onTimeout, onLatido]);

  const reiniciar = useCallback(() => {
    ultimaActividad.current = Date.now();
    vencido.current = false;
    setRestanteMs(timeoutMs);
  }, [timeoutMs]);

  useEffect(() => {
    if (!activo) return;
    reiniciar();

    const registrarActividad = () => {
      if (!vencido.current) ultimaActividad.current = Date.now();
    };
    EVENTOS_ACTIVIDAD.forEach((evento) => window.addEventListener(evento, registrarActividad, { passive: true }));

    const intervalo = window.setInterval(() => {
      const ahora = Date.now();
      const restante = timeoutMs - (ahora - ultimaActividad.current);
      setRestanteMs(Math.max(0, restante));

      if (restante <= 0 && !vencido.current) {
        vencido.current = true;
        callbacks.current.onTimeout();
        return;
      }
      const huboActividadReciente = ultimaActividad.current > ultimoLatido.current;
      if (callbacks.current.onLatido && huboActividadReciente && ahora - ultimoLatido.current >= INTERVALO_LATIDO_MS) {
        ultimoLatido.current = ahora;
        callbacks.current.onLatido();
      }
    }, 1000);

    return () => {
      EVENTOS_ACTIVIDAD.forEach((evento) => window.removeEventListener(evento, registrarActividad));
      window.clearInterval(intervalo);
    };
  }, [activo, timeoutMs, reiniciar]);

  return { restanteMs, reiniciar };
}

interface SessionTimeoutGuardProps extends OpcionesInactividad {
  /** Mostrar el contador restante en pantalla (útil en la demo). */
  mostrarContador?: boolean;
}

/**
 * Cierra la sesión automáticamente tras 10 minutos de inactividad.
 * Muestra un aviso 60 segundos antes; cualquier interacción con el botón lo cancela.
 */
export default function SessionTimeoutGuard({ mostrarContador = false, ...opciones }: SessionTimeoutGuardProps) {
  const { restanteMs, reiniciar } = useInactividad(opciones);
  const segundos = Math.ceil(restanteMs / 1000);
  const activo = opciones.activo !== false;
  const enAviso = activo && restanteMs > 0 && restanteMs <= AVISO_PREVIO_MS;

  return (
    <>
      {mostrarContador && activo && (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs tabular-nums text-slate-600"
          title="Tiempo restante antes del cierre automático por inactividad"
        >
          <Clock className="h-3 w-3" aria-hidden />
          {String(Math.floor(segundos / 60)).padStart(2, "0")}:{String(segundos % 60).padStart(2, "0")}
        </span>
      )}
      {enAviso && (
        <div role="alertdialog" aria-live="assertive" className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-xl">
            <Clock className="mx-auto h-10 w-10 text-amber-500" aria-hidden />
            <h2 className="mt-3 text-lg font-semibold text-slate-900">Sesión por expirar</h2>
            <p className="mt-2 text-sm text-slate-600">
              Por seguridad de los datos de los estudiantes, la sesión se cerrará en{" "}
              <strong className="tabular-nums">{segundos} s</strong> por inactividad.
            </p>
            <button
              type="button"
              onClick={reiniciar}
              className="mt-5 w-full rounded-lg bg-institucional-600 px-4 py-2 text-sm font-medium text-white hover:bg-institucional-700"
            >
              Continuar trabajando
            </button>
          </div>
        </div>
      )}
    </>
  );
}
