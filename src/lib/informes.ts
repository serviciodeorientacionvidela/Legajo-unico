/**
 * Informes institucionales del LUE (Dirección, SOE y Preceptoría).
 *
 * El servidor (y el modo demostración) arma `DatosInforme` con `construirDatosInforme`: una fila
 * sanitizada por estudiante regular más los listados de convivencia y SOE que el rol puede ver.
 * El navegador agrega esas filas (por curso, por materia, riesgo) sin volver a consultar la base,
 * así los filtros de año/división y la exportación son instantáneos.
 *
 * Módulo puro: lo usan la API, el modo demostración y los componentes.
 */

import { normalizarTipoIntervencion, tienePermiso, UMBRAL_ALERTA_PUNTOS, UMBRAL_ASISTENCIA_RIESGO, UMBRAL_PROMEDIO_BAJO } from "./rbac";
import type { Fecha, LegajoFuente, Rol, TipoIncidente, TipoIntervencion } from "./types";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface NotaInforme {
  materia: string;
  nota: number;
}

export interface FilaInforme {
  dni: string;
  apellidos: string;
  nombres: string;
  anio: number;
  division: string;
  turno: string;
  promedio: number;
  asistencia: number;
  tieneCud: boolean;
  requierePpi: boolean;
  materiasPrevias: number;
  /** Nota vigente por materia del ciclo del informe. */
  notas: NotaInforme[];
  /** null cuando el rol no accede al régimen de convivencia. */
  puntos: number | null;
  faltasIce: number | null;
  /** null cuando el rol no accede a la trayectoria escolar. */
  repitencias: number | null;
  alertasTempranas: number | null;
}

export interface IncidenteInforme {
  id: string;
  fecha: string;
  dni: string;
  estudiante: string;
  anio: number;
  division: string;
  tipo: TipoIncidente;
  puntos: number;
  aprobado: boolean;
  notificadoFamilia: boolean;
  autor: string;
}

/** Intervención del SOE sin el informe clínico: solo lo necesario para la agenda y la estadística. */
export interface IntervencionInforme {
  id: string;
  fecha: string;
  dni: string;
  estudiante: string;
  anio: number;
  division: string;
  tipo: TipoIntervencion;
  motivo: string;
  profesional: string;
  proximoSeguimiento: string | null;
}

export interface DatosInforme {
  generado: string;
  ciclo: number;
  rolConsulta: Rol;
  filas: FilaInforme[];
  /** Incidentes del LUE del ciclo (no anulados). null sin permiso de convivencia. */
  incidentes: IncidenteInforme[] | null;
  /** Intervenciones del SOE del ciclo. null salvo Directivo / SOE. */
  intervenciones: IntervencionInforme[] | null;
}

/** Lo que el servidor necesita del legajo para el informe (las asistencias mensuales no se usan). */
export type FuenteInforme = Omit<LegajoFuente, "asistencias">;

// ---------------------------------------------------------------------------
// Construcción (servidor / demo)
// ---------------------------------------------------------------------------

function iso(fecha: Fecha): string {
  return typeof fecha === "string" ? fecha : fecha.toISOString();
}

function anioDe(fecha: Fecha): number {
  return new Date(fecha).getUTCFullYear();
}

export function notaVigenteDe(c: {
  notaFinal: number | null;
  segundoCuatrimestre: number | null;
  primerCuatrimestre: number | null;
}): number | null {
  return c.notaFinal ?? c.segundoCuatrimestre ?? c.primerCuatrimestre;
}

/** Ciclo del informe: el más reciente con calificaciones; si no hay, el año en curso. */
export function cicloDelInforme(legajos: FuenteInforme[], referencia = new Date()): number {
  let ciclo = 0;
  for (const l of legajos) for (const c of l.calificaciones) if (c.cicloLectivo > ciclo) ciclo = c.cicloLectivo;
  return ciclo || referencia.getFullYear();
}

