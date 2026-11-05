"use client";

import { ArrowLeft, Loader2, MessageSquarePlus, Send, UserPlus, Users } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { solicitar } from "@/lib/dataSource";
import { formatearFechaHora } from "@/lib/formato";
import { etiquetaCargo, type Rol } from "@/lib/types";
import { MensajeError } from "./ui";

interface Persona {
  id: string;
  nombre: string;
  cargo: string | null;
}
interface Detalle {
  nombre: string | null;
  esGrupo: boolean;
  participantes: { usuario: Persona }[];
}
interface ConversacionResumen extends Detalle {
  id: string;
  mensajes: { texto: string; createdAt: string; autor: { nombre: string } }[];
  noLeidos: number;
}
interface MensajeVisible {
  id: string;
  texto: string;
  createdAt: string;
  autor: { id: string; nombre: string };
}

const titulo = (c: Detalle, yo: string) =>
  c.esGrupo
    ? (c.nombre ?? "Grupo")
    : (c.participantes.find((p) => p.usuario.id !== yo)?.usuario.nombre ?? "Conversación");

/** Mensajería interna: chats directos y grupos entre usuarios del sistema. */
export default function MensajesPanel({ onCambioNoLeidos }: { onCambioNoLeidos?: () => void }) {
  const [yo, setYo] = useState("");
  const [conversaciones, setConversaciones] = useState<ConversacionResumen[] | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<MensajeVisible[]>([]);
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [texto, setTexto] = useState("");
  const [nueva, setNueva] = useState<null | "chat" | "agregar">(null);
  const [personas, setPersonas] = useState<(Persona & { rol: Rol })[]>([]);
  const [elegidas, setElegidas] = useState<string[]>([]);
  const [nombreGrupo, setNombreGrupo] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState<string | null>(null);
  const finRef = useRef<HTMLDivElement>(null);

  const cargarLista = useCallback(async () => {
    try {
      const r = await solicitar<{ conversaciones: ConversacionResumen[]; yo: string }>("/api/mensajes");
      setConversaciones(r.conversaciones);
      setYo(r.yo);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const cargarChat = useCallback(
    async (id: string) => {
      try {
        const r = await solicitar<{ conversacion: Detalle; mensajes: MensajeVisible[]; yo: string }>(
          `/api/mensajes?conversacion=${encodeURIComponent(id)}`,
        );
        setDetalle(r.conversacion);
        setMensajes(r.mensajes);
        setYo(r.yo);
        onCambioNoLeidos?.();
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [onCambioNoLeidos],
  );

  useEffect(() => {
    void cargarLista();
    const t = window.setInterval(() => void cargarLista(), 20_000);
    return () => window.clearInterval(t);
  }, [cargarLista]);

  // Mientras un chat está abierto, se actualiza cada 8 segundos.
  useEffect(() => {
    if (!abierta) return;
    void cargarChat(abierta);
    const t = window.setInterval(() => void cargarChat(abierta), 8_000);
    return () => window.clearInterval(t);
  }, [abierta, cargarChat]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ block: "end" });
  }, [mensajes.length]);

  const abrirSelector = async (modo: "chat" | "agregar") => {
    setNueva(modo);
    setElegidas([]);
    setNombreGrupo("");
    setBusqueda("");
    if (!personas.length) {
      try {
        setPersonas((await solicitar<{ usuarios: (Persona & { rol: Rol })[] }>("/api/mensajes?usuarios=1")).usuarios);
      } catch (e) {
        setError((e as Error).message);
      }
    }
  };

  const crear = async () => {
    setError(null);
    try {
      if (nueva === "agregar" && abierta) {
        await solicitar("/api/mensajes", {
          method: "POST",
          body: JSON.stringify({ accion: "AGREGAR", conversacionId: abierta, participantes: elegidas }),
        });
        await cargarChat(abierta);
      } else {
        const r = await solicitar<{ conversacionId: string }>("/api/mensajes", {
          method: "POST",
          body: JSON.stringify({
            accion: "CREAR",
            participantes: elegidas,
            ...(elegidas.length > 1 ? { nombre: nombreGrupo.trim() } : {}),
          }),
        });
        setAbierta(r.conversacionId);
      }
      setNueva(null);
      await cargarLista();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!abierta || !texto.trim()) return;
    const contenido = texto.trim();
    setTexto("");
    try {
      await solicitar("/api/mensajes", {
        method: "POST",
        body: JSON.stringify({ accion: "ENVIAR", conversacionId: abierta, texto: contenido }),
      });
      await cargarChat(abierta);
      void cargarLista();
    } catch (err) {
      setTexto(contenido);
      setError((err as Error).message);
    }
  };

  const visibles = personas.filter(
    (p) =>
      !(nueva === "agregar" && detalle?.participantes.some((x) => x.usuario.id === p.id)) &&
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()),
  );

  return (
    <section className="grid min-h-[70vh] gap-4 lg:grid-cols-[320px_1fr]">
      {/* Bandeja */}
      <div className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 ${abierta || nueva ? "hidden lg:block" : ""}`}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-slate-900">Mensajes</h2>
          <button type="button" className="boton-primario" onClick={() => void abrirSelector("chat")}>
            <MessageSquarePlus className="h-4 w-4" aria-hidden /> Nuevo
          </button>
        </div>
        {!conversaciones && <Loader2 className="mx-auto mt-6 h-5 w-5 animate-spin" aria-label="Cargando" />}
        {conversaciones?.length === 0 && (
          <p className="mt-6 text-sm text-slate-500">
            Todavía no tiene conversaciones. Use <strong>Nuevo</strong> para escribirle a alguien o armar un grupo.
          </p>
        )}
        <ul className="mt-3 divide-y divide-slate-100">
          {conversaciones?.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  setAbierta(c.id);
                  setNueva(null);
                }}
                className={`flex w-full items-start gap-3 rounded-xl px-2 py-3 text-left hover:bg-slate-50 ${abierta === c.id ? "bg-institucional-50" : ""}`}
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-institucional-100 font-bold text-institucional-800">
                  {c.esGrupo ? <Users className="h-4 w-4" aria-hidden /> : titulo(c, yo).slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold text-slate-900">{titulo(c, yo)}</span>
                    {c.noLeidos > 0 && (
                      <span className="rounded-full bg-amber-500 px-1.5 text-xs font-bold text-white">{c.noLeidos}</span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {c.mensajes[0] ? `${c.mensajes[0].autor.nombre}: ${c.mensajes[0].texto}` : "Sin mensajes"}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Chat / selector */}
      <div className={`flex flex-col rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 ${!abierta && !nueva ? "hidden lg:flex" : ""}`}>
        {nueva ? (
          <div className="space-y-3 p-4">
            <h3 className="font-bold text-slate-900">{nueva === "agregar" ? "Sumar personas al grupo" : "Nueva conversación"}</h3>
            <p className="text-xs text-slate-500">Elija una persona para un chat directo, o varias para armar un grupo.</p>
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre" className="campo" />
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {visibles.map((p) => (
                <li key={p.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={elegidas.includes(p.id)}
                      onChange={(e) => setElegidas((x) => (e.target.checked ? [...x, p.id] : x.filter((id) => id !== p.id)))}
                    />
                    <span className="font-medium">{p.nombre}</span>
                    <span className="text-xs text-slate-500">{etiquetaCargo(p.cargo, p.rol)}</span>
                  </label>
                </li>
              ))}
            </ul>
            {nueva === "chat" && elegidas.length > 1 && (
              <input
                value={nombreGrupo}
                onChange={(e) => setNombreGrupo(e.target.value)}
                placeholder="Nombre del grupo (p. ej. Caso 3.º 2.ª · Equipo)"
                className="campo"
              />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                className="boton-primario"
                disabled={!elegidas.length || (nueva === "chat" && elegidas.length > 1 && !nombreGrupo.trim())}
                onClick={() => void crear()}
              >
                {nueva === "agregar" ? "Sumar" : elegidas.length > 1 ? "Crear grupo" : "Abrir chat"}
              </button>
              <button type="button" className="boton-secundario" onClick={() => setNueva(null)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : abierta && detalle ? (
          <>
            <header className="flex items-center gap-3 border-b border-slate-100 p-4">
              <button type="button" className="lg:hidden" onClick={() => setAbierta(null)} aria-label="Volver">
                <ArrowLeft className="h-5 w-5" aria-hidden />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-slate-900">{titulo(detalle, yo)}</p>
                <p className="truncate text-xs text-slate-500">{detalle.participantes.map((p) => p.usuario.nombre).join(", ")}</p>
              </div>
              {detalle.esGrupo && (
                <button type="button" className="boton-secundario" onClick={() => void abrirSelector("agregar")}>
                  <UserPlus className="h-4 w-4" aria-hidden /> Sumar
                </button>
              )}
            </header>
            <div className="flex-1 space-y-2 overflow-y-auto p-4" style={{ maxHeight: "55vh" }}>
              {mensajes.length === 0 && <p className="text-center text-sm text-slate-400">Escriba el primer mensaje.</p>}
              {mensajes.map((m) => {
                const propio = m.autor.id === yo;
                return (
                  <div key={m.id} className={`flex ${propio ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${propio ? "bg-institucional-700 text-white" : "bg-slate-100 text-slate-900"}`}
                    >
                      {!propio && detalle.esGrupo && <p className="text-xs font-semibold opacity-80">{m.autor.nombre}</p>}
                      <p className="whitespace-pre-line break-words">{m.texto}</p>
                      <p className={`mt-0.5 text-[10px] ${propio ? "text-institucional-100" : "text-slate-500"}`}>
                        {formatearFechaHora(m.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={finRef} />
            </div>
            <form onSubmit={enviar} className="flex gap-2 border-t border-slate-100 p-3">
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Escribir un mensaje… (los datos de salud van en el legajo)"
                className="campo flex-1"
                maxLength={4000}
              />
              <button type="submit" className="boton-primario" disabled={!texto.trim()} aria-label="Enviar">
                <Send className="h-4 w-4" aria-hidden />
              </button>
            </form>
          </>
        ) : (
          <p className="m-auto p-6 text-sm text-slate-400">Elija una conversación o cree una nueva.</p>
        )}
        {error && (
          <div className="p-3">
            <MensajeError mensaje={error} />
          </div>
        )}
      </div>
    </section>
  );
}
