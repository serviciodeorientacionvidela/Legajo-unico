"use client";

import { Camera, KeyRound, Loader2, Pencil, RefreshCw, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { solicitar } from "@/lib/dataSource";
import { formatearFechaHora } from "@/lib/formato";
import {
  CARGO_ETIQUETA,
  CARGO_ROL,
  CARGOS,
  ROL_ETIQUETA,
  etiquetaCargo,
  type Cargo,
  type UsuarioAdministrado,
} from "@/lib/types";
import Avatar, { reducirFoto, urlFotoUsuario } from "./Avatar";
import { Insignia, MensajeError, Modal } from "./ui";

interface Props {
  usuarioActualId: string;
  onAviso: (texto: string) => void;
  onError: (error: unknown) => boolean;
  /** Se llama cuando cambia la cuenta propia (p. ej. su foto) para refrescar el menú. */
  onCambioPropio: () => void;
}

export default function UsuariosPanel({ usuarioActualId, onAviso, onError, onCambioPropio }: Props) {
  const [usuarios, setUsuarios] = useState<UsuarioAdministrado[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [edicion, setEdicion] = useState<UsuarioAdministrado | "nuevo" | null>(null);
  const [claveDe, setClaveDe] = useState<UsuarioAdministrado | null>(null);

  const actualizar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const r = await solicitar<{ usuarios: UsuarioAdministrado[] }>("/api/usuarios");
      setUsuarios(r.usuarios);
    } catch (err) {
      if (!onError(err)) setError((err as Error).message);
    } finally {
      setCargando(false);
    }
  }, [onError]);

  useEffect(() => {
    void actualizar();
  }, [actualizar]);

  const alGuardar = (u: UsuarioAdministrado, nuevo: boolean) => {
    setEdicion(null);
    onAviso(nuevo ? `Usuario ${u.nombre} creado.` : `Usuario ${u.nombre} actualizado.`);
    if (u.id === usuarioActualId) onCambioPropio();
    void actualizar();
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          {usuarios.length} usuario{usuarios.length === 1 ? "" : "s"} · Cada alta y modificación queda registrada en auditoría.
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={() => void actualizar()} className="boton-secundario px-3 py-1.5 text-xs">
            {cargando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
            Actualizar
          </button>
          <button type="button" onClick={() => setEdicion("nuevo")} className="boton-primario px-4 py-1.5 text-xs">
            <UserPlus className="h-4 w-4" aria-hidden /> Nuevo usuario
          </button>
        </div>
      </div>

      {error && <MensajeError mensaje={error} />}

      <div className="tarjeta overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-100 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Usuario</th>
              <th className="px-4 py-3 font-medium">DNI</th>
              <th className="px-4 py-3 font-medium">Cargo</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Alta</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {usuarios.map((u) => (
              <tr key={u.id} className={u.activo ? "" : "opacity-60"}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar nombre={u.nombre} src={urlFotoUsuario(u.id, u.fotoVersion)} tamanio="sm" />
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 font-semibold text-slate-900">
                        {u.nombre}
                        {u.esAdministrador && (
                          <ShieldCheck className="h-4 w-4 text-institucional-600" aria-label="Administrador" />
                        )}
                      </p>
                      <p className="truncate text-xs text-slate-500">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 tabular-nums text-slate-700">{u.dni ?? "—"}</td>
                <td className="px-4 py-3 text-slate-700">
                  {etiquetaCargo(u.cargo, u.rol)}
                  {u.cargo && <span className="block text-xs text-slate-500">{ROL_ETIQUETA[u.rol]}</span>}
                </td>
                <td className="px-4 py-3">
                  {u.activo ? <Insignia tono="verde">Activo</Insignia> : <Insignia tono="neutro">Inactivo</Insignia>}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{formatearFechaHora(u.createdAt)}</td>
                <td className="space-x-1 whitespace-nowrap px-4 py-3 text-right">
                  {u.id !== usuarioActualId && (
                    <button
                      type="button"
                      onClick={() => setClaveDe(u)}
                      className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200 hover:bg-amber-50"
                    >
                      <KeyRound className="h-3.5 w-3.5" aria-hidden /> Contraseña
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setEdicion(u)}
                    className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-institucional-700 ring-1 ring-inset ring-institucional-100 hover:bg-institucional-50"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden /> Editar
                  </button>
                </td>
              </tr>
            ))}
            {usuarios.length === 0 && !cargando && !error && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No hay usuarios cargados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ClaveModal usuario={claveDe} onCerrar={() => setClaveDe(null)} onError={onError} />
      <UsuarioModal
        edicion={edicion}
        esPropio={edicion !== null && edicion !== "nuevo" && edicion.id === usuarioActualId}
        onCerrar={() => setEdicion(null)}
        onGuardado={alGuardar}
        onError={onError}
      />
    </section>
  );
}

function UsuarioModal({
  edicion,
  esPropio,
  onCerrar,
  onGuardado,
  onError,
}: {
  edicion: UsuarioAdministrado | "nuevo" | null;
  esPropio: boolean;
  onCerrar: () => void;
  onGuardado: (u: UsuarioAdministrado, nuevo: boolean) => void;
  onError: (error: unknown) => boolean;
}) {
  const nuevo = edicion === "nuevo";
  const existente = edicion !== null && edicion !== "nuevo" ? edicion : null;

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [dni, setDni] = useState("");
  const [cargo, setCargo] = useState<Cargo | "">("DOCENTE");
  const [password, setPassword] = useState("");
  const [activo, setActivo] = useState(true);
  const [esAdministrador, setEsAdministrador] = useState(false);
  // undefined = sin cambios; null = quitar la foto; string = foto nueva (data URL)
  const [foto, setFoto] = useState<string | null | undefined>(undefined);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputFoto = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (edicion === null) return;
    setNombre(existente?.nombre ?? "");
    setEmail(existente?.email ?? "");
    setDni(existente?.dni ?? "");
    // Cuentas anteriores a los cargos: se muestran sin cargo y conservan su rol hasta que se elija uno.
    setCargo(existente ? (existente.cargo ?? "") : "DOCENTE");
    setPassword("");
    setActivo(existente?.activo ?? true);
    setEsAdministrador(existente?.esAdministrador ?? false);
    setFoto(undefined);
    setError(null);
  }, [edicion, existente]);

  const fotoVisible =
    foto === undefined ? (existente ? urlFotoUsuario(existente.id, existente.fotoVersion) : null) : foto;

  const elegirFoto = async (archivo: File | undefined) => {
    if (!archivo) return;
    try {
      setFoto(await reducirFoto(archivo));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (nombre.trim().length < 3) return setError("Ingrese el nombre completo.");
    if (dni && !/^\d{7,8}$/.test(dni.replace(/\./g, ""))) return setError("El DNI debe tener 7 u 8 dígitos.");
    if (nuevo && password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    if (!nuevo && password && password.length < 8) return setError("La contraseña nueva debe tener al menos 8 caracteres.");

    const cuerpo: Record<string, unknown> = {
      nombre: nombre.trim(),
      email: email.trim(),
      dni: dni.trim() ? dni.trim() : null,
      ...(cargo ? { rol: CARGO_ROL[cargo], cargo } : {}),
      esAdministrador,
    };
    if (password) cuerpo.password = password;
    if (!nuevo) cuerpo.activo = activo;
    if (foto !== undefined) cuerpo.foto = foto;

    setGuardando(true);
    setError(null);
    try {
      const r = await solicitar<{ usuario: UsuarioAdministrado }>(
        existente ? `/api/usuarios/${encodeURIComponent(existente.id)}` : "/api/usuarios",
        { method: existente ? "PATCH" : "POST", body: JSON.stringify(cuerpo) },
      );
      onGuardado(r.usuario, nuevo);
    } catch (err) {
      if (!onError(err)) setError((err as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      abierto={edicion !== null}
      onCerrar={onCerrar}
      titulo={nuevo ? "Nuevo usuario" : "Editar usuario"}
      subtitulo={existente ? existente.email : "Alta de una cuenta de acceso al LUE"}
      ancho="lg"
    >
      <form onSubmit={(e) => void enviar(e)} className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar nombre={nombre || "?"} src={fotoVisible} tamanio="lg" />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => inputFoto.current?.click()} className="boton-secundario px-3 py-1.5 text-xs">
              <Camera className="h-4 w-4" aria-hidden /> {fotoVisible ? "Cambiar foto" : "Subir foto"}
            </button>
            {fotoVisible && (
              <button type="button" onClick={() => setFoto(null)} className="boton-secundario px-3 py-1.5 text-xs">
                <Trash2 className="h-4 w-4" aria-hidden /> Quitar
              </button>
            )}
            <input
              ref={inputFoto}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                void elegirFoto(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <p className="ayuda-campo w-full">Se recorta en cuadrado y se reduce a 256 px.</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="etiqueta-campo sm:col-span-2">
            Apellido y nombre
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="campo" placeholder="APELLIDO, Nombre" required />
          </label>
          <label className="etiqueta-campo">
            DNI
            <input value={dni} onChange={(e) => setDni(e.target.value)} className="campo" inputMode="numeric" placeholder="Opcional" />
          </label>
          <label className="etiqueta-campo">
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="campo" required />
          </label>
          <label className="etiqueta-campo">
            Cargo
            <select value={cargo} onChange={(e) => setCargo(e.target.value as Cargo | "")} className="campo">
              {cargo === "" && <option value="">Sin cargo asignado</option>}
              {CARGOS.map((c) => (
                <option key={c} value={c}>
                  {CARGO_ETIQUETA[c]}
                </option>
              ))}
            </select>
            <span className="ayuda-campo">
              Acceso: {cargo ? ROL_ETIQUETA[CARGO_ROL[cargo]] : existente ? ROL_ETIQUETA[existente.rol] : "—"}
            </span>
          </label>
          <label className="etiqueta-campo">
            <span className="flex items-center gap-1">
              <KeyRound className="h-3.5 w-3.5" aria-hidden /> {nuevo ? "Contraseña" : "Nueva contraseña"}
            </span>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="campo"
              autoComplete="new-password"
              placeholder={nuevo ? "Mínimo 8 caracteres" : "Dejar vacío para no cambiarla"}
              required={nuevo}
            />
          </label>
        </div>

        <div className="space-y-2 rounded-2xl bg-slate-50 px-4 py-3">
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={esAdministrador}
              disabled={esPropio}
              onChange={(e) => setEsAdministrador(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <strong>Administrador</strong> · puede crear y editar usuarios
            </span>
          </label>
          {!nuevo && (
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={activo} disabled={esPropio} onChange={(e) => setActivo(e.target.checked)} className="mt-0.5" />
              <span>
                <strong>Cuenta activa</strong> · si se desactiva, el usuario no puede ingresar
              </span>
            </label>
          )}
        </div>

        {error && <MensajeError mensaje={error} />}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCerrar} className="boton-secundario">
            Cancelar
          </button>
          <button type="submit" disabled={guardando} className="boton-primario">
            {guardando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {nuevo ? "Crear usuario" : "Guardar cambios"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Cuenta técnica: ver la contraseña temporal (si la persona todavía no eligió la suya) o generar una nueva. */
function ClaveModal({
  usuario,
  onCerrar,
  onError,
}: {
  usuario: UsuarioAdministrado | null;
  onCerrar: () => void;
  onError: (error: unknown) => boolean;
}) {
  const [estado, setEstado] = useState<{ temporal: string | null; pendienteDeCambio: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!usuario) return;
    setEstado(null);
    setError(null);
    setCopiado(false);
    solicitar<{ temporal: string | null; pendienteDeCambio: boolean }>(`/api/usuarios/${encodeURIComponent(usuario.id)}/clave`)
      .then(setEstado)
      .catch((e) => {
        if (!onError(e)) setError((e as Error).message);
      });
  }, [usuario, onError]);

  const generar = async () => {
    if (!usuario) return;
    setOcupado(true);
    setError(null);
    setCopiado(false);
    try {
      setEstado(
        await solicitar<{ temporal: string; pendienteDeCambio: boolean }>(
          `/api/usuarios/${encodeURIComponent(usuario.id)}/clave`,
          { method: "POST", body: JSON.stringify({}) },
        ),
      );
    } catch (e) {
      if (!onError(e)) setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  const copiar = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  };

  return (
    <Modal abierto={usuario !== null} onCerrar={onCerrar} titulo="Contraseña" subtitulo={usuario ? `${usuario.nombre} · ${usuario.email}` : ""}>
      <div className="space-y-4">
        {!estado && !error && <Loader2 className="mx-auto h-5 w-5 animate-spin text-institucional-600" aria-label="Cargando" />}
        {estado?.temporal && (
          <div className="rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">Contraseña temporal</p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <code className="select-all rounded-lg bg-white px-3 py-1.5 font-mono text-lg text-slate-900 ring-1 ring-amber-200">{estado.temporal}</code>
              <button type="button" className="boton-secundario" onClick={() => void copiar(estado.temporal!)}>
                {copiado ? "Copiada" : "Copiar"}
              </button>
            </div>
            <p className="mt-2 text-xs text-amber-900">
              Pásela por un canal privado. Al ingresar, el sistema le va a pedir que elija una propia y esta deja de verse.
            </p>
          </div>
        )}
        {estado && !estado.temporal && (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700 ring-1 ring-slate-200">
            Esta persona ya eligió su propia contraseña. Por seguridad no se guarda legible y no se puede ver. Si la olvidó,
            genere una temporal nueva.
          </p>
        )}
        {error && <MensajeError mensaje={error} />}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={onCerrar} className="boton-secundario">
            Cerrar
          </button>
          <button type="button" disabled={ocupado} onClick={() => void generar()} className="boton-primario">
            {ocupado ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
            Generar contraseña nueva
          </button>
        </div>
      </div>
    </Modal>
  );
}
