import { z } from "zod";
import { ApiError, jsonConSesion, manejarError, requerirSesion } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/** Solo participa quien está en la conversación. */
async function exigirParticipante(conversacionId: string, usuarioId: string) {
  const p = await prisma.participanteConversacion.findUnique({
    where: { conversacionId_usuarioId: { conversacionId, usuarioId } },
  });
  if (!p) throw new ApiError(403, "No participa de esta conversación.");
  return p;
}

/**
 * GET /api/mensajes                 → conversaciones del usuario con no leídos
 * GET /api/mensajes?conversacion=ID → últimos mensajes (marca como leída)
 * GET /api/mensajes?usuarios=1      → personas con las que se puede conversar
 * GET /api/mensajes?resumen=1       → total de mensajes sin leer (para el menú)
 */
export async function GET(req: Request) {
  try {
    const u = await requerirSesion();
    const q = new URL(req.url).searchParams;

    if (q.has("usuarios")) {
      const usuarios = await prisma.usuario.findMany({
        where: { activo: true, id: { not: u.id } },
        select: { id: true, nombre: true, cargo: true, rol: true },
        orderBy: { nombre: "asc" },
      });
      return jsonConSesion({ usuarios }, u);
    }

    const conversacionId = q.get("conversacion");
    if (conversacionId) {
      await exigirParticipante(conversacionId, u.id);
      const [conversacion, mensajes] = await Promise.all([
        prisma.conversacion.findUnique({
          where: { id: conversacionId },
          select: {
            id: true,
            nombre: true,
            esGrupo: true,
            participantes: { select: { usuario: { select: { id: true, nombre: true, cargo: true } } } },
          },
        }),
        prisma.mensaje.findMany({
          where: { conversacionId },
          orderBy: { createdAt: "desc" },
          take: 200,
          select: { id: true, texto: true, createdAt: true, autor: { select: { id: true, nombre: true } } },
        }),
      ]);
      await prisma.participanteConversacion.update({
        where: { conversacionId_usuarioId: { conversacionId, usuarioId: u.id } },
        data: { ultimaLecturaEl: new Date() },
      });
      return jsonConSesion({ conversacion, mensajes: mensajes.reverse(), yo: u.id }, u);
    }

    const participaciones = await prisma.participanteConversacion.findMany({
      where: { usuarioId: u.id },
      select: {
        ultimaLecturaEl: true,
        conversacion: {
          select: {
            id: true,
            nombre: true,
            esGrupo: true,
            ultimoMensajeEl: true,
            participantes: { select: { usuario: { select: { id: true, nombre: true, cargo: true } } } },
            mensajes: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { texto: true, createdAt: true, autor: { select: { nombre: true } } },
            },
          },
        },
      },
      orderBy: { conversacion: { ultimoMensajeEl: "desc" } },
    });
    const conversaciones = await Promise.all(
      participaciones.map(async (p) => ({
        ...p.conversacion,
        noLeidos: await prisma.mensaje.count({
          where: {
            conversacionId: p.conversacion.id,
            autorId: { not: u.id },
            ...(p.ultimaLecturaEl ? { createdAt: { gt: p.ultimaLecturaEl } } : {}),
          },
        }),
      })),
    );
    if (q.has("resumen"))
      return jsonConSesion({ noLeidos: conversaciones.reduce((t, c) => t + c.noLeidos, 0) }, u);
    return jsonConSesion({ conversaciones, yo: u.id }, u);
  } catch (error) {
    return manejarError(error);
  }
}

const esquema = z.discriminatedUnion("accion", [
  z.object({
    accion: z.literal("CREAR"),
    participantes: z.array(z.string().min(1).max(40)).min(1).max(60),
    nombre: z.string().trim().max(80).optional(),
  }),
  z.object({
    accion: z.literal("ENVIAR"),
    conversacionId: z.string().min(1).max(40),
    texto: z.string().trim().min(1, "Escriba un mensaje.").max(4000),
  }),
  z.object({
    accion: z.literal("AGREGAR"),
    conversacionId: z.string().min(1).max(40),
    participantes: z.array(z.string().min(1).max(40)).min(1).max(60),
  }),
  z.object({
    accion: z.literal("SALIR"),
    conversacionId: z.string().min(1).max(40),
  }),
]);

/** POST /api/mensajes — crear chat (directo o grupo), enviar, sumar personas o salir de un grupo. */
export async function POST(req: Request) {
  try {
    const u = await requerirSesion();
    const d = esquema.parse(await req.json());

    if (d.accion === "CREAR") {
      const otros = [...new Set(d.participantes.filter((id) => id !== u.id))];
      const validos = await prisma.usuario.count({ where: { id: { in: otros }, activo: true } });
      if (!otros.length || validos !== otros.length) throw new ApiError(400, "Elija personas activas del sistema.");
      const esGrupo = otros.length > 1 || !!d.nombre;
      if (esGrupo && !d.nombre) throw new ApiError(400, "Ponga un nombre al grupo.");
      if (!esGrupo) {
        // Un solo chat directo por par de personas.
        const existente = await prisma.conversacion.findFirst({
          where: {
            esGrupo: false,
            AND: [{ participantes: { some: { usuarioId: u.id } } }, { participantes: { some: { usuarioId: otros[0] } } }],
          },
          select: { id: true },
        });
        if (existente) return jsonConSesion({ conversacionId: existente.id }, u);
      }
      const c = await prisma.conversacion.create({
        data: {
          nombre: esGrupo ? d.nombre : null,
          esGrupo,
          creadaPorId: u.id,
          participantes: { create: [u.id, ...otros].map((usuarioId) => ({ usuarioId })) },
        },
        select: { id: true },
      });
      return jsonConSesion({ conversacionId: c.id }, u, { status: 201 });
    }

    await exigirParticipante(d.conversacionId, u.id);

    if (d.accion === "ENVIAR") {
      const ahora = new Date();
      const [m] = await prisma.$transaction([
        prisma.mensaje.create({
          data: { conversacionId: d.conversacionId, autorId: u.id, texto: d.texto },
          select: { id: true },
        }),
        prisma.conversacion.update({ where: { id: d.conversacionId }, data: { ultimoMensajeEl: ahora } }),
        prisma.participanteConversacion.update({
          where: { conversacionId_usuarioId: { conversacionId: d.conversacionId, usuarioId: u.id } },
          data: { ultimaLecturaEl: ahora },
        }),
      ]);
      return jsonConSesion({ mensajeId: m.id }, u, { status: 201 });
    }

    const c = await prisma.conversacion.findUnique({ where: { id: d.conversacionId }, select: { esGrupo: true } });
    if (!c?.esGrupo) throw new ApiError(400, "Solo los grupos admiten sumar o quitar personas.");

    if (d.accion === "AGREGAR") {
      const nuevos = [...new Set(d.participantes)];
      const validos = await prisma.usuario.count({ where: { id: { in: nuevos }, activo: true } });
      if (validos !== nuevos.length) throw new ApiError(400, "Elija personas activas del sistema.");
      await prisma.participanteConversacion.createMany({
        data: nuevos.map((usuarioId) => ({ conversacionId: d.conversacionId, usuarioId })),
        skipDuplicates: true,
      });
      return jsonConSesion({ guardado: true }, u);
    }

    await prisma.participanteConversacion.delete({
      where: { conversacionId_usuarioId: { conversacionId: d.conversacionId, usuarioId: u.id } },
    });
    return jsonConSesion({ guardado: true }, u);
  } catch (error) {
    return manejarError(error);
  }
}
