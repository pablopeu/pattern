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

test('modo simple: simetrías curadas, escape a avanzado, galería y teselas filtradas', async ({
  browser,
}) => {
  test.setTimeout(120000);
  const context = await browser.newContext({ locale: 'es-AR', storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto(base);
  await ready(page);
  await expect(page.locator('.simple-symmetry-chips')).toBeVisible();
  for (const label of ['Repetición en cuadrícula', 'Giro de 3', 'Giro de 6'])
    await expect(page.locator('.simple-symmetry-chips').getByRole('button', { name: new RegExp(label) })).toBeVisible();
  // La galería queda a un clic desde el lienzo vacío.
  await page.getByRole('button', { name: 'Explorar ejemplos', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Galería de ejemplos', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar galería de ejemplos' }).click();
  // Escape a avanzado desde el panel de simetrías.
  await page.locator('.simple-symmetry-chips').getByRole('button', { name: /Explorar más simetrías/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-ui-mode', 'advanced');
  await expect(
    page.getByRole('complementary', { name: 'Panel contextual' }).getByRole('tab', { name: 'Grupo y red' }),
  ).toBeVisible();
  // Teselas: simple muestra sólo Encastre y ofrece más familias.
  await page.locator('.experience-menu summary').click();
  await page.locator('.experience-menu').getByLabel('Interfaz', { exact: true }).selectOption('simple');
  await page.getByRole('button', { name: 'Abrir Teselas', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Aperiódicas', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Más familias de teselas', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Más familias de teselas', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-ui-mode', 'advanced');
  await expect(page.getByRole('button', { name: 'Aperiódicas', exact: true })).toBeVisible();
  await context.close();
});

test('integridad: idioma, tema y modo no modifican un proyecto complejo ni el histórico', async ({
  browser,
}) => {
  test.setTimeout(150000);
  const context = await browser.newContext({ locale: 'es-AR', storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto(base);
  await ready(page);
  // Proyecto complejo real: ejemplo recurrente de la galería.
  await page.locator('.main-menu summary').click();
  await page.getByRole('button', { name: 'Galería de ejemplos', exact: true }).click();
  const gallery = page.getByRole('dialog', { name: 'Galería de ejemplos' });
  await gallery.getByLabel('Buscar ejemplos').fill('Límite cuadrado');
  await gallery.getByRole('button', { name: /Abrir ejemplo Peces · Límite cuadrado/ }).click();
  await ready(page);
  const before = await model(page);
  await page.locator('.experience-menu summary').click();
  await page.getByLabel('Idioma / Language').selectOption('en');
  await page.getByLabel('Apariencia / Appearance').selectOption('dark');
  await page.getByLabel('Interface', { exact: true }).selectOption('simple');
  await page.getByLabel('Interface', { exact: true }).selectOption('advanced');
  await page.getByLabel('Apariencia / Appearance').selectOption('light');
  await page.getByLabel('Idioma / Language').selectOption('es');
  const after = await model(page);
  expect(after!.patterns).toEqual(before!.patterns);
  expect(after!.metadata).toEqual(before!.metadata);
  expect(after!.visualization).toEqual(before!.visualization);
  // Guardar y reabrir conserva exactamente los mismos datos.
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Guardar proyecto', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar archivo', exact: true }).click();
  await download;
  await page.reload();
  await ready(page);
  expect((await model(page))!.patterns).toEqual(before!.patterns);
  await context.close();
});

test('las ocho combinaciones de idioma, tema y modo funcionan juntas', async ({ browser }) => {
  test.setTimeout(180000);
  for (const lang of ['es-AR', 'en-US'] as const)
    for (const theme of ['light', 'dark'] as const)
      for (const mode of ['simple', 'advanced'] as const) {
        const context = await browser.newContext({
          locale: lang,
          storageState: {
            cookies: [],
            origins: [
              {
                origin: base,
                localStorage: [
                  { name: 'pattern.experience.v1', value: JSON.stringify({ language: lang.startsWith('es') ? 'es' : 'en', theme, uiMode: mode }) },
                ],
              },
            ],
          },
        });
        try {
          const page = await context.newPage();
          await page.setViewportSize({ width: 390, height: 844 });
          await page.goto(base);
          await ready(page);
          await expect(page.locator('html')).toHaveAttribute('lang', lang.startsWith('es') ? 'es' : 'en');
          await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
          await expect(page.locator('html')).toHaveAttribute('data-ui-mode', mode);
          const file = await page.locator('.main-menu summary').innerText();
          expect(file.trim()).toBe(lang.startsWith('es') ? 'Archivo' : 'File');
          const tools = await page.locator('.rail-tools > button').count();
          expect(tools).toBeGreaterThan(0);
          if (mode === 'advanced') expect(tools).toBeGreaterThan(8);
        } finally {
          await context.close();
        }
      }
});
