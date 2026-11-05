"use client";

import { Loader2, RefreshCw, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatearFechaHora } from "@/lib/formato";
import { etiquetaCargo, type AccionAuditoria, type RegistroAuditoriaVisible } from "@/lib/types";
import { Insignia, MensajeError, Modal } from "./ui";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  cargar: (filtros?: { desde?: string; hasta?: string }) => Promise<RegistroAuditoriaVisible[]>;
}

const ACCIONES: Record<AccionAuditoria, { etiqueta: string; tono: "azul" | "violeta" | "ambar" | "verde" | "neutro" | "rojo" }> = {
  VER_LEGAJO: { etiqueta: "Consultó legajo", tono: "azul" },
  VER_CUD_SOE: { etiqueta: "Vio datos CUD / SOE", tono: "violeta" },
  CARGAR_ACTA: { etiqueta: "Convivencia / acta", tono: "ambar" },
  IMPORTAR_GEI: { etiqueta: "Importó GEI", tono: "verde" },
  CARGAR_INTERVENCION: { etiqueta: "Registró intervención SOE", tono: "violeta" },
  EDITAR_CONFIDENCIAL: { etiqueta: "Editó datos CUD / PPI", tono: "rojo" },
  GENERAR_INFORME: { etiqueta: "Generó informe", tono: "neutro" },
  GESTIONAR_USUARIO: { etiqueta: "Gestionó usuarios", tono: "ambar" },
  CARGAR_ACTUACION: { etiqueta: "Registró actuación", tono: "ambar" },
  CARGAR_DERIVACION: { etiqueta: "Derivación al SOE", tono: "violeta" },
  REGISTRAR_SEGUIMIENTO: { etiqueta: "Registró seguimiento", tono: "violeta" },
  GESTIONAR_SITUACION: { etiqueta: "Situación especial", tono: "ambar" },
  VER_FICHA_ANEXA: { etiqueta: "Vio ficha anexa", tono: "rojo" },
  EDITAR_FICHA_ANEXA: { etiqueta: "Editó ficha anexa", tono: "rojo" },
  VER_REPORTE_RESTRINGIDO: { etiqueta: "Vio reporte restringido", tono: "rojo" },
  GESTIONAR_NORMATIVA: { etiqueta: "Gestionó normativa", tono: "neutro" },
};

