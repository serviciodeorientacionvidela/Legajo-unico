import { z } from "zod";
import {
  ApiError,
  DNI_REGEX,
  jsonConSesion,
  manejarError,
  obtenerIp,
  requerirSesion,
} from "@/lib/api";
import { prisma } from "@/lib/prisma";
import {
  obtenerPerfil,
  exigirCurso,
  exigirEquipo,
  seguimientoHabilitado,
} from "@/lib/seguimiento/permisos";
import {
  cargarSeguimiento,
  escribirSeguimiento,
  bandeja,
} from "@/lib/seguimiento/servicio";
import { generarReporte } from "@/lib/seguimiento/reportes";
import { perfilSchema, diaLocal } from "@/lib/seguimiento/reglas";
export const runtime = "nodejs";
export async function GET(req: Request) {
  try {
    const u = await requerirSesion();
    const q = new URL(req.url).searchParams;
    if (q.has("perfiles")) {
      if (!u.esAdministrador)
        throw new ApiError(403, "Solo administración configura perfiles.");
      return jsonConSesion(
        await prisma.usuario.findMany({
          where: { activo: true, rol: { not: "DOCENTE" } },
          select: {
            id: true,
            nombre: true,
            rol: true,
            perfilSeguimiento: true,
          },
        }),
        u,
      );
    }
    if (q.has("avisos")) {
      // Avisos sin leer del usuario (derivaciones nuevas, seguimientos), para mostrarlos al ingresar.
      if (!seguimientoHabilitado() || u.rol === "DOCENTE")
        return jsonConSesion({ avisos: [] }, u);
      const avisos = await prisma.notificacion.findMany({
        where: { usuarioId: u.id, leida: false },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          tipo: true,
          titulo: true,
          mensaje: true,
          createdAt: true,
          estudiante: { select: { dni: true } },
        },
      });
      return jsonConSesion(
        {
          avisos: avisos.map((a) => ({
            id: a.id,
            tipo: a.tipo,
            titulo: a.titulo,
            mensaje: a.mensaje,
            createdAt: a.createdAt.toISOString(),
            dni: a.estudiante?.dni ?? null,
          })),
        },
        u,
      );
    }
    const p = await obtenerPerfil(u);
    if (q.has("reporte")) {
      const n = z.coerce.number().int().min(1).max(12).parse(q.get("reporte"));
      const ciclo = z.coerce
        .number()
        .int()
        .min(2000)
        .max(2100)
        .parse(q.get("ciclo") ?? diaLocal().slice(0, 4));
      return jsonConSesion(
        await generarReporte(
          n,
          ciclo,
          q.get("curso") ?? "",
          q.get("estado") ?? "",
          p,
          u,
        ),
        u,
      );
    }
    const dni = q.get("dni");
    if (!dni) return jsonConSesion(await bandeja(p, u), u);
    if (!DNI_REGEX.test(dni)) throw new ApiError(400, "DNI inválido.");
    if (q.has("ficha")) {
      exigirEquipo(p);
      const tipo = z.enum(["SALUD", "PSICOSOCIAL"]).parse(q.get("ficha"));
      const e = await prisma.estudiante.findUnique({
        where: { dni },
        select: { id: true, anio: true, division: true, turno: true },
      });
      if (!e) throw new ApiError(404, "Estudiante inexistente.");
      exigirCurso(p, e);
      const ficha = await prisma.fichaAnexa.findUnique({
        where: { estudianteId_tipo: { estudianteId: e.id, tipo } },
      });
      await prisma.auditLog.create({
        data: {
          usuarioId: u.id,
          estudianteDni: dni,
          accion: "VER_FICHA_ANEXA",
          ipAddress: obtenerIp(req),
        },
      });
      return jsonConSesion(ficha, u);
    }
    return jsonConSesion(await cargarSeguimiento(dni, p, u), u);
  } catch (e) {
    return manejarError(e);
  }
}
export async function POST(req: Request) {
  try {
    const u = await requerirSesion();
    const body = z
      .object({
        dni: z.string().regex(DNI_REGEX).optional(),
        accion: z.string(),
        datos: z.unknown(),
      })
      .parse(await req.json());
    if (body.accion === "PERFIL") {
      if (!u.esAdministrador)
        throw new ApiError(403, "Solo administración configura perfiles.");
      const d = perfilSchema.parse(body.datos);
      const destinatario = await prisma.usuario.findUnique({
        where: { id: d.usuarioId },
        select: { rol: true },
      });
      if (
        !destinatario ||
        destinatario.rol === "DOCENTE" ||
        (destinatario.rol === "PRECEPTOR" && d.funcion !== "PRECEPTORIA")
      )
        throw new ApiError(400, "Perfil incompatible con el rol de la cuenta.");
      await prisma.$transaction([
        prisma.perfilSeguimiento.upsert({
          where: { usuarioId: d.usuarioId },
          create: d,
          update: { funcion: d.funcion, cursos: d.cursos },
        }),
        prisma.auditLog.create({
          data: {
            usuarioId: u.id,
            accion: "GESTIONAR_USUARIO",
            ipAddress: obtenerIp(req),
          },
        }),
      ]);
      return jsonConSesion({ guardado: true }, u);
    }
    const p = await obtenerPerfil(u);
    if (body.accion === "LEER_AVISO") {
      const d = z.object({ id: z.string() }).parse(body.datos);
      await prisma.notificacion.updateMany({
        where: { id: d.id, usuarioId: u.id },
        data: { leida: true, leidaEl: new Date() },
      });
      return jsonConSesion({ guardado: true }, u);
    }
    if (!body.dni) throw new ApiError(400, "Falta DNI.");
    if (body.accion === "IMPRIMIR") {
      await cargarSeguimiento(body.dni, p, u);
      await prisma.auditLog.create({
        data: {
          usuarioId: u.id,
          estudianteDni: body.dni,
          accion: "GENERAR_INFORME",
          ipAddress: obtenerIp(req),
        },
      });
      return jsonConSesion({ registrado: true }, u);
    }
    return jsonConSesion(
      await escribirSeguimiento(
        body.dni,
        body.accion,
        body.datos,
        p,
        u,
        obtenerIp(req),
      ),
      u,
    );
  } catch (e) {
    return manejarError(e);
  }
}
