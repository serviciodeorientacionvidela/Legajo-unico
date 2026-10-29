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
import { PrismaClient, type Rol } from "@prisma/client";
import { crearLegajosDemo, PROFESIONAL_SOE_DEMO, USUARIOS_DEMO } from "../src/lib/demoData";

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

  for (const l of crearLegajosDemo()) {
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

  console.log("✓ Seed completo. Usuarios de prueba (contraseña = SEED_PASSWORD):");
  usuariosSemilla.forEach((u) => console.log(`  - ${u.email} (${u.rol})`));
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
