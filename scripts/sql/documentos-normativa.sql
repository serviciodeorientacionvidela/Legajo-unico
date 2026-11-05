-- Documentos de la sección Normativa subidos por dirección / SOE. Idempotente.
ALTER TYPE "AccionAuditoria" ADD VALUE IF NOT EXISTS 'GESTIONAR_NORMATIVA';

CREATE TABLE IF NOT EXISTS "DocumentoNormativa" (
  "id" TEXT NOT NULL,
  "titulo" TEXT NOT NULL,
  "descripcion" TEXT,
  "nombreArchivo" TEXT NOT NULL,
  "tipoMime" TEXT NOT NULL,
  "tamanio" INTEGER NOT NULL,
  "contenido" BYTEA NOT NULL,
  "subidoPorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentoNormativa_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DocumentoNormativa_subidoPorId_fkey" FOREIGN KEY ("subidoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "DocumentoNormativa_createdAt_idx" ON "DocumentoNormativa"("createdAt");
