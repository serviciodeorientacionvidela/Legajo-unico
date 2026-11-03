/**
 * Carga datos de prueba FICTICIOS en la base (los mismos casos del modo demostración)
 * y crea un usuario por rol para probar el login y el RBAC reales.
 *
 *   npm run db:seed
 *
 * La contraseña de los usuarios de prueba se toma de SEED_PASSWORD (obligatoria, mínimo 12 caracteres).
 * No ejecutar sobre la base de producción con alumnos reales.
 */

import { config as cargarEnv } from "dotenv";
import bcrypt from "bcryptjs";
import { Prisma, PrismaClient, type Rol } from "@prisma/client";
import { crearLegajosDemo, PROFESIONAL_SOE_DEMO, USUARIOS_DEMO } from "../src/lib/demoData";
import { crearSeguimientoDemo, DNIS_SEGUIMIENTO_DEMO, type AutorDemo } from "../src/lib/demoSeguimiento";
import type { LegajoFuente } from "../src/lib/types";

cargarEnv({ path: ".env.local" });
cargarEnv();

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const password = process.env.SEED_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error("Defina SEED_PASSWORD (mínimo 12 caracteres) en .env.local antes de ejecutar el seed.");
  }
  const passwordHash = await bcrypt.hash(password, 12);

  const usuariosSemilla = [...Object.values(USUARIOS_DEMO), PROFESIONAL_SOE_DEMO];
  const idsPorNombre = new Map<string, string>();
  for (const u of usuariosSemilla) {
    const creado = await prisma.usuario.upsert({
      where: { email: u.email },
      create: { email: u.email, nombre: u.nombre, rol: u.rol as Rol, passwordHash },
      update: { nombre: u.nombre, rol: u.rol as Rol, passwordHash, activo: true },
    });
    idsPorNombre.set(u.nombre, creado.id);
  }

  const idUsuario = (nombre: string): string => {
    const id = idsPorNombre.get(nombre);
    if (!id) throw new Error(`Usuario semilla inexistente: ${nombre}`);
    return id;
  };

  const legajos = crearLegajosDemo();
  const idsPorDni = new Map<string, string>();

  for (const l of legajos) {
    const datos = {
      cuil: l.cuil,
      apellidos: l.apellidos,
      nombres: l.nombres,
      fechaNacimiento: l.fechaNacimiento ? new Date(l.fechaNacimiento) : null,
      anio: l.anio,
      division: l.division,
      turno: l.turno,
      promedioGeneral: l.promedioGeneral,
      porcentajeAsistencia: l.porcentajeAsistencia,
      puntosConvivencia: l.puntosConvivencia,
      tieneCud: l.tieneCud,
      vencimientoCud: l.vencimientoCud ? new Date(l.vencimientoCud) : null,
      requierePpi: l.requierePpi,
      diagnosticoReservado: l.diagnosticoReservado,
      observacionesConfidenciales: l.observacionesConfidenciales,
      estadoMatricula: l.estadoMatricula,
      // Los enlaces de Drive de la demo son simulados: en la base quedan vacíos hasta sincronizar.
      cudUrl: null,
      driveFolderId: null,
      driveDocumentacionFolderId: null,
      driveConvivenciaFolderId: null,
      driveConfidencialFolderId: null,
    };

    const estudiante = await prisma.estudiante.upsert({
      where: { dni: l.dni },
      create: { dni: l.dni, ...datos },
      update: datos,
    });
    idsPorDni.set(l.dni, estudiante.id);

    // Relaciones: se regeneran completas para que el seed sea idempotente.
    await prisma.$transaction([
      prisma.calificacionMateria.deleteMany({ where: { estudianteId: estudiante.id } }),
      prisma.incidenteConvivencia.deleteMany({ where: { estudianteId: estudiante.id } }),
      prisma.intervencionSoe.deleteMany({ where: { estudianteId: estudiante.id } }),
      prisma.calificacionMateria.createMany({
        data: l.calificaciones.map((c) => ({
          estudianteId: estudiante.id,
          materia: c.materia,
          cicloLectivo: c.cicloLectivo,
          primerCuatrimestre: c.primerCuatrimestre,
          segundoCuatrimestre: c.segundoCuatrimestre,
          notaFinal: c.notaFinal,
          previa: c.previa,
        })),
      }),
      prisma.incidenteConvivencia.createMany({
        data: l.incidentes.map((i) => ({
          estudianteId: estudiante.id,
          autorId: idUsuario(i.autor.nombre),
          fecha: new Date(i.fecha),
          tipo: i.tipo,
          puntosDescontados: i.puntosDescontados,
          motivo: i.motivo,
          descargoAlumno: i.descargoAlumno,
          medidaAdoptada: i.medidaAdoptada,
          notificadoFamilia: i.notificadoFamilia,
          actaDriveUrl: null,
          aprobado: i.aprobado,
          aprobadoPorId: i.aprobado ? idUsuario(USUARIOS_DEMO.DIRECTIVO_SOE.nombre) : null,
          anulado: i.anulado,
        })),
      }),
      prisma.intervencionSoe.createMany({
        data: l.intervenciones.map((i) => ({
          estudianteId: estudiante.id,
          profesionalId: idUsuario(i.profesional.nombre),
          fecha: new Date(i.fecha),
          tipo: i.tipo,
          participantes: i.participantes,
          proximoSeguimiento: i.proximoSeguimiento ? new Date(i.proximoSeguimiento) : null,
          motivo: i.motivo,
          informeConfidencial: i.informeConfidencial,
          acuerdosDocentes: i.acuerdosDocentes,
          archivoDriveUrl: null,
        })),
      }),
    ]);
  }

  const nombrePorAutor: Record<AutorDemo, string> = {
    DIRECTIVO: USUARIOS_DEMO.DIRECTIVO_SOE.nombre,
    PRECEPTOR: USUARIOS_DEMO.PRECEPTOR.nombre,
    SOE: PROFESIONAL_SOE_DEMO.nombre,
  };
  await cargarSeguimientoDemo(
    legajos,
    (dni) => {
      const id = idsPorDni.get(dni);
      if (!id) throw new Error(`Alumno semilla inexistente: ${dni}`);
      return id;
    },
    (autor) => idUsuario(nombrePorAutor[autor]),
  );

  console.log("✓ Seed completo. Usuarios de prueba (contraseña = SEED_PASSWORD):");
  usuariosSemilla.forEach((u) => console.log(`  - ${u.email} (${u.rol})`));
}

