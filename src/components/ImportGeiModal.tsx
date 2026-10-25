"use client";

import { CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ResultadoImportacionGei } from "@/services/geiParser";
import { MensajeError, Modal } from "./ui";

interface Props {
  abierto: boolean;
  modoDemo: boolean;
  onCerrar: () => void;
  onImportar: (archivo: File) => Promise<ResultadoImportacionGei>;
}

/** Genera un Excel de ejemplo con el formato de exportación del GEI (útil para la demo y para probar el parser). */
async function descargarEjemplo(): Promise<void> {
  const XLSX = await import("xlsx");
  const libro = XLSX.utils.book_new();
  const matricula = XLSX.utils.aoa_to_sheet([
    ["DIRECCIÓN GENERAL DE ESCUELAS - MENDOZA"],
    ["Reporte de matrícula - Ciclo lectivo 2026"],
    [],
    ["DNI", "Apellido y Nombre", "Curso", "División", "Turno", "Fecha de Nacimiento", "% Asistencia", "Estado"],
    ["50.123.456", "PEREZ, Juan Ignacio", "1°", "1ra", "Mañana", "12/04/2013", "95,1%", "Regular"],
    ["54012345", "ARAYA, Benicio Martín", "1°", "1ra", "Mañana", "03/02/2014", "100%", "Regular"],
    ["54098761", "BUSTOS, Olivia", "1°", "2da", "Tarde", "28/09/2013", "98%", "Regular"],
    ["4567", "DATO, Inválido", "1°", "1ra", "Mañana", "", "", "Regular"],
  ]);
  const notas = XLSX.utils.aoa_to_sheet([
    ["DNI", "Materia", "Ciclo Lectivo", "1er Cuatrimestre", "2do Cuatrimestre", "Nota Final", "Previa"],
    ["54012345", "Matemática", 2026, 8, "", "", "No"],
    ["54012345", "Lengua", 2026, 7.5, "", "", "No"],
    ["54098761", "Matemática", 2026, 6, "", "", "No"],
    ["54098761", "Lengua", 2026, 9, "", "", "No"],
  ]);
  XLSX.utils.book_append_sheet(libro, matricula, "Matricula");
  XLSX.utils.book_append_sheet(libro, notas, "Notas");
  XLSX.writeFile(libro, "ejemplo_reporte_GEI.xlsx");
}

export default function ImportGeiModal({ abierto, modoDemo, onCerrar, onImportar }: Props) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImportacionGei | null>(null);
  const [error, setError] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!abierto) return;
    setArchivo(null);
    setResultado(null);
    setError(null);
  }, [abierto]);

  const importar = async () => {
    if (!archivo) return;
    setProcesando(true);
    setError(null);
    try {
      setResultado(await onImportar(archivo));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setProcesando(false);
    }
  };

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Importar reporte del GEI"
      subtitulo="Matrícula, asistencia y notas (Excel o CSV exportado del portal GEI)"
      ancho="lg"
    >
      <div className="space-y-4">
        <div
          role="button"
          tabIndex={0}
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-6 py-8 text-center hover:border-institucional-500 hover:bg-institucional-50/40"
          onClick={() => entrada.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") entrada.current?.click();
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const soltado = e.dataTransfer.files[0];
            if (soltado) setArchivo(soltado);
          }}
        >
          <FileSpreadsheet className="h-8 w-8 text-emerald-600" aria-hidden />
          <p className="text-sm text-slate-700">
            {archivo ? <strong>{archivo.name}</strong> : "Arrastre el archivo aquí o haga clic para seleccionarlo"}
          </p>
          <p className="text-xs text-slate-500">.xlsx, .xls o .csv · máximo 15 MB · la columna DNI es obligatoria</p>
          <input
            ref={entrada}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => void descargarEjemplo()}
            className="inline-flex items-center gap-1 text-xs font-medium text-institucional-700 hover:underline"
          >
            <Download className="h-3.5 w-3.5" aria-hidden /> Descargar Excel de ejemplo
          </button>
          <button
            type="button"
            disabled={!archivo || procesando}
            onClick={() => void importar()}
            className="inline-flex items-center gap-2 rounded-md bg-institucional-600 px-4 py-2 text-sm font-medium text-white hover:bg-institucional-700 disabled:opacity-50"
          >
            {procesando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />}
            {procesando ? "Procesando…" : "Importar y sincronizar"}
          </button>
        </div>

        {!modoDemo && (
          <p className="text-xs text-slate-500">
            Se actualizarán los datos por DNI, se recalcularán promedios y se crearán o moverán las carpetas de Google Drive.
          </p>
        )}
        {error && <MensajeError mensaje={error} />}

        {resultado && (
          <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
              <CheckCircle2 className="h-5 w-5" aria-hidden /> Importación finalizada en {(resultado.duracionMs / 1000).toFixed(1)} s
            </p>
            <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              {(
                [
                  ["Alumnos nuevos", resultado.estudiantesCreados],
                  ["Actualizados", resultado.estudiantesActualizados],
                  ["Asistencias", resultado.asistenciasActualizadas],
                  ["Calificaciones", resultado.calificacionesActualizadas],
                  ["Carpetas creadas", resultado.carpetasDriveCreadas],
                  ["Carpetas movidas", resultado.carpetasDriveMovidas],
                  ["Errores", resultado.errores.length],
                ] as const
              ).map(([etiqueta, valor]) => (
                <div key={etiqueta} className="rounded-md bg-white px-3 py-2 ring-1 ring-inset ring-slate-200">
                  <dt className="text-xs text-slate-500">{etiqueta}</dt>
                  <dd className="font-semibold tabular-nums text-slate-900">{valor}</dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-slate-600">
              Hojas: {resultado.hojas.map((h) => `${h.nombre} (${h.tipo.toLowerCase()}, ${h.filas} filas)`).join(" · ")}
            </p>
            {resultado.advertencias.map((a) => (
              <p key={a} className="text-xs text-amber-800">
                ⚠ {a}
              </p>
            ))}
            {resultado.errores.length > 0 && (
              <ul className="max-h-32 space-y-0.5 overflow-y-auto text-xs text-red-700">
                {resultado.errores.slice(0, 50).map((e, i) => (
                  <li key={i}>
                    ✗ [{e.hoja}
                    {e.fila > 0 ? ` fila ${e.fila}` : ""}] {e.motivo}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
