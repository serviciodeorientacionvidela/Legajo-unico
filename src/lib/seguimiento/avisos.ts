import { prisma } from "../prisma";
import {
  diaLocal,
  diasHastaFecha,
  inasistenciasAnuales,
  type Perfil,
} from "./reglas";
import { exigirCurso } from "./permisos";
import { aperturaSelect } from "./servicio";
import type { TipoNotificacion } from "../types";
import { cicloLectivoActual } from "../ciclo";

/** Cada ejecución es reintentable: una clave por destinatario, hecho y día evita duplicados. */
export async function procesarAvisos() {
  const hoy = diaLocal();
  const ciclo = cicloLectivoActual();
  const usuarios = await prisma.usuario.findMany({
    where: {
      activo: true,
      rol: { not: "DOCENTE" },
      perfilSeguimiento: { isNot: null },
    },
    select: { id: true, email: true, perfilSeguimiento: true },
  });
  const directivos = usuarios.filter(
    (u) => u.perfilSeguimiento?.funcion === "DIRECCION",
  );
  const equipo = usuarios.filter((u) =>
    ["DIRECCION", "SOE"].includes(u.perfilSeguimiento?.funcion ?? ""),
  );
  let creados = 0,
    enviados = 0,
    pendientesCorreo = 0;
  const avisar = async (
    usuarioId: string,
    tipo: TipoNotificacion,
    clave: string,
    estudianteId: string,
    dni: string,
    titulo: string,
    seguimientoId?: string,
    derivacionId?: string,
  ) => {
    const existente = await prisma.notificacion.findUnique({
      where: { claveDedup: clave },
    });
    if (existente) return existente;
    const n = await prisma.notificacion.upsert({
      where: { claveDedup: clave },
      update: {},
      create: {
        usuarioId,
        tipo,
        claveDedup: clave,
        estudianteId,
        titulo,
        mensaje: "Revise el registro y deje constancia de la acción realizada.",
        enlace: `/?seguimiento=${dni}`,
        seguimientoId,
        derivacionId,
      },
    });
    creados++;
    return n;
  };
  const programados = await prisma.seguimientoCaso.findMany({
    where: { estado: "PROGRAMADO" },
    include: {
      estudiante: { select: { dni: true, estadoMatricula: true } },
      derivacion: { select: { derivadoPorId: true } },
      situacion: { select: { nivelAcceso: true } },
    },
  });
  for (const s of programados) {
    if (s.estudiante.estadoMatricula !== "REGULAR") continue;
    const dias = diasHastaFecha(s.fechaProgramada, hoy);
    if (dias > 2 || dias === 1) continue;
    const tipo: TipoNotificacion =
      dias < 0
        ? "SEGUIMIENTO_VENCIDO"
        : dias === 0
          ? "SEGUIMIENTO_HOY"
          : "SEGUIMIENTO_PROXIMO";
    const ids = new Set(
      [
        s.responsableId,
        s.derivacion?.derivadoPorId,
        ...(dias < 0 ? directivos.map((u) => u.id) : []),
      ].filter((v): v is string => !!v),
    );
    for (const usuarioId of ids) {
      const u = usuarios.find((u) => u.id === usuarioId);
      if (!u) continue;
      if (
        s.situacion?.nivelAcceso === "SOLO_DIRECCION" &&
        u.perfilSeguimiento?.funcion !== "DIRECCION"
      )
        continue;
      const n = await avisar(
        usuarioId,
        tipo,
        `seguimiento:${s.id}:${hoy}:${usuarioId}`,
        s.estudianteId,
        s.estudiante.dni,
        dias < 0
          ? "Seguimiento vencido"
          : dias === 0
            ? "Seguimiento para hoy"
            : "Seguimiento en dos días",
        s.id,
        s.derivacionId ?? undefined,
      );
      if (s.avisoCorreo && !n.correoEnviadoEl) {
        if (await enviarCorreoInstitucional(u.email, n.enlace!, n.id)) {
          await prisma.notificacion.update({
            where: { id: n.id },
            data: { correoEnviadoEl: new Date() },
          });
          enviados++;
        } else pendientesCorreo++;
      }
    }
  }
  const es = await prisma.estudiante.findMany({
    where: { estadoMatricula: "REGULAR" },
    select: {
      id: true,
      dni: true,
      anio: true,
      division: true,
      turno: true,
      promedioGeneral: true,
      puntosConvivencia: true,
      requierePpi: true,
      ...aperturaSelect,
      trayectoria: true,
      asistencias: true,
      calificaciones: { where: { previa: true }, select: { id: true } },
      situaciones: {
        where: { tipo: "ESCOLARIDAD_PROTEGIDA", estado: "VIGENTE" },
        select: {
          id: true,
          fechaVencimiento: true,
          seguimientos: { select: { responsableId: true } },
        },
      },
    },
  });
  for (const e of es) {
    const preceptores = usuarios.filter((u) => {
      if (u.perfilSeguimiento?.funcion !== "PRECEPTORIA") return false;
      try {
        exigirCurso(
          {
            usuarioId: u.id,
            funcion: "PRECEPTORIA",
            cursos: u.perfilSeguimiento.cursos as Perfil["cursos"],
          },
          e,
        );
        return true;
      } catch {
        return false;
      }
    });
    // Inasistencias e ICE no generan avisos por alumno: el barrido del GEI deja un único aviso con el
    // resumen del mes y el detalle está en la bandeja de Seguimiento LUE.
    for (const s of e.situaciones) {
      if (!s.fechaVencimiento || diasHastaFecha(s.fechaVencimiento, hoy) > 7)
        continue;
      const ids = new Set([
        ...directivos.map((u) => u.id),
        ...preceptores.map((u) => u.id),
        ...s.seguimientos
          .map((x) => x.responsableId)
          .filter((v): v is string => !!v),
      ]);
      for (const uid of ids)
        await avisar(
          uid,
          "SITUACION_POR_VENCER",
          `situacion:${s.id}:${hoy}:${uid}`,
          e.id,
          e.dni,
          "Escolaridad protegida: revisar renovación o cierre",
        );
    }
  }
  return { creados, enviados, pendientesCorreo };
}

/** Adaptador del correo institucional. El endpoint debe aceptar esta estructura e Idempotency-Key. */
async function enviarCorreoInstitucional(
  destinatario: string,
  enlace: string,
  clave: string,
) {
  const endpoint = process.env.LUE_CORREO_ENDPOINT;
  const token = process.env.LUE_CORREO_TOKEN;
  const base = process.env.LUE_PUBLIC_URL;
  const dominios = (process.env.LUE_DOMINIOS_INSTITUCIONALES ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (
    !endpoint ||
    !token ||
    !base ||
    !dominios.includes(destinatario.split("@")[1]?.toLowerCase() ?? "")
  )
    return false;
  if (!endpoint.startsWith("https://") || !base.startsWith("https://"))
    throw new Error("El servicio institucional de correo requiere HTTPS.");
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "Idempotency-Key": clave,
    },
    body: JSON.stringify({
      to: destinatario,
      subject: "Recordatorio institucional LUE",
      text: new URL(enlace, base).toString(),
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return false;
  return true;
}
