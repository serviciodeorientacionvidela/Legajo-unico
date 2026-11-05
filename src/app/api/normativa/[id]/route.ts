import { ApiError, jsonConSesion, manejarError, obtenerIp, requerirSesion } from "@/lib/api";
import { registrarAuditoria } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { exigirPermiso } from "@/lib/rbac";

export const runtime = "nodejs";

/** GET /api/normativa/:id — descarga del documento (cualquier usuario con sesión). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requerirSesion();
    const { id } = await params;
    const doc = await prisma.documentoNormativa.findUnique({
      where: { id },
      select: { nombreArchivo: true, tipoMime: true, contenido: true },
    });
    if (!doc) throw new ApiError(404, "Documento inexistente.");
    const nombre = encodeURIComponent(doc.nombreArchivo);
    return new Response(new Uint8Array(doc.contenido), {
      headers: {
        "Content-Type": doc.tipoMime,
        "Content-Disposition": `attachment; filename*=UTF-8''${nombre}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return manejarError(error);
  }
}

/** DELETE /api/normativa/:id — quitar un documento subido (solo Directivo / SOE). */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const u = await requerirSesion();
    exigirPermiso(u.rol, "GESTIONAR_NORMATIVA");
    const { id } = await params;
    const borrados = await prisma.documentoNormativa.deleteMany({ where: { id } });
    if (!borrados.count) throw new ApiError(404, "Documento inexistente.");
    await registrarAuditoria(u.id, null, "GESTIONAR_NORMATIVA", obtenerIp(req));
    return jsonConSesion({ borrado: true }, u);
  } catch (error) {
    return manejarError(error);
  }
}
