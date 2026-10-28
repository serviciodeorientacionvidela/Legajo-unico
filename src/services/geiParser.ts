/**
 * Parser de reportes exportados del GEI (Matrícula, Asistencia y Notas) en Excel o CSV.
 * Módulo puro (sin base de datos): lo usa geiSyncService en el servidor y el modo demostración
 * en el navegador.
 *
 * Los encabezados del GEI varían según el reporte y la versión del portal, por eso las columnas se
 * reconocen por alias normalizados (sin tildes, minúsculas). Un mismo libro puede traer varias
 * hojas; cada hoja se clasifica y procesa por separado. La clave de cruce es siempre el DNI.
 */

import * as XLSX from "xlsx";
import type { EstadoMatricula } from "@/lib/types";

export type TipoHojaGei = "MATRICULA" | "ASISTENCIA" | "NOTAS" | "DESCONOCIDO";

export interface ErrorFilaGei {
  hoja: string;
  fila: number;
  motivo: string;
}

export interface MatriculaGei {
  dni: string;
  cuil: string | null;
  apellidos: string;
  nombres: string;
  fechaNacimiento: Date | null;
  anio: number;
  division: string;
  turno: string;
  estadoMatricula: EstadoMatricula;
  /** Campos opcionales: undefined si el reporte no trae la columna (no se pisa lo ya cargado). */
  genero?: string | null;
  direccion?: string | null;
  localidad?: string | null;
  familiares?: string | null;
  telefonosFamiliares?: string | null;
  emailsFamiliares?: string | null;
  emailContacto?: string | null;
}

export interface AsistenciaGei {
  dni: string;
  porcentajeAsistencia: number;
}

export interface CalificacionGei {
  dni: string;
  materia: string;
  cicloLectivo: number;
  primerCuatrimestre: number | null;
  segundoCuatrimestre: number | null;
  notaFinal: number | null;
  previa: boolean;
}

export interface LibroGeiAnalizado {
  hojas: { nombre: string; tipo: TipoHojaGei; filas: number }[];
  matricula: MatriculaGei[];
  asistencias: AsistenciaGei[];
  calificaciones: CalificacionGei[];
  errores: ErrorFilaGei[];
}

/** Resultado de una importación (servidor o demo). */
export interface ResultadoImportacionGei {
  archivo: string;
  hojas: LibroGeiAnalizado["hojas"];
  estudiantesCreados: number;
  estudiantesActualizados: number;
  asistenciasActualizadas: number;
  calificacionesActualizadas: number;
  carpetasDriveCreadas: number;
  carpetasDriveMovidas: number;
  errores: ErrorFilaGei[];
  advertencias: string[];
  duracionMs: number;
}

// ---------------------------------------------------------------------------
// Reconocimiento de columnas
// ---------------------------------------------------------------------------

type CampoGei =
  | "dni"
  | "cuil"
  | "apellidos"
  | "nombres"
  | "apellidoYNombre"
  | "fechaNacimiento"
  | "anio"
  | "division"
  | "curso"
  | "turno"
  | "estado"
  | "asistencia"
  | "materia"
  | "ciclo"
  | "primerCuatrimestre"
  | "segundoCuatrimestre"
  | "notaFinal"
  | "previa"
  | "genero"
  | "direccion"
  | "localidad"
  | "familiares"
  | "telefonosFamiliares"
  | "emailsFamiliares"
  | "emailContacto";

const ALIAS_COLUMNAS: Record<CampoGei, string[]> = {
  dni: ["dni", "documento", "nro documento", "n documento", "numero documento", "numero de documento", "nro de documento", "doc", "dni alumno", "dni estudiante"],
  cuil: ["cuil", "cuil alumno", "cuil estudiante"],
  apellidos: ["apellido", "apellidos"],
  nombres: ["nombre", "nombres"],
  apellidoYNombre: ["apellido y nombre", "apellidos y nombres", "apellido y nombres", "alumno", "estudiante", "nombre completo"],
  fechaNacimiento: ["fecha nacimiento", "fecha de nacimiento", "f nacimiento", "f nac", "nacimiento"],
  anio: ["ano", "anio", "grado", "ano de cursado"],
  division: ["division", "div", "seccion"],
  curso: ["curso", "curso division", "ano division", "grado division"],
  turno: ["turno"],
  estado: ["estado", "situacion", "estado matricula", "situacion de matricula", "condicion matricula"],
  asistencia: ["% asistencia", "asistencia %", "porcentaje asistencia", "porcentaje de asistencia", "asistencia", "% de asistencia"],
  materia: ["materia", "espacio curricular", "asignatura", "espacio"],
  ciclo: ["ciclo lectivo", "ciclo", "ano lectivo", "anio lectivo"],
  primerCuatrimestre: ["1er cuatrimestre", "1 cuatrimestre", "primer cuatrimestre", "1c", "cuatrimestre 1", "1 cuat", "1er cuat"],
  segundoCuatrimestre: ["2do cuatrimestre", "2 cuatrimestre", "segundo cuatrimestre", "2c", "cuatrimestre 2", "2 cuat", "2do cuat"],
  notaFinal: ["nota final", "final", "calificacion final", "definitiva", "nota definitiva", "promedio final", "calificacion definitiva"],
  previa: ["previa", "adeuda", "materia previa", "condicion"],
  genero: ["genero", "sexo"],
  direccion: ["direccion", "domicilio"],
  localidad: ["localidad departamento", "localidad", "localidad y departamento"],
  familiares: ["madre padre tutor", "tutor", "tutores", "responsable", "responsables", "madre padre"],
  telefonosFamiliares: ["telefono familiares", "telefonos familiares", "telefono", "telefonos", "telefono tutor"],
  emailsFamiliares: ["email familiares", "emails familiares", "mail familiares", "correo familiares"],
  emailContacto: ["email contacto", "mail contacto", "email", "correo electronico"],
};

