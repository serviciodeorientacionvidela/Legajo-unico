"use client";

import { CheckCircle2, CircleDot, FolderOpen, Inbox, Loader2, Send, Ticket } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { solicitar } from "@/lib/dataSource";
import { formatearFechaHora } from "@/lib/formato";
import { etiquetaCargo } from "@/lib/types";
import { MensajeError } from "./ui";

interface Persona {
  id: string;
  nombre: string;
  cargo: string | null;
}
interface TicketVisible {
  id: string;
  numero: number;
  fecha: string;
  motivo: string;
  estado: "PENDIENTE" | "EN_CURSO" | "CERRADA";
  recibidaEl: string | null;
  cerradaEl: string | null;
  respuesta: string | null;
  createdAt: string;
  derivadoPor: Persona;
  destinatario: Persona | null;
  profesionalSoe: { nombre: string } | null;
  estudiante: { dni: string; apellidos: string; nombres: string; anio: number; division: string };
}

const ESTADO: Record<TicketVisible["estado"], { texto: string; clase: string }> = {
  PENDIENTE: { texto: "Enviado", clase: "bg-amber-100 text-amber-900 ring-amber-300" },
  EN_CURSO: { texto: "Recibido", clase: "bg-sky-100 text-sky-900 ring-sky-300" },
  CERRADA: { texto: "Resuelto", clase: "bg-emerald-100 text-emerald-900 ring-emerald-300" },
};

/** Línea de tiempo de 3 pasos: Enviado → Recibido → Resuelto. */
function Progreso({ t }: { t: TicketVisible }) {
  const pasos = [
    { texto: "Enviado", fecha: t.createdAt, hecho: true },
    { texto: "Recibido", fecha: t.recibidaEl, hecho: !!t.recibidaEl },
    { texto: "Resuelto", fecha: t.cerradaEl, hecho: t.estado === "CERRADA" },
  ];
  return (
    <ol className="mt-3 flex items-center gap-1 text-[11px]">
      {pasos.map((p, i) => (
        <li key={p.texto} className="flex flex-1 items-center gap-1">
          <span className={`flex items-center gap-1 font-semibold ${p.hecho ? "text-institucional-800" : "text-slate-400"}`}>
            {p.hecho ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <CircleDot className="h-4 w-4" aria-hidden />}
            {p.texto}
          </span>
          {p.hecho && p.fecha && <span className="hidden text-slate-400 sm:inline">{formatearFechaHora(p.fecha)}</span>}
          {i < pasos.length - 1 && <span className={`h-0.5 flex-1 ${pasos[i + 1]?.hecho ? "bg-institucional-500" : "bg-slate-200"}`} />}
        </li>
      ))}
    </ol>
  );
}

