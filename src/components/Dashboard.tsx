"use client";

import {
  ChartColumn,
  ClipboardList,
  FileSpreadsheet,
  Info,
  Loader2,
  LogOut,
  RotateCcw,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  crearFuenteApi,
  crearFuenteDemo,
  ErrorFuenteDatos,
  reiniciarDemo,
  type DatosConfidenciales,
  type NuevaIntervencion,
  type NuevoIncidente,
} from "@/lib/dataSource";
import { USUARIOS_DEMO } from "@/lib/demoData";
import { tienePermiso } from "@/lib/rbac";
import {
  ROL_ETIQUETA,
  type EstudianteResumen,
  type FiltrosEstudiantes,
  type LegajoVisible,
  type MetricasInstitucionales,
  type Rol,
  type UsuarioSesion,
} from "@/lib/types";
import AuditoriaPanel from "./AuditoriaPanel";
import ConfidencialModal from "./ConfidencialModal";
import ImportGeiModal from "./ImportGeiModal";
import IncidenteModal from "./IncidenteModal";
import InformeLegajoModal from "./InformeLegajoModal";
import InformesPanel from "./InformesPanel";
import IntervencionModal from "./IntervencionModal";
import LegajoDetalle from "./LegajoDetalle";
import MetricCards, { type FiltroRapido } from "./MetricCards";
import RoleSimulator from "./RoleSimulator";
import SessionTimeoutGuard from "./SessionTimeoutGuard";
import StudentTable from "./StudentTable";

type Acceso = "total" | "parcial" | "ninguno";

/** Matriz institucional de permisos, tal como se presenta a Dirección. */
const MATRIZ_PERMISOS: { modulo: string; acceso: Record<Rol, [Acceso, string]> }[] = [
  {
    modulo: "Datos biográficos y curso",
    acceso: { DOCENTE: ["parcial", "Lectura"], PRECEPTOR: ["parcial", "Lectura / Edición"], DIRECTIVO_SOE: ["total", "Control total"] },
  },
  {
    modulo: "Calificaciones, promedios y asistencias",
    acceso: { DOCENTE: ["parcial", "Lectura"], PRECEPTOR: ["parcial", "Lectura"], DIRECTIVO_SOE: ["total", "Control total"] },
  },
  {
    modulo: "Indicador CUD / PPI",
    acceso: {
      DOCENTE: ["parcial", "Solo Sí/No"],
      PRECEPTOR: ["parcial", "Solo Sí/No"],
      DIRECTIVO_SOE: ["total", "Diagnóstico y PDF"],
    },
  },
  {
    modulo: "Régimen de convivencia",
    acceso: {
      DOCENTE: ["ninguno", "Sin acceso"],
      PRECEPTOR: ["parcial", "Carga y lectura"],
      DIRECTIVO_SOE: ["total", "Aprobación, quita y baja"],
    },
  },
  {
    modulo: "Informes SOE y carpeta confidencial",
    acceso: { DOCENTE: ["ninguno", "Sin acceso"], PRECEPTOR: ["ninguno", "Sin acceso"], DIRECTIVO_SOE: ["total", "Control total"] },
  },
  {
    modulo: "Informes institucionales y exportación",
    acceso: { DOCENTE: ["ninguno", "Sin acceso"], PRECEPTOR: ["parcial", "Generación"], DIRECTIVO_SOE: ["total", "Generación (incluye SOE)"] },
  },
  {
    modulo: "Auditoría y sincronización GEI",
    acceso: { DOCENTE: ["ninguno", "Sin acceso"], PRECEPTOR: ["ninguno", "Sin acceso"], DIRECTIVO_SOE: ["total", "Control total"] },
  },
];

const COLOR_ACCESO: Record<Acceso, string> = {
  total: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  parcial: "bg-institucional-50 text-institucional-700 ring-institucional-100",
  ninguno: "bg-slate-100 text-slate-500 ring-slate-200",
};

