-- Cambio de contraseña propio y contraseñas temporales de la cuenta técnica. Idempotente.
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "debeCambiarPassword" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "passwordTemporalCifrada" TEXT;
