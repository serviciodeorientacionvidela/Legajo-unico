import bcrypt from "bcryptjs";
import { jsonConSesion, manejarError, obtenerIp, requerirSesion } from "@/lib/api";
import { registrarAuditoria } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import {
  aUsuarioAdministrado,
  errorDuplicado,
  esquemaNuevoUsuario,
  exigirAdministrador,
  SELECCION_USUARIO,
} from "@/lib/usuarios";

export const runtime = "nodejs";

/** GET /api/usuarios — listado de usuarios (solo cuenta administradora). */
export async function GET() {
  try {
    const usuario = await requerirSesion();
    exigirAdministrador(usuario);
    const usuarios = await prisma.usuario.findMany({ select: SELECCION_USUARIO, orderBy: { nombre: "asc" } });
    return await jsonConSesion({ usuarios: usuarios.map(aUsuarioAdministrado) }, usuario);
  } catch (error) {
    return manejarError(error);
  }
}

/** POST /api/usuarios — alta de un usuario nuevo. */
export async function POST(req: Request) {
  try {
    const usuario = await requerirSesion();
    exigirAdministrador(usuario);
    const datos = esquemaNuevoUsuario.parse(await req.json());

    const creado = await prisma.usuario
      .create({
        data: {
          nombre: datos.nombre,
          email: datos.email,
          dni: datos.dni ?? null,
          rol: datos.rol,
          esAdministrador: datos.esAdministrador ?? false,
          passwordHash: await bcrypt.hash(datos.password, 12),
          fotoPerfil: datos.foto ?? null,
          fotoActualizada: datos.foto ? new Date() : null,
        },
        select: SELECCION_USUARIO,
      })
      .catch(errorDuplicado);

    await registrarAuditoria(usuario.id, null, "GESTIONAR_USUARIO", obtenerIp(req));
    return await jsonConSesion({ usuario: aUsuarioAdministrado(creado) }, usuario, { status: 201 });
  } catch (error) {
    return manejarError(error);
  }
}