export function construirDatosInforme(legajos: FuenteInforme[], rol: Rol, ahora = new Date()): DatosInforme {
  const verConvivencia = tienePermiso(rol, "VER_CONVIVENCIA");
  const verTrayectoria = tienePermiso(rol, "VER_TRAYECTORIA");
  const verSoe = tienePermiso(rol, "VER_DATOS_CONFIDENCIALES");
  const regulares = legajos.filter((l) => l.estadoMatricula === "REGULAR");
  const ciclo = cicloDelInforme(regulares, ahora);

  const filas: FilaInforme[] = regulares
    .map((l) => ({
      dni: l.dni,
      apellidos: l.apellidos,
      nombres: l.nombres,
      anio: l.anio,
      division: l.division,
      turno: l.turno,
      promedio: l.promedioGeneral,
      asistencia: l.porcentajeAsistencia,
      tieneCud: l.tieneCud,
      requierePpi: l.requierePpi,
      materiasPrevias: l.calificaciones.filter((c) => c.previa).length,
      notas: l.calificaciones
        .filter((c) => c.cicloLectivo === ciclo)
        .flatMap((c) => {
          const nota = notaVigenteDe(c);
          return nota === null ? [] : [{ materia: c.materia, nota }];
        }),
      puntos: verConvivencia ? l.puntosConvivencia : null,
      faltasIce: verConvivencia ? l.faltasIce.filter((f) => f.cicloLectivo === ciclo && !f.dadaDeBaja).length : null,
      repitencias: verTrayectoria ? l.trayectoria.filter((t) => /PERMANENCIA/i.test(t.motivoEgreso ?? "")).length : null,
      alertasTempranas: verTrayectoria ? l.alertas.length : null,
    }))
    .sort(compararFilas);

  const nombre = (l: FuenteInforme) => `${l.apellidos}, ${l.nombres}`;

  const incidentes = verConvivencia
    ? regulares
        .flatMap((l) =>
          l.incidentes
            .filter((i) => !i.anulado && anioDe(i.fecha) === ciclo)
            .map((i) => ({
              id: i.id,
              fecha: iso(i.fecha),
              dni: l.dni,
              estudiante: nombre(l),
              anio: l.anio,
              division: l.division,
              tipo: i.tipo,
              puntos: i.puntosDescontados,
              aprobado: i.aprobado,
              notificadoFamilia: i.notificadoFamilia,
              autor: i.autor.nombre,
            })),
        )
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
    : null;

  const intervenciones = verSoe
    ? regulares
        .flatMap((l) =>
          l.intervenciones
            .filter((i) => anioDe(i.fecha) === ciclo || (i.proximoSeguimiento !== null && anioDe(i.proximoSeguimiento) >= ciclo))
            .map((i) => ({
              id: i.id,
              fecha: iso(i.fecha),
              dni: l.dni,
              estudiante: nombre(l),
              anio: l.anio,
              division: l.division,
              tipo: normalizarTipoIntervencion(i.tipo),
              motivo: i.motivo,
              profesional: i.profesional.nombre,
              proximoSeguimiento: i.proximoSeguimiento === null ? null : iso(i.proximoSeguimiento),
            })),
        )
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
    : null;

  return { generado: ahora.toISOString(), ciclo, rolConsulta: rol, filas, incidentes, intervenciones };
}

function compararFilas(a: FilaInforme, b: FilaInforme): number {
  return (
    a.anio - b.anio ||
    a.division.localeCompare(b.division, "es", { numeric: true }) ||
    a.apellidos.localeCompare(b.apellidos, "es") ||
    a.nombres.localeCompare(b.nombres, "es")
  );
}

// ---------------------------------------------------------------------------
// Agregados (cliente)
// ---------------------------------------------------------------------------

function redondear(valor: number, decimales = 2): number {
  const factor = 10 ** decimales;
  return Math.round(valor * factor) / factor;
}

function media(valores: number[]): number | null {
  return valores.length ? redondear(valores.reduce((a, b) => a + b, 0) / valores.length) : null;
}

