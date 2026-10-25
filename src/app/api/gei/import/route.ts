import { ApiError, jsonConSesion, manejarError, obtenerIp, requerirSesion } from "@/lib/api";
import { exigirPermiso } from "@/lib/rbac";
import { importarArchivoGei } from "@/services/geiSyncService";

export const runtime = "nodejs";
// La creación de carpetas en Drive para toda la escuela puede tardar (límite del plan de Vercel).
export const maxDuration = 300;

const TAMANO_MAXIMO_BYTES = 15 * 1024 * 1024;
const EXTENSIONES_VALIDAS = /\.(xlsx|xls|csv)$/i;

/** POST /api/gei/import — multipart/form-data con el campo "archivo" (Excel/CSV exportado del GEI). */
export async function POST(req: Request) {
  try {
    const usuario = await requerirSesion();
    exigirPermiso(usuario.rol, "IMPORTAR_GEI");

    const formulario = await req.formData();
    const archivo = formulario.get("archivo");
    if (!(archivo instanceof File)) throw new ApiError(400, 'Adjunte el reporte del GEI en el campo "archivo".');
    if (!EXTENSIONES_VALIDAS.test(archivo.name)) throw new ApiError(400, "Formato no soportado: use .xlsx, .xls o .csv.");
    if (archivo.size === 0) throw new ApiError(400, "El archivo está vacío.");
    if (archivo.size > TAMANO_MAXIMO_BYTES) throw new ApiError(413, "El archivo supera los 15 MB.");

    const cicloCrudo = formulario.get("cicloLectivo");
    const cicloLectivo = typeof cicloCrudo === "string" && /^\d{4}$/.test(cicloCrudo) ? Number(cicloCrudo) : undefined;
    const sincronizarDrive = formulario.get("sincronizarDrive") !== "false";

    const resultado = await importarArchivoGei(new Uint8Array(await archivo.arrayBuffer()), {
      usuarioId: usuario.id,
      nombreArchivo: archivo.name,
      cicloLectivo,
      sincronizarDrive,
      ipAddress: obtenerIp(req),
    });

    return await jsonConSesion(resultado, usuario);
  } catch (error) {
    return manejarError(error);
  }
}