/** Texto sin acentos y en minúsculas, para buscar sin importar cómo se escriba. */
const normalizar = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function AuditoriaPanel({ abierto, onCerrar, cargar }: Props) {
  const [registros, setRegistros] = useState<RegistroAuditoriaVisible[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Filtros
  const [busqueda, setBusqueda] = useState("");
  const [usuario, setUsuario] = useState("");
  const [cargo, setCargo] = useState("");
  const [accion, setAccion] = useState("");
  const [conAlumno, setConAlumno] = useState<"" | "si" | "no">("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const actualizar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setRegistros(await cargar({ desde: desde || undefined, hasta: hasta || undefined }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCargando(false);
    }
  }, [cargar, desde, hasta]);

  useEffect(() => {
    if (abierto) void actualizar();
  }, [abierto, actualizar]);

  const cargoDe = (r: RegistroAuditoriaVisible) => etiquetaCargo(r.usuarioCargo, r.usuarioRol);
  const opcionesUsuario = useMemo(() => [...new Set(registros.map((r) => r.usuarioNombre))].sort(), [registros]);
  const opcionesCargo = useMemo(() => [...new Set(registros.map(cargoDe))].sort(), [registros]);
  const opcionesAccion = useMemo(
    () => [...new Set(registros.map((r) => r.accion))].sort((a, b) => ACCIONES[a].etiqueta.localeCompare(ACCIONES[b].etiqueta)),
    [registros],
  );

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda.trim());
    return registros.filter((r) => {
      if (usuario && r.usuarioNombre !== usuario) return false;
      if (cargo && cargoDe(r) !== cargo) return false;
      if (accion && r.accion !== accion) return false;
      if (conAlumno === "si" && !r.estudianteDni) return false;
      if (conAlumno === "no" && r.estudianteDni) return false;
      if (!q) return true;
      const texto = normalizar(
        [r.usuarioNombre, cargoDe(r), ACCIONES[r.accion].etiqueta, r.estudianteDni, r.estudianteNombre, r.ipAddress, formatearFechaHora(r.createdAt)]
          .filter(Boolean)
          .join(" "),
      );
      return q.split(/\s+/).every((palabra) => texto.includes(palabra));
    });
  }, [registros, busqueda, usuario, cargo, accion, conAlumno]);

  const hayFiltros = !!(busqueda || usuario || cargo || accion || conAlumno || desde || hasta);
  const limpiar = () => {
    setBusqueda("");
    setUsuario("");
    setCargo("");
    setAccion("");
    setConAlumno("");
    setDesde("");
    setHasta("");
  };
  const filtroCelda = "w-full rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs font-normal text-slate-700";
  const botonChico =
    "inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-300 hover:bg-slate-50";

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Logs de auditoría"
      subtitulo="Registro de accesos a legajos y acciones sensibles (Ley 25.326)"
      ancho="xl"
    >
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <label className="relative min-w-[14rem] flex-1">
          <span className="sr-only">Buscar</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por persona, alumno, DNI, acción…"
            className="campo pl-8"
          />
        </label>
        <label className="text-xs text-slate-500">
          Desde
          <input type="date" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} className="campo mt-0.5 py-1.5" />
        </label>
        <label className="text-xs text-slate-500">
          Hasta
          <input type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} className="campo mt-0.5 py-1.5" />
        </label>
        {hayFiltros && (
          <button type="button" onClick={limpiar} className={botonChico}>
            <X className="h-3.5 w-3.5" aria-hidden /> Limpiar filtros
          </button>
        )}
        <button type="button" onClick={() => void actualizar()} className={botonChico}>
          {cargando ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden />}
          Actualizar
        </button>
      </div>
      <p className="mb-2 text-xs text-slate-500">
        Mostrando {filtrados.length} de {registros.length} registros
        {registros.length >= 1000 && " (los 1000 más recientes: acote por fechas para ver más atrás)"}
      </p>
      {error && <MensajeError mensaje={error} />}
      {!error && registros.length === 0 && !cargando && (
        <p className="py-8 text-center text-sm text-slate-500">No hay registros para el período elegido.</p>
      )}
      {registros.length > 0 && (
        <div className="max-h-[60vh] overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-white text-left text-xs text-slate-500">
              <tr>
                <th className="py-2 pr-3 font-medium">Fecha y hora</th>
                <th className="py-2 pr-3 font-medium">Usuario</th>
                <th className="py-2 pr-3 font-medium">Acción</th>
                <th className="py-2 pr-3 font-medium">Alumno</th>
                <th className="py-2 font-medium">IP</th>
              </tr>
              <tr className="border-b border-slate-200">
                <th className="pb-2 pr-3" />
                <th className="space-y-1 pb-2 pr-3">
                  <select aria-label="Filtrar por persona" value={usuario} onChange={(e) => setUsuario(e.target.value)} className={filtroCelda}>
                    <option value="">Todas las personas</option>
                    {opcionesUsuario.map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </select>
                  <select aria-label="Filtrar por cargo" value={cargo} onChange={(e) => setCargo(e.target.value)} className={filtroCelda}>
                    <option value="">Todos los cargos</option>
                    {opcionesCargo.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </th>
                <th className="pb-2 pr-3 align-top">
                  <select aria-label="Filtrar por acción" value={accion} onChange={(e) => setAccion(e.target.value)} className={filtroCelda}>
                    <option value="">Todas las acciones</option>
                    {opcionesAccion.map((a) => (
                      <option key={a} value={a}>
                        {ACCIONES[a].etiqueta}
                      </option>
                    ))}
                  </select>
                </th>
                <th className="pb-2 pr-3 align-top">
                  <select
                    aria-label="Filtrar por alumno"
                    value={conAlumno}
                    onChange={(e) => setConAlumno(e.target.value as "" | "si" | "no")}
                    className={filtroCelda}
                  >
                    <option value="">Con y sin alumno</option>
                    <option value="si">Sobre un alumno</option>
                    <option value="no">Generales</option>
                  </select>
                </th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtrados.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap py-2 pr-3 tabular-nums text-slate-600">{formatearFechaHora(r.createdAt)}</td>
                  <td className="py-2 pr-3">
                    <button
                      type="button"
                      className="text-left text-slate-900 hover:underline"
                      onClick={() => setUsuario(r.usuarioNombre)}
                      title="Ver solo esta persona"
                    >
                      {r.usuarioNombre}
                    </button>
                    <div className="text-xs text-slate-500">{cargoDe(r)}</div>
                  </td>
                  <td className="py-2 pr-3">
                    <button type="button" onClick={() => setAccion(r.accion)} title="Ver solo esta acción">
                      <Insignia tono={ACCIONES[r.accion].tono}>{ACCIONES[r.accion].etiqueta}</Insignia>
                    </button>
                  </td>
                  <td className="py-2 pr-3">
                    {r.estudianteDni ? (
                      <>
                        <div className="text-slate-800">{r.estudianteNombre ?? "—"}</div>
                        <div className="text-xs tabular-nums text-slate-500">DNI {r.estudianteDni}</div>
                      </>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-2 text-xs text-slate-500">{r.ipAddress ?? "—"}</td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-slate-500">
                    Ningún registro coincide con los filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
