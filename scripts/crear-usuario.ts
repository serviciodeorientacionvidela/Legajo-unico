/**
 * Crea (o reactiva) un usuario real del sistema y le asigna una contraseña aleatoria.
 *
 *   npm run usuario:crear -- <email> "<Nombre Apellido>" <DIRECTIVO_SOE|PRECEPTOR|DOCENTE> [--dni=12345678] [--admin] [--password=...]
 *
 * La contraseña se genera acá y se muestra UNA sola vez por consola: entregarla al usuario por un canal
 * privado. Para fijarla a mano, usar --password o definir USUARIO_PASSWORD (mínimo 8 caracteres). Si el email ya existe, se actualizan nombre y rol, se reactiva y se le genera una contraseña nueva.
 * --admin marca la cuenta como administradora (puede crear y editar usuarios desde el sistema).
 */

import { randomBytes } from "node:crypto";
import { config as cargarEnv } from "dotenv";
import bcrypt from "bcryptjs";
import { PrismaClient, Rol } from "@prisma/client";

cargarEnv({ path: ".env.local" });
cargarEnv();

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const argumentos = process.argv.slice(2);
  const opcion = (nombre: string) =>
    argumentos.find((a) => a.startsWith(`--${nombre}=`))?.slice(nombre.length + 3);
  const esAdministrador = argumentos.includes("--admin");
  const dni = opcion("dni")?.replace(/\./g, "");
  if (dni !== undefined && !/^\d{7,8}$/.test(dni)) throw new Error(`DNI inválido: "${dni}".`);
  const [emailCrudo, nombre, rolCrudo] = argumentos.filter((a) => !a.startsWith("--"));
  const roles = Object.values(Rol);
  if (!emailCrudo || !nombre || !rolCrudo) {
    throw new Error(`Uso: npm run usuario:crear -- <email> "<Nombre Apellido>" <${roles.join("|")}>`);
  }
  const email = emailCrudo.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`Email inválido: "${emailCrudo}".`);
  const rol = rolCrudo.trim().toUpperCase() as Rol;
  if (!roles.includes(rol)) throw new Error(`Rol inválido: "${rolCrudo}". Opciones: ${roles.join(", ")}.`);

  const passwordFija = opcion("password") ?? process.env.USUARIO_PASSWORD;
  if (passwordFija !== undefined && passwordFija.length < 8) {
    throw new Error("USUARIO_PASSWORD debe tener al menos 8 caracteres.");
  }
  const password = passwordFija ?? randomBytes(12).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 12);

  const usuario = await prisma.usuario.upsert({
    where: { email },
    create: { email, nombre: nombre.trim(), rol, passwordHash, dni, esAdministrador },
    update: { nombre: nombre.trim(), rol, passwordHash, activo: true, dni, ...(esAdministrador && { esAdministrador }) },
  });

  console.log(`Usuario listo: ${usuario.email} (${usuario.rol}${usuario.esAdministrador ? ", administrador" : ""})`);
  console.log(`Contraseña: ${password}`);
  console.log("Guardala ahora: no se vuelve a mostrar.");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
