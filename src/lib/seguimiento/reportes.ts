import { prisma } from "../prisma";
import { ApiError } from "../api";
import { filtroCurso, exigirDireccion } from "./permisos";
import {
  diaLocal,
  estadoVigencia,
  inasistenciasAnuales,
  REPORTES,
  type Perfil,
} from "./reglas";
import type { TipoSituacion, UsuarioSesion } from "../types";
const TIPOS: Partial<Record<number, TipoSituacion[]>> = {
  1: ["ESCOLARIDAD_PROTEGIDA"],
  2: ["DEPORTISTA_FEDERADO"],
  3: ["CUD_EVALUACION"],
  7: ["INGRESANTE"],
  8: ["SALIDA"],
  4: [
    "CONDICIONAL_INASISTENCIAS",
    "EXTENSION_INASISTENCIAS",
    "CONDICIONAL_ICE",
  ],
  5: ["EMBARAZO_PATERNIDAD_LACTANCIA"],
  6: ["ENFERMEDAD_APRENDIZAJE"],
  9: ["CAMBIO_GENERO"],
  10: ["JUDICIALIZADO"],
  11: ["ESCUELA_DOMICILIARIA"],
  12: ["NO_ASISTE"],
};
export async function generarReporte(
  n: number,
  ciclo: number,
  curso: string,
  estado: string,
  p: Perfil,
  u: UsuarioSesion,
) {
  if (!Number.isInteger(n) || n < 1 || n > 12)
    throw new ApiError(400, "Reporte inválido.");
  if (p.funcion === "PRECEPTORIA" && n !== 4)
    throw new ApiError(
      403,
      "Preceptoría solo accede al reporte de condicionales de sus cursos.",
    );
  if (n === 9) exigirDireccion(p);
  const restringido = [5, 6, 9, 10].includes(n);
  const es = await prisma.estudiante.findMany({
    where: filtroCurso(p),
    select: {
      id: true,
      dni: true,
      apellidos: true,
      nombres: true,
      anio: true,
      division: true,
      turno: true,
      tieneCud: true,
      requierePpi: true,
      vencimientoCud: true,
      estadoMatricula: true,
      puntosConvivencia: true,
      trayectoria: true,
      asistencias: true,
      situaciones: { where: { tipo: { in: TIPOS[n] ?? [] } } },
      seguimientos: {
        select: {
          fechaProgramada: true,
          estado: true,
          situacionId: true,
          responsable: { select: { nombre: true } },
        },
      },
    },
  });
  const filas: Record<string, string | number>[] = [];
  for (const e of es) {
    const etiquetaCurso = `${e.anio}° ${e.division} · ${e.turno}`;
    if (curso && curso !== etiquetaCurso) continue;
    const base = {
      Legajo: e.id,
      Estudiante: restringido
        ? `${e.apellidos[0] ?? ""}.${e.nombres[0] ?? ""}.`
        : `${e.apellidos}, ${e.nombres}`,
      Curso: etiquetaCurso,
      Ciclo: ciclo,
    };
    if (n === 3 && !e.situaciones.length) {
      if (
        !(e.tieneCud || e.requierePpi) ||
        !e.trayectoria.some((t) => t.cicloLectivo === ciclo)
      )
        continue;
      const condicion = e.vencimientoCud
        ? estadoVigencia("VIGENTE", e.vencimientoCud)
        : "SIN_VENCIMIENTO";
      if (estado && condicion !== estado) continue;
      filas.push({
        ...base,
        CUD: e.tieneCud ? "Sí" : "No",
        PPI: e.requierePpi ? "Sí" : "No",
        Vencimiento: e.vencimientoCud?.toISOString().slice(0, 10) ?? "",
        Estado: condicion,
      });
      continue;
    }
    if ((n === 7 || n === 8) && !e.situaciones.length) {
      for (const t of e.trayectoria.filter(
        (t) =>
          t.cicloLectivo === ciclo &&
          (n === 7
            ? !!t.fechaIngreso && !!t.motivoIngreso
            : !!t.fechaEgreso && /pase|abandono/i.test(t.motivoEgreso ?? "")),
      )) {
        if (estado && estado !== e.estadoMatricula) continue;
        filas.push({
          ...base,
          Escuela: t.escuela,
          Fecha:
            (n === 7 ? t.fechaIngreso : t.fechaEgreso)
              ?.toISOString()
              .slice(0, 10) ?? "",
          Motivo: (n === 7 ? t.motivoIngreso : t.motivoEgreso) ?? "",
          Estado: e.estadoMatricula,
        });
      }
      continue;
    }
    const faltas = inasistenciasAnuales(e, ciclo);
    if (n === 4 && (faltas === null || faltas < 20)) continue;
    for (const s of e.situaciones) {
      if (
        s.fechaInicio.getUTCFullYear() > ciclo ||
        (s.fechaFin && s.fechaFin.getUTCFullYear() < ciclo)
      )
        continue;
      if (
        n === 12 &&
        !String(
          (s.detalle as Record<string, unknown> | null)?.["Categoría"] ?? "",
        )
          .toLowerCase()
          .includes("no asiste")
      )
        continue;
      const condicion = estadoVigencia(s.estado, s.fechaVencimiento);
      if (estado && condicion !== estado) continue;
      const seguimientos = e.seguimientos.filter((x) => x.situacionId === s.id);
      filas.push({
        ...base,
        Tipo: s.tipo,
        Forma: s.forma ?? "",
        Apertura: s.fechaInicio.toISOString().slice(0, 10),
        Aval: s.aval ?? "Pendiente",
        Vencimiento: s.fechaVencimiento?.toISOString().slice(0, 10) ?? "",
        Estado: condicion,
        Seguimiento: seguimientos
          .map(
            (x) =>
              `${x.fechaProgramada.toISOString().slice(0, 10)} ${x.responsable?.nombre ?? "Sin asignar"} ${x.estado}`,
          )
          .join("; "),
        ...(n === 4
          ? {
              Inasistencias: faltas ?? "Sin acumulado anual",
              ICE: e.puntosConvivencia,
            }
          : {}),
        ...Object.fromEntries(
          Object.entries((s.detalle ?? {}) as Record<string, unknown>)
            .filter(([k]) => !restringido || k !== "Nombre elegido")
            .map(([k, v]) => [k, String(v ?? "")]),
        ),
      });
    }
  }
  await prisma.auditLog.create({
    data: {
      usuarioId: u.id,
      accion: restringido ? "VER_REPORTE_RESTRINGIDO" : "GENERAR_INFORME",
    },
  });
  return {
    titulo: REPORTES[n - 1],
    ciclo,
    fecha: diaLocal(),
    restringido,
    filas,
  };
}
