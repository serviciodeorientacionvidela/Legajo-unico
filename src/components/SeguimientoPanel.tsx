"use client";
import { useEffect, useState } from "react";
import { solicitar } from "@/lib/dataSource";
import { cicloLectivoActual } from "@/lib/ciclo";
import { REPORTES, diaLocal, diasHastaFecha } from "@/lib/seguimiento/reglas";
import type { DatosBandeja, ReporteDatos } from "@/lib/seguimiento/tipos";
import type { Rol } from "@/lib/types";
import SeguimientoLegajo, {
  Campo,
  inputLue,
  botonLue,
} from "./SeguimientoLegajo";
import { MensajeError } from "./ui";
import { DocumentoInforme, ZonaImpresion, useImpresion } from "./Imprimible";

type PerfilFila = {
  id: string;
  nombre: string;
  rol: string;
  perfilSeguimiento: {
    funcion: string;
    cursos: { anio: number; division: string; turno: string }[];
  } | null;
};
export default function SeguimientoPanel({
  modoDemo,
  rol,
  administrador,
}: {
  modoDemo: boolean;
  rol: Rol;
  administrador: boolean;
}) {
  const { imprimiendo, imprimir } = useImpresion();
  const [tab, setTab] = useState("bandeja");
  const [bandeja, setBandeja] = useState<DatosBandeja | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [dni, setDni] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [numero, setNumero] = useState(4);
  const [ciclo, setCiclo] = useState(cicloLectivoActual());
  const [curso, setCurso] = useState("");
  const [estado, setEstado] = useState("");
  const [reporte, setReporte] = useState<ReporteDatos | null>(null);
  const [perfiles, setPerfiles] = useState<PerfilFila[]>([]);
  const [guardando, setGuardando] = useState(false);
  async function request<T>(query: string, init?: RequestInit): Promise<T> {
    if (modoDemo) {
      const { solicitarSeguimientoDemo } =
        await import("@/lib/seguimiento/demo");
      return solicitarSeguimientoDemo<T>(query, init, rol);
    }
    return solicitar<T>(`/api/seguimiento${query}`, init);
  }
  async function cargar() {
    setError(null);
    setCargando(true);
    try {
      setBandeja(await request<DatosBandeja>(""));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }
  useEffect(() => {
    setBandeja(null);
    setReporte(null);
    setDni("");
    void cargar();
    const q = new URLSearchParams(window.location.search).get("seguimiento");
    if (q && /^\d{7,8}$/.test(q)) setDni(q);
  }, [rol, modoDemo]); // eslint-disable-line react-hooks/exhaustive-deps
  async function generar() {
    setError(null);
    setCargando(true);
    setReporte(null);
    try {
      setReporte(
        await request<ReporteDatos>(
          `?reporte=${numero}&ciclo=${ciclo}&curso=${encodeURIComponent(curso)}&estado=${estado}`,
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }
  async function excel() {
    if (!reporte) return;
    const XLSX = await import("xlsx");
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      libro,
      XLSX.utils.json_to_sheet(reporte.filas),
      "Reporte LUE",
    );
    XLSX.writeFile(libro, `LUE-reporte-${numero}-${ciclo}.xlsx`);
  }
  async function cargarPerfiles() {
    setTab("perfiles");
    setError(null);
    try {
      setPerfiles(await request<PerfilFila[]>("?perfiles=1"));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const cursos = [
    ...new Set(
      bandeja?.estudiantes.map(
        (e) => `${e.anio}° ${e.division} · ${e.turno}`,
      ) ?? [],
    ),
  ];
  const es =
    bandeja?.estudiantes.filter(
      (e) =>
        `${e.nombre} ${e.dni}`
          .toLocaleLowerCase()
          .includes(busqueda.toLocaleLowerCase()) &&
        (filtro === "todos" ||
          (filtro === "abiertos" && e.abierto) ||
          (filtro === "derivaciones" && e.pendientes > 0) ||
          (filtro === "vencidos" &&
            e.seguimientos.some(
              (s) => diasHastaFecha(s.fechaProgramada) < 0,
            )) ||
          (filtro === "alertas" &&
            ((e.inasistencias ?? 0) >= 10 || e.ice <= 0))),
    ) ?? [];
  return (
    <div className="space-y-5">
      <header className="rounded-2xl bg-institucional-950 p-5 text-white">
        <h2 className="text-xl font-bold">Seguimiento de trayectorias</h2>
        <p className="mt-1 text-sm text-institucional-100">
          Legajos relevantes, circuito de comunicación y reportes
          institucionales.
        </p>
        {modoDemo && (
          <p className="mt-2 text-xs">
            Demostración · datos ficticios · cambios solo en memoria
          </p>
        )}
      </header>
      <nav className="flex flex-wrap gap-2 print:hidden">
        {(
          [
            ["bandeja", "Bandeja y alertas"],
            ["reportes", "12 reportes"],
            ["procedimiento", "Procedimiento de apertura"],
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            onClick={() => {
              setTab(v);
              setDni("");
            }}
            className={
              tab === v
                ? botonLue
                : "rounded-full border bg-white px-4 py-2 text-sm"
            }
          >
            {l}
          </button>
        ))}
        {administrador && (
          <button
            onClick={cargarPerfiles}
            className={
              tab === "perfiles"
                ? botonLue
                : "rounded-full border bg-white px-4 py-2 text-sm"
            }
          >
            Perfiles y cursos
          </button>
        )}
      </nav>
      {error && <MensajeError mensaje={error} />}{" "}
      {cargando && <p role="status">Cargando…</p>}
      {tab === "bandeja" && (
        <>
          {dni ? (
            <>
              <button
                onClick={() => {
                  setDni("");
                  void cargar();
                }}
                className="text-sm underline print:hidden"
              >
                ← Volver a la bandeja
              </button>
              <SeguimientoLegajo
                key={`${dni}-${rol}`}
                dni={dni}
                modoDemo={modoDemo}
                rol={rol}
              />
            </>
          ) : (
            <>
              {bandeja && (
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    [
                      "Legajos abiertos",
                      bandeja.estudiantes.filter((e) => e.abierto).length,
                    ],
                    [
                      "Derivaciones por atender",
                      bandeja.estudiantes.reduce((n, e) => n + e.pendientes, 0),
                    ],
                    [
                      "Seguimientos vencidos",
                      bandeja.estudiantes.reduce(
                        (n, e) =>
                          n +
                          e.seguimientos.filter(
                            (s) => diasHastaFecha(s.fechaProgramada) < 0,
                          ).length,
                        0,
                      ),
                    ],
                  ].map(([l, n]) => (
                    <div
                      key={String(l)}
                      className="rounded-xl border bg-white p-4"
                    >
                      <p className="text-xs text-slate-500">{l}</p>
                      <p className="text-3xl font-bold text-institucional-900">
                        {n}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {!!bandeja?.avisos.length && (
                <section className="rounded-xl border bg-white p-4">
                  <h3 className="font-bold">Avisos personales</h3>
                  {bandeja.avisos.map((a) => (
                    <div
                      key={a.id}
                      className="flex flex-wrap items-center justify-between gap-2 border-b py-3 text-sm"
                    >
                      <div>
                        <p className="font-semibold">{a.titulo}</p>
                        <p>{a.mensaje}</p>
                      </div>
                      <div className="flex gap-3">
                        <button
                          className="underline"
                          onClick={() => {
                            const d = a.enlace
                              ? new URL(
                                  a.enlace,
                                  window.location.origin,
                                ).searchParams.get("seguimiento")
                              : null;
                            if (d) setDni(d);
                          }}
                        >
                          Abrir
                        </button>
                        <button
                          className="underline"
                          onClick={async () => {
                            try {
                              await request("", {
                                method: "POST",
                                body: JSON.stringify({
                                  accion: "LEER_AVISO",
                                  datos: { id: a.id },
                                }),
                              });
                              await cargar();
                            } catch (e) {
                              setError((e as Error).message);
                            }
                          }}
                        >
                          Marcar leído
                        </button>
                      </div>
                    </div>
                  ))}
                </section>
              )}
              <div className="flex flex-wrap gap-3">
                <input
                  aria-label="Buscar estudiante o DNI"
                  placeholder="Buscar estudiante o DNI…"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className={`${inputLue} sm:max-w-sm`}
                />
                <select
                  aria-label="Filtrar bandeja"
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  className={`${inputLue} sm:max-w-xs`}
                >
                  {[
                    ["todos", "Todos los estudiantes"],
                    ["abiertos", "Legajos abiertos"],
                    ["derivaciones", "Derivaciones pendientes"],
                    ["vencidos", "Seguimientos vencidos"],
                    ["alertas", "Alertas de faltas / ICE"],
                  ].map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
                <button className="text-sm underline" onClick={cargar}>
                  Actualizar
                </button>
              </div>
              <div className="overflow-x-auto rounded-xl border bg-white">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {[
                        "Estudiante",
                        "Curso",
                        "Legajo",
                        "Avisos",
                        "Acceso",
                      ].map((t) => (
                        <th key={t} className="p-3">
                          {t}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {es.map((e) => (
                      <tr key={e.id} className="border-t">
                        <td className="p-3 font-medium">
                          {e.nombre}
                          <span className="block text-xs text-slate-500">
                            DNI {e.dni}
                          </span>
                        </td>
                        <td className="p-3">
                          {e.anio}° {e.division} · {e.turno}
                        </td>
                        <td className="p-3">
                          {e.abierto ? "Abierto" : "Sin abrir"}
                          {e.estadoMatricula !== "REGULAR" &&
                            ` · ${e.estadoMatricula}`}
                        </td>
                        <td className="p-3">
                          {e.inasistencias !== null && e.inasistencias >= 10 ? (
                            <span className="block text-amber-800">
                              {e.inasistencias} faltas ·{" "}
                              {e.inasistencias >= 20
                                ? "Revisar apertura / condicionalidad"
                                : e.inasistencias >= 15
                                  ? "Avisar a orientación social"
                                  : "Citar a familia"}
                            </span>
                          ) : null}
                          {e.ice <= 0 && (
                            <span className="block text-red-700">
                              ICE en cero · Consejo de Convivencia
                            </span>
                          )}
                          {e.pendientes > 0 && (
                            <span className="block">
                              {e.pendientes} derivaciones
                            </span>
                          )}
                          {e.seguimientos.some(
                            (s) => diasHastaFecha(s.fechaProgramada) < 0,
                          ) && (
                            <span className="block text-red-700">
                              Seguimiento vencido
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <button
                            className="font-semibold text-institucional-700 underline"
                            onClick={() => setDni(e.dni)}
                          >
                            Abrir ficha
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!es.length && !cargando && (
                  <p className="p-5 text-sm text-slate-500">
                    No hay estudiantes para este filtro.
                  </p>
                )}
              </div>
            </>
          )}
        </>
      )}
      {tab === "reportes" && (
        <section className="space-y-4 rounded-xl border bg-white p-5">
          <h3 className="font-bold">Reportes institucionales</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
            <Campo label="Reporte">
              <select
                className={inputLue}
                value={numero}
                onChange={(e) => {
                  setNumero(Number(e.target.value));
                  setReporte(null);
                }}
              >
                {REPORTES.map((r, i) => ({ r, n: i + 1 }))
                  .filter((r) => rol !== "PRECEPTOR" || r.n === 4)
                  .filter((r) => r.n !== 9 || bandeja?.perfil === "DIRECCION")
                  .map((r) => (
                    <option key={r.n} value={r.n}>
                      {r.n} · {r.r}
                    </option>
                  ))}
              </select>
            </Campo>
            <Campo label="Ciclo">
              <input
                type="number"
                min={2000}
                max={2100}
                className={inputLue}
                value={ciclo}
                onChange={(e) => {
                  setCiclo(Number(e.target.value));
                  setReporte(null);
                }}
              />
            </Campo>
            <Campo label="Curso">
              <select
                className={inputLue}
                value={curso}
                onChange={(e) => {
                  setCurso(e.target.value);
                  setReporte(null);
                }}
              >
                <option value="">Todos</option>
                {cursos.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Campo>
            <Campo label="Estado">
              <select
                className={inputLue}
                value={estado}
                onChange={(e) => {
                  setEstado(e.target.value);
                  setReporte(null);
                }}
              >
                <option value="">Todos</option>
                {[
                  "PENDIENTE",
                  "VIGENTE",
                  "POR_VENCER",
                  "VENCIDA",
                  "CUMPLIDA",
                  "DENEGADA",
                  "DADA_DE_BAJA",
                  "PASE",
                  "ABANDONO",
                  "REGULAR",
                ].map((e) => (
                  <option key={e}>{e}</option>
                ))}
              </select>
            </Campo>
          </div>
          <div className="flex gap-3 print:hidden">
            <button className={botonLue} disabled={cargando} onClick={generar}>
              Consultar reporte
            </button>
            {reporte && (
              <>
                <button className="text-sm underline" onClick={excel}>
                  Exportar Excel
                </button>
                <button
                  className="text-sm underline"
                  onClick={() => imprimir(`LUE-reporte-${numero}-${ciclo}`)}
                >
                  Imprimir / PDF
                </button>
              </>
            )}
          </div>
          {reporte && (
            <>
              <h4 className="font-semibold">
                {reporte.titulo} · Ciclo {reporte.ciclo}
              </h4>
              {reporte.restringido && (
                <p className="rounded bg-amber-50 p-3 text-sm">
                  Reporte restringido: identificación por iniciales y número de
                  legajo. Consulta registrada en auditoría.
                </p>
              )}
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead>
                    <tr>
                      {[
                        ...new Set(
                          reporte.filas.flatMap((f) => Object.keys(f)),
                        ),
                      ].map((k) => (
                        <th className="border-b p-2" key={k}>
                          {k}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reporte.filas.map((f, i) => (
                      <tr key={i}>
                        {[
                          ...new Set(
                            reporte.filas.flatMap((f) => Object.keys(f)),
                          ),
                        ].map((k) => (
                          <td className="border-b p-2" key={k}>
                            {f[k] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!reporte.filas.length && (
                <p className="text-sm">
                  Sin registros para los filtros elegidos.
                </p>
              )}
            </>
          )}
        </section>
      )}
      {tab === "procedimiento" && (
        <section className="space-y-4 rounded-xl border bg-white p-5 text-sm">
          <h3 className="text-lg font-bold">
            Apertura, comunicación y conservación
          </h3>
          <ol className="list-decimal space-y-3 pl-5">
            <li>
              Identificar una causa relevante: 20 faltas anuales, ICE en cero,
              falta grave, protocolo, derivación al SOE, PPI, escolaridad
              protegida, federado o situación particular.
            </li>
            <li>
              Buscar al estudiante por DNI y revisar el historial de ciclos
              anteriores.
            </li>
            <li>
              Registrar la primera actuación con fecha, motivo, resumen, acta,
              causa de apertura y primer seguimiento. Se conserva una foto del
              rendimiento y de la trayectoria importada.
            </li>
            <li>
              El SOE o dirección anexa las fichas de salud y psicosocial.
              Registrar apoyos y acciones institucionales, sin diagnósticos
              clínicos.
            </li>
            <li>
              La derivación contiene una parte A de quien deriva, una respuesta
              B del SOE y los seguimientos C. La respuesta vuelve a quien
              derivó.
            </li>
            <li>
              Revisar los estados en diciembre. Cerrar o dar de baja cada
              escolaridad vencida y resolver los seguimientos. El historial no
              se reinicia; los pases y egresos se conservan para consulta.
            </li>
          </ol>
          <p>
            10 faltas: citar a la familia. 15: aviso al SOE como propuesta
            institucional. 20: apertura y revisión de condicionalidad; las
            extensiones otorgadas requieren aval de Supervisión.
          </p>
          <p>
            Los correos institucionales contienen solo un enlace; los avisos se
            generan dos días antes, al vencer y se reiteran diariamente hasta
            registrar el resultado.
          </p>
          <details>
            <summary className="cursor-pointer font-bold">
              Puntos que la escuela debe validar (sección 11)
            </summary>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              {[
                "Alerta propuesta a las 15 faltas.",
                "Contenido definitivo de las fichas y prohibición de diagnósticos.",
                "Derivación y actuación: formularios separados vinculados en esta implementación.",
                "Fundamento de condicionalidad por convivencia.",
                "Significado de permanecedor: no inferir repitencia sin datos.",
                "Cobertura anual de las asistencias; no sumar períodos incompletos como total oficial.",
                "Validez del índice digital del libro de actas.",
                "Quién puede anular actuaciones (la función queda deshabilitada hasta su validación).",
                "Conservación y archivo: no hay borrado automático.",
                "Número del protocolo de amenazas e intimidación.",
                "Normativa y circuito escolar de cambio de género.",
              ].map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </details>
        </section>
      )}
      {tab === "perfiles" && (
        <section className="space-y-4 rounded-xl border bg-white p-5">
          <h3 className="font-bold">
            Funciones institucionales y cursos asignados
          </h3>
          <p className="text-sm text-slate-600">
            Asigne dirección y SOE explícitamente. Preceptoría solo podrá
            acceder a los cursos y turnos autorizados. Use los nombres de
            división y turno tal como figuran en el GEI.
          </p>
          {perfiles.map((p) => (
            <form
              key={p.id}
              className="space-y-3 rounded-lg border p-4"
              onSubmit={async (ev) => {
                ev.preventDefault();
                setError(null);
                setGuardando(true);
                try {
                  const f = new FormData(ev.currentTarget);
                  const cursos = String(f.get("cursos") ?? "")
                    .split("\n")
                    .filter((v) => v.trim())
                    .map((v) => {
                      const [anio, division, turno] = v
                        .split("|")
                        .map((x) => x.trim());
                      return { anio: Number(anio), division, turno };
                    });
                  await request("", {
                    method: "POST",
                    body: JSON.stringify({
                      accion: "PERFIL",
                      datos: {
                        usuarioId: p.id,
                        funcion: f.get("funcion"),
                        cursos,
                      },
                    }),
                  });
                  await cargarPerfiles();
                  await cargar();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setGuardando(false);
                }
              }}
            >
              <p className="font-semibold">
                {p.nombre} · {p.rol}
              </p>
              <Campo label="Función">
                <select
                  name="funcion"
                  className={inputLue}
                  defaultValue={
                    p.perfilSeguimiento?.funcion ??
                    (p.rol === "PRECEPTOR" ? "PRECEPTORIA" : "SOE")
                  }
                >
                  {(p.rol === "PRECEPTOR"
                    ? ["PRECEPTORIA"]
                    : ["SOE", "DIRECCION", "PRECEPTORIA"]
                  ).map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </Campo>
              <Campo label="Cursos: un curso por línea, formato año | división | turno">
                <textarea
                  name="cursos"
                  className={inputLue}
                  placeholder="3 | 1 | Mañana"
                  defaultValue={
                    p.perfilSeguimiento?.cursos
                      .map((c) => `${c.anio} | ${c.division} | ${c.turno}`)
                      .join("\n") ?? ""
                  }
                />
              </Campo>
              <button className={botonLue} disabled={guardando}>
                Guardar permisos
              </button>
            </form>
          ))}
        </section>
      )}
      {imprimiendo && reporte && (
        <ZonaImpresion>
          <DocumentoInforme
            titulo={reporte.titulo}
            subtitulo={`Ciclo ${reporte.ciclo} ? ${curso || "Todos los cursos"}`}
            generadoPor={bandeja?.perfil ?? rol}
            confidencial={reporte.restringido}
          >
            <table className="tabla-informe">
              <thead>
                <tr>
                  {[
                    ...new Set(reporte.filas.flatMap((f) => Object.keys(f))),
                  ].map((k) => (
                    <th key={k}>{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reporte.filas.map((f, i) => (
                  <tr key={i}>
                    {[
                      ...new Set(reporte.filas.flatMap((f) => Object.keys(f))),
                    ].map((k) => (
                      <td key={k}>{f[k] ?? ""}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </DocumentoInforme>
        </ZonaImpresion>
      )}
    </div>
  );
}
