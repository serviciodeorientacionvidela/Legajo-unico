import bcrypt from "bcryptjs";
import { z } from "zod";
import { ApiError, jsonConSesion, manejarError, obtenerIp, requerirSesion } from "@/lib/api";
import { registrarAuditoria } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { esquemaPassword } from "@/lib/usuarios";

export const runtime = "nodejs";

const esquema = z.object({
  actual: z.string().min(1, "Escriba su contraseña actual.").max(200),
  nueva: esquemaPassword,
});

/** POST /api/auth/password — cada usuario cambia su propia contraseña. */
export async function POST(req: Request) {
  try {
    const sesion = await requerirSesion();
    const d = esquema.parse(await req.json());
    const usuario = await prisma.usuario.findUnique({ where: { id: sesion.id }, select: { passwordHash: true } });
    if (!usuario || !(await bcrypt.compare(d.actual, usuario.passwordHash))) {
      throw new ApiError(400, "La contraseña actual no es correcta.");
    }
    if (d.actual === d.nueva) throw new ApiError(400, "La contraseña nueva tiene que ser distinta de la actual.");
    if (/^(.)\1+$/.test(d.nueva) || /^(12345678|password|contraseña)/i.test(d.nueva)) {
      throw new ApiError(400, "Elija una contraseña menos fácil de adivinar.");
    }
    await prisma.usuario.update({
      where: { id: sesion.id },
      // La contraseña propia nunca queda legible: se borra la temporal cifrada.
      data: { passwordHash: await bcrypt.hash(d.nueva, 12), debeCambiarPassword: false, passwordTemporalCifrada: null },
    });
    await registrarAuditoria(sesion.id, null, "GESTIONAR_USUARIO", obtenerIp(req));
    return await jsonConSesion({ guardado: true }, { ...sesion, debeCambiarPassword: false });
  } catch (error) {
    return manejarError(error);
  }
}
