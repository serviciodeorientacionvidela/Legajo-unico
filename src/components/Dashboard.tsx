"use client";

import {
  ClipboardList,
  FileSpreadsheet,
  GraduationCap,
  Info,
  Loader2,
  LogOut,
  RotateCcw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  crearFuenteApi,
  crearFuenteDemo,
  ErrorFuenteDatos,
  reiniciarDemo,
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
import ImportGeiModal from "./ImportGeiModal";
import IncidenteModal from "./IncidenteModal";
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

const CLASE_SELECT =
  "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-institucional-500 focus:outline-none focus:ring-1 focus:ring-institucional-500";

function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition ${
        activo ? "bg-institucional-600 text-white ring-institucional-600" : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50"
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
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
        <div className="w-full max-w-sm rounded-xl bg-white p-8 text-center shadow">
          <ShieldCheck className="mx-auto h-10 w-10 text-institucional-600" aria-hidden />
          <h1 className="mt-3 text-lg font-semibold text-slate-900">Sesión cerrada por inactividad</h1>
          <p className="mt-2 text-sm text-slate-600">
            Pasaron 10 minutos sin actividad. Se ocultaron todos los datos de estudiantes de la pantalla.
          </p>
          <button
            type="button"
            onClick={() => setSesionCerrada(false)}
            className="mt-6 w-full rounded-lg bg-institucional-600 px-4 py-2 text-sm font-medium text-white hover:bg-institucional-700"
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

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-institucional-600 p-2 text-white">
              <GraduationCap className="h-6 w-6" aria-hidden />
            </span>
            <div>
              <h1 className="text-base font-semibold leading-tight text-slate-900">Legajo Único del Estudiante</h1>
              <p className="text-xs text-slate-500">Escuela Secundaria · Mendoza · Ciclo lectivo 2026</p>
            </div>
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
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
                  title="Restablecer los datos semilla"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden /> Reiniciar
                </button>
              </>
            ) : (
              <>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-900">{usuario.nombre}</p>
                  <p className="text-xs text-slate-500">{ROL_ETIQUETA[usuario.rol]}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void cerrarSesion()}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-slate-600 ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
                >
                  <LogOut className="h-4 w-4" aria-hidden /> Salir
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {modoDemo && (
        <div className="border-b border-amber-200 bg-amber-50">
          <p className="mx-auto flex max-w-7xl items-start gap-2 px-4 py-2 text-xs text-amber-900 sm:px-6">
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
        <MetricCards metricas={metricas} onFiltroRapido={aplicarFiltroRapido} />

        <details className="group rounded-xl border border-slate-200 bg-white shadow-sm">
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
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por DNI o apellido…"
                aria-label="Buscar estudiante por DNI o apellido"
                className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm shadow-sm focus:border-institucional-500 focus:outline-none focus:ring-1 focus:ring-institucional-500"
              />
            </div>
            <select
              value={anio ?? ""}
              onChange={(e) => setAnio(e.target.value ? Number(e.target.value) : undefined)}
              className={CLASE_SELECT}
              aria-label="Filtrar por año"
            >
              <option value="">Todos los años</option>
              {[1, 2, 3, 4, 5].map((a) => (
                <option key={a} value={a}>
                  {a}° año
                </option>
              ))}
            </select>
            <select value={division} onChange={(e) => setDivision(e.target.value)} className={CLASE_SELECT} aria-label="Filtrar por división">
              <option value="">Todas las divisiones</option>
              {["1", "2", "3", "4"].map((d) => (
                <option key={d} value={d}>
                  {d}° división
                </option>
              ))}
            </select>
            {tienePermiso(rol, "IMPORTAR_GEI") && (
              <button
                type="button"
                onClick={() => setModalImportar(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
              >
                <FileSpreadsheet className="h-4 w-4" aria-hidden /> Importar GEI
              </button>
            )}
            {tienePermiso(rol, "VER_AUDITORIA") && (
              <button
                type="button"
                onClick={() => setModalAuditoria(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
              >
                <ClipboardList className="h-4 w-4" aria-hidden /> Auditoría
              </button>
            )}
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
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200">{errorLista}</p>
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
