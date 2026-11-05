-- Aviso con el resultado del barrido del GEI. Idempotente.
ALTER TYPE "TipoNotificacion" ADD VALUE IF NOT EXISTS 'GEI_SINCRONIZADO';
