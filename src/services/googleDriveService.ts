/**
 * Sincronización del árbol de carpetas del LUE en Google Drive mediante una Service Account.
 *
 * 📁 LEGAJO_UNICO_ESTUDIANTES_2026            (dentro de GOOGLE_DRIVE_ROOT_FOLDER_ID)
 *  └── 📁 1er Año
 *       └── 📁 1ra División
 *            └── 📁 50123456 - PEREZ, Juan Ignacio
 *                 ├── 📁 01_Documentacion_General
 *                 ├── 📁 02_Convivencia_y_Actas
 *                 └── 📁 03_SOE_y_Salud_Confidencial
 *
 * Recomendación: usar una Unidad Compartida institucional (las Service Accounts no tienen cuota
 * propia en "Mi unidad"). Todas las llamadas usan supportsAllDrives para funcionar en ambos casos.
 */

import { google, type drive_v3 } from "googleapis";
import {
  NOMBRE_CARPETA_RAIZ,
  nombreCarpetaAnio,
  nombreCarpetaDivision,
  nombreCarpetaEstudiante,
  SUBCARPETAS,
} from "@/lib/driveNombres";

export { NOMBRE_CARPETA_RAIZ, SUBCARPETAS } from "@/lib/driveNombres";

const MIME_CARPETA = "application/vnd.google-apps.folder";
const TTL_CACHE_MS = 10 * 60 * 1000;

export interface EstudianteParaDrive {
  dni: string;
  apellidos: string;
  nombres: string;
  anio: number;
  division: string;
  driveFolderId?: string | null;
}

export interface CarpetasEstudiante {
  driveFolderId: string;
  driveDocumentacionFolderId: string;
  driveConvivenciaFolderId: string;
  driveConfidencialFolderId: string;
}

export function driveConfigurado(): boolean {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_PRIVATE_KEY &&
      process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID,
  );
}

let clienteDrive: drive_v3.Drive | null = null;

