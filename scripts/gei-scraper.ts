/**
 * Scraper autónomo del GEI (DGE Mendoza).
 *
 * Inicia sesión en la intranet de la DGE con la cuenta del establecimiento, entra al GEI y descarga,
 * para los años configurados (GEI_ANIOS):
 *   - la matrícula (alumno/excel_alumnos): datos personales y de contacto,
 *   - la asistencia de cada mes cerrado de cada división (division_inasistencia/resumen_diario_imprimir_excel),
 *   - el resumen de evaluaciones de cada espacio curricular (cursada/excel_resumen_evaluaciones_generico),
 *   - la ficha de cada alumno (alumno/ver): trayectoria escolar y alertas tempranas.
 * Luego importa todo con geiSyncService (upsert en PostgreSQL + carpetas en Google Drive + auditoría).
 *
 * Solo navega y descarga: nunca hace clic en botones que modifiquen el GEI.
 *
 * Uso:
 *   npm run gei:scrape                     # descarga e importa
 *   npm run gei:scrape -- --headed         # con navegador visible (para calibrar)
 *   npm run gei:scrape -- --solo-descargar # descarga sin importar
 *   npm run gei:scrape -- --sin-drive      # importa sin sincronizar Google Drive
 *   npm run gei:scrape -- --solo-fichas    # solo trayectoria y alertas tempranas (sin planillas)
 *   npm run gei:scrape -- --sin-fichas     # omite las fichas (más rápido)
 *
 * Variables de entorno (ver .env.example): GEI_USER, GEI_PASS, GEI_SYNC_USER_EMAIL y, opcionalmente,
 * GEI_LOGIN_URL, GEI_BASE_URL, GEI_ESCUELA_ID, GEI_ANIOS, GEI_CICLO.
 *
 * Requiere una única vez: npx playwright install chromium
 */

import { config as cargarEnv } from "dotenv";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";
import { ROTULOS_TABLA_ALERTAS, ROTULOS_TABLA_TRAYECTORIA, type FichaGei } from "../src/services/geiFichas";

cargarEnv({ path: ".env.local" });
cargarEnv();

const argumentos = new Set(process.argv.slice(2));
const MODO_VISIBLE = argumentos.has("--headed");
const SOLO_DESCARGAR = argumentos.has("--solo-descargar");
const SIN_DRIVE = argumentos.has("--sin-drive");
const SOLO_FICHAS = argumentos.has("--solo-fichas");
const SIN_FICHAS = argumentos.has("--sin-fichas");

const URL_INGRESO = process.env.GEI_LOGIN_URL ?? "https://intranet.mendoza.edu.ar/usuarios/auth/login";
const URL_GEI = (process.env.GEI_BASE_URL ?? "https://dti.mendoza.edu.ar/gem/").replace(/\/?$/, "/");
const ESCUELA_ID = process.env.GEI_ESCUELA_ID ?? "1000";
const CICLO = Number(process.env.GEI_CICLO ?? new Date().getFullYear());
const ANIOS = (process.env.GEI_ANIOS ?? "1,2,3,4,5").split(",").map((a) => Number(a.trim())).filter(Boolean);

const CARPETA_DESCARGAS = path.resolve(process.cwd(), "gei-downloads", new Date().toISOString().slice(0, 10));
const TIMEOUT_MS = 90_000;
const PAUSA_ENTRE_DESCARGAS_MS = 300;

interface DivisionGei {
  curso: string;
  anio: number;
  divisionId: string;
  /** Ids de los meses cerrados (candado) de la grilla de asistencia. */
  mesesCerrados: string[];
}

interface ArchivoDescargado {
  nombre: string;
  datos: Uint8Array;
}

function requerirEnv(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(`Falta la variable de entorno ${nombre}. Revise .env.local (ver .env.example).`);
  }
  return valor;
}

const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

async function iniciarSesion(page: Page): Promise<void> {
  console.log(`→ Ingresando a ${URL_INGRESO}`);
  await page.goto(URL_INGRESO, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });

  await page.locator('input[placeholder="Usuario"], input[name="usuario"], input[type="text"]').first().fill(requerirEnv("GEI_USER"));
  const campoClave = page.locator('input[type="password"]').first();
  await campoClave.fill(requerirEnv("GEI_PASS"));
  // Enter en vez de clic: la página tiene otros botones submit ocultos.
  await campoClave.press("Enter");

  // Si no sale de la pantalla de login, falló (credenciales o captcha).
  await page.waitForURL((url) => !url.pathname.includes("/auth/login"), { timeout: 30_000 }).catch(() => {
    throw new Error("No se pudo iniciar sesión en la intranet DGE: verifique GEI_USER / GEI_PASS.");
  });
  await page.waitForLoadState("domcontentloaded");
  console.log("✓ Sesión iniciada en la intranet DGE");
}