/**
 * Actuaciones, derivaciones, seguimientos, situaciones, fichas anexas y avisos de demostración.
 * Se borran y se vuelven a crear (con ids fijos) solo para los alumnos de DNIS_SEGUIMIENTO_DEMO.
 */
async function cargarSeguimientoDemo(
  legajos: LegajoFuente[],
  idEstudiante: (dni: string) => string,
  idUsuarioAutor: (autor: AutorDemo) => string,
): Promise<void> {
  const demo = crearSeguimientoDemo();
  const estudianteIds = DNIS_SEGUIMIENTO_DEMO.map(idEstudiante);
  const deEstos = { estudianteId: { in: estudianteIds } };
  const fecha = (iso: string | null): Date | null => (iso ? new Date(iso) : null);

  // Incidentes de convivencia ya creados arriba, para vincular la quita de puntos ICE.
  const incidentesDemo = new Map(legajos.flatMap((l) => l.incidentes.map((i) => [i.id, { dni: l.dni, ...i }] as const)));
  const idIncidente = async (incidenteDemoId: string | null): Promise<string | null> => {
    if (!incidenteDemoId) return null;
    const inc = incidentesDemo.get(incidenteDemoId);
    if (!inc) throw new Error(`Incidente semilla inexistente: ${incidenteDemoId}`);
    const enBase = await prisma.incidenteConvivencia.findFirst({
      where: { estudianteId: idEstudiante(inc.dni), fecha: new Date(inc.fecha), motivo: inc.motivo },
      select: { id: true },
    });
    return enBase?.id ?? null;
  };

  const actuaciones = await Promise.all(
    demo.actuaciones.map(async (a) => ({
      id: a.id,
      estudianteId: idEstudiante(a.dni),
      autorId: idUsuarioAutor(a.autor),
      fecha: new Date(a.fecha),
      cicloLectivo: a.cicloLectivo,
      tipo: a.tipo,
      motivo: a.motivo,
      resumen: a.resumen,
      tipoActa: a.tipoActa,
      actaLibro: a.actaLibro,
      actaFolio: a.actaFolio,
      confidencial: a.confidencial,
      puntosIce: a.puntosIce,
      incidenteId: await idIncidente(a.incidenteDemoId),
      derivacionId: a.derivacionId,
    })),
  );

  await prisma.$transaction([
    // Orden: primero lo que referencia a otros registros.
    prisma.notificacion.deleteMany({ where: deEstos }),
    prisma.seguimientoCaso.deleteMany({ where: deEstos }),
    prisma.situacionEspecial.deleteMany({ where: deEstos }),
    prisma.actuacion.deleteMany({ where: deEstos }),
    prisma.derivacion.deleteMany({ where: deEstos }),
    prisma.fichaAnexa.deleteMany({ where: deEstos }),
    ...DNIS_SEGUIMIENTO_DEMO.map((dni) => {
      const a = demo.aperturas.find((x) => x.dni === dni);
      return prisma.estudiante.update({
        where: { id: idEstudiante(dni) },
        data: {
          legajoAbiertoEl: fecha(a?.fecha ?? null),
          motivoApertura: a?.motivo ?? null,
          detalleApertura: a?.detalle ?? null,
          aperturaPromedio: a?.promedio ?? null,
          aperturaPendientes: a?.pendientes ?? null,
          aperturaInasistencias: a?.inasistencias ?? null,
          aperturaIce: a?.ice ?? null,
        },
      });
    }),
    prisma.derivacion.createMany({
      data: demo.derivaciones.map((d) => ({
        id: d.id,
        estudianteId: idEstudiante(d.dni),
        fecha: new Date(d.fecha),
        derivadoPorId: idUsuarioAutor(d.derivadoPor),
        motivo: d.motivo,
        profesionalSoeId: d.profesionalSoe ? idUsuarioAutor(d.profesionalSoe) : null,
        recibidaEl: fecha(d.recibidaEl),
        accionesSoe: d.accionesSoe,
        respuesta: d.respuesta,
        destino: d.destino,
        organismoExterno: d.organismoExterno,
        estado: d.estado,
        cerradaEl: fecha(d.cerradaEl),
      })),
    }),
    prisma.actuacion.createMany({ data: actuaciones }),
    prisma.situacionEspecial.createMany({
      data: demo.situaciones.map((s) => ({
        id: s.id,
        estudianteId: idEstudiante(s.dni),
        tipo: s.tipo,
        forma: s.forma,
        aval: s.aval,
        estado: s.estado,
        nivelAcceso: s.nivelAcceso,
        fechaInicio: new Date(s.fechaInicio),
        fechaVencimiento: fecha(s.fechaVencimiento),
        fechaFin: fecha(s.fechaFin),
        detalle: s.detalle ?? Prisma.JsonNull,
        observaciones: s.observaciones,
        actuacionId: s.actuacionId,
        derivacionId: s.derivacionId,
        registradaPorId: idUsuarioAutor(s.registradaPor),
      })),
    }),
    prisma.seguimientoCaso.createMany({
      data: demo.seguimientos.map((s) => ({
        id: s.id,
        estudianteId: idEstudiante(s.dni),
        derivacionId: s.derivacionId,
        situacionId: s.situacionId,
        responsableId: s.responsable ? idUsuarioAutor(s.responsable) : null,
        fechaProgramada: new Date(s.fechaProgramada),
        descripcion: s.descripcion,
        estado: s.estado,
        realizadoEl: fecha(s.realizadoEl),
        resultado: s.resultado,
        avisoLue: s.avisoLue,
        avisoCorreo: s.avisoCorreo,
      })),
    }),
    prisma.fichaAnexa.createMany({
      data: demo.fichas.map((f) => ({
        id: f.id,
        estudianteId: idEstudiante(f.dni),
        tipo: f.tipo,
        datos: f.datos,
        cargadaPorId: idUsuarioAutor(f.cargadaPor),
        createdAt: new Date(f.fecha),
      })),
    }),
    prisma.notificacion.createMany({
      data: demo.notificaciones.map((n) => ({
        id: n.id,
        usuarioId: idUsuarioAutor(n.para),
        tipo: n.tipo,
        titulo: n.titulo,
        mensaje: n.mensaje,
        estudianteId: idEstudiante(n.dni),
        seguimientoId: n.seguimientoId,
        derivacionId: n.derivacionId,
        leida: n.leida,
        createdAt: new Date(n.fecha),
      })),
    }),
  ]);

  console.log(
    `✓ Seguimiento demo: ${demo.actuaciones.length} actuaciones, ${demo.derivaciones.length} derivaciones, ` +
      `${demo.seguimientos.length} seguimientos, ${demo.situaciones.length} situaciones, ${demo.fichas.length} fichas anexas.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
