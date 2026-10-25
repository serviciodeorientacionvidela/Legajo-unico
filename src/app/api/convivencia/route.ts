import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ApiError, DNI_REGEX, jsonConSesion, manejarError, obtenerIp, requerirSesion } from "@/lib/api";
import { registrarAuditoria } from "@/lib/audit";
import { descuentoEfectivo, PUNTOS_INICIALES, validarPuntos } from "@/lib/convivencia";
import { prisma } from "@/lib/prisma";
import { exigirPermiso, tienePermiso } from "@/lib/rbac";
import { TIPOS_INCIDENTE } from "@/lib/types";

export const runtime = "nodejs";

const OPCIONES_TRANSACCION = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable } as const;

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

const esquemaIncidente = z.object({
  dni: z.string().regex(DNI_REGEX, "DNI inválido"),
  tipo: z.enum(TIPOS_INCIDENTE),
  puntosDescontados: z.number().int().min(0).max(PUNTOS_INICIALES),
  fecha: z.coerce.date().optional(),
  motivo: z.string().trim().min(5, "Describa el motivo (mínimo 5 caracteres)").max(2000),
  descargoAlumno: textoOpcional(2000),
  medidaAdoptada: textoOpcional(1000),
  notificadoFamilia: z.boolean().default(false),
  actaDriveUrl: z
    .string()
    .url()
    .max(500)
    .refine((u) => u.startsWith("https://drive.google.com/") || u.startsWith("https://docs.google.com/"), {
      message: "El acta debe ser un enlace de Google Drive",
    })
    .nullish()
    .transform((v) => v ?? null),
});

/**
 * POST /api/convivencia — Carga de un incidente.
 * - DIRECTIVO_SOE: el incidente queda aprobado y los puntos se descuentan en la misma transacción.
 * - PRECEPTOR: el incidente queda pendiente de aprobación (sin descuento hasta que Dirección apruebe).
 */
export async function POST(req: Request) {
  try {
    const usuario = await requerirSesion();
    exigirPermiso(usuario.rol, "CARGAR_INCIDENTE");

    const datos = esquemaIncidente.parse(await req.json());
    const errorPuntos = validarPuntos(datos.tipo, datos.puntosDescontados);
    if (errorPuntos) throw new ApiError(400, errorPuntos);

    const fecha = datos.fecha ?? new Date();
    if (fecha.getTime() > Date.now() + 60_000) throw new ApiError(400, "La fecha del incidente no puede ser futura.");

    const apruebaDirecto = tienePermiso(usuario.rol, "APROBAR_INCIDENTE");

    const resultado = await prisma.$transaction(async (tx) => {
      const estudiante = await tx.estudiante.findUnique({
        where: { dni: datos.dni },
        select: { id: true, puntosConvivencia: true },
      });
      if (!estudiante) throw new ApiError(404, "No existe un estudiante con ese DNI.");

      const puntos = apruebaDirecto
        ? descuentoEfectivo(estudiante.puntosConvivencia, datos.puntosDescontados)
        : datos.puntosDescontados;

      const actualizado = apruebaDirecto
        ? await tx.estudiante.update({
            where: { id: estudiante.id },
            data: { puntosConvivencia: { decrement: puntos } },
            select: { puntosConvivencia: true },
          })
        : estudiante;

      const incidente = await tx.incidenteConvivencia.create({
        data: {
          estudianteId: estudiante.id,
          autorId: usuario.id,
          fecha,
          tipo: datos.tipo,
          puntosDescontados: puntos,
          motivo: datos.motivo,
          descargoAlumno: datos.descargoAlumno,
          medidaAdoptada: datos.medidaAdoptada,
          notificadoFamilia: datos.notificadoFamilia,
          actaDriveUrl: datos.actaDriveUrl,
          aprobado: apruebaDirecto,
          aprobadoPorId: apruebaDirecto ? usuario.id : null,
        },
      });

      return { incidente, puntosConvivencia: actualizado.puntosConvivencia };
    }, OPCIONES_TRANSACCION);

    await registrarAuditoria(usuario.id, datos.dni, "CARGAR_ACTA", obtenerIp(req));

    return await jsonConSesion(
      {
        incidenteId: resultado.incidente.id,
        aprobado: resultado.incidente.aprobado,
        puntosDescontados: resultado.incidente.puntosDescontados,
        puntosConvivencia: resultado.puntosConvivencia,
      },
      usuario,
      { status: 201 },
    );
  } catch (error) {
    return manejarError(error);
  }
}

const esquemaResolucion = z.object({
  incidenteId: z.string().min(1).max(50),
  accion: z.enum(["APROBAR", "ANULAR"]),
});

/**
 * PATCH /api/convivencia — Solo DIRECTIVO_SOE.
 * - APROBAR: aprueba un incidente pendiente y descuenta los puntos.
 * - ANULAR (baja): anula el incidente y, si ya había descontado puntos, los restituye.
 */
export async function PATCH(req: Request) {
  try {
    const usuario = await requerirSesion();
    exigirPermiso(usuario.rol, "APROBAR_INCIDENTE");
    const { incidenteId, accion } = esquemaResolucion.parse(await req.json());

    const resultado = await prisma.$transaction(async (tx) => {
      const incidente = await tx.incidenteConvivencia.findUnique({
        where: { id: incidenteId },
        include: { estudiante: { select: { id: true, dni: true, puntosConvivencia: true } } },
      });
      if (!incidente) throw new ApiError(404, "Incidente inexistente.");
      if (incidente.anulado) throw new ApiError(409, "El incidente ya fue dado de baja.");

      const { estudiante } = incidente;

      if (accion === "APROBAR") {
        if (incidente.aprobado) throw new ApiError(409, "El incidente ya estaba aprobado.");
        const puntos = descuentoEfectivo(estudiante.puntosConvivencia, incidente.puntosDescontados);
        const actualizado = await tx.estudiante.update({
          where: { id: estudiante.id },
          data: { puntosConvivencia: { decrement: puntos } },
          select: { puntosConvivencia: true },
        });
        await tx.incidenteConvivencia.update({
          where: { id: incidente.id },
          data: { aprobado: true, aprobadoPorId: usuario.id, puntosDescontados: puntos },
        });
        return { dni: estudiante.dni, puntosConvivencia: actualizado.puntosConvivencia };
      }

      const restitucion = incidente.aprobado ? incidente.puntosDescontados : 0;
      const actualizado = await tx.estudiante.update({
        where: { id: estudiante.id },
        data: { puntosConvivencia: Math.min(PUNTOS_INICIALES, estudiante.puntosConvivencia + restitucion) },
        select: { puntosConvivencia: true },
      });
      await tx.incidenteConvivencia.update({ where: { id: incidente.id }, data: { anulado: true } });
      return { dni: estudiante.dni, puntosConvivencia: actualizado.puntosConvivencia };
    }, OPCIONES_TRANSACCION);

    await registrarAuditoria(usuario.id, resultado.dni, "CARGAR_ACTA", obtenerIp(req));

    return await jsonConSesion({ incidenteId, accion, puntosConvivencia: resultado.puntosConvivencia }, usuario);
  } catch (error) {
    return manejarError(error);
  }
}
