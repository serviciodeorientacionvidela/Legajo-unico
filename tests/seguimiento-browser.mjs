import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
mkdirSync("artifacts/seguimiento", { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
try {
  const errors = [];
  page.setDefaultTimeout(90000);
  page.on("pageerror", (e) => {
    errors.push(e.message);
    console.log("PAGE ERROR", e.message);
  });
  await page.goto("http://127.0.0.1:3105", {
    waitUntil: "domcontentloaded",
    timeout: 300000,
  });
  await page.locator("table tbody tr").first().waitFor();
  await page
    .getByRole("button", { name: "Seguimiento LUE", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Seguimiento de trayectorias" })
    .waitFor();
  await page.getByPlaceholder("Buscar estudiante o DNI…").fill("49688745");
  await page.getByRole("button", { name: "Abrir ficha", exact: true }).click();
  await page
    .getByRole("heading", { name: "Legajo de seguimiento", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Nueva actuación", exact: true })
    .click();
  await page.getByLabel("Tipo de actuación").selectOption("FAMILIA");
  await page
    .getByLabel("Resumen breve (máximo tres líneas)")
    .fill("Se acordó un seguimiento de la asistencia con la familia.");
  await page
    .getByLabel("Motivo", { exact: true })
    .fill("Entrevista familiar de prueba");
  await page
    .getByRole("button", { name: "Guardar registro", exact: true })
    .click();
  await page
    .getByText("Registro guardado y auditado.", { exact: true })
    .waitFor();
  await page
    .getByText("Entrevista familiar de prueba", { exact: true })
    .waitFor();
  await page.screenshot({
    path: "artifacts/seguimiento/legajo-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "12 reportes", exact: true }).click();
  await page.getByLabel("Reporte", { exact: true }).selectOption("1");
  await page
    .getByRole("button", { name: "Consultar reporte", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Exportar Excel", exact: true })
    .waitFor();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exportar Excel", exact: true })
    .click();
  const download = await downloadPromise;
  await download.saveAs("artifacts/seguimiento/reporte.xlsx");
  await page.screenshot({
    path: "artifacts/seguimiento/reportes-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Bandeja y alertas", exact: true })
    .click();
  await page.getByPlaceholder("Buscar estudiante o DNI…").fill("49688745");
  await page.getByRole("button", { name: "Abrir ficha", exact: true }).click();
  await page
    .getByRole("button", { name: "Derivar al SOE", exact: true })
    .waitFor();
  await page.screenshot({
    path: "artifacts/seguimiento/legajo-mobile.png",
    fullPage: true,
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );

  if (errors.length || overflow)
    throw new Error(JSON.stringify({ errors, overflow }));
  console.log(
    "OK: navegación, actuación guardada, reporte, exportación Excel y vista móvil sin desbordamiento.",
  );
} finally {
  await browser.close();
}
