import { z } from "zod";
import { DNI_REGEX, jsonConSesion, manejarError, requerirSesion } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { exigirPermiso } from "@/lib/rbac";
import { ACCIONES_AUDITORIA, type RegistroAuditoriaVisible } from "@/lib/types";

export const runtime = "nodejs";

const esquemaConsulta = z.object({
  dni: z.string().regex(DNI_REGEX).optional(),
  accion: z.enum(ACCIONES_AUDITORIA).optional(),
  limite: z.coerce.number().int().min(1).max(3000).default(1000),
  /** AAAA-MM-DD, en hora de Mendoza. */
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/** GET /api/auditoria — Logs de acceso a legajos (solo DIRECTIVO_SOE). */
export async function GET(req: Request) {
  try {
    const usuario = await requerirSesion();
    exigirPermiso(usuario.rol, "VER_AUDITORIA");

    const { dni, accion, limite, desde, hasta } = esquemaConsulta.parse(Object.fromEntries(new URL(req.url).searchParams));
    const registros = await prisma.auditLog.findMany({
      where: {
        ...(dni ? { estudianteDni: dni } : {}),
        ...(accion ? { accion } : {}),
        ...(desde || hasta
          ? {
              createdAt: {
                ...(desde ? { gte: new Date(`${desde}T00:00:00-03:00`) } : {}),
                ...(hasta ? { lte: new Date(`${hasta}T23:59:59.999-03:00`) } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limite,
      include: { usuario: { select: { nombre: true, rol: true, cargo: true } } },
    });
    // Nombre del alumno de cada registro, para poder buscar por estudiante.
    const dnis = [...new Set(registros.map((r) => r.estudianteDni).filter((d): d is string => !!d))];
    const alumnos = dnis.length
      ? await prisma.estudiante.findMany({ where: { dni: { in: dnis } }, select: { dni: true, apellidos: true, nombres: true } })
      : [];
    const nombrePorDni = new Map(alumnos.map((a) => [a.dni, `${a.apellidos}, ${a.nombres}`]));

    const visibles: RegistroAuditoriaVisible[] = registros.map((r) => ({
      id: r.id,
      usuarioNombre: r.usuario.nombre,
      usuarioRol: r.usuario.rol,
      usuarioCargo: r.usuario.cargo,
      estudianteDni: r.estudianteDni,
      estudianteNombre: r.estudianteDni ? (nombrePorDni.get(r.estudianteDni) ?? null) : null,
      accion: r.accion,
      ipAddress: r.ipAddress,
      createdAt: r.createdAt.toISOString(),
    }));

    return await jsonConSesion({ registros: visibles }, usuario);
  } catch (error) {
    return manejarError(error);
  }
}
