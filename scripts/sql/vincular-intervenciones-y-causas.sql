-- Vincula intervenciones del SOE con actuaciones, agrega causa y número de acta,
-- y suma los tipos de actuación Género y Escuela domiciliaria. Idempotente.

ALTER TYPE "TipoActuacion" ADD VALUE IF NOT EXISTS 'GENERO';
ALTER TYPE "TipoActuacion" ADD VALUE IF NOT EXISTS 'ESCUELA_DOMICILIARIA';

ALTER TABLE "Actuacion" ADD COLUMN IF NOT EXISTS "causa" TEXT;
ALTER TABLE "Actuacion" ADD COLUMN IF NOT EXISTS "actaNumero" TEXT;

ALTER TABLE "IntervencionSoe" ADD COLUMN IF NOT EXISTS "actuacionId" TEXT;
CREATE INDEX IF NOT EXISTS "IntervencionSoe_actuacionId_idx" ON "IntervencionSoe"("actuacionId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'IntervencionSoe_actuacionId_fkey') THEN
    ALTER TABLE "IntervencionSoe" ADD CONSTRAINT "IntervencionSoe_actuacionId_fkey"
      FOREIGN KEY ("actuacionId") REFERENCES "Actuacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Cargos institucionales de los usuarios.
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "cargo" TEXT;

-- Derivación dirigida a un usuario puntual.
ALTER TABLE "Derivacion" ADD COLUMN IF NOT EXISTS "destinatarioId" TEXT;
CREATE INDEX IF NOT EXISTS "Derivacion_destinatarioId_estado_idx" ON "Derivacion"("destinatarioId", "estado");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Derivacion_destinatarioId_fkey') THEN
    ALTER TABLE "Derivacion" ADD CONSTRAINT "Derivacion_destinatarioId_fkey"
      FOREIGN KEY ("destinatarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Tickets de derivación y avisos nuevos.
ALTER TYPE "TipoNotificacion" ADD VALUE IF NOT EXISTS 'TICKET_ACTUALIZADO';
ALTER TYPE "TipoNotificacion" ADD VALUE IF NOT EXISTS 'MENSAJE_NUEVO';
ALTER TABLE "Derivacion" ADD COLUMN IF NOT EXISTS "numero" SERIAL;
CREATE UNIQUE INDEX IF NOT EXISTS "Derivacion_numero_key" ON "Derivacion"("numero");

-- Mensajería interna.
CREATE TABLE IF NOT EXISTS "Conversacion" (
  "id" TEXT NOT NULL,
  "nombre" TEXT,
  "esGrupo" BOOLEAN NOT NULL DEFAULT false,
  "creadaPorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ultimoMensajeEl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Conversacion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Conversacion_creadaPorId_fkey" FOREIGN KEY ("creadaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ParticipanteConversacion" (
  "conversacionId" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "ultimaLecturaEl" TIMESTAMP(3),
  "unidoEl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ParticipanteConversacion_pkey" PRIMARY KEY ("conversacionId", "usuarioId"),
  CONSTRAINT "ParticipanteConversacion_conversacionId_fkey" FOREIGN KEY ("conversacionId") REFERENCES "Conversacion"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ParticipanteConversacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ParticipanteConversacion_usuarioId_idx" ON "ParticipanteConversacion"("usuarioId");

CREATE TABLE IF NOT EXISTS "Mensaje" (
  "id" TEXT NOT NULL,
  "conversacionId" TEXT NOT NULL,
  "autorId" TEXT NOT NULL,
  "texto" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Mensaje_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Mensaje_conversacionId_fkey" FOREIGN KEY ("conversacionId") REFERENCES "Conversacion"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Mensaje_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Mensaje_conversacionId_createdAt_idx" ON "Mensaje"("conversacionId", "createdAt");
