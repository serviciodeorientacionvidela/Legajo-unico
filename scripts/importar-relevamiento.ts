/**
 * Carga en el LUE las actas y situaciones que surgen del relevamiento de preceptoría
 * (planilla por curso con inasistencias, observaciones e ICE).
 *
 *   npx tsx scripts/importar-relevamiento.ts <casos.json> --usuario=<email> [--aplicar]
 *
 * Sin --aplicar solo muestra lo que haría. El JSON NO va al repositorio (datos de menores):
 *   { fuente, fecha: "AAAA-MM-DD",
 *     casos: [{ dni, curso, alumno,
 *               actuaciones: [{ tipo, causa, motivo, resumen, libro?, numero?, fecha?, confidencial? }],
 *               situaciones: [{ tipo, fecha?, vence?, sinAval?, obs? }] }] }
 * El alumno se busca por DNI. Asistencia e ICE NO se cargan: la fuente oficial es el GEI.
 * Es idempotente: no repite un acta (mismo libro y número) ni una situación del mismo tipo que siga
 * pendiente o vigente, venga de donde venga. Abre el legajo si hacía falta y registra la auditoría.
 */

import { readFileSync } from "node:fs";
import { config as cargarEnv } from "dotenv";
import { PrismaClient, type Prisma } from "@prisma/client";
import {
  NIVEL_ACCESO_SITUACION,
  TIPOS_ACTUACION,
  TIPOS_SITUACION,
  type MotivoApertura,
  type TipoActuacion,
  type TipoSituacion,
} from "../src/lib/types";
import { inasistenciasAnuales } from "../src/lib/seguimiento/reglas";

cargarEnv({ path: ".env.local" });
cargarEnv();

const CON_AVAL: TipoSituacion[] = ["CONDICIONAL_INASISTENCIAS", "EXTENSION_INASISTENCIAS"];

interface ActuacionEntrada {
  tipo: TipoActuacion;
  causa: string;
  motivo: string;
  resumen: string;
  libro?: string;
  numero?: string;
  fecha?: string;
  confidencial?: boolean;
}
interface SituacionEntrada {
  tipo: TipoSituacion;
  fecha?: string;
  vence?: string;
  sinAval?: boolean;
  obs?: string;
}
interface CasoEntrada {
  dni: string;
  curso: string;
  alumno: string;
  actuaciones: ActuacionEntrada[];
  situaciones: SituacionEntrada[];
}
interface Entrada {
  fuente: string;
  fecha: string;
  casos: CasoEntrada[];
}

function fecha(valor: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) throw new Error(`Fecha inválida: "${valor}" (use AAAA-MM-DD).`);
  return new Date(`${valor}T12:00:00.000Z`);
}

function validar(entrada: Entrada): void {
  fecha(entrada.fecha);
  for (const c of entrada.casos) {
    if (!/^\d{7,9}$/.test(c.dni)) throw new Error(`DNI inválido: "${c.dni}" (${c.alumno}).`);
    for (const a of c.actuaciones) {
      if (!TIPOS_ACTUACION.includes(a.tipo)) throw new Error(`Tipo de actuación inválido en ${c.alumno}.`);
      if (!a.motivo.trim() || !a.resumen.trim()) throw new Error(`Actuación sin motivo o resumen en ${c.alumno}.`);
      if (a.fecha) fecha(a.fecha);
    }
    for (const s of c.situaciones) {
      if (!TIPOS_SITUACION.includes(s.tipo)) throw new Error(`Tipo de situación inválido en ${c.alumno}.`);
      if (s.fecha) fecha(s.fecha);
      if (s.vence) fecha(s.vence);
    }
  }
}

