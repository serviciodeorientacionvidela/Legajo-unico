import { PrismaClient } from "@prisma/client";

/**
 * Singleton de PrismaClient para Neon PostgreSQL.
 * En desarrollo, el hot-reload de Next.js re-evalúa los módulos: guardamos la instancia en
 * globalThis para no agotar el pool de conexiones de Neon.
 */
function crearPrisma() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    // El esquema de seguimiento aún no se migró en producción. Prisma incluye
    // todos los escalares por defecto, también en el RETURNING de las escrituras.
    // Omitir estos campos mantiene operativas las pantallas actuales hasta migrar
    // la base. Al habilitar seguimiento, retirar esta omisión tras la migración.
    omit: {
      estudiante: {
        legajoAbiertoEl: true,
        motivoApertura: true,
        detalleApertura: true,
        aperturaPromedio: true,
        aperturaPendientes: true,
        aperturaInasistencias: true,
        aperturaIce: true,
      },
    },
  });
}

const globalParaPrisma = globalThis as unknown as { prisma?: ReturnType<typeof crearPrisma> };

export const prisma = globalParaPrisma.prisma ?? crearPrisma();

if (process.env.NODE_ENV !== "production") {
  globalParaPrisma.prisma = prisma;
}
