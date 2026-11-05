"use client";

import { KeyRound, Loader2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { solicitar } from "@/lib/dataSource";
import { MensajeError, Modal } from "./ui";

interface Props {
  abierto: boolean;
  /** Primer ingreso con contraseña temporal: no se puede cerrar sin cambiarla. */
  obligatorio?: boolean;
  onCerrar: () => void;
  onCambiada: () => void;
}

export default function CambiarPasswordModal({ abierto, obligatorio = false, onCerrar, onCambiada }: Props) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) return;
    setActual("");
    setNueva("");
    setRepetida("");
    setError(null);
  }, [abierto]);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (nueva.length < 8) return setError("La contraseña nueva debe tener al menos 8 caracteres.");
    if (nueva !== repetida) return setError("Las dos contraseñas nuevas no coinciden.");
    setGuardando(true);
    setError(null);
    try {
      await solicitar("/api/auth/password", { method: "POST", body: JSON.stringify({ actual, nueva }) });
      onCambiada();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      abierto={abierto}
      onCerrar={obligatorio ? () => undefined : onCerrar}
      titulo={obligatorio ? "Elija su contraseña" : "Cambiar contraseña"}
      subtitulo={
        obligatorio
          ? "Ingresó con una contraseña temporal. Antes de seguir, elija una propia que solo usted conozca."
          : "La contraseña nueva reemplaza a la actual en este momento."
      }
    >
      <form onSubmit={enviar} className="space-y-4">
        <label className="etiqueta-campo">
          {obligatorio ? "Contraseña temporal (la que recibió)" : "Contraseña actual"}
          <input
            type="password"
            autoComplete="current-password"
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            className="campo"
            required
          />
        </label>
        <label className="etiqueta-campo">
          Contraseña nueva
          <input
            type="password"
            autoComplete="new-password"
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            className="campo"
            minLength={8}
            required
          />
          <span className="ayuda-campo">Mínimo 8 caracteres. No use la misma que en su correo.</span>
        </label>
        <label className="etiqueta-campo">
          Repetir contraseña nueva
          <input
            type="password"
            autoComplete="new-password"
            value={repetida}
            onChange={(e) => setRepetida(e.target.value)}
            className="campo"
            required
          />
        </label>
        {error && <MensajeError mensaje={error} />}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          {!obligatorio && (
            <button type="button" onClick={onCerrar} className="boton-secundario">
              Cancelar
            </button>
          )}
          <button type="submit" disabled={guardando} className="boton-primario">
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <KeyRound className="h-4 w-4" aria-hidden />}
            Guardar contraseña
          </button>
        </div>
      </form>
    </Modal>
  );
}
