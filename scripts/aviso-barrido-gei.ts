/**
 * Deja un aviso en el sistema con el resultado del barrido mensual del GEI.
 * Lo ejecuta scripts/gei-barrido-mensual.ps1 al terminar:
 *
 *   npx tsx scripts/aviso-barrido-gei.ts --ok    <ruta-del-log>
 *   npx tsx scripts/aviso-barrido-gei.ts --error <ruta-del-log>
 *
 * Toma del log solo las líneas de resumen (📊 / ✓ / ✗), que no contienen datos de alumnos.
 * El aviso llega a la cuenta de GEI_SYNC_USER_EMAIL y a los perfiles de Dirección.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { config as cargarEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";

cargarEnv({ path: ".env.local" });
cargarEnv();

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const [modo, rutaLog] = process.argv.slice(2);
  if (!["--ok", "--error"].includes(modo ?? "") || !rutaLog) {
    throw new Error("Uso: tsx scripts/aviso-barrido-gei.ts --ok|--error <ruta-del-log>");
  }
  const exito = modo === "--ok";
  const log = await readFile(rutaLog, "utf8").catch(() => "");
  const resumen = log
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^(📊|✓ Sincronización|✓ Descargados|✗)/u.test(l))
    .slice(-8)
    .join(" · ");

  const hoy = new Date().toLocaleDateString("es-AR", { timeZone: "America/Argentina/Mendoza" });
  const titulo = exito ? `Barrido GEI del ${hoy} completado` : `Barrido GEI del ${hoy} con errores`;
  const mensaje =
    (
      resumen ||
      (exito ? "Datos actualizados desde el GEI." : "No se completó. Revise el registro en la PC de la escuela.")
    ).slice(0, 900) + ` (registro: ${path.basename(rutaLog)})`;

  const email = process.env.GEI_SYNC_USER_EMAIL;
  const destinatarios = await prisma.usuario.findMany({
    where: {
      activo: true,
      OR: [...(email ? [{ email }] : []), { perfilSeguimiento: { funcion: "DIRECCION" } }],
    },
    select: { id: true },
  });
  await prisma.notificacion.createMany({
    data: destinatarios.map((d) => ({ usuarioId: d.id, tipo: "GEI_SINCRONIZADO" as const, titulo, mensaje })),
  });
  console.log(`Aviso enviado a ${destinatarios.length} usuario(s): ${titulo}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