/** Entra al GEI desde el escritorio de la intranet (el ícono abre el GEI, a veces en otra pestaña). */
async function entrarAlGei(contexto: BrowserContext, page: Page): Promise<Page> {
  const destino = `${URL_GEI}escuela/escritorio/${ESCUELA_ID}`;
  const icono = page.locator('a[href*="/gem"], a:has(img[src*="gei" i]), a:has(img[alt*="gei" i])').first();
  if (await icono.isVisible().catch(() => false)) {
    await icono.click();
    const limite = Date.now() + TIMEOUT_MS;
    while (Date.now() < limite) {
      const gei = contexto.pages().find((p) => p.url().includes("/gem/"));
      if (gei) {
        await gei.waitForLoadState("domcontentloaded");
        await gei.goto(destino, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });
        console.log("✓ Dentro del GEI");
        return gei;
      }
      await esperar(500);
    }
  }
  // Sin ícono visible: se intenta directo con la sesión ya iniciada.
  await page.goto(destino, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });
  if (!page.url().includes("/gem/") || (await page.locator('input[type="password"]').first().isVisible().catch(() => false))) {
    throw new Error("No se pudo entrar al GEI después del login (ejecute con --headed para ver qué pasa).");
  }
  console.log("✓ Dentro del GEI");
  return page;
}

const omitidos: string[] = [];

/**
 * Descarga un Excel con la sesión del navegador. Si el GEI devuelve HTML reintenta una vez:
 * si es la pantalla de login (sesión vencida) aborta; si es otra página, omite el archivo y sigue.
 */
async function descargar(contexto: BrowserContext, ruta: string, nombre: string): Promise<ArchivoDescargado | null> {
  for (let intento = 1; intento <= 2; intento++) {
    const respuesta = await contexto.request.get(`${URL_GEI}${ruta}`, { timeout: TIMEOUT_MS });
    const datos = new Uint8Array(await respuesta.body());
    const tipo = respuesta.headers()["content-type"] ?? "";
    if (respuesta.ok() && !tipo.includes("text/html")) {
      await writeFile(path.join(CARPETA_DESCARGAS, `${nombre}.xls`), datos);
      await esperar(PAUSA_ENTRE_DESCARGAS_MS);
      return { nombre, datos };
    }
    const html = Buffer.from(datos).toString("utf8");
    if (/auth\/login|type="password"/i.test(html)) throw new Error(`${nombre}: la sesión del GEI venció (${ruta}).`);
    await esperar(PAUSA_ENTRE_DESCARGAS_MS * 3);
  }
  console.warn(`  ⚠ ${nombre}: el GEI no devolvió un Excel (${ruta}); se omite.`);
  omitidos.push(nombre);
  return null;
}

async function listarDivisiones(page: Page): Promise<DivisionGei[]> {
  await page.goto(`${URL_GEI}escuela/alumnos_inasistencias/${ESCUELA_ID}`, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });
  await page.locator('a[href*="division_inasistencia/listar/"]').first().waitFor({ timeout: TIMEOUT_MS });
  const filas = await page.$$eval("table tbody tr", (trs) =>
    trs.map((tr) => {
      const celdas = Array.from(tr.querySelectorAll("td"));
      const estadisticas = tr.querySelector('a[href*="division_inasistencia/listar/"]')?.getAttribute("href") ?? "";
      return {
        curso: (celdas[0]?.textContent ?? "").replace(/\s+/g, " ").trim(),
        divisionId: /division_inasistencia\/listar\/(\d+)/.exec(estadisticas)?.[1] ?? "",
        mesesCerrados: celdas.flatMap((td) => {
          const href = td.querySelector('a[href*="division_inasistencia/ver/"]')?.getAttribute("href") ?? "";
          const id = /division_inasistencia\/ver\/(\d+)/.exec(href)?.[1];
          return id && td.querySelector("i.fa-lock") ? [id] : [];
        }),
      };
    }),
  );
  return filas
    .filter((f) => f.divisionId)
    .map((f) => ({ ...f, anio: Number(/(\d)/.exec(f.curso)?.[1] ?? 0) }))
    .filter((f) => ANIOS.includes(f.anio));
}

