import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AccesoDenegadoError } from "./rbac";
import { establecerCookieSesion, obtenerUsuarioSesion } from "./session";
import type { UsuarioSesion } from "./types";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function requerirSesion(): Promise<UsuarioSesion> {
  const usuario = await obtenerUsuarioSesion();
  if (!usuario) {
    throw new ApiError(401, "Sesión inexistente o expirada. Vuelva a iniciar sesión.");
  }
  return usuario;
}

/** Respuesta JSON autenticada: renueva la ventana de inactividad de la sesión. */
export async function jsonConSesion<T>(
  data: T,
  usuario: UsuarioSesion,
  init?: ResponseInit,
): Promise<NextResponse<T>> {
  const res = NextResponse.json(data, init);
  await establecerCookieSesion(res, usuario);
  return res;
}

export function manejarError(error: unknown): NextResponse<{ error: string; detalles?: unknown }> {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof AccesoDenegadoError) {
    return NextResponse.json({ error: "No tiene permisos para realizar esta acción." }, { status: 403 });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Datos inválidos.",
        detalles: error.issues.map((i) => ({ campo: i.path.join("."), mensaje: i.message })),
      },
      { status: 400 },
    );
  }
  console.error("[LUE] Error no controlado:", error);
  return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
}

export function obtenerIp(req: Request): string | null {
  const reenviada = req.headers.get("x-forwarded-for");
  if (reenviada) {
    const primera = reenviada.split(",")[0]?.trim();
    if (primera) return primera;
  }
  return req.headers.get("x-real-ip");
}

export const DNI_REGEX = /^\d{7,8}$/;
