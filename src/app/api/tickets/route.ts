import { z } from "zod";
import { ApiError, jsonConSesion, manejarError, obtenerIp, requerirSesion } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { obtenerPerfil } from "@/lib/seguimiento/permisos";

export const runtime = "nodejs";

const SELECCION_TICKET = {
  id: true,
  numero: true,
  fecha: true,
  motivo: true,
  estado: true,
  recibidaEl: true,
  cerradaEl: true,
  respuesta: true,
  createdAt: true,
  derivadoPor: { select: { id: true, nombre: true, cargo: true } },
  destinatario: { select: { id: true, nombre: true, cargo: true } },
  profesionalSoe: { select: { nombre: true } },
  estudiante: { select: { dni: true, apellidos: true, nombres: true, anio: true, division: true } },
} as const;

/**
 * Tickets = derivaciones vistas como bandeja de trabajo.
 * Enviados: las que derivó el usuario. Recibidos: las dirigidas a él, o al equipo si es SOE / dirección.
 */
export async function GET() {
  try {
    const u = await requerirSesion();
    const p = await obtenerPerfil(u);
    const equipo = p.funcion !== "PRECEPTORIA";
    const [enviados, recibidos] = await Promise.all([
      prisma.derivacion.findMany({
        where: { derivadoPorId: u.id },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: SELECCION_TICKET,
      }),
      prisma.derivacion.findMany({
        where: {
          derivadoPorId: { not: u.id },
          OR: [{ destinatarioId: u.id }, ...(equipo ? [{ destinatarioId: null }] : [])],
        },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: SELECCION_TICKET,
      }),
    ]);
    return jsonConSesion({ enviados, recibidos }, u);
  } catch (error) {
    return manejarError(error);
  }
}

const esquemaCambio = z.object({
  id: z.string().min(1).max(40),
  accion: z.enum(["RECIBIR", "RESOLVER"]),
  nota: z.string().trim().max(2000).default(""),
});

/** PATCH /api/tickets — marcar como recibido o resuelto (lo hace quien recibe). */
export async function PATCH(req: Request) {
  try {
    const u = await requerirSesion();
    const p = await obtenerPerfil(u);
    const d = esquemaCambio.parse(await req.json());
    const t = await prisma.derivacion.findUnique({
      where: { id: d.id },
      select: {
        id: true,
        numero: true,
        estado: true,
        recibidaEl: true,
        destinatarioId: true,
        derivadoPorId: true,
        estudianteId: true,
        estudiante: { select: { dni: true } },
      },
    });
    if (!t) throw new ApiError(404, "Ticket inexistente.");
    const puede = t.destinatarioId ? t.destinatarioId === u.id : p.funcion !== "PRECEPTORIA";
    if (!puede) throw new ApiError(403, "Solo quien recibe la derivación puede actualizar el ticket.");
    if (t.estado === "CERRADA") throw new ApiError(409, "El ticket ya está resuelto.");

    if (d.accion === "RESOLVER") {
      if (d.nota.length < 5) throw new ApiError(400, "Indique brevemente cómo se resolvió (mínimo 5 caracteres).");
      const pendientes = await prisma.seguimientoCaso.count({ where: { derivacionId: t.id, estado: "PROGRAMADO" } });
      if (pendientes) throw new ApiError(409, "Resuelva o cancele los seguimientos programados antes de cerrar el ticket.");
    }

    const ahora = new Date();
    await prisma.$transaction([
      prisma.derivacion.update({
        where: { id: t.id },
        data:
          d.accion === "RECIBIR"
            ? { estado: "EN_CURSO", recibidaEl: t.recibidaEl ?? ahora, profesionalSoeId: u.id }
            : {
                estado: "CERRADA",
                cerradaEl: ahora,
                recibidaEl: t.recibidaEl ?? ahora,
                respuesta: d.nota,
                profesionalSoeId: u.id,
              },
      }),
      prisma.notificacion.create({
        data: {
          usuarioId: t.derivadoPorId,
          tipo: "TICKET_ACTUALIZADO",
          titulo: `Ticket #${t.numero} ${d.accion === "RECIBIR" ? "recibido" : "resuelto"}`,
          mensaje:
            d.accion === "RECIBIR"
              ? `${u.nombre} recibió su derivación.`
              : `${u.nombre} resolvió su derivación: ${d.nota.slice(0, 140)}`,
          estudianteId: t.estudianteId,
          derivacionId: t.id,
          enlace: `/?seguimiento=${t.estudiante.dni}`,
        },
      }),
      prisma.auditLog.create({
        data: {
          usuarioId: u.id,
          estudianteDni: t.estudiante.dni,
          accion: "CARGAR_DERIVACION",
          ipAddress: obtenerIp(req),
        },
      }),
    ]);
    return jsonConSesion({ guardado: true }, u);
  } catch (error) {
    return manejarError(error);
  }
}
