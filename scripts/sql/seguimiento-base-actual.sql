-- CreateEnum
CREATE TYPE "TipoActuacion" AS ENUM ('INASISTENCIAS', 'CONVIVENCIA_ICE', 'FAMILIA', 'SALUD', 'PROTOCOLO', 'ESCOLARIDAD_PROTEGIDA', 'DEPORTISTA_FEDERADO', 'INCLUSION_PPI', 'OTRA');

-- CreateEnum
CREATE TYPE "MotivoApertura" AS ENUM ('INASISTENCIAS', 'ICE_CERO', 'FALTA_GRAVE', 'PROTOCOLO', 'DERIVACION_SOE', 'CONDICIONALIDAD', 'ESCOLARIDAD_PROTEGIDA', 'PPI', 'DEPORTISTA_FEDERADO', 'OTRO');

-- CreateEnum
CREATE TYPE "DestinoDerivacion" AS ENUM ('INTERNA_PSICOPEDAGOGICA', 'INTERNA_SOCIAL', 'EXTERNA_ORGANISMO');

-- CreateEnum
CREATE TYPE "EstadoDerivacion" AS ENUM ('PENDIENTE', 'EN_CURSO', 'CERRADA');

-- CreateEnum
CREATE TYPE "EstadoSeguimiento" AS ENUM ('PROGRAMADO', 'REALIZADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TipoSituacion" AS ENUM ('CUD_EVALUACION', 'INGRESANTE', 'SALIDA', 'NO_ASISTE', 'CONDICIONAL_ICE', 'ESCOLARIDAD_PROTEGIDA', 'DEPORTISTA_FEDERADO', 'CONDICIONAL_INASISTENCIAS', 'EXTENSION_INASISTENCIAS', 'EMBARAZO_PATERNIDAD_LACTANCIA', 'ENFERMEDAD_APRENDIZAJE', 'JUDICIALIZADO', 'ESCUELA_DOMICILIARIA', 'CAMBIO_GENERO', 'OTRA');

-- CreateEnum
CREATE TYPE "EstadoSituacion" AS ENUM ('PENDIENTE', 'VIGENTE', 'CUMPLIDA', 'DENEGADA', 'DADA_DE_BAJA');

-- CreateEnum
CREATE TYPE "NivelAcceso" AS ENUM ('GENERAL', 'RESTRINGIDO', 'SOLO_DIRECCION');

-- CreateEnum
CREATE TYPE "TipoFichaAnexa" AS ENUM ('SALUD', 'PSICOSOCIAL');

-- CreateEnum
CREATE TYPE "TipoNotificacion" AS ENUM ('SEGUIMIENTO_PROXIMO', 'SEGUIMIENTO_HOY', 'SEGUIMIENTO_VENCIDO', 'DERIVACION_RECIBIDA', 'ALERTA_INASISTENCIAS', 'LEGAJO_ABIERTO', 'SITUACION_POR_VENCER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AccionAuditoria" ADD VALUE 'CARGAR_ACTUACION';
ALTER TYPE "AccionAuditoria" ADD VALUE 'CARGAR_DERIVACION';
ALTER TYPE "AccionAuditoria" ADD VALUE 'REGISTRAR_SEGUIMIENTO';
ALTER TYPE "AccionAuditoria" ADD VALUE 'GESTIONAR_SITUACION';
ALTER TYPE "AccionAuditoria" ADD VALUE 'VER_FICHA_ANEXA';
ALTER TYPE "AccionAuditoria" ADD VALUE 'EDITAR_FICHA_ANEXA';
ALTER TYPE "AccionAuditoria" ADD VALUE 'VER_REPORTE_RESTRINGIDO';

-- AlterEnum
ALTER TYPE "EstadoMatricula" ADD VALUE 'ABANDONO';

-- AlterTable
ALTER TABLE "Estudiante" ADD COLUMN     "aperturaIce" INTEGER,
ADD COLUMN     "aperturaInasistencias" DOUBLE PRECISION,
ADD COLUMN     "aperturaPendientes" INTEGER,
ADD COLUMN     "aperturaPromedio" DOUBLE PRECISION,
ADD COLUMN     "aperturaTrayectoria" JSONB,
ADD COLUMN     "detalleApertura" TEXT,
ADD COLUMN     "legajoAbiertoEl" TIMESTAMP(3),
ADD COLUMN     "motivoApertura" "MotivoApertura";

-- CreateTable
CREATE TABLE "Actuacion" (
    "anuladaEl" TIMESTAMP(3),
    "anuladaPorId" TEXT,
    "motivoAnulacion" TEXT,
    "id" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "cicloLectivo" INTEGER NOT NULL,
    "tipo" "TipoActuacion" NOT NULL,
    "motivo" TEXT NOT NULL,
    "resumen" TEXT NOT NULL,
    "tipoActa" TEXT,
    "actaLibro" TEXT,
    "actaFolio" TEXT,
    "confidencial" BOOLEAN NOT NULL DEFAULT false,
    "puntosIce" INTEGER,
    "incidenteId" TEXT,
    "derivacionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Actuacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerfilSeguimiento" (
    "usuarioId" TEXT NOT NULL,
    "funcion" TEXT NOT NULL,
    "cursos" JSONB NOT NULL,

    CONSTRAINT "PerfilSeguimiento_pkey" PRIMARY KEY ("usuarioId")
);

-- CreateTable
CREATE TABLE "Derivacion" (
    "id" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "derivadoPorId" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "profesionalSoeId" TEXT,
    "recibidaEl" TIMESTAMP(3),
    "accionesSoe" TEXT,
    "respuesta" TEXT,
    "destino" "DestinoDerivacion",
    "organismoExterno" TEXT,
    "estado" "EstadoDerivacion" NOT NULL DEFAULT 'PENDIENTE',
    "cerradaEl" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Derivacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeguimientoCaso" (
    "id" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "derivacionId" TEXT,
    "situacionId" TEXT,
    "responsableId" TEXT,
    "fechaProgramada" TIMESTAMP(3) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "estado" "EstadoSeguimiento" NOT NULL DEFAULT 'PROGRAMADO',
    "realizadoEl" TIMESTAMP(3),
    "resultado" TEXT,
    "avisoLue" BOOLEAN NOT NULL DEFAULT true,
    "avisoCorreo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeguimientoCaso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SituacionEspecial" (
    "id" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "tipo" "TipoSituacion" NOT NULL,
    "forma" TEXT,
    "aval" TEXT,
    "estado" "EstadoSituacion" NOT NULL DEFAULT 'VIGENTE',
    "nivelAcceso" "NivelAcceso" NOT NULL DEFAULT 'GENERAL',
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaVencimiento" TIMESTAMP(3),
    "fechaFin" TIMESTAMP(3),
    "detalle" JSONB,
    "observaciones" TEXT,
    "actuacionId" TEXT,
    "derivacionId" TEXT,
    "registradaPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SituacionEspecial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FichaAnexa" (
    "id" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "tipo" "TipoFichaAnexa" NOT NULL,
    "datos" JSONB NOT NULL,
    "cargadaPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FichaAnexa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notificacion" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" "TipoNotificacion" NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "enlace" TEXT,
    "estudianteId" TEXT,
    "seguimientoId" TEXT,
    "derivacionId" TEXT,
    "claveDedup" TEXT,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "leidaEl" TIMESTAMP(3),
    "correoEnviadoEl" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Actuacion_incidenteId_key" ON "Actuacion"("incidenteId");

-- CreateIndex
CREATE INDEX "Actuacion_estudianteId_fecha_idx" ON "Actuacion"("estudianteId", "fecha");

-- CreateIndex
CREATE INDEX "Actuacion_estudianteId_cicloLectivo_idx" ON "Actuacion"("estudianteId", "cicloLectivo");

-- CreateIndex
CREATE INDEX "Derivacion_estado_fecha_idx" ON "Derivacion"("estado", "fecha");

-- CreateIndex
CREATE INDEX "Derivacion_estudianteId_fecha_idx" ON "Derivacion"("estudianteId", "fecha");

-- CreateIndex
CREATE INDEX "SeguimientoCaso_estado_fechaProgramada_idx" ON "SeguimientoCaso"("estado", "fechaProgramada");

-- CreateIndex
CREATE INDEX "SeguimientoCaso_estudianteId_fechaProgramada_idx" ON "SeguimientoCaso"("estudianteId", "fechaProgramada");

-- CreateIndex
CREATE INDEX "SeguimientoCaso_responsableId_estado_idx" ON "SeguimientoCaso"("responsableId", "estado");

-- CreateIndex
CREATE INDEX "SituacionEspecial_tipo_estado_idx" ON "SituacionEspecial"("tipo", "estado");

-- CreateIndex
CREATE INDEX "SituacionEspecial_estudianteId_tipo_idx" ON "SituacionEspecial"("estudianteId", "tipo");

-- CreateIndex
CREATE INDEX "SituacionEspecial_fechaVencimiento_idx" ON "SituacionEspecial"("fechaVencimiento");

-- CreateIndex
CREATE UNIQUE INDEX "FichaAnexa_estudianteId_tipo_key" ON "FichaAnexa"("estudianteId", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "Notificacion_claveDedup_key" ON "Notificacion"("claveDedup");

-- CreateIndex
CREATE INDEX "Notificacion_usuarioId_leida_createdAt_idx" ON "Notificacion"("usuarioId", "leida", "createdAt");

-- AddForeignKey
ALTER TABLE "Actuacion" ADD CONSTRAINT "Actuacion_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Estudiante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actuacion" ADD CONSTRAINT "Actuacion_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actuacion" ADD CONSTRAINT "Actuacion_incidenteId_fkey" FOREIGN KEY ("incidenteId") REFERENCES "IncidenteConvivencia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actuacion" ADD CONSTRAINT "Actuacion_derivacionId_fkey" FOREIGN KEY ("derivacionId") REFERENCES "Derivacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfilSeguimiento" ADD CONSTRAINT "PerfilSeguimiento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Derivacion" ADD CONSTRAINT "Derivacion_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Estudiante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Derivacion" ADD CONSTRAINT "Derivacion_derivadoPorId_fkey" FOREIGN KEY ("derivadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Derivacion" ADD CONSTRAINT "Derivacion_profesionalSoeId_fkey" FOREIGN KEY ("profesionalSoeId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeguimientoCaso" ADD CONSTRAINT "SeguimientoCaso_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Estudiante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeguimientoCaso" ADD CONSTRAINT "SeguimientoCaso_derivacionId_fkey" FOREIGN KEY ("derivacionId") REFERENCES "Derivacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeguimientoCaso" ADD CONSTRAINT "SeguimientoCaso_situacionId_fkey" FOREIGN KEY ("situacionId") REFERENCES "SituacionEspecial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeguimientoCaso" ADD CONSTRAINT "SeguimientoCaso_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SituacionEspecial" ADD CONSTRAINT "SituacionEspecial_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Estudiante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SituacionEspecial" ADD CONSTRAINT "SituacionEspecial_actuacionId_fkey" FOREIGN KEY ("actuacionId") REFERENCES "Actuacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SituacionEspecial" ADD CONSTRAINT "SituacionEspecial_derivacionId_fkey" FOREIGN KEY ("derivacionId") REFERENCES "Derivacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SituacionEspecial" ADD CONSTRAINT "SituacionEspecial_registradaPorId_fkey" FOREIGN KEY ("registradaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FichaAnexa" ADD CONSTRAINT "FichaAnexa_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Estudiante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FichaAnexa" ADD CONSTRAINT "FichaAnexa_cargadaPorId_fkey" FOREIGN KEY ("cargadaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Estudiante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_seguimientoId_fkey" FOREIGN KEY ("seguimientoId") REFERENCES "SeguimientoCaso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_derivacionId_fkey" FOREIGN KEY ("derivacionId") REFERENCES "Derivacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
