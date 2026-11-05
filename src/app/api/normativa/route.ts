import { ApiError, jsonConSesion, manejarError, obtenerIp, requerirSesion } from "@/lib/api";
import { registrarAuditoria } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { exigirPermiso } from "@/lib/rbac";

export const runtime = "nodejs";

/** Vercel acepta cuerpos de hasta ~4,5 MB por solicitud. */
const TAMANIO_MAXIMO = 4 * 1024 * 1024;

const TIPOS_PERMITIDOS = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
]);

/** GET /api/normativa — documentos subidos (sin el contenido). Lo ve cualquier usuario con sesión. */
export async function GET() {
  try {
    const u = await requerirSesion();
    const documentos = await prisma.documentoNormativa.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        titulo: true,
        descripcion: true,
        nombreArchivo: true,
        tipoMime: true,
        tamanio: true,
        createdAt: true,
        subidoPor: { select: { nombre: true } },
      },
    });
    return jsonConSesion({ documentos }, u);
  } catch (error) {
    return manejarError(error);
  }
}

/** POST /api/normativa — subir un documento (multipart: archivo, titulo, descripcion). Solo Directivo / SOE. */
export async function POST(req: Request) {
  try {
    const u = await requerirSesion();
    exigirPermiso(u.rol, "GESTIONAR_NORMATIVA");
    const form = await req.formData();
    const archivo = form.get("archivo");
    const titulo = String(form.get("titulo") ?? "").trim();
    const descripcion = String(form.get("descripcion") ?? "").trim();

    if (!(archivo instanceof File) || archivo.size === 0) throw new ApiError(400, "Elija un archivo.");
    if (titulo.length < 3 || titulo.length > 150) throw new ApiError(400, "El título debe tener entre 3 y 150 caracteres.");
    if (descripcion.length > 300) throw new ApiError(400, "La descripción admite hasta 300 caracteres.");
    if (archivo.size > TAMANIO_MAXIMO) throw new ApiError(413, "El archivo supera los 4 MB. Comprímalo o súbalo en partes.");
    if (!TIPOS_PERMITIDOS.has(archivo.type))
      throw new ApiError(400, "Formato no admitido. Use PDF, Word, Excel, JPG o PNG.");

    const doc = await prisma.documentoNormativa.create({
      data: {
        titulo,
        descripcion: descripcion || null,
        nombreArchivo: archivo.name.slice(0, 200),
        tipoMime: archivo.type,
        tamanio: archivo.size,
        contenido: Buffer.from(await archivo.arrayBuffer()),
        subidoPorId: u.id,
      },
      select: { id: true },
    });
    await registrarAuditoria(u.id, null, "GESTIONAR_NORMATIVA", obtenerIp(req));
    return jsonConSesion({ id: doc.id }, u, { status: 201 });
  } catch (error) {
    return manejarError(error);
  }
}