export function normalizarTexto(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[°º]/g, " ")
    .replace(/[^a-z0-9%]+/g, " ")
    .trim();
}

type MapaColumnas = Partial<Record<CampoGei, number>>;

function mapearEncabezados(fila: unknown[]): MapaColumnas {
  const mapa: MapaColumnas = {};
  fila.forEach((celda, indice) => {
    if (celda === null || celda === undefined) return;
    const normalizado = normalizarTexto(String(celda));
    if (!normalizado) return;
    for (const [campo, alias] of Object.entries(ALIAS_COLUMNAS) as [CampoGei, string[]][]) {
      if (mapa[campo] === undefined && alias.includes(normalizado)) {
        mapa[campo] = indice;
        return;
      }
    }
  });
  return mapa;
}

function clasificarHoja(mapa: MapaColumnas): TipoHojaGei {
  if (mapa.dni === undefined) return "DESCONOCIDO";
  if (mapa.materia !== undefined) return "NOTAS";
  const tieneIdentidad =
    (mapa.apellidos !== undefined || mapa.apellidoYNombre !== undefined) &&
    (mapa.anio !== undefined || mapa.curso !== undefined);
  if (tieneIdentidad) return "MATRICULA";
  if (mapa.asistencia !== undefined) return "ASISTENCIA";
  return "DESCONOCIDO";
}

// ---------------------------------------------------------------------------
// Conversión de celdas
// ---------------------------------------------------------------------------

function texto(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  if (valor instanceof Date) return valor.toISOString();
  return String(valor).replace(/\s+/g, " ").trim();
}

export function parsearDni(valor: unknown): string | null {
  const digitos = texto(valor).replace(/\D/g, "");
  return /^\d{7,8}$/.test(digitos) ? digitos : null;
}

function parsearCuil(valor: unknown): string | null {
  const digitos = texto(valor).replace(/\D/g, "");
  return digitos.length === 11 ? `${digitos.slice(0, 2)}-${digitos.slice(2, 10)}-${digitos.slice(10)}` : null;
}

function numerosEn(valor: unknown): number[] {
  return (texto(valor).match(/\d+/g) ?? []).map((n) => Number.parseInt(n, 10));
}

export function parsearAnio(valor: unknown): number | null {
  const primero = numerosEn(valor)[0];
  return primero !== undefined && primero >= 1 && primero <= 5 ? primero : null;
}

export function parsearDivision(valor: unknown): string | null {
  const t = texto(valor);
  if (!t) return null;
  const numero = numerosEn(t)[0];
  if (numero !== undefined) return String(numero);
  const letra = normalizarTexto(t).replace(/division|div/g, "").trim();
  return letra ? letra.toUpperCase() : null;
}

/** "1° 2da", "1-2", "1ro 2da" → { anio: 1, division: "2" } */
export function parsearCursoCombinado(valor: unknown): { anio: number; division: string } | null {
  const [anio, division] = numerosEn(valor);
  if (anio === undefined || division === undefined || anio < 1 || anio > 5) return null;
  return { anio, division: String(division) };
}

export function parsearNota(valor: unknown): number | null {
  if (typeof valor === "number") return valor >= 1 && valor <= 10 ? Math.round(valor * 100) / 100 : null;
  const t = texto(valor).replace(",", ".");
  if (!t || t === "-") return null;
  const n = Number.parseFloat(t);
  return Number.isFinite(n) && n >= 1 && n <= 10 ? Math.round(n * 100) / 100 : null;
}