function useDiferido<T>(valor: T, demoraMs: number): T {
  const [diferido, setDiferido] = useState(valor);
  useEffect(() => {
    const t = window.setTimeout(() => setDiferido(valor), demoraMs);
    return () => window.clearTimeout(t);
  }, [valor, demoraMs]);
  return diferido;
}

function BotonMenu({ activo, onClick, icono, children }: { activo: boolean; onClick: () => void; icono: ReactNode; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={activo ? "page" : undefined}
      className={`flex shrink-0 items-center gap-3 whitespace-nowrap rounded-full px-4 py-2.5 text-sm transition lg:w-full ${
        activo ? "bg-institucional-600 font-semibold text-white" : "font-medium text-slate-300 hover:bg-institucional-900 hover:text-white"
      }`}
    >
      {icono}
      {children}
    </button>
  );
}

function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 ring-inset transition ${
        activo ? "bg-institucional-600 text-white ring-institucional-600" : "bg-white text-slate-600 ring-slate-200 hover:bg-institucional-50"
      }`}
    >
      {children}
    </button>
  );
}

export default function Dashboard({ modoDemo }: { modoDemo: boolean }) {
  const router = useRouter();

  // --- Sesión / rol -----------------------------------------------------------
  const [rolDemo, setRolDemo] = useState<Rol>("DIRECTIVO_SOE");
  const [usuarioReal, setUsuarioReal] = useState<UsuarioSesion | null>(null);
  const usuario: UsuarioSesion | null = modoDemo ? USUARIOS_DEMO[rolDemo] : usuarioReal;
  const rol = usuario?.rol ?? null;
  const [sesionCerrada, setSesionCerrada] = useState(false);
  const fuente = useMemo(() => (modoDemo ? crearFuenteDemo(rolDemo) : crearFuenteApi()), [modoDemo, rolDemo]);

  useEffect(() => {
    if (modoDemo) return;
    let cancelado = false;
    fetch("/api/auth/me", { credentials: "same-origin" })
      .then(async (res) => {
        if (cancelado) return;
        if (!res.ok) return router.replace("/login");
        const datos = (await res.json()) as { usuario: UsuarioSesion };
        setUsuarioReal(datos.usuario);
      })
      .catch(() => router.replace("/login"));
    return () => {
      cancelado = true;
    };
  }, [modoDemo, router]);

  const esErrorDeSesion = useCallback(
    (error: unknown): boolean => {
      if (!modoDemo && error instanceof ErrorFuenteDatos && error.status === 401) {
        router.replace("/login?motivo=expirada");
        return true;
      }
      return false;
    },
    [modoDemo, router],
  );

  // --- Avisos -----------------------------------------------------------------
  const [aviso, setAviso] = useState<{ texto: string; tono: "ok" | "error" } | null>(null);
  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), 5000);
    return () => window.clearTimeout(t);
  }, [aviso]);

  // --- Filtros ----------------------------------------------------------------
  const [busqueda, setBusqueda] = useState("");
  const busquedaDiferida = useDiferido(busqueda.trim(), 250);
  const [anio, setAnio] = useState<number | undefined>(undefined);
  const [division, setDivision] = useState("");
  const [alertaPuntos, setAlertaPuntos] = useState(false);
  const [conCud, setConCud] = useState(false);
  const [promedioBajo, setPromedioBajo] = useState(false);
  const puedeVerConvivencia = rol !== null && tienePermiso(rol, "VER_CONVIVENCIA");

  const filtros = useMemo<FiltrosEstudiantes>(
    () => ({
      q: busquedaDiferida || undefined,
      anio,
      division: division || undefined,
      alertaPuntos: alertaPuntos && puedeVerConvivencia,
      conCud,
      promedioBajo,
    }),
    [busquedaDiferida, anio, division, alertaPuntos, puedeVerConvivencia, conCud, promedioBajo],
  );

  const aplicarFiltroRapido = (filtro: FiltroRapido) => {
    setBusqueda("");
    setAnio(undefined);
    setDivision("");
    setAlertaPuntos(filtro === "convivencia");
    setConCud(filtro === "cud");
    setPromedioBajo(filtro === "riesgo");
  };

  // --- Listado ----------------------------------------------------------------
  const [estudiantes, setEstudiantes] = useState<EstudianteResumen[]>([]);
  const [total, setTotal] = useState(0);
  const [metricas, setMetricas] = useState<MetricasInstitucionales | null>(null);
  const [pagina, setPagina] = useState(1);
  const [cargandoLista, setCargandoLista] = useState(false);
  const [errorLista, setErrorLista] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const refrescar = () => setVersion((v) => v + 1);

  useEffect(() => {
    if (!rol || sesionCerrada) return;
    let cancelado = false;
    setCargandoLista(true);
    fuente
      .listar(filtros, 1)
      .then((r) => {
        if (cancelado) return;
        setEstudiantes(r.estudiantes);
        setTotal(r.total);
        setMetricas(r.metricas);
        setPagina(1);
        setErrorLista(null);
      })
      .catch((error: unknown) => {
        if (!cancelado && !esErrorDeSesion(error)) setErrorLista((error as Error).message);
      })
      .finally(() => {
        if (!cancelado) setCargandoLista(false);
      });
    return () => {
      cancelado = true;
    };
  }, [fuente, filtros, rol, version, sesionCerrada, esErrorDeSesion]);

  const cargarMas = async () => {
    setCargandoLista(true);
    try {
      const r = await fuente.listar(filtros, pagina + 1);
      setEstudiantes((previos) => [...previos, ...r.estudiantes]);
      setTotal(r.total);
      setPagina(pagina + 1);
    } catch (error) {
      if (!esErrorDeSesion(error)) setAviso({ texto: (error as Error).message, tono: "error" });
    } finally {
      setCargandoLista(false);
    }
  };

  // --- Legajo -----------------------------------------------------------------
  const [dniAbierto, setDniAbierto] = useState<string | null>(null);
  const [legajo, setLegajo] = useState<LegajoVisible | null>(null);
  const [cargandoLegajo, setCargandoLegajo] = useState(false);
  const [errorLegajo, setErrorLegajo] = useState<string | null>(null);
  const [incidenteEnProceso, setIncidenteEnProceso] = useState<string | null>(null);
  const [modalIncidente, setModalIncidente] = useState(false);
  const [modalImportar, setModalImportar] = useState(false);
  const [modalAuditoria, setModalAuditoria] = useState(false);
  const [modalIntervencion, setModalIntervencion] = useState(false);
  const [modalConfidencial, setModalConfidencial] = useState(false);
  const [modalInforme, setModalInforme] = useState(false);
  const [vista, setVista] = useState<"estudiantes" | "informes">("estudiantes");

  const cargarLegajo = useCallback(
    async (dni: string, silencioso = false) => {
      if (!silencioso) setCargandoLegajo(true);
      setErrorLegajo(null);
      try {
        setLegajo(await fuente.obtenerLegajo(dni));
      } catch (error) {
        if (!esErrorDeSesion(error)) {
          setLegajo(null);
          setErrorLegajo((error as Error).message);
        }
      } finally {
        setCargandoLegajo(false);
      }
    },
    [fuente, esErrorDeSesion],
  );

  // Se vuelve a pedir el legajo al cambiar de rol: muestra en vivo qué datos llegan a cada perfil.
  useEffect(() => {
    if (dniAbierto && !sesionCerrada) void cargarLegajo(dniAbierto);
  }, [dniAbierto, cargarLegajo, sesionCerrada]);

  const cerrarLegajo = useCallback(() => {
    setDniAbierto(null);
    setLegajo(null);
    setErrorLegajo(null);
  }, []);

  const guardarIncidente = async (datos: NuevoIncidente) => {
    const r = await fuente.cargarIncidente(datos);
    setModalIncidente(false);
    setAviso({
      tono: "ok",
      texto: r.aprobado
        ? `Incidente registrado. Recuerde cargar los −${r.puntosDescontados} pts en Puntos ICE del GEI.`
        : "Incidente enviado a Dirección para su aprobación.",
    });
    await cargarLegajo(datos.dni, true);
    refrescar();
  };

  const resolverIncidente = async (incidenteId: string, accion: "APROBAR" | "ANULAR") => {
    if (!dniAbierto) return;
    setIncidenteEnProceso(incidenteId);
    try {
      const r = await fuente.resolverIncidente(incidenteId, accion);
      setAviso({
        tono: "ok",
        texto: `${accion === "APROBAR" ? "Incidente aprobado" : "Incidente dado de baja"}. Saldo ICE (GEI): ${r.puntosConvivencia} pts.`,
      });
      await cargarLegajo(dniAbierto, true);
      refrescar();
    } catch (error) {
      if (!esErrorDeSesion(error)) setAviso({ texto: (error as Error).message, tono: "error" });
    } finally {
      setIncidenteEnProceso(null);
    }
  };

  const guardarIntervencion = async (datos: NuevaIntervencion) => {
    await fuente.cargarIntervencion(datos);
    setModalIntervencion(false);
    setAviso({
      tono: "ok",
      texto: datos.proximoSeguimiento ? "Intervención registrada y seguimiento agendado." : "Intervención del SOE registrada.",
    });
    await cargarLegajo(datos.dni, true);
  };

  const guardarConfidencial = async (dni: string, datos: DatosConfidenciales) => {
    setLegajo(await fuente.editarConfidencial(dni, datos));
    setModalConfidencial(false);
    setAviso({ tono: "ok", texto: "Datos de inclusión y salud actualizados." });
    refrescar();
  };

  const registrarInformeIndividual = useCallback(
    async (dni: string) => {
      try {
        await fuente.registrarInformeIndividual(dni);
      } catch (error) {
        if (esErrorDeSesion(error)) return;
        throw error;
      }
    },
    [fuente, esErrorDeSesion],
  );

  const cargarInforme = useCallback(() => fuente.obtenerInforme(), [fuente]);
  const cargarAuditoria = useCallback(() => fuente.obtenerAuditoria(), [fuente]);

  const importarGei = async (archivo: File) => {
    const resultado = await fuente.importarGei(archivo);
    refrescar();
    return resultado;
  };

  // --- Cierre de sesión -------------------------------------------------------
  const cerrarTodo = useCallback(() => {
    cerrarLegajo();
    setModalIncidente(false);
    setModalImportar(false);
    setModalAuditoria(false);
    setModalIntervencion(false);
    setModalConfidencial(false);
    setModalInforme(false);
  }, [cerrarLegajo]);

  const alExpirarSesion = useCallback(() => {
    cerrarTodo();
    if (modoDemo) {
      setSesionCerrada(true);
      return;
    }
    void fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" })
      .catch(() => undefined)
      .finally(() => {
        window.location.href = "/login?motivo=inactividad";
      });
  }, [cerrarTodo, modoDemo]);

  const latido = useCallback(() => {
    if (modoDemo) return;
    void fetch("/api/auth/me", { credentials: "same-origin" }).then((res) => {
      if (res.status === 401) router.replace("/login?motivo=expirada");
    });
  }, [modoDemo, router]);

  const cerrarSesion = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => undefined);
    window.location.href = "/login";
  };

  const cambiarRolDemo = (nuevo: Rol) => {
    setRolDemo(nuevo);
    setModalIncidente(false);
    setModalImportar(false);
    setModalAuditoria(false);
    setModalIntervencion(false);
    setModalConfidencial(false);
    setModalInforme(false);
    if (!tienePermiso(nuevo, "GENERAR_INFORMES")) setVista("estudiantes");
  };

  // --- Render -----------------------------------------------------------------
  if (!rol || !usuario) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Verificando sesión…
      </div>
    );
  }

  if (sesionCerrada) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="tarjeta w-full max-w-sm p-8 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-institucional-600" aria-hidden />
          <h1 className="mt-3 text-lg font-semibold text-slate-900">Sesión cerrada por inactividad</h1>
          <p className="mt-2 text-sm text-slate-600">
            Pasaron 10 minutos sin actividad. Se ocultaron todos los datos de estudiantes de la pantalla.
          </p>
          <button
            type="button"
            onClick={() => setSesionCerrada(false)}
            className="boton-primario mt-6 w-full"
          >
            Volver a ingresar
          </button>
        </div>
      </div>
    );
  }

  const estudianteAbierto = legajo
    ? {
        dni: legajo.estudiante.dni,
        nombreCompleto: `${legajo.estudiante.apellidos}, ${legajo.estudiante.nombres}`,
        puntos: legajo.convivencia?.puntos ?? 0,
      }
    : null;

  const iniciales = usuario.nombre
    .replace(/^(Lic|Prof|Dr|Dra)\.\s*/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen lg:pl-64">
      {/* --- Menú lateral (petróleo) ------------------------------------------------ */}
      <aside className="flex flex-col bg-institucional-950 text-slate-300 lg:fixed lg:inset-y-0 lg:left-0 lg:w-64">
        <div className="flex items-center gap-3 px-5 py-5 lg:flex-col lg:py-8 lg:text-center">
          <Image
            src="/logo-escuela.jpg"
            alt="Escudo Esc. N° 4-012 Ing. Ricardo Videla"
            width={80}
            height={80}
            className="h-12 w-12 rounded-full object-cover ring-2 ring-institucional-400 lg:h-20 lg:w-20 lg:ring-4"
            priority
          />
          <div>
            <h1 className="text-base font-bold leading-tight text-white">Legajo Único</h1>
            <p className="text-xs text-institucional-200">del Estudiante · Ciclo 2026</p>
          </div>
        </div>

        <nav aria-label="Secciones" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:block lg:space-y-1 lg:pb-0">
          <BotonMenu activo={vista === "estudiantes"} onClick={() => setVista("estudiantes")} icono={<Users className="h-4 w-4" aria-hidden />}>
            Estudiantes
          </BotonMenu>
          {tienePermiso(rol, "GENERAR_INFORMES") && (
            <BotonMenu activo={vista === "informes"} onClick={() => setVista("informes")} icono={<ChartColumn className="h-4 w-4" aria-hidden />}>
              Informes
            </BotonMenu>
          )}
          {(tienePermiso(rol, "IMPORTAR_GEI") || tienePermiso(rol, "VER_AUDITORIA")) && (
            <p className="hidden px-4 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-institucional-300/70 lg:block">
              Administración
            </p>
          )}
          {tienePermiso(rol, "IMPORTAR_GEI") && (
            <BotonMenu activo={false} onClick={() => setModalImportar(true)} icono={<FileSpreadsheet className="h-4 w-4" aria-hidden />}>
              Importar GEI
            </BotonMenu>
          )}
          {tienePermiso(rol, "VER_AUDITORIA") && (
            <BotonMenu activo={false} onClick={() => setModalAuditoria(true)} icono={<ClipboardList className="h-4 w-4" aria-hidden />}>
              Auditoría
            </BotonMenu>
          )}
        </nav>

        <div className="mt-auto hidden space-y-3 border-t border-institucional-900 px-5 py-5 lg:block">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-institucional-800 text-xs font-bold text-institucional-100">
              {iniciales}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{usuario.nombre}</p>
              <p className="truncate text-xs text-institucional-200">{ROL_ETIQUETA[usuario.rol]}</p>
            </div>
          </div>
          {!modoDemo && (
            <button
              type="button"
              onClick={() => void cerrarSesion()}
              className="flex w-full items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-slate-200 ring-1 ring-inset ring-institucional-800 transition hover:bg-institucional-900"
            >
              <LogOut className="h-4 w-4" aria-hidden /> Cerrar sesión
            </button>
          )}
        </div>
      </aside>

      {/* --- Barra superior ---------------------------------------------------------- */}
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-fondo/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div>
            <h2 className="text-lg font-bold text-institucional-950">{vista === "informes" ? "Informes" : "Estudiantes"}</h2>
            <p className="text-xs text-slate-500">
              {vista === "informes"
                ? "Indicadores institucionales, seguimiento y exportación"
                : "Escuela 4012 · Mendoza · Ciclo lectivo 2026"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SessionTimeoutGuard onTimeout={alExpirarSesion} onLatido={latido} mostrarContador={modoDemo} />
            {modoDemo ? (
              <>
                <RoleSimulator rol={rolDemo} onCambiar={cambiarRolDemo} />
                <button
                  type="button"
                  onClick={() => {
                    reiniciarDemo();
                    cerrarLegajo();
                    refrescar();
                    setAviso({ texto: "Datos de demostración restablecidos.", tono: "ok" });
                  }}
                  className="boton-secundario px-3 py-1.5 text-xs"
                  title="Restablecer los datos semilla"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden /> Reiniciar
                </button>
              </>
            ) : (
              <button type="button" onClick={() => void cerrarSesion()} className="boton-secundario px-3 py-1.5 text-xs lg:hidden">
                <LogOut className="h-4 w-4" aria-hidden /> Salir
              </button>
            )}
          </div>
        </div>
      </header>

      {modoDemo && (
        <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6">
          <p className="flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-2.5 text-xs text-amber-900 ring-1 ring-inset ring-amber-200">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              <strong>Modo demostración</strong> · Datos ficticios en memoria. Está viendo el sistema como{" "}
              <strong>{usuario.nombre}</strong> ({ROL_ETIQUETA[rol]}). Cambie el rol arriba, abra un legajo y presione{" "}
              <em>«JSON recibido»</em> para comprobar que los datos sensibles no viajan al navegador.
            </span>
          </p>
        </div>
      )}

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
        {vista === "informes" && tienePermiso(rol, "GENERAR_INFORMES") ? (
          <InformesPanel cargar={cargarInforme} emisor={`${usuario.nombre} (${ROL_ETIQUETA[rol]})`} onVerLegajo={setDniAbierto} onError={esErrorDeSesion} />
        ) : (
        <>
        <MetricCards metricas={metricas} onFiltroRapido={aplicarFiltroRapido} />

        <details className="tarjeta group">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-slate-700">
            <ShieldCheck className="h-4 w-4 text-institucional-600" aria-hidden />
            Permisos de su rol: {ROL_ETIQUETA[rol]}
            <span className="ml-auto text-xs text-slate-400 group-open:hidden">Ver matriz</span>
          </summary>
          <div className="grid gap-2 border-t border-slate-100 px-4 py-3 sm:grid-cols-2 lg:grid-cols-3">
            {MATRIZ_PERMISOS.map(({ modulo, acceso }) => {
              const [nivel, texto] = acceso[rol];
              return (
                <div key={modulo} className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2">
                  <span className="text-xs text-slate-700">{modulo}</span>
                  <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${COLOR_ACCESO[nivel]}`}>
                    {texto}
                  </span>
                </div>
              );
            })}
          </div>
        </details>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[16rem] flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por DNI o apellido…"
                aria-label="Buscar estudiante por DNI o apellido"
                className="campo-pildora pl-10"
              />
            </div>
            <select
              value={anio ?? ""}
              onChange={(e) => setAnio(e.target.value ? Number(e.target.value) : undefined)}
              className="campo-pildora w-auto"
              aria-label="Filtrar por año"
            >
              <option value="">Todos los años</option>
              {[1, 2, 3, 4, 5].map((a) => (
                <option key={a} value={a}>
                  {a}° año
                </option>
              ))}
            </select>
            <select value={division} onChange={(e) => setDivision(e.target.value)} className="campo-pildora w-auto" aria-label="Filtrar por división">
              <option value="">Todas las divisiones</option>
              {["1", "2", "3", "4", "5"].map((d) => (
                <option key={d} value={d}>
                  {d}° división
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">Filtros:</span>
            {puedeVerConvivencia && (
              <Chip activo={alertaPuntos} onClick={() => setAlertaPuntos((v) => !v)}>
                Puntos de convivencia &lt; 10
              </Chip>
            )}
            <Chip activo={conCud} onClick={() => setConCud((v) => !v)}>
              Posee CUD
            </Chip>
            <Chip activo={promedioBajo} onClick={() => setPromedioBajo((v) => !v)}>
              Promedio bajo (&lt; 6)
            </Chip>
          </div>

          {errorLista ? (
            <p className="rounded-2xl bg-red-50 px-4 py-2.5 text-sm text-red-700 ring-1 ring-inset ring-red-200">{errorLista}</p>
          ) : (
            <StudentTable
              estudiantes={estudiantes}
              total={total}
              cargando={cargandoLista}
              mostrarPuntos={puedeVerConvivencia}
              onVerLegajo={setDniAbierto}
              onCargarMas={() => void cargarMas()}
            />
          )}
        </section>
        </>
        )}

        <footer className="pb-4 text-center text-xs text-slate-400">
          Datos personales de menores protegidos por la Ley 25.326 y la Ley 26.061 · Cada consulta de legajo queda registrada
          en auditoría · Cierre automático de sesión tras 10 minutos de inactividad
        </footer>
      </main>

      <LegajoDetalle
        abierto={dniAbierto !== null}
        legajo={legajo}
        cargando={cargandoLegajo}
        error={errorLegajo}
        modoDemo={modoDemo}
        selectorRol={modoDemo ? <RoleSimulator rol={rolDemo} onCambiar={cambiarRolDemo} compacto /> : undefined}
        incidenteEnProceso={incidenteEnProceso}
        onCerrar={cerrarLegajo}
        onCargarIncidente={() => setModalIncidente(true)}
        onResolverIncidente={(id, accion) => void resolverIncidente(id, accion)}
        onGenerarInforme={() => setModalInforme(true)}
        onNuevaIntervencion={() => setModalIntervencion(true)}
        onEditarConfidencial={() => setModalConfidencial(true)}
      />
      <IntervencionModal
        abierto={modalIntervencion}
        estudiante={estudianteAbierto}
        onCerrar={() => setModalIntervencion(false)}
        onGuardar={guardarIntervencion}
      />
      <ConfidencialModal
        abierto={modalConfidencial}
        legajo={legajo}
        onCerrar={() => setModalConfidencial(false)}
        onGuardar={guardarConfidencial}
      />
      <InformeLegajoModal
        abierto={modalInforme}
        legajo={legajo}
        emisor={`${usuario.nombre} (${ROL_ETIQUETA[rol]})`}
        onCerrar={() => setModalInforme(false)}
        onRegistrar={registrarInformeIndividual}
      />
      <IncidenteModal
        abierto={modalIncidente}
        rol={rol}
        estudiante={estudianteAbierto}
        onCerrar={() => setModalIncidente(false)}
        onGuardar={guardarIncidente}
      />
      <ImportGeiModal abierto={modalImportar} modoDemo={modoDemo} onCerrar={() => setModalImportar(false)} onImportar={importarGei} />
      <AuditoriaPanel abierto={modalAuditoria} onCerrar={() => setModalAuditoria(false)} cargar={cargarAuditoria} />

      {aviso && (
        <div
          role="status"
          className={`fixed bottom-4 left-1/2 z-[70] -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg ${
            aviso.tono === "ok" ? "bg-slate-900 text-white" : "bg-red-600 text-white"
          }`}
        >
          {aviso.texto}
        </div>
      )}
    </div>
  );
}
