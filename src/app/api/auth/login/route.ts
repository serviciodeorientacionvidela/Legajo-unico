import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, manejarError, obtenerIp } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { establecerCookieSesion } from "@/lib/session";

export const runtime = "nodejs";

const esquemaLogin = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
});

// Hash de referencia para igualar el tiempo de respuesta cuando el email no existe.
let hashFicticio: string | null = null;
function obtenerHashFicticio(): string {
  hashFicticio ??= bcrypt.hashSync("lue-usuario-inexistente", 12);
  return hashFicticio;
}

const VENTANA_MS = 15 * 60 * 1000;
const INTENTOS_MAXIMOS = 5;
const intentosFallidos = new Map<string, { cantidad: number; desde: number }>();

function bloqueado(clave: string): boolean {
  const registro = intentosFallidos.get(clave);
  if (!registro) return false;
  if (Date.now() - registro.desde > VENTANA_MS) {
    intentosFallidos.delete(clave);
    return false;
  }
  return registro.cantidad >= INTENTOS_MAXIMOS;
}

function registrarFallo(clave: string): void {
  const registro = intentosFallidos.get(clave);
  if (!registro || Date.now() - registro.desde > VENTANA_MS) {
    intentosFallidos.set(clave, { cantidad: 1, desde: Date.now() });
  } else {
    registro.cantidad++;
  }
}

/** POST /api/auth/login */
export async function POST(req: Request) {
  try {
    const { email, password } = esquemaLogin.parse(await req.json());
    const clave = `${obtenerIp(req) ?? "sin-ip"}:${email}`;
    if (bloqueado(clave)) {
      throw new ApiError(429, "Demasiados intentos fallidos. Espere 15 minutos e intente nuevamente.");
    }

    const usuario = await prisma.usuario.findUnique({ where: { email } });
    const coincide = await bcrypt.compare(password, usuario?.passwordHash ?? obtenerHashFicticio());

    if (!usuario || !coincide || !usuario.activo) {
      registrarFallo(clave);
      throw new ApiError(401, "Email o contraseña incorrectos.");
    }
    intentosFallidos.delete(clave);

    const sesion = { id: usuario.id, email: usuario.email, nombre: usuario.nombre, rol: usuario.rol };
    const res = NextResponse.json({ usuario: sesion });
    await establecerCookieSesion(res, sesion);
    return res;
  } catch (error) {
    return manejarError(error);
  }
}
