/**
 * Deja UN aviso en el sistema con el resultado del barrido del GEI (no un aviso por alumno).
 * Lo ejecuta scripts/gei-barrido.ps1 al terminar:
 *
 *   npx tsx scripts/aviso-barrido-gei.ts --ok    <ruta-del-log>
 *   npx tsx scripts/aviso-barrido-gei.ts --error <ruta-del-log>
 *
 * El aviso dice de qué mes son los datos y resume cuántos alumnos quedaron con 20 o más
 * inasistencias o con ICE en 0; el detalle por alumno está en la bandeja de Seguimiento LUE.
 * Llega a la cuenta de GEI_SYNC_USER_EMAIL y a los perfiles de Dirección.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { config as cargarEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { cicloLectivoActual } from "../src/lib/ciclo";
import { inasistenciasAnuales } from "../src/lib/seguimiento/reglas";

cargarEnv({ path: ".env.local" });
cargarEnv();

const prisma = new PrismaClient();

/** Mes de los datos: el barrido del día 5 trae hasta el mes anterior, que es el último cerrado. */
function mesDeLosDatos(hoy = new Date()): string {
  const anterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  return anterior.toLocaleDateString("es-AR", { month: "long", year: "numeric", timeZone: "America/Argentina/Mendoza" });
}

async function main(): Promise<void> {
  const [modo, rutaLog] = process.argv.slice(2);
  if (!["--ok", "--error"].includes(modo ?? "") || !rutaLog) {
    throw new Error("Uso: tsx scripts/aviso-barrido-gei.ts --ok|--error <ruta-del-log>");
  }
  const exito = modo === "--ok";
  const mes = mesDeLosDatos();

  let titulo: string;
  let mensaje: string;
  if (exito) {
    const ciclo = cicloLectivoActual();
    const alumnos = await prisma.estudiante.findMany({
      where: { estadoMatricula: "REGULAR" },
      select: {
        puntosConvivencia: true,
        trayectoria: { where: { cicloLectivo: ciclo }, select: { cicloLectivo: true, activo: true, inasistencias: true } },
      },
    });
    const con20 = alumnos.filter((a) => (inasistenciasAnuales({ ...a, asistencias: [] }, ciclo) ?? 0) >= 20).length;
    const iceCero = alumnos.filter((a) => a.puntosConvivencia === 0).length;
    titulo = `Se actualizaron los datos del GEI de ${mes}`;
    mensaje = `${alumnos.length} alumnos regulares · ${con20} con 20 o más inasistencias · ${iceCero} con ICE en 0. El detalle está en Seguimiento LUE.`;
  } else {
    const bytes = await readFile(rutaLog).catch(() => Buffer.alloc(0));
    const error = bytes
      .toString("utf8")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.startsWith("✗"))
      .pop();
    titulo = `No se pudieron actualizar los datos del GEI de ${mes}`;
    mensaje = `${error ?? "El barrido terminó con errores."} Vuelva a ejecutar "Barrido GEI". (registro: ${path.basename(rutaLog)})`;
  }

  const email = process.env.GEI_SYNC_USER_EMAIL;
  const destinatarios = await prisma.usuario.findMany({
    where: {
      activo: true,
      OR: [...(email ? [{ email }] : []), { perfilSeguimiento: { funcion: "DIRECCION" } }],
    },
    select: { id: true },
  });
  await prisma.notificacion.createMany({
    data: destinatarios.map((d) => ({ usuarioId: d.id, tipo: "GEI_SINCRONIZADO" as const, titulo, mensaje: mensaje.slice(0, 900) })),
  });
  console.log(`Aviso enviado a ${destinatarios.length} usuario(s): ${titulo}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
