"use client";

import { ChevronRight, Loader2 } from "lucide-react";
import { nivelAlertaPuntos, PUNTOS_INICIALES } from "@/lib/convivencia";
import { etiquetaCurso, formatearNota } from "@/lib/formato";
import { UMBRAL_ASISTENCIA_RIESGO, UMBRAL_PROMEDIO_BAJO } from "@/lib/rbac";
import type { EstudianteResumen } from "@/lib/types";
import { Insignia } from "./ui";

interface Props {
  estudiantes: EstudianteResumen[];
  total: number;
  cargando: boolean;
  mostrarPuntos: boolean;
  onVerLegajo: (dni: string) => void;
  onCargarMas: () => void;
}

function BarraPuntos({ puntos }: { puntos: number }) {
  const nivel = nivelAlertaPuntos(puntos);
  const colores = { ok: "bg-emerald-500", atencion: "bg-amber-500", critico: "bg-red-500" };
  return (
    <div className="flex items-center gap-2" title={`${puntos} de ${PUNTOS_INICIALES} puntos`}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full ${colores[nivel]}`} style={{ width: `${(puntos / PUNTOS_INICIALES) * 100}%` }} />
      </div>
      <span className={`text-sm tabular-nums ${nivel === "ok" ? "text-slate-700" : "font-semibold text-red-700"}`}>{puntos}</span>
    </div>
  );
}

export default function StudentTable({ estudiantes, total, cargando, mostrarPuntos, onVerLegajo, onCargarMas }: Props) {
  if (!cargando && estudiantes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
        No hay estudiantes que coincidan con la búsqueda o los filtros.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-3">Estudiante</th>
              <th scope="col" className="px-4 py-3">Curso</th>
              <th scope="col" className="px-4 py-3 text-right">Promedio</th>
              <th scope="col" className="px-4 py-3 text-right">Asistencia</th>
              {mostrarPuntos && <th scope="col" className="px-4 py-3">Convivencia</th>}
              <th scope="col" className="px-4 py-3">Indicadores</th>
              <th scope="col" className="px-4 py-3"><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {estudiantes.map((e) => (
              <tr
                key={e.id}
                className={`cursor-pointer hover:bg-institucional-50/50 ${e.estadoMatricula !== "REGULAR" ? "opacity-60" : ""}`}
                onClick={() => onVerLegajo(e.dni)}
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">
                    {e.apellidos}, {e.nombres}
                  </div>
                  <div className="text-xs tabular-nums text-slate-500">DNI {e.dni}</div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                  {etiquetaCurso(e.anio, e.division)}
                  <div className="text-xs text-slate-500">{e.turno}</div>
                </td>
                <td
                  className={`px-4 py-3 text-right tabular-nums ${e.promedioGeneral < UMBRAL_PROMEDIO_BAJO ? "font-semibold text-red-700" : "text-slate-700"}`}
                >
                  {formatearNota(e.promedioGeneral)}
                </td>
                <td
                  className={`px-4 py-3 text-right tabular-nums ${e.porcentajeAsistencia < UMBRAL_ASISTENCIA_RIESGO ? "font-semibold text-red-700" : "text-slate-700"}`}
                >
                  {e.porcentajeAsistencia.toLocaleString("es-AR")}%
                </td>
                {mostrarPuntos && (
                  <td className="px-4 py-3">{e.puntosConvivencia !== null && <BarraPuntos puntos={e.puntosConvivencia} />}</td>
                )}
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {e.tieneCud && <Insignia tono="violeta" titulo="Posee Certificado Único de Discapacidad">CUD</Insignia>}
                    {e.requierePpi && <Insignia tono="azul" titulo="Requiere Proyecto Pedagógico Individual">PPI</Insignia>}
                    {e.materiasPrevias > 0 && (
                      <Insignia tono="ambar">
                        {e.materiasPrevias} previa{e.materiasPrevias > 1 ? "s" : ""}
                      </Insignia>
                    )}
                    {e.estadoMatricula !== "REGULAR" && <Insignia tono="neutro">{e.estadoMatricula}</Insignia>}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onVerLegajo(e.dni);
                    }}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-institucional-700 hover:bg-institucional-50"
                  >
                    Legajo <ChevronRight className="h-4 w-4" aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
        <span>
          Mostrando {estudiantes.length} de {total}
        </span>
        {cargando && <Loader2 className="h-4 w-4 animate-spin text-institucional-600" aria-label="Cargando" />}
        {!cargando && estudiantes.length < total && (
          <button type="button" onClick={onCargarMas} className="font-medium text-institucional-700 hover:underline">
            Cargar más
          </button>
        )}
      </div>
    </div>
  );
}
