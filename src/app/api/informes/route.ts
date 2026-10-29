import { z } from "zod";
import { ApiError, DNI_REGEX, jsonConSesion, manejarError, obtenerIp, requerirSesion } from "@/lib/api";
import { registrarAuditoria } from "@/lib/audit";
import { construirDatosInforme } from "@/lib/informes";
import { prisma } from "@/lib/prisma";
import { exigirPermiso, tienePermiso } from "@/lib/rbac";

export const runtime = "nodejs";

/**
 * GET /api/informes — Datos del informe institucional (Directivo / SOE y Preceptor).
 * Una fila sanitizada por estudiante regular + incidentes (si ve convivencia) + agenda del SOE
 * (solo Directivo / SOE, sin el texto clínico). Queda registrado en auditoría como GENERAR_INFORME.
 */
export async function GET(req: Request) {
  try {
    const usuario = await requerirSesion();
    exigirPermiso(usuario.rol, "GENERAR_INFORMES");
    const verSoe = tienePermiso(usuario.rol, "VER_DATOS_CONFIDENCIALES");
    const verConvivencia = tienePermiso(usuario.rol, "VER_CONVIVENCIA");

    const legajos = await prisma.estudiante.findMany({
      where: { estadoMatricula: "REGULAR" },
      include: {
        calificaciones: true,
        trayectoria: true,
        alertas: true,
        faltasIce: true,
        // Lo que el rol no puede ver ni siquiera se lee de la base.
        incidentes: { include: { autor: { select: { nombre: true } } }, take: verConvivencia ? undefined : 0 },
        intervenciones: { include: { profesional: { select: { nombre: true } } }, take: verSoe ? undefined : 0 },
      },
    });

    await registrarAuditoria(usuario.id, null, "GENERAR_INFORME", obtenerIp(req));
    return await jsonConSesion(construirDatosInforme(legajos, usuario.rol), usuario);
  } catch (error) {
    return manejarError(error);
  }
}

const esquemaRegistro = z.object({ dni: z.string().regex(DNI_REGEX, "DNI inválido") });

/**
 * POST /api/informes — Registra en auditoría la emisión de un informe individual (impresión / PDF)
 * del legajo de un estudiante. El contenido lo arma el navegador con el legajo ya sanitizado.
 */
export async function POST(req: Request) {
  try {
    const usuario = await requerirSesion();
    const { dni } = esquemaRegistro.parse(await req.json());
    const existe = await prisma.estudiante.count({ where: { dni } });
    if (!existe) throw new ApiError(404, "No existe un estudiante con ese DNI.");
    await registrarAuditoria(usuario.id, dni, "GENERAR_INFORME", obtenerIp(req));
    return await jsonConSesion({ registrado: true }, usuario, { status: 201 });
  } catch (error) {
    return manejarError(error);
  }
}
