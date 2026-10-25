import { ApiError, DNI_REGEX, jsonConSesion, manejarError, obtenerIp, requerirSesion } from "@/lib/api";
import { registrarAuditorias } from "@/lib/audit";
import { INCLUDE_LEGAJO } from "@/lib/consultas";
import { prisma } from "@/lib/prisma";
import { expusoDatosConfidenciales, sanitizarLegajo } from "@/lib/rbac";
import type { AccionAuditoria } from "@/lib/types";

export const runtime = "nodejs";

/**
 * GET /api/estudiantes/[dni] — Legajo unificado.
 * 1. Toda consulta queda registrada en AuditLog (VER_LEGAJO, y VER_CUD_SOE si se expusieron datos de salud),
 *    incluso si el DNI no existe. Si la auditoría falla, no se devuelven datos.
 * 2. El payload se arma por lista blanca según el rol (rbac.sanitizarLegajo): DOCENTE y PRECEPTOR
 *    nunca reciben diagnóstico, URL del CUD, observaciones ni informes del SOE.
 */
export async function GET(req: Request, { params }: { params: Promise<{ dni: string }> }) {
  try {
    const usuario = await requerirSesion();
    const { dni } = await params;
    if (!DNI_REGEX.test(dni)) throw new ApiError(400, "DNI inválido.");

    const legajo = await prisma.estudiante.findUnique({ where: { dni }, include: INCLUDE_LEGAJO });

    const acciones: AccionAuditoria[] = ["VER_LEGAJO"];
    if (legajo && expusoDatosConfidenciales(legajo, usuario.rol)) acciones.push("VER_CUD_SOE");
    await registrarAuditorias(usuario.id, dni, acciones, obtenerIp(req));

    if (!legajo) throw new ApiError(404, "No existe un estudiante con ese DNI.");

    return await jsonConSesion(sanitizarLegajo(legajo, usuario.rol), usuario);
  } catch (error) {
    return manejarError(error);
  }
}
