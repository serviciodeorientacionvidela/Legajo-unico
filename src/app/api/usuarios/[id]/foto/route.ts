import { NextResponse } from "next/server";
import { ApiError, manejarError, requerirSesion } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/** GET /api/usuarios/:id/foto — foto de perfil (solo usuarios autenticados). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requerirSesion();
    const { id } = await params;
    const u = await prisma.usuario.findUnique({ where: { id }, select: { fotoPerfil: true } });
    const [, tipo, base64] = u?.fotoPerfil?.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/) ?? [];
    if (!tipo || !base64) throw new ApiError(404, "El usuario no tiene foto de perfil.");
    return new NextResponse(Buffer.from(base64, "base64"), { headers: { "Content-Type": tipo } });
  } catch (error) {
    return manejarError(error);
  }
}
