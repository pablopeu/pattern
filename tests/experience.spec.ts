import { test, expect, type Page } from '@playwright/test';

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:4173';
async function ready(page: Page) {
  await expect(page.locator('.save-indicator')).toHaveText(/Guardado|Saved/);
}
async function model(page: Page) {
  await expect(page.locator('.save-indicator')).toHaveText(/Guardado|Saved/);
  return page.evaluate(async () => (await import('/src/persistence/storage.ts')).recover());
}

test('detección inicial: es-AR → español, en-US → inglés, fr-FR → inglés', async ({ browser }) => {
  for (const [locale, expected] of [
    ['es-AR', 'es'],
    ['en-US', 'en'],
    ['fr-FR', 'en'],
  ] as const) {
    const context = await browser.newContext({ locale, storageState: undefined });
    try {
      const page = await context.newPage();
      await page.goto(base);
      await ready(page);
      await expect(page.locator('html')).toHaveAttribute('lang', expected);
      const fileLabel = await page.locator('.main-menu summary').innerText();
      expect(fileLabel.trim()).toBe(expected === 'es' ? 'Archivo' : 'File');
    } finally {
      await context.close();
    }
  }
});

test('cambios manuales inmediatos, independientes y persistentes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto(base);
  await ready(page);
  const before = (await model(page))!.patterns;
  await page.locator('.experience-menu summary').click();
  await page.getByLabel('Idioma / Language').selectOption('en');
  await expect(page.locator('.main-menu summary')).toContainText('File');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.getByLabel('Apariencia / Appearance').selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  // El lienzo se oscurece con el tema cuando usa el fondo predeterminado (pedido de Pablo).
  const canvasBg = await page
    .locator('.studio-canvas')
    .evaluate((el) => (el as SVGElement).style.background || getComputedStyle(el).backgroundColor);
  expect(canvasBg).toBe('rgb(27, 33, 28)');
  // Un fondo elegido por el usuario se respeta en modo oscuro.
  await page.getByRole('button', { name: 'Open Preferences', exact: true }).click();
  await page.getByLabel('Canvas background', { exact: true }).fill('#112233');
  await expect
    .poll(async () =>
      page
        .locator('.studio-canvas')
        .evaluate((el) => (el as SVGElement).style.background || getComputedStyle(el).backgroundColor),
    )
    .toBe('rgb(17, 34, 51)');
  await page.locator('.experience-menu').getByLabel('Interface').selectOption('simple');
  await expect(page.locator('html')).toHaveAttribute('data-ui-mode', 'simple');
  // Persisten tras recargar y el documento no cambió.
  await page.reload();
  await ready(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect((await model(page))!.patterns).toEqual(before);
});

test('modo simple: por defecto, menos herramientas y salto a avanzado sin tocar el documento', async ({
  browser,
}) => {
  const context = await browser.newContext({ locale: 'es-AR', storageState: undefined });
  try {
    const page = await context.newPage();
    await page.setViewportSize({ width: 1440, height: 950 });
    await page.goto(base);
    await ready(page);
    await expect(page.locator('html')).toHaveAttribute('data-ui-mode', 'simple');
    const count = () => page.locator('.rail-tools > button').count();
    const simple = await count();
    const original = (await model(page))!.patterns;
    await page.locator('.experience-menu summary').click();
    await page.getByLabel('Interfaz').selectOption('advanced');
    await page.locator('.experience-menu summary').click();
    expect(await count()).toBeGreaterThan(simple);
    expect((await model(page))!.patterns).toEqual(original);
    await page.getByRole('button', { name: 'Guardar proyecto', exact: true }).click();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  } finally {
    await context.close();
  }
});
