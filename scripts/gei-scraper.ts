/**
 * Scraper autónomo del portal GEI (DGE Mendoza).
 *
 * Inicia sesión con las credenciales del establecimiento, descarga los reportes configurados
 * (matrícula, asistencia, notas) y los procesa con geiSyncService (upsert en PostgreSQL +
 * carpetas en Google Drive + auditoría IMPORTAR_GEI).
 *
 * Uso:
 *   npm run gei:scrape                     # descarga e importa
 *   npm run gei:scrape -- --headed         # con navegador visible (para calibrar selectores)
 *   npm run gei:scrape -- --solo-descargar # descarga sin importar
 *   npm run gei:scrape -- --sin-drive      # importa sin sincronizar Google Drive
 *
 * Variables de entorno (ver .env.example): GEI_USER, GEI_PASS, GEI_LOGIN_URL, GEI_REPORTES,
 * GEI_SYNC_USER_EMAIL y, opcionalmente, los selectores GEI_SELECTOR_*.
 *
 * Requiere una única vez: npx playwright install chromium
 */

import { config as cargarEnv } from "dotenv";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Locator, type Page } from "playwright";

cargarEnv({ path: ".env.local" });
cargarEnv();

interface ReporteGei {
  nombre: string;
  url: string;
}

const argumentos = new Set(process.argv.slice(2));
const MODO_VISIBLE = argumentos.has("--headed");
const SOLO_DESCARGAR = argumentos.has("--solo-descargar");
const SIN_DRIVE = argumentos.has("--sin-drive");

const CARPETA_DESCARGAS = path.resolve(process.cwd(), "gei-downloads");
const TIMEOUT_MS = 60_000;

function requerirEnv(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(`Falta la variable de entorno ${nombre}. Revise .env.local (ver .env.example).`);
  }
  return valor;
}

/** GEI_REPORTES="matricula|https://...;asistencia|https://...;notas|https://..." */
function leerReportes(): ReporteGei[] {
  const crudo = requerirEnv("GEI_REPORTES");
  const reportes = crudo
    .split(";")
    .map((entrada) => entrada.trim())
    .filter(Boolean)
    .map((entrada) => {
      const separador = entrada.indexOf("|");
      if (separador === -1) throw new Error(`Entrada inválida en GEI_REPORTES: "${entrada}" (formato nombre|url).`);
      const nombre = entrada.slice(0, separador).trim();
      const url = entrada.slice(separador + 1).trim();
      new URL(url); // valida el formato
      return { nombre, url };
    });
  if (reportes.length === 0) throw new Error("GEI_REPORTES no contiene ningún reporte.");
  return reportes;
}

async function primerVisible(page: Page, selectores: string): Promise<Locator> {
  const candidato = page.locator(selectores).first();
  await candidato.waitFor({ state: "visible", timeout: TIMEOUT_MS });
  return candidato;
}

async function iniciarSesion(page: Page): Promise<void> {
  const urlIngreso = process.env.GEI_LOGIN_URL ?? "https://gei.mendoza.edu.ar/";
  console.log(`→ Ingresando a ${urlIngreso}`);
  await page.goto(urlIngreso, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });

  const campoUsuario = await primerVisible(
    page,
    process.env.GEI_SELECTOR_USUARIO ??
      'input[name="usuario"], input[name="username"], input[name="user"], input#usuario, input[type="email"], input[type="text"]',
  );
  await campoUsuario.fill(requerirEnv("GEI_USER"));

  const campoClave = await primerVisible(page, process.env.GEI_SELECTOR_PASSWORD ?? 'input[type="password"]');
  await campoClave.fill(requerirEnv("GEI_PASS"));

  const botonIngresar = await primerVisible(
    page,
    process.env.GEI_SELECTOR_INGRESAR ?? 'button[type="submit"], input[type="submit"], button:has-text("Ingresar")',
  );
  await Promise.all([page.waitForLoadState("networkidle", { timeout: TIMEOUT_MS }), botonIngresar.click()]);

  // Si el campo de contraseña sigue visible, el login falló (credenciales o captcha).
  const sigueEnLogin = await page.locator('input[type="password"]').first().isVisible().catch(() => false);
  if (sigueEnLogin) {
    throw new Error("No se pudo iniciar sesión en el GEI: verifique GEI_USER / GEI_PASS o si el portal pide captcha.");
  }
  console.log("✓ Sesión iniciada en el GEI");
}

