import { jsonConSesion, manejarError, requerirSesion } from "@/lib/api";

export const runtime = "nodejs";

/** GET /api/auth/me — usuario actual. También funciona como "latido" que renueva la sesión activa. */
export async function GET() {
  try {
    const usuario = await requerirSesion();
    return await jsonConSesion({ usuario }, usuario);
  } catch (error) {
    return manejarError(error);
  }
}
