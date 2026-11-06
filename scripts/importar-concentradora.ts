/**
 * Carga en el LUE las situaciones especiales de la concentradora de datos de Dirección
 * (CUD, salud y aprendizaje, escolaridad protegida, condicionales, judicializados, embarazo,
 * matriculados que no asisten e ingresantes).
 *
 *   npx tsx scripts/importar-concentradora.ts <datos.json> --usuario=<email> [--aplicar]
 *
 * Sin --aplicar solo muestra lo que haría. El JSON NO va al repositorio (datos de menores):
 *   { fuente, fechaPorDefecto: "AAAA-MM-DD", preceptoras: { "1°1": "Nombre" },
 *     casos: [{ curso: "1°1", alumno: "APELLIDO, NOMBRE", cud?, diagnostico?,
 *               situaciones: [{ tipo, forma?, fecha?, fin?, estado?, sinAval?, detalle?, obs? }] }] }
 * "alumno" se busca (sin tildes ni mayúsculas) dentro de "APELLIDOS, NOMBRES" del curso; debe haber uno solo.
 * Es idempotente: no repite una situación del mismo tipo ya cargada desde la concentradora.
 * Abre el legajo de seguimiento (salvo que el alumno solo figure como ingresante), deja una actuación
 * por alumno que vincula sus situaciones y registra la auditoría. No programa seguimientos ni avisos.
 */

import { readFileSync } from "node:fs";
import { config as cargarEnv } from "dotenv";
import { PrismaClient, type Prisma } from "@prisma/client";
import {
  NIVEL_ACCESO_SITUACION,
  TIPO_SITUACION_ETIQUETA,
  TIPOS_SITUACION,
  FORMAS_ESCOLARIDAD_PROTEGIDA,
  ESTADOS_SITUACION,
  type TipoSituacion,
  type EstadoSituacion,
} from "../src/lib/types";
import { inasistenciasAnuales } from "../src/lib/seguimiento/reglas";

cargarEnv({ path: ".env.local" });
cargarEnv();

const MARCA = "Fuente: concentradora de Dirección";
const CON_AVAL: TipoSituacion[] = [
  "ESCOLARIDAD_PROTEGIDA",
  "CONDICIONAL_INASISTENCIAS",
  "EXTENSION_INASISTENCIAS",
  "CONDICIONAL_ICE",
];

interface SituacionEntrada {
  tipo: TipoSituacion;
  forma?: string;
  fecha?: string;
  fin?: string;
  estado?: EstadoSituacion;
  sinAval?: boolean;
  detalle?: Record<string, string>;
  obs?: string;
}
interface CasoEntrada {
  curso: string;
  alumno: string;
  cud?: boolean;
  diagnostico?: string;
  situaciones: SituacionEntrada[];
}
interface Entrada {
  fuente: string;
  fechaPorDefecto: string;
  preceptoras?: Record<string, string>;
  casos: CasoEntrada[];
}

const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/['´`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function fecha(valor: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) throw new Error(`Fecha inválida: "${valor}" (use AAAA-MM-DD).`);
  return new Date(`${valor}T12:00:00.000Z`);
}

