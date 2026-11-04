"use client";
import {
  useEffect,
  useState,
  useId,
  cloneElement,
  isValidElement,
  type ReactElement,
  type FormEvent,
  type ReactNode,
} from "react";
import { solicitar } from "@/lib/dataSource";
import type { DatosSeguimiento } from "@/lib/seguimiento/tipos";
import {
  CAMPOS_SITUACION,
  diaLocal,
  diasHastaFecha,
} from "@/lib/seguimiento/reglas";
import {
  type Rol,
  TIPOS_ACTUACION,
  TIPO_ACTUACION_ETIQUETA,
  MOTIVOS_APERTURA,
  MOTIVO_APERTURA_ETIQUETA,
  TIPOS_ACTA,
  TIPOS_SITUACION,
  TIPO_SITUACION_ETIQUETA,
  ESTADOS_SITUACION,
  DESTINOS_DERIVACION,
  DESTINO_DERIVACION_ETIQUETA,
} from "@/lib/types";
import { MensajeError } from "./ui";
import { DocumentoInforme, ZonaImpresion, useImpresion } from "./Imprimible";

export function Campo({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="block text-sm font-medium text-slate-700">
      <span id={`${id}-label`} className="mb-1 block">
        {label}
      </span>
      {isValidElement(children)
        ? cloneElement(
            children as ReactElement<{
              id?: string;
              "aria-labelledby"?: string;
            }>,
            { id, "aria-labelledby": `${id}-label` },
          )
        : children}
    </label>
  );
}
export const inputLue =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";
export const botonLue =
  "rounded-full bg-institucional-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const fecha = (v: string | Date | null | undefined) =>
  v ? new Date(v).toLocaleDateString("es-AR", { timeZone: "UTC" }) : "—";
