import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { prisma } from "./prisma";
import { ROLES, type Rol, type UsuarioSesion } from "./types";

export const COOKIE_SESION = "lue_session";

/**
 * Tiempo máximo de inactividad (10 minutos). El cliente cierra la sesión con
 * SessionTimeoutGuard; el servidor lo refuerza emitiendo tokens que vencen a los 10 minutos
 * y que solo se renuevan cuando hay actividad (cada respuesta autenticada los extiende).
 */
export const INACTIVIDAD_MS = 600_000;

function claveSecreta(): Uint8Array {
  const secreto = process.env.NEXTAUTH_SECRET;
  if (!secreto || secreto.length < 32) {
    throw new Error("NEXTAUTH_SECRET no está configurado o tiene menos de 32 caracteres.");
  }
  return new TextEncoder().encode(secreto);
}

function esRol(valor: unknown): valor is Rol {
  return typeof valor === "string" && (ROLES as readonly string[]).includes(valor);
}

export async function crearTokenSesion(usuario: UsuarioSesion): Promise<string> {
  return new SignJWT({ email: usuario.email, nombre: usuario.nombre, rol: usuario.rol })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(usuario.id)
    .setIssuedAt()
    .setExpirationTime(Math.floor((Date.now() + INACTIVIDAD_MS) / 1000))
    .sign(claveSecreta());
}

async function verificarTokenSesion(token: string): Promise<{ id: string } | null> {
  try {
    const { payload } = await jwtVerify(token, claveSecreta(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || !esRol(payload.rol)) return null;
    return { id: payload.sub };
  } catch {
    return null;
  }
}

/**
 * Devuelve el usuario autenticado o null. El rol se relee de la base en cada request:
 * si Dirección desactiva a un usuario o le cambia el rol, el efecto es inmediato.
 */
export async function obtenerUsuarioSesion(): Promise<UsuarioSesion | null> {
  const almacen = await cookies();
  const token = almacen.get(COOKIE_SESION)?.value;
  if (!token) return null;

  const datos = await verificarTokenSesion(token);
  if (!datos) return null;

  const usuario = await prisma.usuario.findUnique({
    where: { id: datos.id },
    select: { id: true, email: true, nombre: true, rol: true, activo: true },
  });
  if (!usuario || !usuario.activo) return null;

  return { id: usuario.id, email: usuario.email, nombre: usuario.nombre, rol: usuario.rol };
}

export async function establecerCookieSesion(res: NextResponse, usuario: UsuarioSesion): Promise<void> {
  res.cookies.set(COOKIE_SESION, await crearTokenSesion(usuario), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: INACTIVIDAD_MS / 1000,
  });
}

export function borrarCookieSesion(res: NextResponse): void {
  res.cookies.set(COOKIE_SESION, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}
