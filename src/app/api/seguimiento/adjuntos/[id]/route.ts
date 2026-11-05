import { ApiError, manejarError, obtenerIp, requerirSesion } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { exigirCurso, obtenerPerfil } from "@/lib/seguimiento/permisos";

export const runtime = "nodejs";

/** GET /api/seguimiento/adjuntos/:id — muestra el acta escaneada a quien puede ver la actuación. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const u = await requerirSesion();
    const p = await obtenerPerfil(u);
    const { id } = await params;
    const adj = await prisma.adjuntoActuacion.findUnique({
      where: { id },
      select: {
        nombreArchivo: true,
        tipoMime: true,
        contenido: true,
        actuacion: {
          select: { confidencial: true, estudiante: { select: { dni: true, anio: true, division: true, turno: true } } },
        },
      },
    });
    if (!adj) throw new ApiError(404, "Adjunto inexistente.");
    exigirCurso(p, adj.actuacion.estudiante);
    if (adj.actuacion.confidencial && p.funcion === "PRECEPTORIA") {
      throw new ApiError(403, "Actuación reservada al SOE y dirección.");
    }
    await prisma.auditLog.create({
      data: { usuarioId: u.id, estudianteDni: adj.actuacion.estudiante.dni, accion: "VER_LEGAJO", ipAddress: obtenerIp(req) },
    });
    return new Response(new Uint8Array(adj.contenido), {
      headers: {
        "Content-Type": adj.tipoMime,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(adj.nombreArchivo)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return manejarError(error);
  }
}