export function parsearPorcentaje(valor: unknown): number | null {
  let n: number;
  if (typeof valor === "number") {
    // Celdas con formato % llegan como fracción (0.925).
    n = valor <= 1 ? valor * 100 : valor;
  } else {
    const t = texto(valor).replace("%", "").replace(",", ".").trim();
    if (!t) return null;
    n = Number.parseFloat(t);
  }
  return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 10) / 10 : null;
}

export function parsearFecha(valor: unknown): Date | null {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return new Date(Date.UTC(valor.getFullYear(), valor.getMonth(), valor.getDate()));
  }
  const t = texto(valor);
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(t);
  if (dmy) {
    const [, d, m, a] = dmy;
    const fecha = new Date(Date.UTC(Number(a), Number(m) - 1, Number(d)));
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }
  const isoFecha = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (isoFecha) {
    const [, a, m, d] = isoFecha;
    return new Date(Date.UTC(Number(a), Number(m) - 1, Number(d)));
  }
  return null;
}

function parsearPrevia(valor: unknown): boolean {
  if (typeof valor === "boolean") return valor;
  const t = normalizarTexto(texto(valor));
  return ["si", "s", "x", "previa", "adeuda", "true", "1", "pendiente"].includes(t);
}

function parsearEstado(valor: unknown): EstadoMatricula {
  const t = normalizarTexto(texto(valor));
  if (t.includes("egres")) return "EGRESADO";
  if (t.includes("pase") || t.includes("salid") || t.includes("baja")) return "PASE";
  return "REGULAR";
}

function separarApellidoYNombre(valor: unknown): { apellidos: string; nombres: string } | null {
  const t = texto(valor);
  if (!t) return null;
  if (t.includes(",")) {
    const [apellidos = "", ...resto] = t.split(",");
    const nombres = resto.join(",").trim();
    return apellidos.trim() && nombres ? { apellidos: apellidos.trim(), nombres } : null;
  }
  const partes = t.split(" ");
  if (partes.length < 2) return null;
  return { apellidos: partes[0] ?? "", nombres: partes.slice(1).join(" ") };
}

function celda(fila: unknown[], mapa: MapaColumnas, campo: CampoGei): unknown {
  const indice = mapa[campo];
  return indice === undefined ? undefined : fila[indice];
}

/** Texto libre conservando un renglón por familiar. undefined si la columna no existe. */
function textoOpcional(fila: unknown[], mapa: MapaColumnas, campo: CampoGei): string | null | undefined {
  if (mapa[campo] === undefined) return undefined;
  const valor = celda(fila, mapa, campo);
  if (valor === null || valor === undefined) return null;
  const renglones = String(valor)
    .split(/\r?\n/)
    .map((r) => texto(r))
    .filter(Boolean);
  return renglones.length > 0 ? renglones.join("\n") : null;
}

// ---------------------------------------------------------------------------
// Análisis del libro
// ---------------------------------------------------------------------------

const FILAS_MAX_BUSQUEDA_ENCABEZADO = 15;

