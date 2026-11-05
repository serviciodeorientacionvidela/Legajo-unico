-- Huella de la ficha del GEI: el barrido solo reescribe las fichas que cambiaron. Idempotente.
ALTER TABLE "Estudiante" ADD COLUMN IF NOT EXISTS "fichaGeiHash" TEXT;
