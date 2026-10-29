import bcrypt from "bcryptjs";
import { ApiError, jsonConSesion, manejarError, obtenerIp, requerirSesion } from "@/lib/api";
import { registrarAuditoria } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { aUsuarioAdministrado, errorDuplicado, esquemaEdicionUsuario, SELECCION_USUARIO } from "@/lib/usuarios";

export const runtime = "nodejs";

/**
 * PATCH /api/usuarios/:id — edición de un usuario.
 * La cuenta administradora puede cambiar todo; cualquier usuario puede cambiar solo su propia foto.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const usuario = await requerirSesion();
    const { id } = await params;
    const datos = esquemaEdicionUsuario.parse(await req.json());
    const propio = id === usuario.id;

    if (!usuario.esAdministrador) {
      const soloFoto = Object.keys(datos).every((k) => k === "foto");
      if (!propio || !soloFoto) throw new ApiError(403, "Solo la cuenta administradora puede gestionar usuarios.");
    }
    if (propio && (datos.activo === false || datos.esAdministrador === false)) {
      throw new ApiError(400, "No puede desactivar su propia cuenta ni quitarse el permiso de administrador.");
    }

    const existe = await prisma.usuario.findUnique({ where: { id }, select: { id: true } });
    if (!existe) throw new ApiError(404, "Usuario inexistente.");

    const actualizado = await prisma.usuario
      .update({
        where: { id },
        data: {
          nombre: datos.nombre,
          email: datos.email,
          dni: datos.dni,
          rol: datos.rol,
          activo: datos.activo,
          esAdministrador: datos.esAdministrador,
          passwordHash: datos.password ? await bcrypt.hash(datos.password, 12) : undefined,
          ...(datos.foto !== undefined && {
            fotoPerfil: datos.foto,
            fotoActualizada: datos.foto ? new Date() : null,
          }),
        },
        select: SELECCION_USUARIO,
      })
      .catch(errorDuplicado);

    if (usuario.esAdministrador) await registrarAuditoria(usuario.id, null, "GESTIONAR_USUARIO", obtenerIp(req));
    return await jsonConSesion({ usuario: aUsuarioAdministrado(actualizado) }, usuario);
  } catch (error) {
    return manejarError(error);
  }
}
