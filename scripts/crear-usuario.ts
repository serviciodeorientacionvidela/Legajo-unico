/**
 * Crea (o reactiva) un usuario real del sistema y le asigna una contraseña aleatoria.
 *
 *   npm run usuario:crear -- <email> "<Nombre Apellido>" <DIRECTIVO_SOE|PRECEPTOR|DOCENTE>
 *
 * La contraseña se genera acá y se muestra UNA sola vez por consola: entregarla al usuario por un canal
 * privado. Para fijarla a mano, definir USUARIO_PASSWORD (mínimo 8 caracteres). Si el email ya existe, se actualizan nombre y rol, se reactiva y se le genera una contraseña nueva.
 */

import { randomBytes } from "node:crypto";
import { config as cargarEnv } from "dotenv";
import bcrypt from "bcryptjs";
import { PrismaClient, Rol } from "@prisma/client";

cargarEnv({ path: ".env.local" });
cargarEnv();

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const [emailCrudo, nombre, rolCrudo] = process.argv.slice(2);
  const roles = Object.values(Rol);
  if (!emailCrudo || !nombre || !rolCrudo) {
    throw new Error(`Uso: npm run usuario:crear -- <email> "<Nombre Apellido>" <${roles.join("|")}>`);
  }
  const email = emailCrudo.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`Email inválido: "${emailCrudo}".`);
  const rol = rolCrudo.trim().toUpperCase() as Rol;
  if (!roles.includes(rol)) throw new Error(`Rol inválido: "${rolCrudo}". Opciones: ${roles.join(", ")}.`);

  const passwordFija = process.env.USUARIO_PASSWORD;
  if (passwordFija !== undefined && passwordFija.length < 8) {
    throw new Error("USUARIO_PASSWORD debe tener al menos 8 caracteres.");
  }
  const password = passwordFija ?? randomBytes(12).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 12);

  const usuario = await prisma.usuario.upsert({
    where: { email },
    create: { email, nombre: nombre.trim(), rol, passwordHash },
    update: { nombre: nombre.trim(), rol, passwordHash, activo: true },
  });

  console.log(`Usuario listo: ${usuario.email} (${usuario.rol})`);
  console.log(`Contraseña: ${password}`);
  console.log("Guardala ahora: no se vuelve a mostrar.");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
