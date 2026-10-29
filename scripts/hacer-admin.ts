/**
 * Marca una cuenta existente como administradora (puede crear y editar usuarios desde el sistema).
 * No modifica la contraseña ni el rol.
 *
 *   npm run usuario:admin -- <email>
 */

import { config as cargarEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";

cargarEnv({ path: ".env.local" });
cargarEnv();

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error("Uso: npm run usuario:admin -- <email>");
  const usuario = await prisma.usuario.update({ where: { email }, data: { esAdministrador: true, activo: true } });
  console.log(`${usuario.nombre} (${usuario.email}) ahora es administrador.`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
