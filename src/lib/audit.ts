import { prisma } from "./prisma";
import type { AccionAuditoria } from "./types";

/**
 * Registra un acceso o acción sobre datos personales (Ley 25.326, art. 9: seguridad de los datos).
 * Se espera (await) siempre antes de devolver datos: si la auditoría falla, la consulta falla.
 */
export async function registrarAuditoria(
  usuarioId: string,
  estudianteDni: string | null,
  accion: AccionAuditoria,
  ipAddress: string | null = null,
): Promise<void> {
  await prisma.auditLog.create({
    data: { usuarioId, estudianteDni, accion, ipAddress },
  });
}

/** Registra varias acciones de una misma consulta en una sola operación atómica. */
export async function registrarAuditorias(
  usuarioId: string,
  estudianteDni: string | null,
  acciones: AccionAuditoria[],
  ipAddress: string | null = null,
): Promise<void> {
  if (acciones.length === 0) return;
  await prisma.auditLog.createMany({
    data: acciones.map((accion) => ({ usuarioId, estudianteDni, accion, ipAddress })),
  });
}