function validar(entrada: Entrada): void {
  fecha(entrada.fechaPorDefecto);
  for (const c of entrada.casos) {
    if (!/^[1-5]°\d$/.test(c.curso)) throw new Error(`Curso inválido: "${c.curso}".`);
    for (const s of c.situaciones) {
      const donde = `${c.curso} ${c.alumno} (${s.tipo})`;
      if (!TIPOS_SITUACION.includes(s.tipo)) throw new Error(`Tipo inválido en ${donde}.`);
      if (s.forma && !(FORMAS_ESCOLARIDAD_PROTEGIDA as readonly string[]).includes(s.forma))
        throw new Error(`Forma inválida en ${donde}.`);
      if (s.estado && !ESTADOS_SITUACION.includes(s.estado)) throw new Error(`Estado inválido en ${donde}.`);
      if (s.fecha) fecha(s.fecha);
      if (s.fin) fecha(s.fin);
    }
  }
}

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const ruta = args.find((a) => !a.startsWith("--"));
  const email = args.find((a) => a.startsWith("--usuario="))?.slice(10).trim().toLowerCase();
  const aplicar = args.includes("--aplicar");
  if (!ruta || !email)
    throw new Error("Uso: npx tsx scripts/importar-concentradora.ts <datos.json> --usuario=<email> [--aplicar]");

  const entrada = JSON.parse(readFileSync(ruta, "utf8")) as Entrada;
  validar(entrada);
  const ciclo = fecha(entrada.fechaPorDefecto).getUTCFullYear();
  const etiquetaFuente = `${MARCA} (${entrada.fuente}).`;

  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario || !usuario.activo || usuario.rol !== "DIRECTIVO_SOE")
    throw new Error(`El usuario ${email} no existe, está inactivo o no es del equipo directivo/SOE.`);

  const estudiantes = await prisma.estudiante.findMany({
    where: { estadoMatricula: "REGULAR" },
    include: {
      trayectoria: true,
      asistencias: true,
      calificaciones: { where: { previa: true }, select: { id: true } },
      situaciones: { select: { tipo: true, observaciones: true } },
    },
  });

  // 1) Resolver cada caso contra la matrícula, sin escribir nada todavía.
  const errores: string[] = [];
  const porEstudiante = new Map<string, { e: (typeof estudiantes)[number]; casos: CasoEntrada[] }>();
  for (const c of entrada.casos) {
    const [anio, division] = c.curso.split("°");
    const clave = normalizar(c.alumno);
    const candidatos = estudiantes.filter(
      (e) =>
        e.anio === Number(anio) &&
        e.division === division &&
        normalizar(`${e.apellidos}, ${e.nombres}`).includes(clave),
    );
    const [e] = candidatos;
    if (candidatos.length !== 1 || !e) {
      errores.push(`${c.curso} «${c.alumno}»: ${candidatos.length ? `${candidatos.length} coincidencias` : "sin coincidencia"}`);
      continue;
    }
    const previo = porEstudiante.get(e.id);
    if (previo) previo.casos.push(c);
    else porEstudiante.set(e.id, { e, casos: [c] });
  }
  if (errores.length) {
    console.error("No se pudo identificar a estos alumnos (corregir el JSON):\n  " + errores.join("\n  "));
    throw new Error("Importación cancelada: no se escribió nada.");
  }

  // 2) Cargar por alumno, cada uno en su transacción.
  let creadas = 0;
  let omitidas = 0;
  let legajos = 0;
  const conteo: Partial<Record<TipoSituacion, number>> = {};
  for (const { e, casos } of porEstudiante.values()) {
    const situaciones = casos.flatMap((c) => c.situaciones.map((s) => ({ s, curso: c.curso })));
    const nuevas = situaciones.filter(
      ({ s }) => !e.situaciones.some((x) => x.tipo === s.tipo && x.observaciones?.includes(MARCA)),
    );
    omitidas += situaciones.length - nuevas.length;
    const cud = casos.some((c) => c.cud);
    const diagnostico = casos.find((c) => c.diagnostico)?.diagnostico;
    const abreLegajo = !e.legajoAbiertoEl && nuevas.some(({ s }) => s.tipo !== "INGRESANTE");
    const nombre = `${e.anio}°${e.division} ${e.apellidos}, ${e.nombres}`;
    console.log(
      `${aplicar ? "" : "[simulación] "}${nombre}: ${
        nuevas.map(({ s }) => s.tipo).join(", ") || "nada nuevo"
      }${abreLegajo ? " · abre legajo" : ""}${cud && !e.tieneCud ? " · marca CUD" : ""}`,
    );
    for (const { s } of nuevas) conteo[s.tipo] = (conteo[s.tipo] ?? 0) + 1;
    creadas += nuevas.length;
    if (abreLegajo) legajos++;
    if (!aplicar || !nuevas.length) continue;

    const tipos = nuevas.map(({ s }) => s.tipo);
    const motivo = tipos.includes("ESCOLARIDAD_PROTEGIDA")
      ? "ESCOLARIDAD_PROTEGIDA"
      : tipos.some((t) => t.startsWith("CONDICIONAL"))
        ? "CONDICIONALIDAD"
        : "OTRO";
    const reservada = nuevas.some(({ s }) => NIVEL_ACCESO_SITUACION[s.tipo] !== "GENERAL");

    await prisma.$transaction(async (tx) => {
      const estudianteData: Prisma.EstudianteUpdateInput = {};
      if (cud) estudianteData.tieneCud = true;
      if (diagnostico && !e.diagnosticoReservado) estudianteData.diagnosticoReservado = diagnostico;
      if (abreLegajo) {
        Object.assign(estudianteData, {
          legajoAbiertoEl: new Date(),
          motivoApertura: motivo,
          detalleApertura: `Concentradora de Dirección: ${[...new Set(tipos.filter((t) => t !== "INGRESANTE"))]
            .map((t) => TIPO_SITUACION_ETIQUETA[t])
            .join(", ")}`,
          aperturaPromedio: e.promedioGeneral,
          aperturaPendientes: e.calificaciones.length,
          aperturaInasistencias: inasistenciasAnuales(e, ciclo),
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
        });
      }
      if (Object.keys(estudianteData).length)
        await tx.estudiante.update({ where: { id: e.id }, data: estudianteData });

      const actuacion = await tx.actuacion.create({
        data: {
          estudianteId: e.id,
          autorId: usuario.id,
          fecha: new Date(),
          cicloLectivo: ciclo,
          tipo: "OTRA",
          motivo: "Carga desde la concentradora de Dirección",
          resumen: reservada
            ? `${entrada.fuente}: ${nuevas.length} situación(es) registrada(s), algunas de acceso reservado.`
            : `${entrada.fuente}: ${tipos.map((t) => TIPO_SITUACION_ETIQUETA[t]).join(", ")}.`,
          confidencial: reservada,
        },
      });

      for (const { s, curso } of nuevas) {
        const estado: EstadoSituacion = s.estado ?? (s.sinAval ? "PENDIENTE" : "VIGENTE");
        const detalle = { ...(s.detalle ?? {}) };
        if (s.tipo === "ESCOLARIDAD_PROTEGIDA" && !detalle["Preceptora de seguimiento"] && entrada.preceptoras?.[curso])
          detalle["Preceptora de seguimiento"] = entrada.preceptoras[curso];
        const obs = [s.obs, s.sinAval ? "Falta aval de Supervisión." : null, etiquetaFuente]
          .filter(Boolean)
          .join(" ");
        await tx.situacionEspecial.create({
          data: {
            estudianteId: e.id,
            tipo: s.tipo,
            forma: s.forma ?? null,
            aval: CON_AVAL.includes(s.tipo) && !s.sinAval ? "Supervisión" : null,
            estado,
            nivelAcceso: NIVEL_ACCESO_SITUACION[s.tipo],
            fechaInicio: fecha(s.fecha ?? entrada.fechaPorDefecto),
            fechaFin: ["CUMPLIDA", "DADA_DE_BAJA", "DENEGADA"].includes(estado)
              ? fecha(s.fin ?? entrada.fechaPorDefecto)
              : null,
            detalle: Object.keys(detalle).length ? detalle : undefined,
            observaciones: obs,
            actuacionId: actuacion.id,
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
    `\n${aplicar ? "Cargado" : "Simulación"}: ${porEstudiante.size} alumnos, ${creadas} situaciones nuevas` +
      ` (${omitidas} ya estaban), ${legajos} legajos abiertos.`,
  );
  console.log(Object.entries(conteo).map(([t, n]) => `  ${TIPO_SITUACION_ETIQUETA[t as TipoSituacion]}: ${n}`).join("\n"));
  if (!aplicar) console.log("\nPara grabar, repetir con --aplicar.");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