function texto(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

function FotoTrayectoria({ datos }: { datos: unknown }) {
  if (!datos || typeof datos !== "object" || Array.isArray(datos)) return null;
  const foto = datos as {
    anio?: number;
    division?: string;
    turno?: string;
    ciclos?: {
      cicloLectivo: number;
      escuela: string;
      division: string | null;
      condicion: string | null;
      motivoEgreso: string | null;
    }[];
  };
  return (
    <div className="overflow-x-auto">
      <p className="mb-2">
        Curso al abrir: {foto.anio}° {foto.division} · Turno: {foto.turno}
      </p>
      <table className="min-w-full text-left text-xs">
        <thead>
          <tr>
            {["Ciclo", "Escuela", "Curso", "Condición", "Resultado"].map(
              (t) => (
                <th key={t} className="border-b p-2">
                  {t}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {foto.ciclos?.map((c, i) => (
            <tr key={i}>
              <td className="p-2">{c.cicloLectivo}</td>
              <td className="p-2">{c.escuela}</td>
              <td className="p-2">{c.division}</td>
              <td className="p-2">{c.condicion}</td>
              <td className="p-2">{c.motivoEgreso}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export default function SeguimientoLegajo({
  dni,
  modoDemo = false,
  rol = "DIRECTIVO_SOE",
}: {
  dni: string;
  modoDemo?: boolean;
  rol?: Rol;
}) {
  const { imprimiendo, imprimir } = useImpresion();
  const [datos, setDatos] = useState<DatosSeguimiento | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [formulario, setFormulario] = useState("");
  const [id, setId] = useState("");
  const [tipoSituacion, setTipoSituacion] = useState<
    (typeof TIPOS_SITUACION)[number]
  >("ESCOLARIDAD_PROTEGIDA");
  const [ficha, setFicha] = useState<Record<string, string>>({});
  async function request<T>(query: string, init?: RequestInit): Promise<T> {
    if (modoDemo) {
      const { solicitarSeguimientoDemo } =
        await import("@/lib/seguimiento/demo");
      return solicitarSeguimientoDemo<T>(query, init, rol);
    }
    return solicitar<T>(`/api/seguimiento${query}`, init);
  }
  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      setDatos(await request<DatosSeguimiento>(`?dni=${dni}`));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }
  useEffect(() => {
    let activa = true;
    setDatos(null);
    setError(null);
    setFormulario("");
    setCargando(true);
    request<DatosSeguimiento>(`?dni=${dni}`)
      .then((d) => {
        if (activa) setDatos(d);
      })
      .catch((e) => {
        if (activa) setError(e.message);
      })
      .finally(() => {
        if (activa) setCargando(false);
      });
    return () => {
      activa = false;
    };
  }, [dni, modoDemo, rol]); // eslint-disable-line react-hooks/exhaustive-deps
  function abrir(tipo: string, identificador = "") {
    setFormulario(tipo);
    setId(identificador);
    setError(null);
    setMensaje("");
  }
  async function verFicha(tipo: string) {
    try {
      setError(null);
      const f = await request<{ datos: Record<string, string> } | null>(
        `?dni=${dni}&ficha=${tipo}`,
      );
      setFicha(f?.datos ?? {});
      abrir("FICHA", tipo);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function guardar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!editable) return;
    const f = new FormData(ev.currentTarget);
    let payload: Record<string, unknown> = {};
    if (formulario === "ACTUACION")
      payload = {
        tipo: texto(f, "tipo"),
        fecha: texto(f, "fecha"),
        motivo: texto(f, "motivo"),
        resumen: texto(f, "resumen"),
        tipoActa: texto(f, "tipoActa"),
        actaLibro: texto(f, "actaLibro"),
        actaFolio: texto(f, "actaFolio"),
        confidencial: f.has("confidencial"),
        condicional: f.has("condicional"),
        puntosIce: Number(texto(f, "puntosIce")),
        descargo: texto(f, "descargo"),
        resolucion: texto(f, "resolucion"),
        ...(texto(f, "motivoApertura")
          ? { motivoApertura: texto(f, "motivoApertura") }
          : {}),
        ...(texto(f, "seguimientoFecha")
          ? {
              seguimientoFecha: texto(f, "seguimientoFecha"),
              responsableId: texto(f, "responsableId"),
            }
          : {}),
      };
    if (formulario === "DERIVACION")
      payload = { fecha: texto(f, "fecha"), motivo: texto(f, "motivo") };
    if (formulario === "RESPUESTA")
      payload = {
        id,
        accionesSoe: texto(f, "accionesSoe"),
        respuesta: texto(f, "respuesta"),
        destino: texto(f, "destino"),
        organismoExterno: texto(f, "organismoExterno"),
        estado: texto(f, "estado"),
      };
    if (formulario === "SEGUIMIENTO")
      payload = {
        fechaProgramada: texto(f, "fechaProgramada"),
        descripcion: texto(f, "descripcion"),
        responsableId: texto(f, "responsableId"),
        avisoCorreo: f.has("avisoCorreo"),
        ...(texto(f, "derivacionId")
          ? { derivacionId: texto(f, "derivacionId") }
          : {}),
        ...(texto(f, "situacionId")
          ? { situacionId: texto(f, "situacionId") }
          : {}),
      };
    if (formulario === "RESOLVER_SEGUIMIENTO")
      payload = {
        id,
        estado: texto(f, "estado"),
        resultado: texto(f, "resultado"),
      };
    if (formulario === "ANULAR") payload = { id, motivo: texto(f, "motivo") };
    if (formulario === "SITUACION")
      payload = {
        ...(id ? { id } : {}),
        tipo: tipoSituacion,
        forma: texto(f, "forma"),
        aval: texto(f, "aval"),
        estado: texto(f, "estado"),
        fechaInicio: texto(f, "fechaInicio"),
        ...(texto(f, "fechaVencimiento")
          ? { fechaVencimiento: texto(f, "fechaVencimiento") }
          : {}),
        observaciones: texto(f, "observaciones"),
        detalle: Object.fromEntries(
          (CAMPOS_SITUACION[tipoSituacion] ?? []).map((k) => [
            k,
            texto(f, `detalle:${k}`),
          ]),
        ),
      };
    if (formulario === "FICHA")
      payload = {
        tipo: id,
        datos: Object.fromEntries(
          [
            "apoyos",
            "acuerdos",
            "contactosInstitucionales",
            "documentacion",
          ].map((k) => [k, texto(f, k)]),
        ),
      };
    if (["DERIVACION", "SITUACION"].includes(formulario) && !e?.legajoAbiertoEl)
      payload = {
        ...payload,
        seguimientoFecha: texto(f, "seguimientoFecha"),
        responsableId: texto(f, "responsableId"),
      };
    setGuardando(true);
    setError(null);
    try {
      await request("", {
        method: "POST",
        body: JSON.stringify({ dni, accion: formulario, datos: payload }),
      });
      setFormulario("");
      setMensaje("Registro guardado y auditado.");
      await cargar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }
  const e = datos?.estudiante;
  const equipo = datos?.perfil !== "PRECEPTORIA";
  const direccion = datos?.perfil === "DIRECCION";
  const editable = e?.estadoMatricula === "REGULAR";
  const responsable = (
    <select className={inputLue} name="responsableId" required>
      <option value="">Seleccionar responsable</option>
      {datos?.responsables.map((r) => (
        <option key={r.id} value={r.id}>
          {r.nombre}
        </option>
      ))}
    </select>
  );
  const actual = datos?.situaciones.find((s) => s.id === id);
  return (
    <section
      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5"
      aria-label="Seguimiento del legajo"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-institucional-950">
            Legajo de seguimiento
          </h3>
          <p className="text-xs text-slate-500">
            Actuaciones, derivaciones y trayectoria · El acta original permanece
            en el libro de actas.
          </p>
        </div>
        <button
          className="text-sm text-institucional-700 underline print:hidden"
          onClick={async () => {
            try {
              await request("", {
                method: "POST",
                body: JSON.stringify({ dni, accion: "IMPRIMIR", datos: {} }),
              });
              imprimir(`LUE-${dni}`);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Imprimir / PDF
        </button>
      </div>
      {cargando && <p role="status">Cargando seguimiento…</p>}
      {error && <MensajeError mensaje={error} />}{" "}
      {mensaje && (
        <p
          role="status"
          className="my-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          {mensaje}
        </p>
      )}
      {datos && e && (
        <>
          <div>
            <h3 className="text-xl font-bold">
              {e.apellidos}, {e.nombres}
            </h3>
            <p className="mb-3 text-sm text-slate-600">
              DNI {dni} · {e.anio}° {e.division} · {e.turno}
            </p>
          </div>
          <div className="mb-4 rounded-xl bg-white p-4">
            <p className="font-semibold">
              {e.legajoAbiertoEl
                ? `Abierto el ${fecha(e.legajoAbiertoEl)} · ${e.motivoApertura ? MOTIVO_APERTURA_ETIQUETA[e.motivoApertura] : ""}`
                : "Sin legajo de seguimiento abierto"}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {e.legajoAbiertoEl
                ? e.detalleApertura
                : "La ficha de matrícula no implica apertura de legajo. Registre una causa relevante para iniciarlo."}
            </p>
            {!editable && (
              <p className="mt-2 font-semibold text-amber-800">
                Archivado · {e.estadoMatricula}. Historial disponible para
                consulta.
              </p>
            )}
            <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                ["Promedio", e.promedioGeneral, e.aperturaPromedio],
                [
                  "Espacios pendientes",
                  e.calificaciones.filter((c) => c.previa).length,
                  e.aperturaPendientes,
                ],
                [
                  "Inasistencias anuales",
                  datos.inasistencias ?? "Sin confirmar",
                  e.aperturaInasistencias,
                ],
                ["ICE oficial GEI", e.puntosConvivencia, e.aperturaIce],
              ].map(([label, valor, inicio]) => (
                <div key={String(label)} className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="text-xl font-bold">{valor}</p>
                  <p className="text-xs text-slate-500">
                    Al abrir: {inicio ?? "—"}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {e.tieneCud && (
                <span className="rounded-full bg-sky-50 px-3 py-1 text-xs">
                  CUD
                </span>
              )}
              {e.requierePpi && (
                <span className="rounded-full bg-sky-50 px-3 py-1 text-xs">
                  PPI
                </span>
              )}
              {datos.situaciones.map((s) => (
                <span
                  key={s.id}
                  className="rounded-full bg-amber-50 px-3 py-1 text-xs"
                >
                  {TIPO_SITUACION_ETIQUETA[s.tipo]} · {s.condicion}
                </span>
              ))}
            </div>
            {Boolean(e.aperturaTrayectoria) && (
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer font-medium">
                  Foto de trayectoria al abrir
                </summary>
                <p className="my-2">
                  Se conserva el curso, turno, nacimiento e historial de
                  escuelas importado al abrir. La sobreedad y los cambios se
                  revisan con estos antecedentes.
                </p>
                <FotoTrayectoria datos={e.aperturaTrayectoria} />
              </details>
            )}
          </div>
          {editable && (
            <nav
              className="mb-4 flex flex-wrap gap-2 print:hidden"
              aria-label="Acciones de seguimiento"
            >
              <button className={botonLue} onClick={() => abrir("ACTUACION")}>
                Nueva actuación
              </button>
              <button className={botonLue} onClick={() => abrir("DERIVACION")}>
                Derivar al SOE
              </button>
              {e.legajoAbiertoEl && (
                <button
                  className={botonLue}
                  onClick={() => abrir("SEGUIMIENTO")}
                >
                  Programar seguimiento
                </button>
              )}
              {equipo && (
                <button
                  className={botonLue}
                  onClick={() => {
                    setTipoSituacion(
                      direccion
                        ? "ESCOLARIDAD_PROTEGIDA"
                        : "DEPORTISTA_FEDERADO",
                    );
                    abrir("SITUACION");
                  }}
                >
                  Registrar situación
                </button>
              )}
            </nav>
          )}
          <details className="mb-4 rounded-xl border border-sky-100 bg-sky-50 p-3 text-sm">
            <summary className="cursor-pointer font-semibold">
              Cuándo se abre el legajo y qué alertas se emiten
            </summary>
            <p className="mt-2">
              10 faltas: citación a la familia. 15: aviso a preceptoría y
              orientación social (propuesta institucional). 20 faltas anuales
              confirmadas: apertura y revisión de condicionalidad. Una
              derivación al SOE puede iniciarse en cualquier momento.
            </p>
            <p className="mt-2">
              También corresponde abrir por ICE en cero, faltas graves,
              protocolo, escolaridad protegida, PPI, deportista federado y
              situaciones particulares. Las faltas menores a 20 y las notas
              leves aisladas permanecen en los registros de preceptoría.
            </p>
            <p className="mt-2">
              Al abrir: revisar ciclos anteriores, anexar fichas y programar
              seguimiento con responsable. Dirección registra resoluciones y
              avales; el SOE responde las derivaciones. Los avisos de
              seguimiento se generan dos días antes, al vencer y diariamente
              mientras estén pendientes.
            </p>
          </details>
          {formulario && (editable || formulario === "FICHA") && (
            <form
              key={`${formulario}-${id}`}
              onSubmit={guardar}
              className="mb-5 space-y-4 rounded-xl border border-institucional-200 bg-white p-4 print:hidden"
            >
              <div className="flex justify-between gap-2">
                <h4 className="font-bold">
                  {
                    {
                      ACTUACION: "Nueva actuación",
                      DERIVACION: "A · Quien deriva",
                      RESPUESTA: "B · Respuesta del SOE",
                      SEGUIMIENTO: "C · Programar seguimiento",
                      RESOLVER_SEGUIMIENTO: "Registrar resultado",
                      SITUACION: "Situación particular",
                      FICHA: `Ficha ${id.toLowerCase()}`,
                      ANULAR: "Anular actuación con motivo",
                    }[formulario]
                  }
                </h4>
                <button
                  type="button"
                  onClick={() => setFormulario("")}
                  className="text-sm underline"
                >
                  Cerrar
                </button>
              </div>
              {formulario === "ACTUACION" && (
                <>
                  <Campo label="Tipo de actuación">
                    <select className={inputLue} name="tipo">
                      {TIPOS_ACTUACION.filter(
                        (t) =>
                          equipo ||
                          [
                            "INASISTENCIAS",
                            "CONVIVENCIA_ICE",
                            "FAMILIA",
                            "OTRA",
                          ].includes(t),
                      ).map((t) => (
                        <option key={t} value={t}>
                          {TIPO_ACTUACION_ETIQUETA[t]}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  {!e.legajoAbiertoEl && (
                    <Campo label="Causa de apertura">
                      <select
                        className={inputLue}
                        name="motivoApertura"
                        required
                      >
                        <option value="">Seleccionar causa relevante</option>
                        {MOTIVOS_APERTURA.map((t) => (
                          <option key={t} value={t}>
                            {MOTIVO_APERTURA_ETIQUETA[t]}
                          </option>
                        ))}
                      </select>
                    </Campo>
                  )}
                  <Campo label="Resumen breve (máximo tres líneas)">
                    <textarea
                      name="resumen"
                      required
                      minLength={5}
                      maxLength={700}
                      rows={3}
                      className={inputLue}
                    />
                  </Campo>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Campo label="Acta (si corresponde)">
                      <select name="tipoActa" className={inputLue}>
                        <option value="">Sin acta</option>
                        {TIPOS_ACTA.map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </Campo>
                    <Campo label="Libro">
                      <input name="actaLibro" className={inputLue} />
                    </Campo>
                    <Campo label="Folio">
                      <input name="actaFolio" className={inputLue} />
                    </Campo>
                  </div>
                  {equipo && (
                    <label className="flex gap-2 text-sm">
                      <input type="checkbox" name="confidencial" />
                      Contenido reservado al SOE y dirección
                    </label>
                  )}
                  {direccion && (
                    <details className="rounded-lg bg-amber-50 p-3">
                      <summary>
                        Efectos: condicionalidad / resolución ICE
                      </summary>
                      <label className="my-3 flex gap-2 text-sm">
                        <input type="checkbox" name="condicional" />
                        Condicional por inasistencias (20 o más)
                      </label>
                      <Campo label="Puntos ICE de la resolución">
                        <input
                          name="puntosIce"
                          type="number"
                          min={0}
                          max={25}
                          defaultValue={0}
                          className={inputLue}
                        />
                      </Campo>
                      <Campo label="Descargo del estudiante">
                        <textarea name="descargo" className={inputLue} />
                      </Campo>
                      <Campo label="Resolución del Consejo / medida y plazos">
                        <textarea name="resolucion" className={inputLue} />
                      </Campo>
                      <p className="text-xs">
                        El saldo oficial se actualiza desde GEI; esta actuación
                        conserva la resolución y su respaldo.
                      </p>
                    </details>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Campo
                      label={
                        e.legajoAbiertoEl
                          ? "Seguimiento (opcional)"
                          : "Primer seguimiento (obligatorio)"
                      }
                    >
                      <input
                        type="date"
                        name="seguimientoFecha"
                        required={!e.legajoAbiertoEl}
                        className={inputLue}
                      />
                    </Campo>
                    <Campo label="Responsable">
                      <select
                        name="responsableId"
                        className={inputLue}
                        required={!e.legajoAbiertoEl}
                      >
                        <option value="">Seleccionar</option>
                        {datos.responsables.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.nombre}
                          </option>
                        ))}
                      </select>
                    </Campo>
                  </div>
                </>
              )}
              {["ACTUACION", "DERIVACION"].includes(formulario) && (
                <>
                  <Campo label="Fecha">
                    <input
                      type="date"
                      name="fecha"
                      required
                      defaultValue={diaLocal()}
                      max={diaLocal()}
                      className={inputLue}
                    />
                  </Campo>
                  <Campo label="Motivo">
                    <textarea
                      name="motivo"
                      required
                      minLength={5}
                      maxLength={formulario === "ACTUACION" ? 180 : 4000}
                      rows={2}
                      className={inputLue}
                    />
                  </Campo>
                  {formulario === "DERIVACION" && (
                    <p className="text-xs">
                      DNI {dni} · {e.anio}° {e.division} · La identidad de quien
                      deriva se registra automáticamente.
                    </p>
                  )}
                </>
              )}
              {formulario === "RESPUESTA" && (
                <>
                  <Campo label="Acciones realizadas por el SOE (reservado)">
                    <textarea
                      name="accionesSoe"
                      required
                      minLength={5}
                      rows={3}
                      className={inputLue}
                    />
                  </Campo>
                  <Campo label="Respuesta a quien deriva y a la familia (sin datos sensibles)">
                    <textarea
                      name="respuesta"
                      required
                      minLength={5}
                      rows={3}
                      className={inputLue}
                    />
                  </Campo>
                  <Campo label="Derivación">
                    <select name="destino" className={inputLue}>
                      {DESTINOS_DERIVACION.map((t) => (
                        <option key={t} value={t}>
                          {DESTINO_DERIVACION_ETIQUETA[t]}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <Campo label="Organismo externo (si corresponde)">
                    <input name="organismoExterno" className={inputLue} />
                  </Campo>
                  <Campo label="Estado">
                    <select name="estado" className={inputLue}>
                      <option value="EN_CURSO">En curso</option>
                      <option value="CERRADA">Cerrar derivación</option>
                    </select>
                  </Campo>
                </>
              )}
              {formulario === "SEGUIMIENTO" && (
                <>
                  <Campo label="Fecha programada">
                    <input
                      name="fechaProgramada"
                      type="date"
                      required
                      className={inputLue}
                    />
                  </Campo>
                  <Campo label="Acción a realizar">
                    <textarea
                      name="descripcion"
                      required
                      minLength={5}
                      className={inputLue}
                    />
                  </Campo>
                  <Campo label="Responsable">{responsable}</Campo>
                  <Campo label="Vincular derivación">
                    <select
                      name="derivacionId"
                      defaultValue={id}
                      className={inputLue}
                    >
                      <option value="">Sin derivación</option>
                      {datos.derivaciones
                        .filter((d) => d.estado !== "CERRADA")
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            {fecha(d.fecha)} · {d.motivo}
                          </option>
                        ))}
                    </select>
                  </Campo>
                  <Campo label="Vincular situación">
                    <select name="situacionId" className={inputLue}>
                      <option value="">Sin situación</option>
                      {datos.situaciones.map((s) => (
                        <option key={s.id} value={s.id}>
                          {TIPO_SITUACION_ETIQUETA[s.tipo]}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <label className="flex gap-2 text-sm">
                    <input name="avisoCorreo" type="checkbox" />
                    Solicitar recordatorio al correo institucional (requiere
                    servicio configurado)
                  </label>
                  <p className="text-xs">
                    El aviso en LUE está activo. El correo contiene únicamente
                    un enlace al legajo.
                  </p>
                </>
              )}
              {formulario === "RESOLVER_SEGUIMIENTO" && (
                <>
                  <Campo label="Estado">
                    <select name="estado" className={inputLue}>
                      <option value="REALIZADO">Realizado</option>
                      <option value="CANCELADO">Cancelado</option>
                    </select>
                  </Campo>
                  <Campo label="Resultado o motivo de cancelación">
                    <textarea
                      name="resultado"
                      required
                      minLength={5}
                      className={inputLue}
                    />
                  </Campo>
                </>
              )}
              {formulario === "ANULAR" && (
                <>
                  <p className="text-sm">
                    La actuación seguirá en el historial. La anulación no
                    revierte resoluciones ni situaciones vinculadas; deben
                    revisarse expresamente.
                  </p>
                  <Campo label="Motivo de anulación">
                    <textarea
                      name="motivo"
                      required
                      minLength={10}
                      className={inputLue}
                    />
                  </Campo>
                </>
              )}
              {formulario === "SITUACION" && (
                <>
                  <Campo label="Tipo">
                    <select
                      value={tipoSituacion}
                      disabled={!!id}
                      onChange={(ev) =>
                        setTipoSituacion(
                          ev.target.value as typeof tipoSituacion,
                        )
                      }
                      className={inputLue}
                    >
                      {TIPOS_SITUACION.filter(
                        (t) =>
                          direccion ||
                          ![
                            "CAMBIO_GENERO",
                            "CONDICIONAL_INASISTENCIAS",
                            "EXTENSION_INASISTENCIAS",
                            "ESCOLARIDAD_PROTEGIDA",
                            "CONDICIONAL_ICE",
                          ].includes(t),
                      ).map((t) => (
                        <option key={t} value={t}>
                          {TIPO_SITUACION_ETIQUETA[t]}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Campo label="Inicio">
                      <input
                        name="fechaInicio"
                        type="date"
                        required
                        defaultValue={
                          actual?.fechaInicio.slice(0, 10) ?? diaLocal()
                        }
                        className={inputLue}
                      />
                    </Campo>
                    <Campo label="Vencimiento">
                      <input
                        name="fechaVencimiento"
                        type="date"
                        defaultValue={actual?.fechaVencimiento?.slice(0, 10)}
                        className={inputLue}
                      />
                    </Campo>
                    <Campo label="Forma">
                      <input
                        name="forma"
                        defaultValue={actual?.forma ?? ""}
                        className={inputLue}
                      />
                    </Campo>
                    <Campo label="Aval">
                      <select
                        name="aval"
                        defaultValue={actual?.aval ?? ""}
                        className={inputLue}
                      >
                        <option value="">Pendiente / no corresponde</option>
                        <option>Dirección</option>
                        <option>Supervisión</option>
                      </select>
                    </Campo>
                    <Campo label="Estado">
                      <select
                        name="estado"
                        defaultValue={actual?.estado ?? "PENDIENTE"}
                        className={inputLue}
                      >
                        {ESTADOS_SITUACION.map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </Campo>
                  </div>
                  {(CAMPOS_SITUACION[tipoSituacion] ?? []).map((k) => (
                    <Campo key={`${tipoSituacion}:${k}`} label={k}>
                      <input
                        name={`detalle:${k}`}
                        defaultValue={String(
                          (actual?.detalle as Record<string, unknown> | null)?.[
                            k
                          ] ?? "",
                        )}
                        className={inputLue}
                      />
                    </Campo>
                  ))}
                  {tipoSituacion === "OTRA" && (
                    <p className="text-xs">
                      Para el reporte 12, indique «No asiste» en Categoría y
                      registre las gestiones y denuncias realizadas.
                    </p>
                  )}
                  <Campo label="Observaciones institucionales">
                    <textarea
                      name="observaciones"
                      defaultValue={actual?.observaciones ?? ""}
                      className={inputLue}
                    />
                  </Campo>
                </>
              )}
              {formulario === "FICHA" && (
                <>
                  <p className="rounded bg-sky-50 p-3 text-sm">
                    Registrar apoyos pedagógicos y acuerdos institucionales. No
                    cargar diagnósticos clínicos ni valoraciones de
                    personalidad. El contenido definitivo de las fichas queda a
                    validar con el SOE.
                  </p>
                  {(
                    [
                      ["apoyos", "Apoyos y adecuaciones"],
                      ["acuerdos", "Acuerdos institucionales"],
                      [
                        "contactosInstitucionales",
                        "Referentes y contactos institucionales",
                      ],
                      ["documentacion", "Documentación de respaldo"],
                    ] as const
                  ).map(([k, l]) => (
                    <Campo key={k} label={l}>
                      <textarea
                        readOnly={!editable}
                        name={k}
                        defaultValue={ficha[k] ?? ""}
                        maxLength={4000}
                        rows={3}
                        className={inputLue}
                      />
                    </Campo>
                  ))}
                </>
              )}
              {["DERIVACION", "SITUACION"].includes(formulario) &&
                !e.legajoAbiertoEl && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Campo label="Primer seguimiento">
                      <input
                        name="seguimientoFecha"
                        type="date"
                        required
                        className={inputLue}
                      />
                    </Campo>
                    <Campo label="Responsable">{responsable}</Campo>
                  </div>
                )}
              {editable && (
                <button disabled={guardando} className={botonLue}>
                  {guardando ? "Guardando…" : "Guardar registro"}
                </button>
              )}
            </form>
          )}
          <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
            <div className="space-y-4">
              <section className="rounded-xl bg-white p-4">
                <h4 className="mb-3 font-bold">
                  Línea de tiempo · todos los ciclos
                </h4>
                {!datos.actuaciones.length && (
                  <p className="text-sm text-slate-500">
                    Todavía no hay actuaciones.
                  </p>
                )}
                {[...new Set(datos.actuaciones.map((a) => a.cicloLectivo))]
                  .sort((a, b) => b - a)
                  .map((ciclo) => (
                    <details
                      key={ciclo}
                      open={
                        ciclo ===
                        Math.max(
                          ...datos.actuaciones.map((a) => a.cicloLectivo),
                        )
                      }
                      className="mb-3"
                    >
                      <summary className="cursor-pointer rounded-lg bg-institucional-50 p-2 font-semibold">
                        Ciclo {ciclo} ·{" "}
                        {
                          datos.actuaciones.filter(
                            (a) => a.cicloLectivo === ciclo,
                          ).length
                        }{" "}
                        actuaciones
                      </summary>
                      {datos.actuaciones
                        .filter((a) => a.cicloLectivo === ciclo)
                        .map((a) => (
                          <article
                            key={a.id}
                            className="ml-2 border-l-2 border-institucional-100 py-3 pl-4"
                          >
                            <p className="text-xs text-slate-500">
                              {fecha(a.fecha)} ·{" "}
                              {
                                TIPO_ACTUACION_ETIQUETA[
                                  a.tipo as keyof typeof TIPO_ACTUACION_ETIQUETA
                                ]
                              }{" "}
                              {a.confidencial && "· Confidencial"}
                            </p>
                            <p
                              className={`font-semibold ${a.anuladaEl ? "line-through" : ""}`}
                            >
                              {a.motivo}
                            </p>
                            <p className="whitespace-pre-line text-sm">
                              {a.resumen}
                            </p>
                            {"tipoActa" in a && a.tipoActa && (
                              <p className="mt-1 text-xs text-slate-500">
                                {a.tipoActa} · Libro {a.actaLibro} · Folio{" "}
                                {a.actaFolio}
                              </p>
                            )}
                            <p className="mt-1 text-xs text-slate-500">
                              Registró: {a.autor.nombre} · {a.autor.rol} ·{" "}
                              {fecha(a.createdAt)}
                            </p>
                            {a.anuladaEl && (
                              <p className="text-sm text-red-700">
                                Anulada el {fecha(a.anuladaEl)} ·{" "}
                                {"motivoAnulacion" in a
                                  ? a.motivoAnulacion
                                  : ""}
                              </p>
                            )}
                            {direccion && editable && !a.anuladaEl && (
                              <button
                                className="mt-2 text-xs text-red-700 underline print:hidden"
                                onClick={() => abrir("ANULAR", a.id)}
                              >
                                Anular con motivo
                              </button>
                            )}
                          </article>
                        ))}
                    </details>
                  ))}
              </section>
              <section className="rounded-xl bg-white p-4">
                <h4 className="mb-3 font-bold">Derivaciones al SOE</h4>
                {!datos.derivaciones.length && (
                  <p className="text-sm text-slate-500">
                    Sin derivaciones visibles.
                  </p>
                )}
                {datos.derivaciones.map((d) => (
                  <article
                    key={d.id}
                    className="mb-3 rounded-lg border border-slate-200 p-3"
                  >
                    <p className="font-semibold">
                      {fecha(d.fecha)} · {d.estado}
                    </p>
                    <p className="text-xs text-slate-500">
                      Derivó: {d.derivadoPor.nombre}
                    </p>
                    <p className="my-2 text-sm">{d.motivo}</p>
                    {"accionesSoe" in d && d.accionesSoe && (
                      <p className="my-2 text-sm">
                        Acciones SOE: {d.accionesSoe}
                      </p>
                    )}
                    {d.respuesta && (
                      <p className="rounded bg-sky-50 p-2 text-sm">
                        Respuesta: {d.respuesta}
                      </p>
                    )}
                    {editable && d.estado !== "CERRADA" && (
                      <div className="mt-3 flex flex-wrap gap-2 print:hidden">
                        {equipo && (
                          <button
                            className={botonLue}
                            onClick={() => abrir("RESPUESTA", d.id)}
                          >
                            Completar respuesta
                          </button>
                        )}
                        <button
                          className="text-sm underline"
                          onClick={() => abrir("SEGUIMIENTO", d.id)}
                        >
                          Agregar seguimiento
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </section>
            </div>
            <div className="space-y-4">
              <section className="rounded-xl bg-white p-4">
                <h4 className="mb-3 font-bold">
                  Seguimientos pendientes e historial
                </h4>
                {!datos.seguimientos.length && (
                  <p className="text-sm text-amber-800">
                    Sin seguimiento programado. Al abrir el legajo se debe
                    asignar fecha y responsable.
                  </p>
                )}
                {datos.seguimientos.map((s) => {
                  const dias = diasHastaFecha(s.fechaProgramada);
                  return (
                    <article
                      key={s.id}
                      className={`mb-3 rounded-lg border p-3 ${s.estado === "PROGRAMADO" && dias < 0 ? "border-red-200 bg-red-50" : "border-slate-200"}`}
                    >
                      <p className="text-xs font-bold">
                        {fecha(s.fechaProgramada)} ·{" "}
                        {s.estado === "PROGRAMADO"
                          ? dias < 0
                            ? "VENCIDO"
                            : dias === 0
                              ? "HOY"
                              : `EN ${dias} DÍAS`
                          : s.estado}
                      </p>
                      <p className="my-1 text-sm">{s.descripcion}</p>
                      <p className="text-xs text-slate-500">
                        {s.responsable?.nombre ?? "Sin responsable"}
                      </p>
                      {s.resultado && (
                        <p className="mt-2 text-sm">{s.resultado}</p>
                      )}
                      {s.estado === "PROGRAMADO" && editable && (
                        <button
                          className="mt-2 text-sm underline print:hidden"
                          onClick={() => abrir("RESOLVER_SEGUIMIENTO", s.id)}
                        >
                          Registrar resultado
                        </button>
                      )}
                    </article>
                  );
                })}
              </section>
              {equipo && (
                <section className="rounded-xl bg-white p-4">
                  <h4 className="font-bold">Fichas anexas</h4>
                  <p className="my-2 text-xs text-slate-500">
                    Acceso reservado. Cada consulta queda auditada.
                  </p>
                  {["SALUD", "PSICOSOCIAL"].map((t) => (
                    <div
                      key={t}
                      className="my-2 flex items-center justify-between gap-3"
                    >
                      <span className="text-sm">
                        {t === "SALUD" ? "Ficha de salud" : "Ficha psicosocial"}{" "}
                        ·{" "}
                        {datos.fichas.some((f) => f.tipo === t)
                          ? "Cargada"
                          : "Pendiente"}
                      </span>
                      <button
                        className="text-sm underline"
                        onClick={() => verFicha(t)}
                      >
                        Abrir
                      </button>
                    </div>
                  ))}
                </section>
              )}
              <section className="rounded-xl bg-white p-4">
                <h4 className="font-bold">Situaciones vigentes e historial</h4>
                {datos.situaciones.map((s) => (
                  <article key={s.id} className="mt-3 border-t pt-3 text-sm">
                    <p className="font-semibold">
                      {TIPO_SITUACION_ETIQUETA[s.tipo]}
                    </p>
                    <p>
                      {s.condicion} · Vence: {fecha(s.fechaVencimiento)}
                    </p>
                    <p>Aval: {s.aval || "Pendiente"}</p>
                    {equipo && editable && (
                      <button
                        className="mt-2 underline print:hidden"
                        onClick={() => {
                          setTipoSituacion(s.tipo);
                          abrir("SITUACION", s.id);
                        }}
                      >
                        Revisar / cerrar / dar de baja
                      </button>
                    )}
                  </article>
                ))}
              </section>
            </div>
          </div>
        </>
      )}
      {imprimiendo && datos && e && (
        <ZonaImpresion>
          <DocumentoInforme
            titulo="Legajo de seguimiento"
            subtitulo={`${e.apellidos}, ${e.nombres} · DNI ${dni} ? ${e.anio}° ${e.division}`}
            generadoPor={datos.perfil}
            confidencial={equipo}
          >
            <p className="my-3 text-sm">
              Apertura: {fecha(e.legajoAbiertoEl)} · Promedio al abrir:{" "}
              {e.aperturaPromedio ?? "—"} · Pendientes:{" "}
              {e.aperturaPendientes ?? "—"} · Inasistencias:{" "}
              {e.aperturaInasistencias ?? "—"} · ICE: {e.aperturaIce ?? "—"}
            </p>
            <h3 className="font-bold">Actuaciones por ciclo</h3>
            {datos.actuaciones.map((a) => (
              <article
                key={a.id}
                className="evitar-corte border-b py-3 text-sm"
              >
                <p className="font-semibold">
                  Ciclo {a.cicloLectivo} · {fecha(a.fecha)} · {a.motivo}{" "}
                  {a.anuladaEl ? "(ANULADA)" : ""}
                </p>
                <p>{a.resumen}</p>
                {"tipoActa" in a && a.tipoActa && (
                  <p>
                    {a.tipoActa} · Libro {a.actaLibro} · Folio {a.actaFolio}
                  </p>
                )}
                <p className="text-xs">Registró: {a.autor.nombre}</p>
              </article>
            ))}
            <h3 className="mt-4 font-bold">Seguimientos</h3>
            {datos.seguimientos.map((s) => (
              <p className="my-2 text-sm" key={s.id}>
                {fecha(s.fechaProgramada)} · {s.descripcion} · {s.estado} ·{" "}
                {s.responsable?.nombre} {s.resultado}
              </p>
            ))}
          </DocumentoInforme>
        </ZonaImpresion>
      )}
    </section>
  );
}
