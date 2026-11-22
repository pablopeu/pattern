import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
async function model(page: Page) {
  await expect(page.locator('.save-indicator')).toHaveText(/Guardado local/);
  return page.evaluate(async () => (await import('/src/persistence/storage.ts')).recover());
}
async function fixture(page: Page) {
  await page.goto('/');
  await model(page);
  const p = await page.evaluate(async () => {
    const { newProject, geometry } = await import('/src/app/model.ts'),
      { autosave } = await import('/src/persistence/storage.ts');
    const p = newProject();
    p.mainSymmetry = { ...p.mainSymmetry, family: 'wallpaper', group: 'p1', width: 30, height: 30 };
    p.patterns[0].sourceGeometry = [
      {
        ...geometry('compound', [], true),
        pathData: 'M2 2H28V28H2Z M10 10H20V20H10Z',
        fill: '#3b82f6',
        stroke: '#111111',
        strokeWidth: 0.6,
        fillRule: 'evenodd',
      },
    ];
    p.metadata.name = 'Prueba Poincare';
    await autosave(p);
    return p;
  });
  await page.reload();
  await expect.poll(async () => (await model(page))?.metadata.id).toBe(p.metadata.id);
  return p;
}
function dialog(page: Page) {
  return page.getByRole('dialog', { name: 'Visualización de Poincaré', exact: true });
}
async function ready(page: Page) {
  await expect(
    dialog(page).getByRole('img', {
      name: 'Disco de Poincaré derivado de la fuente plana',
      exact: true,
    }),
  ).toBeVisible({ timeout: 20000 });
  await expect(dialog(page).getByRole('button', { name: 'SVG', exact: true })).toBeEnabled();
}
for (const width of [1440, 390])
  test(`Poincaré derivado: fuente intacta, parámetros válidos, JSON y regreso ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const original = await fixture(page);
    await page.getByRole('button', { name: 'Visualizar patrón', exact: true }).click();
    await ready(page);
    await expect(
      dialog(page).getByText(/Motivo adaptado; correspondencia de bordes no garantizada/),
    ).toBeVisible();
    expect(await dialog(page).evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await dialog(page)
      .getByRole('img', { name: 'Disco de Poincaré derivado de la fuente plana', exact: true })
      .click();
    expect((await model(page))?.patterns).toEqual(original.patterns);
    await dialog(page).getByLabel('Lados p', { exact: true }).fill('4');
    await dialog(page).getByLabel('Celdas por vértice q', { exact: true }).fill('4');
    await expect(
      dialog(page).getByRole('button', { name: 'Actualizar vista', exact: true }),
    ).toBeDisabled();
    await expect(dialog(page).getByRole('alert')).toContainText('(p−2)(q−2)>4');
    expect((await model(page))?.visualization?.settings.p).toBe(7);
    await dialog(page).getByLabel('Lados p', { exact: true }).fill('7');
    await dialog(page).getByLabel('Celdas por vértice q', { exact: true }).fill('3');
    await dialog(page).getByLabel('Centro horizontal', { exact: true }).fill('0.15');
    await expect(dialog(page).getByRole('button', { name: 'SVG', exact: true })).toBeDisabled();
    await dialog(page).getByRole('button', { name: 'Actualizar vista', exact: true }).click();
    await ready(page);
    const before = (await model(page))!;
    expect(before.patterns).toEqual(original.patterns);
    expect(before.visualization?.settings.view.center.x).toBe(0.15);
    await dialog(page).getByRole('button', { name: 'Guardar estudio', exact: true }).click();
    const save = page.getByRole('dialog', { name: 'Guardar proyecto', exact: true });
    const downloaded = page.waitForEvent('download');
    await save.getByRole('button', { name: 'Guardar archivo', exact: true }).click();
    const json = JSON.parse(await readFile((await (await downloaded).path())!, 'utf8'));
    expect(json.schemaVersion).toBe(7);
    expect(json.visualization.active).toBe(true);
    expect(json.patterns).toEqual(original.patterns);
    await page.reload();
    await ready(page);
    expect((await model(page))?.visualization?.settings.view.center.x).toBe(0.15);
    await dialog(page).getByRole('button', { name: 'Volver a la fuente', exact: true }).click();
    await expect(dialog(page)).toHaveCount(0);
    expect((await model(page))?.visualization?.active).toBe(false);
    expect((await model(page))?.patterns).toEqual(original.patterns);
  });
test('Poincaré exporta SVG físico, PNG/JPEG a DPI y el disco no modifica nodos', async ({
  page,
}) => {
  const original = await fixture(page);
  await page.getByRole('button', { name: 'Visualizar patrón', exact: true }).click();
  await ready(page);
  await dialog(page).getByLabel('Radio del disco', { exact: true }).fill('40');
  await dialog(page).getByLabel('Estructura geodésica', { exact: true }).uncheck();
  await dialog(page).getByRole('button', { name: 'Actualizar vista', exact: true }).click();
  await ready(page);
  await dialog(page).getByLabel('Resolución de imagen', { exact: true }).fill('96');
  for (const format of ['SVG', 'PNG', 'JPEG']) {
    const waiting = page.waitForEvent('download');
    await dialog(page).getByRole('button', { name: format, exact: true }).click();
    const file = await waiting,
      bytes = await readFile((await file.path())!);
    if (format === 'SVG') {
      const text = bytes.toString('utf8');
      expect(text).toContain('width="80mm"');
      expect(text).toContain('height="80mm"');
      expect(text).toContain('hasUncertifiedClippingStep');
      expect(text).toContain('flatPreparation');
      expect(text).toContain('data-source=');
      expect(text).not.toContain('&lt;script');
    } else {
      const size = await page.evaluate(
        async ({ bytes, type }) => {
          const blob = new Blob([new Uint8Array(bytes)], { type }),
            bitmap = await createImageBitmap(blob);
          const result = [bitmap.width, bitmap.height];
          bitmap.close();
          return result;
        },
        { bytes: [...bytes], type: format === 'PNG' ? 'image/png' : 'image/jpeg' },
      );
      expect(size).toEqual([302, 302]);
      if (format === 'PNG') expect(bytes.includes(Buffer.from('pHYs'))).toBe(true);
      else expect(bytes[13]).toBe(1);
    }
  }
  expect((await model(page))?.patterns).toEqual(original.patterns);
});
test('Poincaré cancela trabajo real del worker, mantiene la fuente y permite reintentar', async ({
  page,
}) => {
  const original = await fixture(page);
  await page.getByRole('button', { name: 'Visualizar patrón', exact: true }).click();
  await ready(page);
  await dialog(page).getByLabel('Profundidad', { exact: true }).fill('8');
  await dialog(page).getByLabel('Máximo de celdas', { exact: true }).fill('4096');
  await dialog(page).getByRole('button', { name: 'Actualizar vista', exact: true }).click();
  await dialog(page).getByRole('button', { name: 'Cancelar cálculo', exact: true }).click();
  await expect(dialog(page).getByRole('alert')).toHaveText(/Cálculo cancelado/);
  await expect(dialog(page).getByRole('button', { name: 'SVG', exact: true })).toBeDisabled();
  expect((await model(page))?.patterns).toEqual(original.patterns);
  await dialog(page).getByLabel('Radio del disco', { exact: true }).fill('41');
  await expect(
    dialog(page).getByRole('button', { name: 'Guardar estudio', exact: true }),
  ).toBeDisabled();
  await dialog(page).getByLabel('Profundidad', { exact: true }).fill('1');
  await dialog(page).getByLabel('Máximo de celdas', { exact: true }).fill('12');
  await dialog(page).getByRole('button', { name: 'Actualizar vista', exact: true }).click();
  await ready(page);
  expect((await model(page))?.patterns).toEqual(original.patterns);
});

test('galería Poincaré ofrece ejemplos reales y permite volver a sus fuentes editables', async ({
  page,
}) => {
  await page.goto('/');
  await model(page);
  await page.locator('.main-menu summary').click();
  await page.getByRole('button', { name: 'Galería de ejemplos', exact: true }).click();
  const gallery = page.getByRole('dialog', { name: 'Galería de ejemplos', exact: true });
  await gallery.getByLabel('Categoría de ejemplos').selectOption('Poincaré');
  await expect(gallery.locator('.example-card')).toHaveCount(2);
  const images = await gallery
    .locator('.example-card img')
    .evaluateAll((rows) => rows.map((row) => (row as HTMLImageElement).src));
  for (const url of images) expect((await page.request.get(url)).ok()).toBe(true);
  await gallery
    .getByRole('button', { name: 'Abrir ejemplo Poincaré · Rosetas enlazadas {7,3}', exact: true })
    .click();
  await ready(page);
  const loaded = (await model(page))!;
  expect(loaded.metadata.example?.validity).toBe('APPROXIMATED');
  expect(loaded.patterns[0].sourceGeometry).toHaveLength(2);
  await dialog(page).getByRole('button', { name: 'Volver a la fuente', exact: true }).click();
  expect((await model(page))?.patterns).toEqual(loaded.patterns);
});

test('Poincaré colorea por tesela y por orientación, y persiste el modo', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await fixture(page);
  await page.getByRole('button', { name: 'Visualizar patrón', exact: true }).click();
  await ready(page);
  const fills = async () => {
    const src = await dialog(page)
      .getByRole('img', { name: 'Disco de Poincaré derivado de la fuente plana', exact: true })
      .getAttribute('src');
    if (!src) return [];
    const svg = await page.evaluate(async (url) => (await fetch(url)).text(), src);
    return [...new Set([...svg.matchAll(/fill="(#[0-9a-fA-F]{6})"/g)].map((m) => m[1].toLowerCase()))];
  };
  const baseline = (await fills()).length;
  expect(baseline).toBeLessThanOrEqual(2);
  await dialog(page).getByLabel('Color de celdas', { exact: true }).selectOption('cell');
  await dialog(page).getByRole('button', { name: 'Actualizar vista', exact: true }).click();
  await expect
    .poll(async () => (await fills()).length, { timeout: 20000 })
    .toBeGreaterThan(baseline + 1);
  await expect.poll(async () => (await model(page))?.visualization?.settings.colors?.mode).toBe('cell');
  await dialog(page).getByLabel('Color de celdas', { exact: true }).selectOption('orientation');
  await dialog(page).getByRole('button', { name: 'Actualizar vista', exact: true }).click();
  await expect
    .poll(async () => (await fills()).length, { timeout: 20000 })
    .toBeGreaterThan(1);
  await expect
    .poll(async () => (await model(page))?.visualization?.settings.colors?.mode, { timeout: 20000 })
    .toBe('orientation');
  await page.reload();
  await ready(page);
  await expect(dialog(page).getByLabel('Color de celdas', { exact: true })).toHaveValue('orientation');
});
