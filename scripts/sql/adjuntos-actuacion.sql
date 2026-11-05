-- Actas en papel escaneadas (foto o PDF) adjuntas a actuaciones. Idempotente.
CREATE TABLE IF NOT EXISTS "AdjuntoActuacion" (
  "id" TEXT NOT NULL,
  "actuacionId" TEXT NOT NULL,
  "nombreArchivo" TEXT NOT NULL,
  "tipoMime" TEXT NOT NULL,
  "tamanio" INTEGER NOT NULL,
  "contenido" BYTEA NOT NULL,
  "subidoPorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdjuntoActuacion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdjuntoActuacion_actuacionId_fkey" FOREIGN KEY ("actuacionId") REFERENCES "Actuacion"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AdjuntoActuacion_subidoPorId_fkey" FOREIGN KEY ("subidoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "AdjuntoActuacion_actuacionId_idx" ON "AdjuntoActuacion"("actuacionId");
