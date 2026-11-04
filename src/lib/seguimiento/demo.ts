import { crearSeguimientoDemo } from "../demoSeguimiento";
import { crearLegajosDemo, USUARIOS_DEMO } from "../demoData";
import type { Rol } from "../types";
import { NIVEL_ACCESO_SITUACION } from "../types";
import {
  actuacionSchema,
  derivacionSchema,
  respuestaSchema,
  seguimientoSchema,
  situacionSchema,
  fichaSchema,
  diaLocal,
  estadoVigencia,
  REPORTES,
  validarApertura,
} from "./reglas";
const seed = crearSeguimientoDemo();
const estudiantes = crearLegajosDemo();
const copia = <T>(v: T): T => JSON.parse(JSON.stringify(v));
let secuencia = 0;
const id = () => `demo-seguimiento-${++secuencia}`;
const extraActuaciones: Record<string, unknown>[] = [];
const extraSituaciones: Record<string, unknown>[] = [];
const extraSeguimientos: Record<string, unknown>[] = [];
const extraDerivaciones: Record<string, unknown>[] = [];
const fichas = new Map<string, unknown>();
// La demostración es aislada del servidor y nunca escribe datos reales.
export async function solicitarSeguimientoDemo<T>(
  query: string,
  init?: RequestInit,
  rol: Rol = "DIRECTIVO_SOE",
): Promise<T> {
  if (rol === "DOCENTE")
    throw new Error("Acceso reservado a preceptoría, SOE y dirección.");
  const q = new URLSearchParams(query.replace(/^\?/, ""));
  const u = USUARIOS_DEMO[rol];
  const perfil = rol === "PRECEPTOR" ? "PRECEPTORIA" : "DIRECCION";
  const nombre = (a: string) =>
    a === "PRECEPTOR"
      ? "Preceptoría demo"
      : a === "SOE"
        ? "Profesional SOE demo"
        : "Dirección demo";
  const apertura = (dni: string) => seed.aperturas.find((a) => a.dni === dni);
  const actos = (dni: string) =>
    [
      ...seed.actuaciones
        .filter((a) => a.dni === dni)
        .map((a) => ({
          ...a,
          autor: {
            nombre: nombre(a.autor),
            rol: a.autor === "PRECEPTOR" ? "PRECEPTOR" : "DIRECTIVO_SOE",
          },
          createdAt: a.fecha,
          anuladaEl: null,
        })),
      ...extraActuaciones.filter((a) => a.dni === dni),
    ].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  const derivaciones = (dni: string) => [
    ...seed.derivaciones
      .filter((a) => a.dni === dni)
      .map((a) => ({
        ...a,
        derivadoPor: { nombre: nombre(a.derivadoPor) },
        profesionalSoe: a.profesionalSoe
          ? { nombre: nombre(a.profesionalSoe) }
          : null,
      })),
    ...extraDerivaciones.filter((a) => a.dni === dni),
  ];
  const seguimientos = (dni: string) => [
    ...seed.seguimientos
      .filter((a) => a.dni === dni)
      .map((a) => ({
        ...a,
        responsable: { nombre: nombre(a.responsable ?? "SOE") },
      })),
    ...extraSeguimientos.filter((a) => a.dni === dni),
  ];
  const situaciones = (dni: string): Record<string, unknown>[] =>
    [
      ...seed.situaciones.filter((a) => a.dni === dni),
      ...extraSituaciones.filter((a) => a.dni === dni),
    ]
      .filter((a) => perfil !== "PRECEPTORIA" || a.nivelAcceso === "GENERAL")
      .map((a) => ({
        ...a,
        condicion: estadoVigencia(
          String(a.estado),
          a.fechaVencimiento as string | null,
        ),
      }));
  if (init?.method === "POST") {
    const { dni, accion, datos: d } = JSON.parse(String(init.body));
    const e = estudiantes.find((e) => e.dni === dni);
    if (accion === "LEER_AVISO") return { guardado: true } as T;
    if (accion === "PERFIL")
      throw new Error(
        "Los perfiles demo son ficticios. Configure los perfiles en una base real.",
      );
    if (!e) throw new Error("Estudiante inexistente.");
    if (accion === "ACTUACION") {
      const a = actuacionSchema.parse(d);
      if (a.confidencial && perfil === "PRECEPTORIA")
        throw new Error("Sin acceso a contenido reservado.");
      if (!apertura(dni)) {
        const error = validarApertura(
          a.motivoApertura,
          e.trayectoria.find((t) => t.activo)?.inasistencias ?? null,
          e.puntosConvivencia,
          e.requierePpi,
        );
        if (error) throw new Error(error);
        if (!a.seguimientoFecha || !a.responsableId)
          throw new Error(
            "Seleccione fecha y responsable del primer seguimiento.",
          );
        seed.aperturas.push({
          dni,
          fecha: diaLocal(),
          motivo: a.motivoApertura!,
          detalle: a.motivo,
          promedio: e.promedioGeneral,
          pendientes: e.calificaciones.filter((c) => c.previa).length,
          inasistencias:
            e.trayectoria.find((t) => t.activo)?.inasistencias ?? 0,
          ice: e.puntosConvivencia,
        });
      }
      extraActuaciones.unshift({
        ...a,
        id: id(),
        dni,
        cicloLectivo: Number(a.fecha.slice(0, 4)),
        autor: { nombre: u.nombre, rol },
        createdAt: new Date().toISOString(),
        anuladaEl: null,
      });
      if (a.seguimientoFecha)
        extraSeguimientos.push({
          id: id(),
          dni,
          fechaProgramada: a.seguimientoFecha,
          descripcion: a.motivo,
          estado: "PROGRAMADO",
          responsable: { nombre: u.nombre },
        });
    } else if (accion === "DERIVACION") {
      const d0 = derivacionSchema.parse(d);
      extraDerivaciones.unshift({
        ...d0,
        id: id(),
        dni,
        estado: "PENDIENTE",
        derivadoPor: { nombre: u.nombre },
        respuesta: null,
      });
    } else if (accion === "RESPUESTA") {
      if (perfil === "PRECEPTORIA") throw new Error("Solo SOE y dirección.");
      const r = respuestaSchema.parse(d);
      const item =
        extraDerivaciones.find((a) => a.id === r.id) ??
        seed.derivaciones.find((a) => a.id === r.id);
      if (item) Object.assign(item, r);
    } else if (accion === "SEGUIMIENTO") {
      const s = seguimientoSchema.parse(d);
      extraSeguimientos.push({
        ...s,
        id: id(),
        dni,
        estado: "PROGRAMADO",
        responsable: { nombre: u.nombre },
      });
    } else if (accion === "RESOLVER_SEGUIMIENTO") {
      const s =
        extraSeguimientos.find((s) => s.id === d.id) ??
        seed.seguimientos.find((s) => s.id === d.id);
      if (s)
        Object.assign(s, {
          estado: d.estado,
          resultado: d.resultado,
          realizadoEl: diaLocal(),
        });
    } else if (accion === "SITUACION") {
      if (perfil === "PRECEPTORIA") throw new Error("Solo SOE y dirección.");
      const s = situacionSchema.parse(d);
      const previo =
        extraSituaciones.find((x) => x.id === s.id) ??
        seed.situaciones.find((x) => x.id === s.id);
      if (previo) Object.assign(previo, s);
      else
        extraSituaciones.push({
          ...s,
          id: id(),
          dni,
          nivelAcceso: NIVEL_ACCESO_SITUACION[s.tipo],
        });
    } else if (accion === "FICHA") {
      if (perfil === "PRECEPTORIA") throw new Error("Solo SOE y dirección.");
      const f = fichaSchema.parse(d);
      fichas.set(`${dni}:${f.tipo}`, { datos: f.datos });
    } else if (accion === "ANULAR")
      throw new Error(
        "La anulación debe ser validada por la escuela antes de habilitarse.",
      );
    return { guardado: true } as T;
  }
  if (q.has("perfiles")) return [] as T;
  if (q.has("reporte")) {
    const n = Number(q.get("reporte"));
    if (perfil === "PRECEPTORIA" && n !== 4)
      throw new Error("Reporte reservado al equipo.");
    const tipos: Record<number, string> = {
      1: "ESCOLARIDAD_PROTEGIDA",
      2: "DEPORTISTA_FEDERADO",
      4: "CONDICIONAL_INASISTENCIAS",
      5: "EMBARAZO_PATERNIDAD_LACTANCIA",
      6: "ENFERMEDAD_APRENDIZAJE",
      9: "CAMBIO_GENERO",
      10: "JUDICIALIZADO",
      11: "ESCUELA_DOMICILIARIA",
      12: "OTRA",
    };
    const filas = estudiantes
      .flatMap((e) =>
        situaciones(e.dni)
          .filter((s) => s.tipo === tipos[n])
          .map((s) => ({
            Legajo: e.id,
            Estudiante: [5, 6, 9, 10].includes(n)
              ? `${e.apellidos[0]}.${e.nombres[0]}.`
              : `${e.apellidos}, ${e.nombres}`,
            Curso: `${e.anio}° ${e.division} · ${e.turno}`,
            Estado: s.condicion,
            Apertura: s.fechaInicio,
            Aval: s.aval ?? "Pendiente",
            Vencimiento: s.fechaVencimiento ?? "",
          })),
      )
      .filter(
        (f) =>
          (!q.get("curso") || f.Curso === q.get("curso")) &&
          (!q.get("estado") || f.Estado === q.get("estado")),
      );
    return copia({
      titulo: REPORTES[n - 1],
      ciclo: Number(q.get("ciclo")),
      fecha: diaLocal(),
      restringido: [5, 6, 9, 10].includes(n),
      filas,
    }) as T;
  }
  const dni = q.get("dni");
  if (!dni)
    return copia({
      perfil,
      avisos: [],
      estudiantes: estudiantes.map((e) => ({
        id: e.id,
        dni: e.dni,
        nombre: `${e.apellidos}, ${e.nombres}`,
        anio: e.anio,
        division: e.division,
        turno: e.turno,
        estadoMatricula: e.estadoMatricula,
        abierto: !!apertura(e.dni),
        inasistencias:
          e.trayectoria.find((t) => t.activo)?.inasistencias ?? null,
        ice: e.puntosConvivencia,
        pendientes: derivaciones(e.dni).filter((d) => d.estado !== "CERRADA")
          .length,
        seguimientos: seguimientos(e.dni).filter(
          (s) => s.estado === "PROGRAMADO",
        ),
      })),
    }) as T;
  const e = estudiantes.find((e) => e.dni === dni);
  if (!e) throw new Error("Estudiante inexistente.");
  if (q.has("ficha")) {
    if (perfil === "PRECEPTORIA") throw new Error("Acceso reservado.");
    return copia(
      fichas.get(`${dni}:${q.get("ficha")}`) ??
        seed.fichas.find((f) => f.dni === dni && f.tipo === q.get("ficha")) ??
        null,
    ) as T;
  }
  const a = apertura(dni);
  return copia({
    perfil,
    estudiante: {
      id: e.id,
      dni: e.dni,
      apellidos: e.apellidos,
      nombres: e.nombres,
      anio: e.anio,
      division: e.division,
      turno: e.turno,
      estadoMatricula: e.estadoMatricula,
      promedioGeneral: e.promedioGeneral,
      puntosConvivencia: e.puntosConvivencia,
      tieneCud: e.tieneCud,
      requierePpi: e.requierePpi,
      vencimientoCud: e.vencimientoCud,
      calificaciones: e.calificaciones,
      trayectoria: e.trayectoria,
      asistencias: e.asistencias,
      legajoAbiertoEl: a?.fecha ?? null,
      motivoApertura: a?.motivo ?? null,
      detalleApertura: a?.detalle,
      aperturaPromedio: a?.promedio,
      aperturaPendientes: a?.pendientes,
      aperturaInasistencias: a?.inasistencias,
      aperturaIce: a?.ice,
      aperturaTrayectoria: null,
    },
    inasistencias:
      e.trayectoria.find((t) => t.activo)?.inasistencias ??
      a?.inasistencias ??
      null,
    actuaciones: actos(dni).map((a) =>
      a.confidencial && perfil === "PRECEPTORIA"
        ? {
            id: a.id,
            fecha: a.fecha,
            cicloLectivo: a.cicloLectivo,
            tipo: "OTRA",
            motivo: "Actuación confidencial",
            resumen: "Existe un informe reservado.",
            confidencial: true,
            autor: { nombre: "Equipo institucional", rol: "DIRECTIVO_SOE" },
            anuladaEl: null,
            createdAt: a.createdAt,
          }
        : a,
    ),
    derivaciones: derivaciones(dni).map((d) =>
      perfil === "PRECEPTORIA"
        ? {
            id: d.id,
            fecha: d.fecha,
            motivo: d.motivo,
            estado: d.estado,
            respuesta: d.respuesta,
            derivadoPor: d.derivadoPor,
          }
        : d,
    ),
    seguimientos: seguimientos(dni),
    situaciones: situaciones(dni),
    fichas:
      perfil === "PRECEPTORIA"
        ? []
        : seed.fichas
            .filter((f) => f.dni === dni)
            .map((f) => ({ tipo: f.tipo, updatedAt: f.fecha })),
    responsables: [{ id: u.id, nombre: u.nombre }],
  }) as T;
}