export function analizarLibroGei(datos: ArrayBuffer | Uint8Array, cicloPorDefecto: number): LibroGeiAnalizado {
  const libro = XLSX.read(datos, { type: "array", cellDates: true });
  const resultado: LibroGeiAnalizado = { hojas: [], matricula: [], asistencias: [], calificaciones: [], errores: [] };

  for (const nombreHoja of libro.SheetNames) {
    const hoja = libro.Sheets[nombreHoja];
    if (!hoja) continue;
    const filas = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, defval: null, blankrows: false, raw: true });

    // Los reportes del GEI suelen traer filas de título antes de los encabezados.
    let indiceEncabezado = -1;
    let mapa: MapaColumnas = {};
    for (let i = 0; i < Math.min(filas.length, FILAS_MAX_BUSQUEDA_ENCABEZADO); i++) {
      const candidato = mapearEncabezados(filas[i] ?? []);
      if (candidato.dni !== undefined) {
        indiceEncabezado = i;
        mapa = candidato;
        break;
      }
    }

    const tipo = indiceEncabezado === -1 ? "DESCONOCIDO" : clasificarHoja(mapa);
    const filasDatos = indiceEncabezado === -1 ? [] : filas.slice(indiceEncabezado + 1);
    resultado.hojas.push({ nombre: nombreHoja, tipo, filas: filasDatos.length });
    if (tipo === "DESCONOCIDO") continue;

    filasDatos.forEach((fila, desplazamiento) => {
      const numeroFila = indiceEncabezado + desplazamiento + 2; // 1-based + encabezado
      const error = (motivo: string) => resultado.errores.push({ hoja: nombreHoja, fila: numeroFila, motivo });

      const dni = parsearDni(celda(fila, mapa, "dni"));
      if (!dni) {
        const crudo = texto(celda(fila, mapa, "dni"));
        if (crudo) error(`DNI inválido: "${crudo}"`);
        return;
      }

      if (tipo === "MATRICULA") {
        const nombre =
          mapa.apellidos !== undefined && mapa.nombres !== undefined
            ? { apellidos: texto(celda(fila, mapa, "apellidos")), nombres: texto(celda(fila, mapa, "nombres")) }
            : separarApellidoYNombre(celda(fila, mapa, "apellidoYNombre") ?? celda(fila, mapa, "apellidos"));
        if (!nombre || !nombre.apellidos || !nombre.nombres) {
          error(`DNI ${dni}: falta apellido o nombre`);
          return;
        }

        let anio = parsearAnio(celda(fila, mapa, "anio"));
        let division = parsearDivision(celda(fila, mapa, "division"));
        if ((anio === null || division === null) && mapa.curso !== undefined) {
          const combinado = parsearCursoCombinado(celda(fila, mapa, "curso"));
          anio = anio ?? combinado?.anio ?? parsearAnio(celda(fila, mapa, "curso"));
          division = division ?? combinado?.division ?? null;
        }
        if (anio === null || division === null) {
          error(`DNI ${dni}: año o división no reconocidos`);
          return;
        }

        resultado.matricula.push({
          dni,
          cuil: parsearCuil(celda(fila, mapa, "cuil")),
          apellidos: nombre.apellidos,
          nombres: nombre.nombres,
          fechaNacimiento: parsearFecha(celda(fila, mapa, "fechaNacimiento")),
          anio,
          division,
          turno: texto(celda(fila, mapa, "turno")) || "Mañana",
          estadoMatricula: mapa.estado !== undefined ? parsearEstado(celda(fila, mapa, "estado")) : "REGULAR",
          genero: textoOpcional(fila, mapa, "genero"),
          direccion: textoOpcional(fila, mapa, "direccion"),
          localidad: textoOpcional(fila, mapa, "localidad"),
          familiares: textoOpcional(fila, mapa, "familiares"),
          telefonosFamiliares: textoOpcional(fila, mapa, "telefonosFamiliares"),
          emailsFamiliares: textoOpcional(fila, mapa, "emailsFamiliares"),
          emailContacto: textoOpcional(fila, mapa, "emailContacto"),
        });
      }

      if ((tipo === "MATRICULA" || tipo === "ASISTENCIA") && mapa.asistencia !== undefined) {
        const porcentaje = parsearPorcentaje(celda(fila, mapa, "asistencia"));
        if (porcentaje === null) {
          if (tipo === "ASISTENCIA") error(`DNI ${dni}: porcentaje de asistencia inválido`);
        } else {
          resultado.asistencias.push({ dni, porcentajeAsistencia: porcentaje });
        }
      }

      if (tipo === "NOTAS") {
        const materia = texto(celda(fila, mapa, "materia"));
        if (!materia) {
          error(`DNI ${dni}: fila de notas sin materia`);
          return;
        }
        const ciclo = numerosEn(celda(fila, mapa, "ciclo")).find((n) => n >= 2000 && n <= 2100) ?? cicloPorDefecto;
        resultado.calificaciones.push({
          dni,
          materia,
          cicloLectivo: ciclo,
          primerCuatrimestre: parsearNota(celda(fila, mapa, "primerCuatrimestre")),
          segundoCuatrimestre: parsearNota(celda(fila, mapa, "segundoCuatrimestre")),
          notaFinal: parsearNota(celda(fila, mapa, "notaFinal")),
          previa: parsearPrevia(celda(fila, mapa, "previa")),
        });
      }
    });
  }

  return resultado;
}

// ---------------------------------------------------------------------------
// Utilidades compartidas
// ---------------------------------------------------------------------------

/** Último registro por DNI (si el GEI repite filas, gana la última). */
export function deduplicarPorDni<T extends { dni: string }>(items: T[]): T[] {
  return [...new Map(items.map((i) => [i.dni, i])).values()];
}

/** Promedio del ciclo: nota final si existe; si no, promedio de los cuatrimestres cargados. */
export function calcularPromedio(
  notas: { primerCuatrimestre: number | null; segundoCuatrimestre: number | null; notaFinal: number | null }[],
): number | null {
  const valores = notas
    .map((n) => {
      if (n.notaFinal !== null) return n.notaFinal;
      const parciales = [n.primerCuatrimestre, n.segundoCuatrimestre].filter((v): v is number => v !== null);
      return parciales.length > 0 ? parciales.reduce((a, b) => a + b, 0) / parciales.length : null;
    })
    .filter((v): v is number => v !== null);
  if (valores.length === 0) return null;
  return Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 100) / 100;
}
