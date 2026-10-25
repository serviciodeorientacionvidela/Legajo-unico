import { z } from "zod";
import { DNI_REGEX, jsonConSesion, manejarError, requerirSesion } from "@/lib/api";
import { construirFiltroEstudiantes, obtenerMetricas } from "@/lib/consultas";
import { prisma } from "@/lib/prisma";
import { exigirPermiso, resumirEstudiante, tienePermiso } from "@/lib/rbac";
import { ESTADOS_MATRICULA } from "@/lib/types";
import {
  driveConfigurado,
  moverCarpetaPorPromocion,
  sincronizarEstructuraDrive,
} from "@/services/googleDriveService";

export const runtime = "nodejs";

const booleanoQuery = z
  .enum(["true", "false", "1", "0"])
  .optional()
  .transform((v) => v === "true" || v === "1");

const esquemaFiltros = z.object({
  q: z.string().trim().max(60).optional(),
  anio: z.coerce.number().int().min(1).max(5).optional(),
  division: z.string().trim().max(5).optional(),
  alertaPuntos: booleanoQuery,
  conCud: booleanoQuery,
  promedioBajo: booleanoQuery,
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(200).default(50),
});

/** GET /api/estudiantes — listado institucional con filtros y métricas del dashboard. */
export async function GET(req: Request) {
  try {
    const usuario = await requerirSesion();
    const params = Object.fromEntries(new URL(req.url).searchParams);
    const filtros = esquemaFiltros.parse(params);

    // El filtro por puntos revela información del régimen de convivencia.
    if (filtros.alertaPuntos) exigirPermiso(usuario.rol, "VER_CONVIVENCIA");

    const where = construirFiltroEstudiantes(filtros);
    const [filas, total, metricas] = await Promise.all([
      prisma.estudiante.findMany({
        where,
        orderBy: [{ apellidos: "asc" }, { nombres: "asc" }],
        skip: (filtros.pagina - 1) * filtros.porPagina,
        take: filtros.porPagina,
        include: { _count: { select: { calificaciones: { where: { previa: true } } } } },
      }),
      prisma.estudiante.count({ where }),
      obtenerMetricas(usuario.rol),
    ]);

    const estudiantes = filas.map(({ _count, ...e }) =>
      resumirEstudiante({ ...e, materiasPrevias: _count.calificaciones }, usuario.rol),
    );

    return await jsonConSesion(
      { estudiantes, total, pagina: filtros.pagina, porPagina: filtros.porPagina, metricas },
      usuario,
    );
  } catch (error) {
    return manejarError(error);
  }
}

const textoOpcional = (max: number) => z.string().trim().max(max).nullish();

const esquemaAlta = z.object({
  dni: z.string().regex(DNI_REGEX, "DNI inválido (7 u 8 dígitos)"),
  cuil: z.string().regex(/^\d{2}-?\d{8}-?\d$/, "CUIL inválido").nullish(),
  apellidos: z.string().trim().min(1).max(100),
  nombres: z.string().trim().min(1).max(100),
  fechaNacimiento: z.coerce.date().nullish(),
  anio: z.number().int().min(1).max(5),
  division: z.string().trim().min(1).max(5),
  turno: z.string().trim().min(1).max(20),
  estadoMatricula: z.enum(ESTADOS_MATRICULA).default("REGULAR"),
  sincronizarDrive: z.boolean().default(true),
  // --- Campos sensibles: solo DIRECTIVO_SOE ---
  tieneCud: z.boolean().optional(),
  vencimientoCud: z.coerce.date().nullish(),
  requierePpi: z.boolean().optional(),
  diagnosticoReservado: textoOpcional(5000),
  cudUrl: z.string().url().max(500).nullish(),
  observacionesConfidenciales: textoOpcional(5000),
});

const CAMPOS_SENSIBLES = [
  "tieneCud",
  "vencimientoCud",
  "requierePpi",
  "diagnosticoReservado",
  "cudUrl",
  "observacionesConfidenciales",
] as const;

/** POST /api/estudiantes — alta o actualización manual de un alumno + sincronización con Drive. */
export async function POST(req: Request) {
  try {
    const usuario = await requerirSesion();
    exigirPermiso(usuario.rol, "EDITAR_DATOS_BIOGRAFICOS");

    const cuerpo: unknown = await req.json();
    const datos = esquemaAlta.parse(cuerpo);

    const enviaSensibles = CAMPOS_SENSIBLES.some((campo) => datos[campo] !== undefined);
    if (enviaSensibles) exigirPermiso(usuario.rol, "VER_DATOS_CONFIDENCIALES");

    const biograficos = {
      cuil: datos.cuil ? datos.cuil.replace(/^(\d{2})-?(\d{8})-?(\d)$/, "$1-$2-$3") : null,
      apellidos: datos.apellidos,
      nombres: datos.nombres,
      fechaNacimiento: datos.fechaNacimiento ?? null,
      anio: datos.anio,
      division: datos.division,
      turno: datos.turno,
      estadoMatricula: datos.estadoMatricula,
    };
    const sensibles = tienePermiso(usuario.rol, "VER_DATOS_CONFIDENCIALES")
      ? Object.fromEntries(CAMPOS_SENSIBLES.filter((c) => datos[c] !== undefined).map((c) => [c, datos[c]]))
      : {};

    const previo = await prisma.estudiante.findUnique({
      where: { dni: datos.dni },
      select: { anio: true, division: true, driveFolderId: true },
    });

    let estudiante = await prisma.estudiante.upsert({
      where: { dni: datos.dni },
      create: { dni: datos.dni, ...biograficos, ...sensibles },
      update: { ...biograficos, ...sensibles },
    });

    const advertencias: string[] = [];
    if (datos.sincronizarDrive && !driveConfigurado()) {
      advertencias.push("Google Drive no está configurado: no se crearon carpetas.");
    } else if (datos.sincronizarDrive) {
      try {
        const cursoAnterior =
          previo?.driveFolderId && (previo.anio !== estudiante.anio || previo.division !== estudiante.division)
            ? previo
            : null;
        const carpetas = cursoAnterior
          ? await moverCarpetaPorPromocion(
              { ...estudiante, anio: cursoAnterior.anio, division: cursoAnterior.division },
              estudiante.anio,
              estudiante.division,
            )
          : await sincronizarEstructuraDrive(estudiante);
        estudiante = await prisma.estudiante.update({ where: { id: estudiante.id }, data: carpetas });
      } catch (error) {
        advertencias.push(`No se pudo sincronizar Google Drive: ${(error as Error).message}`);
      }
    }

    const materiasPrevias = await prisma.calificacionMateria.count({
      where: { estudianteId: estudiante.id, previa: true },
    });

    return await jsonConSesion(
      {
        creado: previo === null,
        estudiante: resumirEstudiante({ ...estudiante, materiasPrevias }, usuario.rol),
        advertencias,
      },
      usuario,
      { status: previo === null ? 201 : 200 },
    );
  } catch (error) {
    return manejarError(error);
  }
}
