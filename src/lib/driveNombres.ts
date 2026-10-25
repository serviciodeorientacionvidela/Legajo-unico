/**
 * Nomenclatura del árbol de carpetas del LUE en Google Drive.
 * Módulo puro: lo usa googleDriveService (servidor) y la vista del legajo (cliente) para mostrar la ruta.
 */

export const NOMBRE_CARPETA_RAIZ = "LEGAJO_UNICO_ESTUDIANTES_2026";

export const SUBCARPETAS = {
  documentacion: "01_Documentacion_General",
  convivencia: "02_Convivencia_y_Actas",
  confidencial: "03_SOE_y_Salud_Confidencial",
} as const;

const ORDINAL_MASCULINO: Record<number, string> = {
  1: "1er", 2: "2do", 3: "3er", 4: "4to", 5: "5to", 6: "6to", 7: "7mo", 8: "8vo", 9: "9no", 10: "10mo",
};
const ORDINAL_FEMENINO: Record<number, string> = {
  1: "1ra", 2: "2da", 3: "3ra", 4: "4ta", 5: "5ta", 6: "6ta", 7: "7ma", 8: "8va", 9: "9na", 10: "10ma",
};

export function nombreCarpetaAnio(anio: number): string {
  const ordinal = ORDINAL_MASCULINO[anio];
  if (!ordinal) throw new Error(`Año fuera de rango para Drive: ${anio}`);
  return `${ordinal} Año`;
}

export function nombreCarpetaDivision(division: string): string {
  const numero = Number.parseInt(division.replace(/\D/g, ""), 10);
  const ordinal = ORDINAL_FEMENINO[numero];
  return ordinal ? `${ordinal} División` : `División ${division.trim().toUpperCase()}`;
}

export function nombreCarpetaEstudiante(e: { dni: string; apellidos: string; nombres: string }): string {
  return `${e.dni} - ${e.apellidos.trim().toUpperCase()}, ${e.nombres.trim()}`;
}

export function rutaCarpetaEstudiante(e: {
  dni: string;
  apellidos: string;
  nombres: string;
  anio: number;
  division: string;
}): string[] {
  return [NOMBRE_CARPETA_RAIZ, nombreCarpetaAnio(e.anio), nombreCarpetaDivision(e.division), nombreCarpetaEstudiante(e)];
}