async function descargarReporte(page: Page, reporte: ReporteGei): Promise<string> {
  console.log(`→ Abriendo reporte "${reporte.nombre}"`);
  await page.goto(reporte.url, { waitUntil: "networkidle", timeout: TIMEOUT_MS });

  const selectorPersonalizado = process.env.GEI_SELECTOR_EXPORTAR;
  const botonExportar = selectorPersonalizado
    ? page.locator(selectorPersonalizado).first()
    : page
        .getByRole("button", { name: /exportar|excel|descargar|xls/i })
        .or(page.getByRole("link", { name: /exportar|excel|descargar|xls/i }))
        .first();
  await botonExportar.waitFor({ state: "visible", timeout: TIMEOUT_MS });

  const [descarga] = await Promise.all([page.waitForEvent("download", { timeout: TIMEOUT_MS }), botonExportar.click()]);

  const extension = path.extname(descarga.suggestedFilename()) || ".xlsx";
  const fecha = new Date().toISOString().slice(0, 10);
  const destino = path.join(CARPETA_DESCARGAS, `${fecha}_${reporte.nombre}${extension}`);
  await descarga.saveAs(destino);
  console.log(`✓ Descargado: ${path.relative(process.cwd(), destino)}`);
  return destino;
}

async function importarDescargas(archivos: string[]): Promise<void> {
  // Import dinámico: dotenv ya cargó DATABASE_URL antes de instanciar Prisma.
  const { prisma } = await import("../src/lib/prisma");
  const { importarArchivoGei } = await import("../src/services/geiSyncService");

  const emailResponsable = requerirEnv("GEI_SYNC_USER_EMAIL");
  const responsable = await prisma.usuario.findUnique({ where: { email: emailResponsable } });
  if (!responsable || !responsable.activo || responsable.rol !== "DIRECTIVO_SOE") {
    throw new Error(`GEI_SYNC_USER_EMAIL (${emailResponsable}) debe ser un usuario DIRECTIVO_SOE activo.`);
  }

  try {
    for (const archivo of archivos) {
      const contenido = await readFile(archivo);
      const resultado = await importarArchivoGei(new Uint8Array(contenido), {
        usuarioId: responsable.id,
        nombreArchivo: path.basename(archivo),
        sincronizarDrive: !SIN_DRIVE,
        ipAddress: "gei-scraper",
      });
      console.log(`\n📊 ${resultado.archivo}`);
      console.log(`   Hojas: ${resultado.hojas.map((h) => `${h.nombre} (${h.tipo}, ${h.filas} filas)`).join(", ")}`);
      console.log(`   Alumnos creados: ${resultado.estudiantesCreados} · actualizados: ${resultado.estudiantesActualizados}`);
      console.log(`   Asistencias: ${resultado.asistenciasActualizadas} · Calificaciones: ${resultado.calificacionesActualizadas}`);
      console.log(`   Drive: ${resultado.carpetasDriveCreadas} carpetas creadas, ${resultado.carpetasDriveMovidas} movidas`);
      resultado.advertencias.forEach((a) => console.warn(`   ⚠ ${a}`));
      resultado.errores.slice(0, 20).forEach((e) => console.warn(`   ✗ [${e.hoja} fila ${e.fila}] ${e.motivo}`));
      if (resultado.errores.length > 20) console.warn(`   … y ${resultado.errores.length - 20} errores más`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function main(): Promise<void> {
  const reportes = leerReportes();
  await mkdir(CARPETA_DESCARGAS, { recursive: true });

  const navegador = await chromium.launch({ headless: !MODO_VISIBLE });
  const contexto = await navegador.newContext({ acceptDownloads: true, locale: "es-AR" });
  const page = await contexto.newPage();
  const descargados: string[] = [];

  try {
    await iniciarSesion(page);
    for (const reporte of reportes) {
      descargados.push(await descargarReporte(page, reporte));
    }
  } catch (error) {
    const captura = path.join(CARPETA_DESCARGAS, `error-${Date.now()}.png`);
    await page.screenshot({ path: captura, fullPage: true }).catch(() => undefined);
    console.error(`✗ Falló el scraping. Captura de pantalla: ${path.relative(process.cwd(), captura)}`);
    throw error;
  } finally {
    await navegador.close();
  }

  if (SOLO_DESCARGAR) {
    console.log("\nModo --solo-descargar: no se importaron los archivos.");
    return;
  }
  await importarDescargas(descargados);
  console.log("\n✓ Sincronización GEI finalizada.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
