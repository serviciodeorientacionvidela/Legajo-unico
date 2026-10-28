/**
 * Parsers de las planillas que el GEI exporta por división (las que descarga scripts/gei-scraper.ts):
 *
 * - Resumen de asistencia mensual (division_inasistencia/resumen_diario_imprimir_excel): una fila por DNI
 *   con los días presentes del mes. El porcentaje anual se calcula sumando los meses cerrados.
 * - Resumen de evaluaciones de un espacio curricular (cursada/excel_resumen_evaluaciones_generico): una
 *   fila por "APELLIDO, NOMBRE" (sin DNI), con el cierre de cada período y la calificación final. El cruce
 *   con el estudiante se hace por nombre dentro de la división.
 *
 * Módulo puro (sin base de datos).
 */

import * as XLSX from "xlsx";
import { normalizarTexto, parsearCursoCombinado, parsearDni, parsearNota } from "./geiParser";

export interface AsistenciaMensualGei {
  anio: number;
  division: string;
  diasHabiles: number;
  /** Días presentes del mes por DNI (el GEI usa fracciones: llegadas tarde, retiros). */
  presentes: { dni: string; dias: number }[];
}

export interface NotaPlanillaGei {
  nombre: string;
  primerPeriodo: number | null;
  segundoPeriodo: number | null;
  notaFinal: number | null;
}

export interface PlanillaEvaluacionesGei {
  anio: number;
  division: string;
  materia: string;
  notas: NotaPlanillaGei[];
}

type Fila = unknown[];

function leerFilas(datos: ArrayBuffer | Uint8Array, nombreHoja?: string): Fila[] {
  const libro = XLSX.read(datos, { type: "array" });
  const hoja = libro.Sheets[nombreHoja ?? ""] ?? libro.Sheets[libro.SheetNames[0] ?? ""];
  if (!hoja) return [];
  return XLSX.utils.sheet_to_json<Fila>(hoja, { header: 1, defval: null, blankrows: false, raw: true });
}

function celdaTexto(valor: unknown): string {
  return valor === null || valor === undefined ? "" : String(valor).replace(/\s+/g, " ").trim();
}

/** Busca en las primeras filas un rótulo "Clave: valor" (p. ej. "Curso: 1° 1ª secundaria"). */
function valorRotulo(filas: Fila[], claves: string[]): string | null {
  for (const fila of filas.slice(0, 12)) {
    const t = celdaTexto(fila[0]);
    const separador = t.indexOf(":");
    if (separador === -1) continue;
    if (claves.includes(normalizarTexto(t.slice(0, separador)))) return t.slice(separador + 1).trim();
  }
  return null;
}

function cursoDe(filas: Fila[], archivo: string): { anio: number; division: string } {
  const curso = parsearCursoCombinado(valorRotulo(filas, ["curso", "division"]) ?? "");
  if (!curso) throw new Error(`${archivo}: no se encontró el curso/división en el encabezado.`);
  return curso;
}