/** Un alumno sin ninguna nota cargada tiene promedio 0: no es "promedio bajo", es "sin datos". */
export function tieneNotas(f: FilaInforme): boolean {
  return f.notas.length > 0 || f.promedio > 0;
}

export function materiasBajoUmbral(f: FilaInforme): number {
  return f.notas.filter((n) => n.nota < UMBRAL_PROMEDIO_BAJO).length;
}

/** Motivos concretos por los que un estudiante requiere seguimiento (vacío = sin alertas). */
export function motivosDeRiesgo(f: FilaInforme): string[] {
  const motivos: string[] = [];
  if (tieneNotas(f) && f.promedio < UMBRAL_PROMEDIO_BAJO) motivos.push(`Promedio ${f.promedio.toLocaleString("es-AR")}`);
  const bajo = materiasBajoUmbral(f);
  if (bajo >= 3) motivos.push(`${bajo} materias bajo 6`);
  if (f.asistencia < UMBRAL_ASISTENCIA_RIESGO) motivos.push(`Asistencia ${f.asistencia.toLocaleString("es-AR")}%`);
  if (f.puntos !== null && f.puntos < UMBRAL_ALERTA_PUNTOS) motivos.push(`Puntos ICE ${f.puntos}`);
  if (f.materiasPrevias > 0) motivos.push(`${f.materiasPrevias} previa${f.materiasPrevias > 1 ? "s" : ""}`);
  if (f.repitencias) motivos.push(f.repitencias > 1 ? `Repitió ${f.repitencias} veces` : "Repitió un año");
  return motivos;
}

export type NivelRiesgo = "alto" | "medio" | "bajo";

export function nivelDeRiesgo(motivos: string[]): NivelRiesgo {
  if (motivos.length >= 3) return "alto";
  if (motivos.length === 2) return "medio";
  return "bajo";
}

export interface ResumenGrupo {
  clave: string;
  anio: number;
  division: string | null;
  turno: string | null;
  matricula: number;
  promedio: number | null;
  asistencia: number | null;
  enRiesgo: number;
  bajoPromedio: number;
  bajaAsistencia: number;
  conCudPpi: number;
  conPrevias: number;
  sinNotas: number;
  /** null sin permiso de convivencia. */
  bajoPuntos: number | null;
}

function resumir(clave: string, anio: number, division: string | null, filas: FilaInforme[]): ResumenGrupo {
  const conNotas = filas.filter(tieneNotas);
  const turnos = [...new Set(filas.map((f) => f.turno))];
  return {
    clave,
    anio,
    division,
    turno: turnos.length === 1 ? (turnos[0] ?? null) : null,
    matricula: filas.length,
    promedio: media(conNotas.map((f) => f.promedio)),
    asistencia: media(filas.map((f) => f.asistencia)),
    enRiesgo: filas.filter((f) => motivosDeRiesgo(f).length > 0).length,
    bajoPromedio: conNotas.filter((f) => f.promedio < UMBRAL_PROMEDIO_BAJO).length,
    bajaAsistencia: filas.filter((f) => f.asistencia < UMBRAL_ASISTENCIA_RIESGO).length,
    conCudPpi: filas.filter((f) => f.tieneCud || f.requierePpi).length,
    conPrevias: filas.filter((f) => f.materiasPrevias > 0).length,
    sinNotas: filas.length - conNotas.length,
    bajoPuntos: filas.some((f) => f.puntos === null)
      ? null
      : filas.filter((f) => (f.puntos ?? Infinity) < UMBRAL_ALERTA_PUNTOS).length,
  };
}

export function resumenPorCurso(filas: FilaInforme[]): ResumenGrupo[] {
  const grupos = new Map<string, { anio: number; division: string; filas: FilaInforme[] }>();
  for (const f of filas) {
    const clave = `${f.anio}-${f.division}`;
    const grupo = grupos.get(clave) ?? { anio: f.anio, division: f.division, filas: [] };
    grupo.filas.push(f);
    grupos.set(clave, grupo);
  }
  return [...grupos.entries()]
    .map(([clave, g]) => resumir(clave, g.anio, g.division, g.filas))
    .sort((a, b) => a.anio - b.anio || (a.division ?? "").localeCompare(b.division ?? "", "es", { numeric: true }));
}