function motivoApertura(caso: CasoEntrada, faltas: number | null): MotivoApertura {
  if (caso.actuaciones.some((a) => a.tipo === "PROTOCOLO")) return "PROTOCOLO";
  if (caso.situaciones.some((s) => s.tipo === "CONDICIONAL_INASISTENCIAS")) return "CONDICIONALIDAD";
  if (faltas !== null && faltas >= 20) return "INASISTENCIAS";
  return "DERIVACION_SOE";
}

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const ruta = args.find((a) => !a.startsWith("--"));
  const email = args.find((a) => a.startsWith("--usuario="))?.slice(10).trim().toLowerCase();
  const aplicar = args.includes("--aplicar");
  if (!ruta || !email)
    throw new Error("Uso: npx tsx scripts/importar-relevamiento.ts <casos.json> --usuario=<email> [--aplicar]");

  const entrada = JSON.parse(readFileSync(ruta, "utf8")) as Entrada;
  validar(entrada);
  const fechaDefecto = fecha(entrada.fecha);
  const ciclo = fechaDefecto.getUTCFullYear();
  const marca = `Fuente: ${entrada.fuente}.`;

  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario || !usuario.activo || usuario.rol !== "DIRECTIVO_SOE")
    throw new Error(`El usuario ${email} no existe, está inactivo o no es del equipo directivo/SOE.`);

  const estudiantes = await prisma.estudiante.findMany({
    where: { dni: { in: entrada.casos.map((c) => c.dni) } },
    include: {
      trayectoria: true,
      asistencias: true,
      calificaciones: { where: { previa: true }, select: { id: true } },
      situaciones: { select: { tipo: true, estado: true } },
      actuaciones: { where: { anuladaEl: null }, select: { actaLibro: true, actaNumero: true, motivo: true } },
    },
  });
  const porDni = new Map(estudiantes.map((e) => [e.dni, e]));
  const faltantes = entrada.casos.filter((c) => !porDni.has(c.dni));
  if (faltantes.length) {
    console.error("Estos DNI no están en el LUE:\n  " + faltantes.map((c) => `${c.dni} ${c.alumno}`).join("\n  "));
    throw new Error("Importación cancelada: no se escribió nada.");
  }

  let nuevasActuaciones = 0;
  let nuevasSituaciones = 0;
  let omitidas = 0;
  let legajos = 0;
  for (const caso of entrada.casos) {
    const e = porDni.get(caso.dni)!;
    const actuaciones = caso.actuaciones.filter(
      (a) =>
        !e.actuaciones.some((x) =>
          a.numero ? x.actaLibro === (a.libro ?? null) && x.actaNumero === a.numero : x.motivo === a.motivo,
        ),
    );
    const situaciones = caso.situaciones.filter(
      (s) => !e.situaciones.some((x) => x.tipo === s.tipo && ["PENDIENTE", "VIGENTE"].includes(x.estado)),
    );
    omitidas += caso.actuaciones.length - actuaciones.length + caso.situaciones.length - situaciones.length;
    if (!actuaciones.length && !situaciones.length) continue;

    const faltas = inasistenciasAnuales(e, ciclo);
    const abreLegajo = !e.legajoAbiertoEl;
    const nombre = `${e.anio}°${e.division} ${e.apellidos}, ${e.nombres}`;
    console.log(
      `${aplicar ? "" : "[simulación] "}${nombre}: ${[
        ...actuaciones.map((a) => (a.numero ? `acta ${a.numero} (${a.libro})` : a.motivo)),
        ...situaciones.map((s) => s.tipo),
      ].join(", ")}${abreLegajo ? ` · abre legajo (${motivoApertura(caso, faltas)})` : ""}`,
    );
    nuevasActuaciones += actuaciones.length;
    nuevasSituaciones += situaciones.length;
    if (abreLegajo) legajos++;
    if (!aplicar) continue;

    await prisma.$transaction(async (tx) => {
      if (abreLegajo) {
        const data: Prisma.EstudianteUpdateInput = {
          legajoAbiertoEl: new Date(),
          motivoApertura: motivoApertura(caso, faltas),
          detalleApertura: `${entrada.fuente}: ${
            actuaciones.map((a) => a.motivo).join("; ") || situaciones.map((s) => s.tipo).join(", ")
          }`.slice(0, 300),
          aperturaPromedio: e.promedioGeneral,
          aperturaPendientes: e.calificaciones.length,
          aperturaInasistencias: faltas,
          aperturaIce: e.puntosConvivencia,
          aperturaTrayectoria: JSON.parse(
            JSON.stringify({
              fechaNacimiento: e.fechaNacimiento,
              anio: e.anio,
              division: e.division,
              turno: e.turno,
              ciclos: e.trayectoria,
            }),
          ),
        };
        await tx.estudiante.update({ where: { id: e.id }, data });
      }

      const creadas: string[] = [];
      for (const a of actuaciones) {
        const r = await tx.actuacion.create({
          data: {
            estudianteId: e.id,
            autorId: usuario.id,
            fecha: a.fecha ? fecha(a.fecha) : fechaDefecto,
            cicloLectivo: ciclo,
            tipo: a.tipo,
            causa: a.causa,
            motivo: a.motivo,
            resumen: `${a.resumen}${a.fecha ? "" : " Fecha del acta no informada (se usa la del relevamiento)."} ${marca}`,
            tipoActa: a.numero ? "Acta" : null,
            actaLibro: a.libro ?? null,
            actaNumero: a.numero ?? null,
            confidencial: a.confidencial ?? false,
          },
        });
        creadas.push(r.id);
      }
      // Las situaciones nuevas quedan colgadas de la primera actuación; si no hay acta, se deja una.
      let actuacionId = creadas[0];
      if (!actuacionId && situaciones.length) {
        const r = await tx.actuacion.create({
          data: {
            estudianteId: e.id,
            autorId: usuario.id,
            fecha: fechaDefecto,
            cicloLectivo: ciclo,
            tipo: situaciones.some((s) => s.tipo === "JUDICIALIZADO") ? "FAMILIA" : "INASISTENCIAS",
            causa: "Otros",
            motivo: `Carga desde el ${entrada.fuente.toLowerCase()}`,
            resumen: `Situaciones registradas desde la planilla de preceptoría. ${marca}`,
            confidencial: situaciones.some((s) => NIVEL_ACCESO_SITUACION[s.tipo] !== "GENERAL"),
          },
        });
        actuacionId = r.id;
      }
      for (const s of situaciones) {
        await tx.situacionEspecial.create({
          data: {
            estudianteId: e.id,
            tipo: s.tipo,
            aval: null,
            estado: s.sinAval ? "PENDIENTE" : "VIGENTE",
            nivelAcceso: NIVEL_ACCESO_SITUACION[s.tipo],
            fechaInicio: s.fecha ? fecha(s.fecha) : fechaDefecto,
            fechaVencimiento: s.vence ? fecha(s.vence) : null,
            observaciones: [
              s.obs,
              CON_AVAL.includes(s.tipo) ? (s.sinAval ? "Falta aval de Supervisión." : "Aval no informado en la planilla.") : null,
              marca,
            ]
              .filter(Boolean)
              .join(" "),
            actuacionId,
            registradaPorId: usuario.id,
          },
        });
      }
      await tx.auditLog.create({
        data: { usuarioId: usuario.id, estudianteDni: e.dni, accion: "GESTIONAR_SITUACION" },
      });
    });
  }

  console.log(
    `\n${aplicar ? "Cargado" : "Simulación"}: ${nuevasActuaciones} actas/actuaciones y ${nuevasSituaciones} situaciones nuevas` +
      ` (${omitidas} ya estaban), ${legajos} legajos abiertos.`,
  );
  if (!aplicar) console.log("\nPara grabar, repetir con --aplicar.");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
