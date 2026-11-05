import { ApiError, jsonConSesion, manejarError, obtenerIp, requerirSesion } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { exigirCurso, obtenerPerfil } from "@/lib/seguimiento/permisos";

export const runtime = "nodejs";

/** Vercel acepta cuerpos de hasta ~4,5 MB; las fotos se achican en el navegador antes de subir. */
const TAMANIO_MAXIMO = 4 * 1024 * 1024;
const TIPOS = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

/**
 * POST /api/seguimiento/adjuntos — adjunta a una actuación la foto o el PDF del acta en papel
 * (multipart: actuacionId, archivo). Los adjuntos no se borran: dejan constancia del original.
 */
export async function POST(req: Request) {
  try {
    const u = await requerirSesion();
    const p = await obtenerPerfil(u);
    const form = await req.formData();
    const actuacionId = String(form.get("actuacionId") ?? "");
    const archivo = form.get("archivo");
    if (!(archivo instanceof File) || archivo.size === 0) throw new ApiError(400, "Elija la foto o el PDF del acta.");
    if (archivo.size > TAMANIO_MAXIMO) throw new ApiError(413, "El archivo supera los 4 MB.");
    if (!TIPOS.has(archivo.type)) throw new ApiError(400, "Formato no admitido. Use una foto (JPG o PNG) o un PDF.");

    const a = await prisma.actuacion.findUnique({
      where: { id: actuacionId },
      select: {
        id: true,
        confidencial: true,
        anuladaEl: true,
        estudiante: { select: { dni: true, anio: true, division: true, turno: true } },
      },
    });
    if (!a) throw new ApiError(404, "Actuación inexistente.");
    exigirCurso(p, a.estudiante);
    if (a.confidencial && p.funcion === "PRECEPTORIA") throw new ApiError(403, "Actuación reservada al SOE y dirección.");
    if (a.anuladaEl) throw new ApiError(409, "La actuación está anulada.");

    const adjunto = await prisma.adjuntoActuacion.create({
      data: {
        actuacionId: a.id,
        nombreArchivo: archivo.name.slice(0, 200) || "acta",
        tipoMime: archivo.type,
        tamanio: archivo.size,
        contenido: Buffer.from(await archivo.arrayBuffer()),
        subidoPorId: u.id,
      },
      select: { id: true },
    });
    await prisma.auditLog.create({
      data: { usuarioId: u.id, estudianteDni: a.estudiante.dni, accion: "CARGAR_ACTA", ipAddress: obtenerIp(req) },
    });
    return jsonConSesion({ id: adjunto.id }, u, { status: 201 });
  } catch (error) {
    return manejarError(error);
  }
}
