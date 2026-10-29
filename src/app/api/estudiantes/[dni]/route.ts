import { z } from "zod";
import { ApiError, DNI_REGEX, jsonConSesion, manejarError, obtenerIp, requerirSesion } from "@/lib/api";
import { registrarAuditoria, registrarAuditorias } from "@/lib/audit";
import { INCLUDE_LEGAJO } from "@/lib/consultas";
import { prisma } from "@/lib/prisma";
import { exigirPermiso, expusoDatosConfidenciales, sanitizarLegajo } from "@/lib/rbac";
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

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

const esquemaConfidencial = z.object({
  tieneCud: z.boolean(),
  vencimientoCud: z.coerce.date().nullish().transform((v) => v ?? null),
  requierePpi: z.boolean(),
  diagnosticoReservado: textoOpcional(5000),
  cudUrl: z
    .string()
    .url()
    .max(500)
    .refine((u) => u.startsWith("https://drive.google.com/") || u.startsWith("https://docs.google.com/"), {
      message: "El certificado debe ser un enlace de Google Drive",
    })
    .nullish()
    .transform((v) => v ?? null),
  observacionesConfidenciales: textoOpcional(5000),
});

/**
 * PATCH /api/estudiantes/[dni] — Datos de salud e inclusión (CUD, PPI, diagnóstico). Solo Directivo / SOE.
 * Devuelve el legajo actualizado y queda registrado como EDITAR_CONFIDENCIAL.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ dni: string }> }) {
  try {
    const usuario = await requerirSesion();
    exigirPermiso(usuario.rol, "EDITAR_DATOS_CONFIDENCIALES");
    const { dni } = await params;
    if (!DNI_REGEX.test(dni)) throw new ApiError(400, "DNI inválido.");
    const datos = esquemaConfidencial.parse(await req.json());

    const existe = await prisma.estudiante.count({ where: { dni } });
    if (!existe) throw new ApiError(404, "No existe un estudiante con ese DNI.");

    const legajo = await prisma.estudiante.update({
      where: { dni },
      data: { ...datos, vencimientoCud: datos.tieneCud ? datos.vencimientoCud : null, cudUrl: datos.tieneCud ? datos.cudUrl : null },
      include: INCLUDE_LEGAJO,
    });

    await registrarAuditoria(usuario.id, dni, "EDITAR_CONFIDENCIAL", obtenerIp(req));
    return await jsonConSesion(sanitizarLegajo(legajo, usuario.rol), usuario);
  } catch (error) {
    return manejarError(error);
  }
}
