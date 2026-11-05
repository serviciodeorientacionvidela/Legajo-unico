import bcrypt from "bcryptjs";
import { ApiError, jsonConSesion, manejarError, obtenerIp, requerirSesion } from "@/lib/api";
import { registrarAuditoria } from "@/lib/audit";
import { cifrarClaveTemporal, descifrarClaveTemporal, generarClaveTemporal } from "@/lib/claveTemporal";
import { prisma } from "@/lib/prisma";
import { exigirAdministrador } from "@/lib/usuarios";

export const runtime = "nodejs";

/**
 * GET /api/usuarios/:id/clave — la cuenta técnica ve la contraseña temporal de un usuario, si todavía
 * no eligió la suya. Las contraseñas propias no se pueden ver (solo se guarda su hash).
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requerirSesion();
    exigirAdministrador(admin);
    const { id } = await params;
    const u = await prisma.usuario.findUnique({
      where: { id },
      select: { debeCambiarPassword: true, passwordTemporalCifrada: true },
    });
    if (!u) throw new ApiError(404, "Usuario inexistente.");
    const temporal = u.passwordTemporalCifrada ? descifrarClaveTemporal(u.passwordTemporalCifrada) : null;
    await registrarAuditoria(admin.id, null, "GESTIONAR_USUARIO", obtenerIp(req));
    return await jsonConSesion({ temporal, pendienteDeCambio: u.debeCambiarPassword }, admin);
  } catch (error) {
    return manejarError(error);
  }
}

/** POST /api/usuarios/:id/clave — genera una contraseña temporal nueva (la anterior deja de servir). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requerirSesion();
    exigirAdministrador(admin);
    const { id } = await params;
    if (id === admin.id) throw new ApiError(400, "Para su propia cuenta use «Cambiar contraseña».");
    const existe = await prisma.usuario.findUnique({ where: { id }, select: { id: true } });
    if (!existe) throw new ApiError(404, "Usuario inexistente.");
    const temporal = generarClaveTemporal();
    await prisma.usuario.update({
      where: { id },
      data: {
        passwordHash: await bcrypt.hash(temporal, 12),
        debeCambiarPassword: true,
        passwordTemporalCifrada: cifrarClaveTemporal(temporal),
      },
    });
    await registrarAuditoria(admin.id, null, "GESTIONAR_USUARIO", obtenerIp(req));
    return await jsonConSesion({ temporal, pendienteDeCambio: true }, admin);
  } catch (error) {
    return manejarError(error);
  }
}
