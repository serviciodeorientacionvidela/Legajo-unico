import { PrismaClient } from "@prisma/client";

/**
 * Singleton de PrismaClient para Neon PostgreSQL.
 * En desarrollo, el hot-reload de Next.js re-evalúa los módulos: guardamos la instancia en
 * globalThis para no agotar el pool de conexiones de Neon.
 */
const globalParaPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalParaPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalParaPrisma.prisma = prisma;
}