async function listarCursadas(page: Page, divisionId: string): Promise<string[]> {
  await page.goto(`${URL_GEI}cursada/listar/${divisionId}`, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });
  await page.locator('a[href*="cursada/escritorio/"]').first().waitFor({ timeout: TIMEOUT_MS });
  const hrefs = await page.$$eval('a[href*="cursada/escritorio/"]', (as) => as.map((a) => a.getAttribute("href") ?? ""));
  return [...new Set(hrefs.map((h) => /cursada\/escritorio\/(\d+)/.exec(h)?.[1]).filter((id): id is string => Boolean(id)))];
}

function slug(texto: string): string {
  return texto.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

async function importar(
  matricula: ArchivoDescargado | null,
  asistencias: ArchivoDescargado[],
  evaluaciones: ArchivoDescargado[],
  fichas: FichaGei[],
  turnos: { curso: string; turno: string }[],
) {
  // Import dinámico: dotenv ya cargó DATABASE_URL antes de instanciar Prisma.
  const { prisma } = await import("../src/lib/prisma");
  const { actualizarTurnosGei, importarArchivoGei, importarFichasGei, importarPlanillasGei } = await import(
    "../src/services/geiSyncService"
  );

  const emailResponsable = requerirEnv("GEI_SYNC_USER_EMAIL");
  const responsable = await prisma.usuario.findUnique({ where: { email: emailResponsable } });
  if (!responsable || !responsable.activo || responsable.rol !== "DIRECTIVO_SOE") {
    throw new Error(`GEI_SYNC_USER_EMAIL (${emailResponsable}) debe ser un usuario DIRECTIVO_SOE activo.`);
  }

  try {
    if (matricula) await importarMatriculaYPlanillas(matricula, responsable.id);
    // Después de la matrícula, que no trae el turno.
    if (turnos.length > 0) console.log(`📊 Turnos: ${await actualizarTurnosGei(turnos)} alumnos actualizados`);
    if (fichas.length > 0) {
      const f = await importarFichasGei(fichas, { usuarioId: responsable.id, ipAddress: "gei-scraper" });
      console.log(`📊 Fichas: ${f.alumnosActualizados} alumnos · ${f.ciclosTrayectoria} ciclos de trayectoria · ${f.alertasTempranas} alertas tempranas`);
      if (f.sinEstudiante > 0) console.warn(`   ⚠ ${f.sinEstudiante} fichas de alumnos que no están en la base`);
    }
  } finally {
    await prisma.$disconnect();
  }

  async function importarMatriculaYPlanillas(matricula: ArchivoDescargado, usuarioId: string) {
    const m = await importarArchivoGei(matricula.datos, {
      usuarioId,
      nombreArchivo: matricula.nombre,
      cicloLectivo: CICLO,
      anios: ANIOS,
      sincronizarDrive: !SIN_DRIVE,
      ipAddress: "gei-scraper",
    });
    console.log(`\n📊 Matrícula: ${m.estudiantesCreados} creados · ${m.estudiantesActualizados} actualizados`);
    console.log(`   Drive: ${m.carpetasDriveCreadas} carpetas creadas, ${m.carpetasDriveMovidas} movidas`);
    m.advertencias.forEach((a) => console.warn(`   ⚠ ${a}`));
    m.errores.forEach((e) => console.warn(`   ✗ [fila ${e.fila}] ${e.motivo.replace(/\d{7,8}/g, "<dni>")}`));

    const p = await importarPlanillasGei({ asistencias, evaluaciones }, {
      usuarioId,
      cicloLectivo: CICLO,
      ipAddress: "gei-scraper",
    });
    console.log(`📊 Asistencia anual actualizada: ${p.asistenciasActualizadas} alumnos`);
    console.log(`📊 Notas: ${p.calificacionesActualizadas} materias-alumno`);
    p.errores.forEach((e) => console.warn(`   ✗ ${e}`));
    if (p.sinCruzar.length > 0) {
      console.warn(`   ⚠ ${p.sinCruzar.length} filas de notas sin cruzar por nombre (alumnos que no están en la matrícula regular):`);
      const porCurso = new Map<string, number>();
      p.sinCruzar.forEach((s) => porCurso.set(s.curso, (porCurso.get(s.curso) ?? 0) + 1));
      porCurso.forEach((n, curso) => console.warn(`     ${curso}: ${n}`));
    }
  }
}

/** Turno de cada división de la escuela ("3° 4ª Secundario" → "Tarde"). */
async function listarTurnos(contexto: BrowserContext): Promise<{ curso: string; turno: string }[]> {
  const respuesta = await contexto.request.post(`${URL_GEI}division/listar_data/${ESCUELA_ID}/escuela_alu/${ESCUELA_ID}`, {
    form: { draw: "1", start: "0", length: "500" },
    headers: { "X-Requested-With": "XMLHttpRequest" },
    timeout: TIMEOUT_MS,
  });
  if (!respuesta.ok()) throw new Error(`El listado de divisiones del GEI respondió ${respuesta.status()}.`);
  const { data } = (await respuesta.json()) as { data: { curso: string; division: string; turno: string | null }[] };
  return data.map((d) => ({ curso: `${d.curso} ${d.division}`, turno: d.turno ?? "" }));
}

/** Alumnos del ciclo en los años configurados, con el id de su ficha en el GEI (uno por DNI). */
async function listarAlumnosGei(contexto: BrowserContext): Promise<{ dni: string; alumnoId: string }[]> {
  const respuesta = await contexto.request.post(`${URL_GEI}alumno/listar_data/${ESCUELA_ID}/${CICLO}`, {
    form: { draw: "1", start: "0", length: "5000" },
    headers: { "X-Requested-With": "XMLHttpRequest" },
    timeout: TIMEOUT_MS,
  });
  if (!respuesta.ok()) throw new Error(`El listado de alumnos del GEI respondió ${respuesta.status()}.`);
  const { data } = (await respuesta.json()) as { data: { id: string; documento: string; curso: string }[] };
  const porDni = new Map<string, string>();
  for (const a of data) {
    const dni = /^DNI (\d{7,8})$/.exec(a.documento.trim())?.[1];
    const anio = Number(/^(\d)°/.exec(a.curso.trim())?.[1] ?? 0);
    if (dni && ANIOS.includes(anio)) porDni.set(dni, a.id);
  }
  return [...porDni].map(([dni, alumnoId]) => ({ dni, alumnoId }));
}

// Se pasa como texto: tsx/esbuild agrega helpers (__name) a las funciones que no existen en el navegador.
const SCRIPT_TABLAS_FICHA = `(() => {
  const limpiar = (s) => (s ?? "").replace(/\\s+/g, " ").trim();
  const filasDe = (rotulos) => {
    const tabla = [...document.querySelectorAll("table")].find((t) => {
      const encabezado = limpiar(t.querySelector("thead")?.textContent);
      return rotulos.every((r) => encabezado.includes(r));
    });
    if (!tabla) return null;
    return [...tabla.querySelectorAll("tbody tr")]
      .map((tr) => [...tr.querySelectorAll("td")].map((td) => limpiar(td.textContent)))
      .filter((celdas) => celdas.length > 1);
  };
  return {
    trayectoria: filasDe(${JSON.stringify(ROTULOS_TABLA_TRAYECTORIA)}),
    alertas: filasDe(${JSON.stringify(ROTULOS_TABLA_ALERTAS)}),
    pideLogin: document.querySelector('input[type="password"]') !== null,
  };
})()`;

/** Lee la trayectoria y las alertas tempranas de la ficha de cada alumno (alumno/ver). */
async function leerFichas(contexto: BrowserContext): Promise<FichaGei[]> {
  const alumnos = await listarAlumnosGei(contexto);
  console.log(`→ ${alumnos.length} fichas de alumnos para leer`);
  // Página auxiliar sin red: solo se usa para parsear el HTML de cada ficha con el DOM del navegador.
  const parseo = await contexto.newPage();
  await parseo.route("**/*", (ruta) => ruta.abort());
  const fichas: FichaGei[] = [];
  try {
    for (const [i, { dni, alumnoId }] of alumnos.entries()) {
      const html = await (await contexto.request.get(`${URL_GEI}alumno/ver/${alumnoId}`, { timeout: TIMEOUT_MS })).text();
      await parseo.setContent(html.replace(/<script[\s\S]*?<\/script>/gi, ""), { waitUntil: "domcontentloaded" });
      const tablas = (await parseo.evaluate(SCRIPT_TABLAS_FICHA)) as {
        trayectoria: string[][] | null;
        alertas: string[][] | null;
        pideLogin: boolean;
      };
      if (tablas.trayectoria === null) {
        if (tablas.pideLogin) throw new Error("La sesión del GEI venció mientras se leían las fichas.");
        console.warn(`  ⚠ Ficha ${alumnoId}: no se encontró la tabla de trayectoria; se omite.`);
        omitidos.push(`ficha_${alumnoId}`);
        continue;
      }
      fichas.push({ dni, trayectoria: tablas.trayectoria, alertas: tablas.alertas ?? [] });
      if ((i + 1) % 50 === 0) console.log(`  … ${i + 1}/${alumnos.length} fichas`);
      await esperar(PAUSA_ENTRE_DESCARGAS_MS);
    }
  } finally {
    await parseo.close();
  }
  console.log(`✓ Fichas leídas: ${fichas.length}`);
  return fichas;
}

async function main(): Promise<void> {
  await mkdir(CARPETA_DESCARGAS, { recursive: true });
  console.log(`Ciclo ${CICLO} · años ${ANIOS.join(", ")} · escuela ${ESCUELA_ID}`);

  const navegador = await chromium.launch({ headless: !MODO_VISIBLE });
  const contexto = await navegador.newContext({ acceptDownloads: true, locale: "es-AR" });
  let page = await contexto.newPage();
  let matricula: ArchivoDescargado | null = null;
  const asistencias: ArchivoDescargado[] = [];
  const evaluaciones: ArchivoDescargado[] = [];
  let fichas: FichaGei[] = [];
  let turnos: { curso: string; turno: string }[] = [];

  try {
    await iniciarSesion(page);
    page = await entrarAlGei(contexto, page);

    if (!SOLO_FICHAS) {
      matricula = await descargar(contexto, `alumno/excel_alumnos/${ESCUELA_ID}/${CICLO}`, "matricula");
      if (!matricula) throw new Error("No se pudo descargar la matrícula.");
      console.log("✓ Matrícula descargada");

      const divisiones = await listarDivisiones(page);
      console.log(`→ ${divisiones.length} divisiones de ${ANIOS.join("°, ")}°`);
      for (const d of divisiones) {
        const prefijo = slug(d.curso);
        for (const mesId of d.mesesCerrados) {
          const archivo = await descargar(contexto, `division_inasistencia/resumen_diario_imprimir_excel/${mesId}/1`, `asistencia_${prefijo}_${mesId}`);
          if (archivo) asistencias.push(archivo);
        }
        const cursadas = await listarCursadas(page, d.divisionId);
        for (const cursadaId of cursadas) {
          const archivo = await descargar(contexto, `cursada/excel_resumen_evaluaciones_generico/${cursadaId}/${CICLO}`, `notas_${prefijo}_${cursadaId}`);
          if (archivo) evaluaciones.push(archivo);
        }
        console.log(`✓ ${d.curso}: ${d.mesesCerrados.length} meses de asistencia, ${cursadas.length} materias`);
      }
    }
    turnos = await listarTurnos(contexto);
    if (!SIN_FICHAS) fichas = await leerFichas(contexto);
  } catch (error) {
    const captura = path.join(CARPETA_DESCARGAS, `error-${Date.now()}.png`);
    await page.screenshot({ path: captura, fullPage: true }).catch(() => undefined);
    console.error(`✗ Falló el scraping. Captura de pantalla: ${path.relative(process.cwd(), captura)}`);
    throw error;
  } finally {
    await navegador.close();
  }

  if (matricula) {
    console.log(`\n✓ Descargados: 1 matrícula, ${asistencias.length} asistencias, ${evaluaciones.length} planillas de notas`);
  }
  if (omitidos.length > 0) console.warn(`⚠ Omitidos (${omitidos.length}): ${omitidos.join(", ")}`);
  if (SOLO_DESCARGAR) {
    console.log("Modo --solo-descargar: no se importaron los archivos.");
    return;
  }
  await importar(matricula, asistencias, evaluaciones, fichas, turnos);
  console.log("\n✓ Sincronización GEI finalizada.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