export default function TicketsPanel({ onVerLegajo }: { onVerLegajo: (dni: string) => void }) {
  const [datos, setDatos] = useState<{ enviados: TicketVisible[]; recibidos: TicketVisible[] } | null>(null);
  const [pestana, setPestana] = useState<"recibidos" | "enviados">("recibidos");
  const [filtro, setFiltro] = useState<"abiertos" | "todos">("abiertos");
  const [resolviendo, setResolviendo] = useState<string | null>(null);
  const [nota, setNota] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setDatos(await solicitar("/api/tickets"));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void cargar();
  }, [cargar]);

  const actualizar = async (id: string, accion: "RECIBIR" | "RESOLVER") => {
    setOcupado(true);
    setError(null);
    try {
      await solicitar("/api/tickets", { method: "PATCH", body: JSON.stringify({ id, accion, nota }) });
      setResolviendo(null);
      setNota("");
      await cargar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  const lista = (datos?.[pestana] ?? []).filter((t) => filtro === "todos" || t.estado !== "CERRADA");
  const abiertosRecibidos = datos?.recibidos.filter((t) => t.estado !== "CERRADA").length ?? 0;

  return (
    <section className="space-y-4">
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <Ticket className="h-5 w-5 text-institucional-700" aria-hidden /> Tickets de derivación
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Cada derivación genera un ticket. Quien recibe lo marca como <strong>Recibido</strong> y luego como{" "}
          <strong>Resuelto</strong>; quien derivó recibe un aviso en cada paso.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPestana("recibidos")}
            className={pestana === "recibidos" ? "boton-primario" : "boton-secundario"}
          >
            <Inbox className="h-4 w-4" aria-hidden /> Recibidos
            {abiertosRecibidos > 0 && (
              <span className="rounded-full bg-amber-500 px-1.5 text-xs text-white">{abiertosRecibidos}</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setPestana("enviados")}
            className={pestana === "enviados" ? "boton-primario" : "boton-secundario"}
          >
            <Send className="h-4 w-4" aria-hidden /> Enviados
          </button>
          <select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value as "abiertos" | "todos")}
            className="campo ml-auto w-auto"
            aria-label="Filtrar tickets"
          >
            <option value="abiertos">Solo abiertos</option>
            <option value="todos">Todos</option>
          </select>
        </div>
      </div>

      {error && <MensajeError mensaje={error} />}
      {!datos && !error && <Loader2 className="mx-auto h-6 w-6 animate-spin text-institucional-600" aria-label="Cargando" />}
      {datos && lista.length === 0 && (
        <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">
          No hay tickets {filtro === "abiertos" ? "abiertos " : ""}en esta bandeja.
        </p>
      )}

      <ul className="space-y-3">
        {lista.map((t) => (
          <li key={t.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-mono font-bold text-institucional-800">#{t.numero}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${ESTADO[t.estado].clase}`}>
                    {ESTADO[t.estado].texto}
                  </span>
                  <span className="font-semibold text-slate-900">
                    {t.estudiante.apellidos}, {t.estudiante.nombres}
                  </span>
                  <span className="text-xs text-slate-500">
                    {t.estudiante.anio}.º {t.estudiante.division}
                  </span>
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  De: {t.derivadoPor.nombre}
                  {t.derivadoPor.cargo ? ` (${etiquetaCargo(t.derivadoPor.cargo)})` : ""} → Para:{" "}
                  {t.destinatario
                    ? `${t.destinatario.nombre}${t.destinatario.cargo ? ` (${etiquetaCargo(t.destinatario.cargo)})` : ""}`
                    : "Equipo SOE / dirección"}
                  {t.profesionalSoe && ` · Atiende: ${t.profesionalSoe.nombre}`}
                </p>
              </div>
              <button type="button" className="boton-secundario" onClick={() => onVerLegajo(t.estudiante.dni)}>
                <FolderOpen className="h-4 w-4" aria-hidden /> Legajo
              </button>
            </div>
            <p className="mt-2 whitespace-pre-line text-sm text-slate-800">{t.motivo}</p>
            {t.respuesta && (
              <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-900">Resolución: {t.respuesta}</p>
            )}
            <Progreso t={t} />

            {pestana === "recibidos" && t.estado !== "CERRADA" && (
              <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                {t.estado === "PENDIENTE" && (
                  <button type="button" disabled={ocupado} className="boton-primario" onClick={() => void actualizar(t.id, "RECIBIR")}>
                    Marcar recibido
                  </button>
                )}
                {resolviendo === t.id ? (
                  <div className="flex w-full flex-col gap-2">
                    <textarea
                      value={nota}
                      onChange={(e) => setNota(e.target.value)}
                      rows={2}
                      className="campo"
                      placeholder="¿Cómo se resolvió? (lo ve quien derivó; sin datos sensibles)"
                    />
                    <div className="flex gap-2">
                      <button type="button" disabled={ocupado} className="boton-primario" onClick={() => void actualizar(t.id, "RESOLVER")}>
                        Confirmar resuelto
                      </button>
                      <button type="button" className="boton-secundario" onClick={() => setResolviendo(null)}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="boton-secundario"
                    onClick={() => {
                      setResolviendo(t.id);
                      setNota("");
                    }}
                  >
                    Marcar resuelto
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
