import { z } from "zod";
import { ApiError } from "./api";
import { ROLES, type UsuarioAdministrado, type UsuarioSesion } from "./types";

/** Tope de la foto como data URL (~150 KB de imagen); el navegador la reduce antes a 256 px. */
const FOTO_MAX_CARACTERES = 200_000;
const FOTO_REGEX = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;

export const esquemaFoto = z
  .string()
  .max(FOTO_MAX_CARACTERES, "La foto es demasiado grande.")
  .regex(FOTO_REGEX, "Formato de foto inválido (JPEG, PNG o WebP).");

export const esquemaPassword = z.string().min(8, "La contraseña debe tener al menos 8 caracteres.").max(200);

const esquemaDni = z
  .string()
  .trim()
  .transform((v) => v.replace(/\./g, ""))
  .pipe(z.string().regex(/^\d{7,8}$/, "El DNI debe tener 7 u 8 dígitos."));

export const esquemaNuevoUsuario = z.object({
  nombre: z.string().trim().min(3).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  dni: esquemaDni.nullable().optional(),
  rol: z.enum(ROLES),
  password: esquemaPassword,
  esAdministrador: z.boolean().optional(),
  foto: esquemaFoto.nullable().optional(),
});

export const esquemaEdicionUsuario = z.object({
  nombre: z.string().trim().min(3).max(120).optional(),
  email: z.string().trim().toLowerCase().email().max(200).optional(),
  dni: esquemaDni.nullable().optional(),
  rol: z.enum(ROLES).optional(),
  activo: z.boolean().optional(),
  esAdministrador: z.boolean().optional(),
  password: esquemaPassword.optional(),
  foto: esquemaFoto.nullable().optional(),
});

export function exigirAdministrador(usuario: UsuarioSesion): void {
  if (!usuario.esAdministrador) throw new ApiError(403, "Solo la cuenta administradora puede gestionar usuarios.");
}

export const SELECCION_USUARIO = {
  id: true,
  email: true,
  nombre: true,
  dni: true,
  rol: true,
  activo: true,
  esAdministrador: true,
  fotoActualizada: true,
  createdAt: true,
} as const;

export function aUsuarioAdministrado(u: {
  id: string;
  email: string;
  nombre: string;
  dni: string | null;
  rol: UsuarioAdministrado["rol"];
  activo: boolean;
  esAdministrador: boolean;
  fotoActualizada: Date | null;
  createdAt: Date;
}): UsuarioAdministrado {
  return {
    id: u.id,
    email: u.email,
    nombre: u.nombre,
    dni: u.dni,
    rol: u.rol,
    activo: u.activo,
    esAdministrador: u.esAdministrador,
    fotoVersion: u.fotoActualizada?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  };
}

/** Traduce el error de unicidad de Prisma (email o DNI repetido) a un mensaje claro. */
export function errorDuplicado(error: unknown): never {
  if (typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002") {
    const destino = (error as { meta?: { target?: unknown } }).meta?.target;
    const campo = String(destino ?? "").includes("dni") ? "DNI" : "email";
    throw new ApiError(409, `Ya existe un usuario con ese ${campo}.`);
  }
  throw error;
}
