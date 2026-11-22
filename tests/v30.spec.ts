import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { context } from './navigation';

async function project(page: Page) {
  await expect(page.locator('.save-indicator')).toHaveText(/Guardado local/);
  return page.evaluate(async () => {
    const { recover } = await import('/src/persistence/storage.ts');
    return (await recover())!;
  });
}
async function gallery(page: Page) {
  const menu = page.locator('.main-menu');
  if (!(await menu.evaluate((el) => (el as HTMLDetailsElement).open)))
    await menu.locator('summary').click();
  await menu.getByRole('button', { name: 'Galería de ejemplos', exact: true }).click();
  return page.getByRole('dialog', { name: 'Galería de ejemplos' });
}
async function load(page: Page, title = 'Peces al límite · original') {
  await page.goto('/');
  await project(page);
  const id = title === 'Cardumen en espiral · original' ? 'fish-spiral' : 'fish-square';
  const raw = await page.evaluate(async (id) => {
    const { compositionExample } = await import('/src/examples/catalog.ts'),
      { serialize } = await import('/src/persistence/schema.ts');
    return serialize(compositionExample(id));
  }, id);
  await page.locator('input[accept=".json,application/json"]').setInputFiles({
    name: 'archived-composition.json',
    mimeType: 'application/json',
    buffer: Buffer.from(raw),
  });
  await expect
    .poll(async () => (await project(page)).metadata.id)
    .toBe(JSON.parse(raw).metadata.id);
  await composition(page);
  await page.getByRole('button', { name: 'Ajustar contenido', exact: true }).click();
  return project(page);
}
async function composition(page: Page) {
  await context(page, 'Simetrías');
  await page.getByRole('tab', { name: 'Composición', exact: true }).click();
  return page.getByRole('complementary', { name: 'Panel contextual' });
}
for (const viewport of [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 390, height: 844 },
]) {
  test(`v3 galería y controles de composición accesibles ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const before = await project(page);
    const dialog = await gallery(page);
    const overflow = await dialog.evaluate((el) => ({
      x: el.scrollWidth - el.clientWidth,
      y: el.scrollHeight - el.clientHeight,
    }));
    expect(overflow.x).toBeLessThanOrEqual(1);
    expect(overflow.y).toBeLessThanOrEqual(1);
    const count = viewport.width < 650 ? 2 : 4;
    await expect(dialog.locator('.example-card')).toHaveCount(count);
    await expect
      .poll(() =>
        dialog
          .locator('img')
          .evaluateAll((images) =>
            images.every(
              (img) =>
                (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0,
            ),
          ),
      )
      .toBe(true);
    await dialog.getByLabel('Categoría de ejemplos').selectOption('Espirales');
    await expect(
      dialog.getByRole('button', {
        name: 'Abrir ejemplo Peces · Roseta autosimilar',
        exact: true,
      }),
    ).toBeVisible();
    await dialog.getByRole('button', { name: 'Cerrar galería de ejemplos' }).click();
    expect(await project(page)).toEqual(before);
    const reopened = await gallery(page);
    await reopened
      .getByRole('button', {
        name: 'Abrir ejemplo Peces · Límite cuadrado de geometría funcional',
        exact: true,
      })
      .click();
    const source = (await project(page)).patterns[0].sourceGeometry;
    expect(source).toHaveLength(1);
    const panel = await composition(page);
    await expect(panel.getByLabel('Profundidad recursiva')).toBeVisible();
    for (const name of ['Receta', 'Geometría', 'Color', 'Guardadas']) {
      await panel.getByRole('tab', { name, exact: true }).click();
      const size = await panel.locator('.panel-scroll').evaluate((el) => ({
        x: el.scrollWidth - el.clientWidth,
        y: el.scrollHeight - el.clientHeight,
      }));
      expect(size.x).toBeLessThanOrEqual(1);
      expect(size.y).toBeLessThanOrEqual(1);
    }
    expect((await project(page)).patterns[0].sourceGeometry).toEqual(source);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `.runtime/v30-controls-${viewport.width}.png` });
  });
}
test('v3 editar fuente regenera recursión, undo, JSON y SVG reales sin clonar peces', async ({
  page,
}) => {
  const p = await load(page),
    original = p.patterns[0].sourceGeometry;
  const svg = page.locator('.studio-canvas');
  await expect(svg.locator('[data-composition-level]')).toHaveCount(4);
  const initialCount = await svg.locator('use').count();
  await page.getByLabel('Profundidad recursiva').fill('2');
  await expect.poll(() => svg.locator('use').count()).toBeLessThan(initialCount);
  expect((await project(page)).patterns[0].sourceGeometry).toEqual(original);
  const originalPath = await svg.locator('defs g path').first().getAttribute('d');
  await page.getByRole('button', { name: 'Editar motivo fuente', exact: true }).click();
  await page.getByRole('button', { name: 'Editar nodos', exact: true }).click();
  const point = await svg.evaluate((el) => {
    const q = new DOMPoint(10, 5).matrixTransform((el as SVGSVGElement).getScreenCTM()!);
    return { x: q.x, y: q.y };
  });
  await page.mouse.click(point.x, point.y);
  const handle = svg.getByLabel('Nodo 1', { exact: true });
  await expect(handle).toBeVisible();
  const r = (await handle.boundingBox())!;
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width / 2 + 13, r.y + r.height / 2 + 7, { steps: 5 });
  await page.mouse.up();
  await expect
    .poll(async () => (await project(page)).patterns[0].sourceGeometry[0].nodes[0].x)
    .not.toBe(original[0].nodes[0].x);
  const changed = (await project(page)).patterns[0].sourceGeometry;
  const panel = await composition(page);
  await panel.getByRole('button', { name: 'Ver composición', exact: true }).click();
  await expect
    .poll(() => svg.locator('defs g path').first().getAttribute('d'))
    .not.toBe(originalPath);
  expect((await project(page)).patterns[0].sourceGeometry).toEqual(changed);
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  expect((await project(page)).patterns[0].sourceGeometry).toEqual(original);
  await page.getByRole('button', { name: 'Rehacer', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar proyecto', exact: true }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Guardar archivo', exact: true }).click();
  const file = await downloaded,
    data = JSON.parse(await readFile((await file.path())!, 'utf8'));
  expect(data.schemaVersion).toBe(7);
  expect(data.patterns[0].sourceGeometry).toHaveLength(10);
  expect(data.patterns[0].sourceGeometry).toEqual(changed);
  expect(data.patterns[0].composition.depth).toBe(2);
  expect(data.metadata.example.artwork).toBe('original');
  await page.reload();
  expect((await project(page)).patterns[0].composition).toEqual(data.patterns[0].composition);
  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  const exportDialog = page.getByRole('dialog', { name: 'Exportar patrón' });
  await expect(exportDialog.getByAltText('Previsualización de exportación')).toBeVisible();
  const exported = page.waitForEvent('download');
  await exportDialog.getByRole('button', { name: 'Descargar archivo', exact: true }).click();
  const exportedFile = await exported,
    content = await readFile((await exportedFile.path())!, 'utf8');
  expect(content).toContain('FINITE_NONPERIODIC');
  expect(content).toContain('#356a70');
  expect(content).toContain('<use');
});
test('v3 semejanza, recetas personales y desactivar composición conservan el motivo', async ({
  page,
}) => {
  const p = await load(page, 'Cardumen en espiral · original'),
    source = p.patterns[0].sourceGeometry;
  const panel = await composition(page);
  await panel.getByRole('tab', { name: 'Geometría', exact: true }).click();
  await panel.getByLabel('Escala por nivel').fill('0.88');
  expect((await project(page)).patterns[0].composition).toMatchObject({
    kind: 'spiral',
    ratio: 0.88,
  });
  await panel.getByRole('tab', { name: 'Guardadas', exact: true }).click();
  await panel.getByLabel('Nombre de receta').fill('Mi cardumen');
  await panel.getByRole('button', { name: 'Guardar receta personal', exact: true }).click();
  await panel.getByRole('tab', { name: 'Geometría', exact: true }).click();
  await panel.getByLabel('Giro por nivel').fill('90');
  await panel.getByRole('tab', { name: 'Guardadas', exact: true }).click();
  await panel.getByRole('button', { name: 'Mi cardumen', exact: true }).click();
  expect((await project(page)).patterns[0].composition).toMatchObject({
    kind: 'spiral',
    ratio: 0.88,
    angle: 27,
  });
  await panel.getByLabel('Composición activa').uncheck();
  expect((await project(page)).patterns[0].sourceGeometry).toEqual(source);
  await expect(page.locator('[data-composition-level]')).toHaveCount(0);
  await page.keyboard.press('Control+k');
  await page
    .getByRole('dialog', { name: 'Buscar comandos' })
    .getByRole('combobox')
    .fill('galería de ejemplos');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Galería de ejemplos' })).toBeVisible();
});
