import { z } from "zod";
import { DNI_REGEX, jsonConSesion, manejarError, requerirSesion } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { exigirPermiso } from "@/lib/rbac";
import { ACCIONES_AUDITORIA, type RegistroAuditoriaVisible } from "@/lib/types";

export const runtime = "nodejs";

const esquemaConsulta = z.object({
  dni: z.string().regex(DNI_REGEX).optional(),
  accion: z.enum(ACCIONES_AUDITORIA).optional(),
  limite: z.coerce.number().int().min(1).max(500).default(100),
});

/** GET /api/auditoria — Logs de acceso a legajos (solo DIRECTIVO_SOE). */
export async function GET(req: Request) {
  try {
    const usuario = await requerirSesion();
    exigirPermiso(usuario.rol, "VER_AUDITORIA");

    const { dni, accion, limite } = esquemaConsulta.parse(Object.fromEntries(new URL(req.url).searchParams));
    const registros = await prisma.auditLog.findMany({
      where: { ...(dni ? { estudianteDni: dni } : {}), ...(accion ? { accion } : {}) },
      orderBy: { createdAt: "desc" },
      take: limite,
      include: { usuario: { select: { nombre: true, rol: true } } },
    });

    const visibles: RegistroAuditoriaVisible[] = registros.map((r) => ({
      id: r.id,
      usuarioNombre: r.usuario.nombre,
      usuarioRol: r.usuario.rol,
      estudianteDni: r.estudianteDni,
      accion: r.accion,
      ipAddress: r.ipAddress,
      createdAt: r.createdAt.toISOString(),
    }));

    return await jsonConSesion({ registros: visibles }, usuario);
  } catch (error) {
    return manejarError(error);
  }
}