export function resumenPorAnio(filas: FilaInforme[]): ResumenGrupo[] {
  const anios = [...new Set(filas.map((f) => f.anio))].sort((a, b) => a - b);
  return anios.map((anio) => resumir(String(anio), anio, null, filas.filter((f) => f.anio === anio)));
}

export function resumenTotal(filas: FilaInforme[]): ResumenGrupo {
  return resumir("total", 0, null, filas);
}

export interface ResumenMateria {
  materia: string;
  anio: number;
  evaluados: number;
  promedio: number;
  desaprobados: number;
  porcentajeDesaprobados: number;
}

/** Rendimiento por materia y año (notas vigentes del ciclo), ordenado de mayor a menor desaprobación. */
export function resumenPorMateria(filas: FilaInforme[]): ResumenMateria[] {
  const grupos = new Map<string, { materia: string; anio: number; notas: number[] }>();
  for (const f of filas) {
    for (const n of f.notas) {
      const clave = `${f.anio}|${n.materia}`;
      const grupo = grupos.get(clave) ?? { materia: n.materia, anio: f.anio, notas: [] };
      grupo.notas.push(n.nota);
      grupos.set(clave, grupo);
    }
  }
  return [...grupos.values()]
    .map(({ materia, anio, notas }) => {
      const desaprobados = notas.filter((n) => n < UMBRAL_PROMEDIO_BAJO).length;
      return {
        materia,
        anio,
        evaluados: notas.length,
        promedio: media(notas) ?? 0,
        desaprobados,
        porcentajeDesaprobados: redondear((desaprobados / notas.length) * 100, 1),
      };
    })
    .sort((a, b) => b.porcentajeDesaprobados - a.porcentajeDesaprobados || a.anio - b.anio || a.materia.localeCompare(b.materia, "es"));
}

/** Distribución de notas vigentes en franjas (para el histograma institucional). */
export function distribucionNotas(filas: FilaInforme[]): { franja: string; cantidad: number; riesgo: boolean }[] {
  const franjas = [
    { franja: "1 a 3,99", min: 0, max: 4, riesgo: true },
    { franja: "4 a 5,99", min: 4, max: 6, riesgo: true },
    { franja: "6 a 6,99", min: 6, max: 7, riesgo: false },
    { franja: "7 a 7,99", min: 7, max: 8, riesgo: false },
    { franja: "8 a 8,99", min: 8, max: 9, riesgo: false },
    { franja: "9 a 10", min: 9, max: 10.01, riesgo: false },
  ];
  const notas = filas.flatMap((f) => f.notas.map((n) => n.nota));
  return franjas.map(({ franja, min, max, riesgo }) => ({
    franja,
    riesgo,
    cantidad: notas.filter((n) => n >= min && n < max).length,
  }));
}

// ---------------------------------------------------------------------------
// Exportación CSV (abre directo en Excel con configuración regional es-AR)
// ---------------------------------------------------------------------------

type Celda = string | number | boolean | null | undefined;

function celdaCsv(valor: Celda): string {
  if (valor === null || valor === undefined) return "";
  const texto =
    typeof valor === "number"
      ? valor.toLocaleString("es-AR", { maximumFractionDigits: 2, useGrouping: false })
      : typeof valor === "boolean"
        ? valor
          ? "Sí"
          : "No"
        : valor;
  return /[;"\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** CSV separado por ";" con BOM UTF-8: Excel en español lo abre con columnas y tildes correctas. */
export function aCsv(encabezados: string[], filas: Celda[][]): string {
  const lineas = [encabezados, ...filas].map((fila) => fila.map(celdaCsv).join(";"));
  return `﻿${lineas.join("\r\n")}\r\n`;
}