function obtenerDrive(): drive_v3.Drive {
  if (clienteDrive) return clienteDrive;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const clave = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !clave) {
    throw new Error("Google Drive no configurado: faltan GOOGLE_SERVICE_ACCOUNT_EMAIL o GOOGLE_PRIVATE_KEY.");
  }
  const auth = new google.auth.JWT({
    email,
    // En variables de entorno la clave viaja con "\n" literales.
    key: clave.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  clienteDrive = google.drive({ version: "v3", auth });
  return clienteDrive;
}

function idCarpetaPadreInstitucional(): string {
  const id = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (!id) throw new Error("Google Drive no configurado: falta GOOGLE_DRIVE_ROOT_FOLDER_ID.");
  return id;
}

// ---------------------------------------------------------------------------
// Primitivas
// ---------------------------------------------------------------------------

function escaparConsulta(valor: string): string {
  return valor.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function esNoEncontrado(error: unknown): boolean {
  const e = error as { code?: unknown; status?: unknown };
  return e.code === 404 || e.status === 404;
}

/**
 * Caché de promesas por (padre, nombre): evita carpetas duplicadas cuando una importación masiva
 * procesa en paralelo varios alumnos del mismo curso.
 */
const cacheCarpetas = new Map<string, { id: Promise<string>; vence: number }>();

async function buscarOCrearCarpeta(nombre: string, padreId: string): Promise<string> {
  const clave = `${padreId}/${nombre}`;
  const enCache = cacheCarpetas.get(clave);
  if (enCache && enCache.vence > Date.now()) return enCache.id;

  const promesa = (async () => {
    const drive = obtenerDrive();
    const existente = await drive.files.list({
      q: `name = '${escaparConsulta(nombre)}' and '${escaparConsulta(padreId)}' in parents and mimeType = '${MIME_CARPETA}' and trashed = false`,
      fields: "files(id, name)",
      pageSize: 1,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    const idExistente = existente.data.files?.[0]?.id;
    if (idExistente) return idExistente;

    const creada = await drive.files.create({
      requestBody: { name: nombre, mimeType: MIME_CARPETA, parents: [padreId] },
      fields: "id",
      supportsAllDrives: true,
    });
    if (!creada.data.id) throw new Error(`Drive no devolvió el ID de la carpeta "${nombre}".`);
    return creada.data.id;
  })();

  cacheCarpetas.set(clave, { id: promesa, vence: Date.now() + TTL_CACHE_MS });
  promesa.catch(() => cacheCarpetas.delete(clave));
  return promesa;
}

async function carpetaExiste(folderId: string): Promise<boolean> {
  try {
    const res = await obtenerDrive().files.get({
      fileId: folderId,
      fields: "id, trashed, mimeType",
      supportsAllDrives: true,
    });
    return res.data.trashed !== true && res.data.mimeType === MIME_CARPETA;
  } catch (error) {
    if (esNoEncontrado(error)) return false;
    throw error;
  }
}

async function carpetaCurso(anio: number, division: string): Promise<string> {
  const raiz = await buscarOCrearCarpeta(NOMBRE_CARPETA_RAIZ, idCarpetaPadreInstitucional());
  const carpetaAnio = await buscarOCrearCarpeta(nombreCarpetaAnio(anio), raiz);
  return buscarOCrearCarpeta(nombreCarpetaDivision(division), carpetaAnio);
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Verifica o crea la ruta completa del alumno y sus 3 subcarpetas.
 * Si el alumno ya tiene driveFolderId y la carpeta existe, se respeta (aunque haya sido renombrada
 * a mano) y solo se completan las subcarpetas faltantes.
 */
export async function sincronizarEstructuraDrive(estudiante: EstudianteParaDrive): Promise<CarpetasEstudiante> {
  let carpetaAlumno: string;
  if (estudiante.driveFolderId && (await carpetaExiste(estudiante.driveFolderId))) {
    carpetaAlumno = estudiante.driveFolderId;
  } else {
    const curso = await carpetaCurso(estudiante.anio, estudiante.division);
    carpetaAlumno = await buscarOCrearCarpeta(nombreCarpetaEstudiante(estudiante), curso);
  }

  const [documentacion, convivencia, confidencial] = await Promise.all([
    buscarOCrearCarpeta(SUBCARPETAS.documentacion, carpetaAlumno),
    buscarOCrearCarpeta(SUBCARPETAS.convivencia, carpetaAlumno),
    buscarOCrearCarpeta(SUBCARPETAS.confidencial, carpetaAlumno),
  ]);

  return {
    driveFolderId: carpetaAlumno,
    driveDocumentacionFolderId: documentacion,
    driveConvivenciaFolderId: convivencia,
    driveConfidencialFolderId: confidencial,
  };
}

/**
 * Mueve la carpeta del alumno (intacta, con todo su contenido e historial) al curso nuevo
 * cuando promociona o cambia de división. Si el alumno aún no tenía carpeta, la crea.
 */
export async function moverCarpetaPorPromocion(
  estudiante: EstudianteParaDrive,
  nuevoAnio: number,
  nuevaDivision: string,
): Promise<CarpetasEstudiante> {
  const destinoAlumno: EstudianteParaDrive = { ...estudiante, anio: nuevoAnio, division: nuevaDivision };

  if (!estudiante.driveFolderId || !(await carpetaExiste(estudiante.driveFolderId))) {
    return sincronizarEstructuraDrive({ ...destinoAlumno, driveFolderId: null });
  }

  const drive = obtenerDrive();
  const destino = await carpetaCurso(nuevoAnio, nuevaDivision);
  const actual = await drive.files.get({
    fileId: estudiante.driveFolderId,
    fields: "id, parents",
    supportsAllDrives: true,
  });
  const padresActuales = actual.data.parents ?? [];

  if (!padresActuales.includes(destino)) {
    await drive.files.update({
      fileId: estudiante.driveFolderId,
      addParents: destino,
      removeParents: padresActuales.join(","),
      fields: "id, parents",
      supportsAllDrives: true,
    });
  }

  return sincronizarEstructuraDrive(destinoAlumno);
}