function numero(valor: unknown): number | null {
  const n = typeof valor === "number" ? valor : Number.parseFloat(celdaTexto(valor).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function analizarAsistenciaMensual(datos: ArrayBuffer | Uint8Array, archivo: string): AsistenciaMensualGei {
  const filas = leerFilas(datos, "Resumen mensual");
  const { anio, division } = cursoDe(filas, archivo);
  const diasHabiles = numero(valorRotulo(filas, ["dias habiles de cursado"]));
  if (diasHabiles === null) throw new Error(`${archivo}: falta "Días hábiles de cursado".`);

  const indiceEncabezado = filas.findIndex((f) => normalizarTexto(celdaTexto(f[0])) === "documento");
  if (indiceEncabezado === -1) throw new Error(`${archivo}: no se encontró la columna "Documento".`);
  const columnaAsistencia = (filas[indiceEncabezado] ?? []).findIndex(
    (c) => normalizarTexto(celdaTexto(c)) === "asistencia",
  );
  if (columnaAsistencia === -1) throw new Error(`${archivo}: no se encontró la columna "Asistencia".`);

  const presentes = filas.slice(indiceEncabezado + 1).flatMap((fila) => {
    const dni = parsearDni(fila[0]);
    const dias = numero(fila[columnaAsistencia]);
    return dni && dias !== null ? [{ dni, dias }] : [];
  });
  return { anio, division, diasHabiles, presentes };
}

/** Porcentaje anual por DNI: días presentes / días hábiles, sumados sobre los meses recibidos. */
export function consolidarAsistencia(meses: AsistenciaMensualGei[]): { dni: string; porcentajeAsistencia: number }[] {
  const acumulado = new Map<string, { presentes: number; habiles: number }>();
  for (const mes of meses) {
    for (const p of mes.presentes) {
      const previo = acumulado.get(p.dni) ?? { presentes: 0, habiles: 0 };
      acumulado.set(p.dni, { presentes: previo.presentes + p.dias, habiles: previo.habiles + mes.diasHabiles });
    }
  }
  return [...acumulado.entries()]
    .filter(([, a]) => a.habiles > 0)
    .map(([dni, a]) => ({
      dni,
      porcentajeAsistencia: Math.round(Math.min(100, (a.presentes / a.habiles) * 100) * 10) / 10,
    }));
}

export function analizarPlanillaEvaluaciones(datos: ArrayBuffer | Uint8Array, archivo: string): PlanillaEvaluacionesGei {
  const filas = leerFilas(datos, "Resumen de evaluaciones");
  const { anio, division } = cursoDe(filas, archivo);
  const materia = valorRotulo(filas, ["espacio curricular", "materia"]);
  if (!materia) throw new Error(`${archivo}: falta "Espacio curricular".`);

  const indiceEncabezado = filas.findIndex((f) => normalizarTexto(celdaTexto(f[0])) === "nombre y apellido");
  if (indiceEncabezado < 1) throw new Error(`${archivo}: no se encontró la columna "Nombre y Apellido".`);
  const grupos = filas[indiceEncabezado - 1] ?? [];
  const encabezados = filas[indiceEncabezado] ?? [];

  // La fila superior agrupa columnas (Primer Periodo, Segundo Período, Calificación Final, ...):
  // cada grupo empieza en su celda rotulada y termina donde empieza el siguiente.
  const inicios = grupos
    .map((c, i) => ({ rotulo: normalizarTexto(celdaTexto(c)), i }))
    .filter((g) => g.rotulo);
  const rango = (rotulo: string): [number, number] | null => {
    const k = inicios.findIndex((g) => g.rotulo === rotulo);
    if (k === -1) return null;
    return [inicios[k]!.i, inicios[k + 1]?.i ?? encabezados.length];
  };
  // La nota del período está en "Cierre de Periodo"; algunas divisiones la cargan como "Equivalencia Directa".
  const cierreDe = (rotulo: string): number | null => {
    const r = rango(rotulo);
    if (!r) return null;
    let equivalencia: number | null = null;
    for (let i = r[0]; i < r[1]; i++) {
      const encabezado = normalizarTexto(celdaTexto(encabezados[i]));
      if (encabezado === "cierre de periodo") return i;
      if (encabezado.startsWith("equivalencia directa")) equivalencia = i;
    }
    return equivalencia;
  };
  const columnas = {
    primerPeriodo: cierreDe("primer periodo"),
    segundoPeriodo: cierreDe("segundo periodo"),
    calificacionFinal: rango("calificacion final")?.[0] ?? null,
    intensificacion: rango("intensificacion")?.[0] ?? null,
    acreditacion: rango("acreditacion")?.[0] ?? null,
  };
  const nota = (fila: Fila, columna: number | null) => (columna === null ? null : parsearNota(fila[columna]));

  const notas = filas.slice(indiceEncabezado + 1).flatMap((fila) => {
    const nombre = celdaTexto(fila[0]);
    if (!nombre.includes(",")) return [];
    return [
      {
        nombre,
        primerPeriodo: nota(fila, columnas.primerPeriodo),
        segundoPeriodo: nota(fila, columnas.segundoPeriodo),
        // La nota que acredita el espacio pisa a la calificación final de cursado.
        notaFinal:
          nota(fila, columnas.acreditacion) ?? nota(fila, columnas.intensificacion) ?? nota(fila, columnas.calificacionFinal),
      },
    ];
  });
  return { anio, division, materia, notas };
}

/**
 * Clave de cruce por nombre: "BEJARANO MAMANI, JANET RUTH" ≡ apellidos + nombres sin tildes ni signos.
 * Descarta las aclaraciones entre paréntesis que agrega el GEI, como "(Condicional)".
 */
export function claveNombre(apellidosYNombres: string): string {
  return normalizarTexto(apellidosYNombres.replace(/\([^)]*\)/g, " ").replace(",", " "));
}
