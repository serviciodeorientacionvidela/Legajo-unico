import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { ApiError } from "../api";
import type { UsuarioSesion } from "../types";
import { perfilSchema, type Perfil } from "./reglas";
export function seguimientoHabilitado() {
  return process.env.LUE_SEGUIMIENTO_HABILITADO === "true";
}
export async function obtenerPerfil(u: UsuarioSesion): Promise<Perfil> {
  if (!seguimientoHabilitado())
    throw new ApiError(
      503,
      "Seguimiento pendiente de habilitación: aplicar la migración y configurar los perfiles institucionales.",
    );
  if (u.rol === "DOCENTE")
    throw new ApiError(
      403,
      "El circuito de seguimiento corresponde a preceptoría, SOE y dirección.",
    );
  const p = await prisma.perfilSeguimiento.findUnique({
    where: { usuarioId: u.id },
  });
  if (!p)
    throw new ApiError(
      403,
      "Su cuenta necesita un perfil de seguimiento y sus cursos asignados por administración.",
    );
  const perfil = perfilSchema.parse(p);
  if (u.rol === "PRECEPTOR" && perfil.funcion !== "PRECEPTORIA")
    throw new ApiError(
      403,
      "Perfil institucional incompatible con el rol de la cuenta.",
    );
  return perfil;
}
export function filtroCurso(p: Perfil): Prisma.EstudianteWhereInput {
  return p.funcion === "PRECEPTORIA"
    ? { OR: p.cursos.length ? p.cursos : [{ id: "__sin_cursos__" }] }
    : {};
}
export function exigirCurso(
  p: Perfil,
  e: { anio: number; division: string; turno: string },
) {
  if (
    p.funcion === "PRECEPTORIA" &&
    !p.cursos.some(
      (c) =>
        c.anio === e.anio && c.division === e.division && c.turno === e.turno,
    )
  )
    throw new ApiError(
      403,
      "Este estudiante no pertenece a sus cursos asignados.",
    );
}
export function exigirEquipo(p: Perfil) {
  if (p.funcion === "PRECEPTORIA")
    throw new ApiError(403, "Acceso exclusivo de SOE y dirección.");
}
export function exigirDireccion(p: Perfil) {
  if (p.funcion !== "DIRECCION")
    throw new ApiError(403, "Acceso exclusivo de dirección.");
}
export async function restringirCursoExistente(
  u: UsuarioSesion,
  e: { anio: number; division: string; turno: string },
) {
  if (seguimientoHabilitado() && u.rol === "PRECEPTOR")
    exigirCurso(await obtenerPerfil(u), e);
}
