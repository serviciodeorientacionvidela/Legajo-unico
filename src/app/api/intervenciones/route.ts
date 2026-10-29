import { z } from "zod";
import { ApiError, DNI_REGEX, jsonConSesion, manejarError, obtenerIp, requerirSesion } from "@/lib/api";
import { registrarAuditoria } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { exigirPermiso } from "@/lib/rbac";
import { TIPOS_INTERVENCION } from "@/lib/types";

export const runtime = "nodejs";

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

const esquemaIntervencion = z
  .object({
    dni: z.string().regex(DNI_REGEX, "DNI inválido"),
    fecha: z.coerce.date(),
    tipo: z.enum(TIPOS_INTERVENCION),
    participantes: textoOpcional(300),
    motivo: z.string().trim().min(5, "Indique el motivo (mínimo 5 caracteres)").max(300),
    informeConfidencial: z.string().trim().min(10, "Redacte el informe (mínimo 10 caracteres)").max(20000),
    acuerdosDocentes: z.string().trim().max(5000).default(""),
    archivoDriveUrl: z
      .string()
      .url()
      .max(500)
      .refine((u) => u.startsWith("https://drive.google.com/") || u.startsWith("https://docs.google.com/"), {
        message: "El informe adjunto debe ser un enlace de Google Drive",
      })
      .nullish()
      .transform((v) => v ?? null),
    proximoSeguimiento: z.coerce.date().nullish().transform((v) => v ?? null),
  })
  .refine((d) => d.fecha.getTime() <= Date.now() + 60_000, { message: "La fecha no puede ser futura.", path: ["fecha"] })
  .refine((d) => d.proximoSeguimiento === null || d.proximoSeguimiento.getTime() >= d.fecha.getTime(), {
    message: "El próximo seguimiento debe ser posterior a la intervención.",
    path: ["proximoSeguimiento"],
  });

/**
 * POST /api/intervenciones — Registro de una intervención del SOE (solo Directivo / SOE).
 * El informe es confidencial; los acuerdos para docentes se redactan sin datos clínicos y los ve
 * todo el equipo. Las intervenciones no se editan: se agrega una nueva (trazabilidad del legajo).
 */
export async function POST(req: Request) {
  try {
    const usuario = await requerirSesion();
    exigirPermiso(usuario.rol, "CARGAR_INTERVENCION_SOE");
    const datos = esquemaIntervencion.parse(await req.json());

    const estudiante = await prisma.estudiante.findUnique({ where: { dni: datos.dni }, select: { id: true } });
    if (!estudiante) throw new ApiError(404, "No existe un estudiante con ese DNI.");

    const intervencion = await prisma.intervencionSoe.create({
      data: {
        estudianteId: estudiante.id,
        profesionalId: usuario.id,
        fecha: datos.fecha,
        tipo: datos.tipo,
        participantes: datos.participantes,
        motivo: datos.motivo,
        informeConfidencial: datos.informeConfidencial,
        acuerdosDocentes: datos.acuerdosDocentes,
        archivoDriveUrl: datos.archivoDriveUrl,
        proximoSeguimiento: datos.proximoSeguimiento,
      },
    });

    await registrarAuditoria(usuario.id, datos.dni, "CARGAR_INTERVENCION", obtenerIp(req));
    return await jsonConSesion({ intervencionId: intervencion.id }, usuario, { status: 201 });
  } catch (error) {
    return manejarError(error);
  }
}
