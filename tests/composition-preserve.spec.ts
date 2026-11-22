import { test, expect, type Page } from '@playwright/test';
import { context } from './navigation';
async function model(page: Page) {
  await expect(page.locator('.save-indicator')).toHaveText(/Guardado local/);
  return page.evaluate(async () => (await import('/src/persistence/storage.ts')).recover());
}
for (const width of [1440, 390])
  test(`recursiva→espiral→recursiva restaura paleta, parámetros y fuente ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto('/');
    await model(page);
    const original = await page.evaluate(async () => {
      const { functionalGeometryProject } = await import('/src/examples/functional-geometry.ts'),
        { autosave } = await import('/src/persistence/storage.ts');
      const p = functionalGeometryProject();
      p.patterns[0].composition.colorByLevel = true;
      p.patterns[0].composition.palette = ['#b16c43', '#286b73', '#dbccab'];
      await autosave(p);
      return p;
    });
    await page.reload();
    await expect.poll(async () => (await model(page))?.metadata.id).toBe(original.metadata.id);
    await context(page, 'Simetrías');
    await page.getByRole('tab', { name: 'Composición', exact: true }).click();
    const panel = page.getByRole('complementary', { name: 'Panel contextual', exact: true });
    await panel.getByRole('tab', { name: 'Receta', exact: true }).click();
    await panel.getByRole('button', { name: 'Espirales y semejanzas', exact: true }).click();
    await expect
      .poll(async () => (await model(page))?.patterns[0].composition?.kind)
      .toBe('spiral');
    expect((await model(page))?.patterns[0].composition?.palette).toEqual(
      original.patterns[0].composition.palette,
    );
    expect((await model(page))?.patterns[0].sourceGeometry).toEqual(
      original.patterns[0].sourceGeometry,
    );
    await page.reload();
    await model(page);
    await context(page, 'Simetrías');
    await page.getByRole('tab', { name: 'Composición', exact: true }).click();
    await panel.getByRole('tab', { name: 'Receta', exact: true }).click();
    await panel.getByRole('button', { name: 'Composición recursiva', exact: true }).click();
    await expect
      .poll(async () => (await model(page))?.patterns[0].composition)
      .toEqual(original.patterns[0].composition);
    await panel.getByLabel('Receta de composición', { exact: true }).selectOption('branching');
    await expect
      .poll(async () => (await model(page))?.patterns[0].composition?.recipe)
      .toBe('branching');
    await panel.getByLabel('Receta de composición', { exact: true }).selectOption('henderson');
    await expect
      .poll(async () => (await model(page))?.patterns[0].composition)
      .toEqual(original.patterns[0].composition);
    expect((await model(page))?.patterns[0].sourceGeometry).toEqual(
      original.patterns[0].sourceGeometry,
    );
  });
for (const [width, height] of [
  [320, 568],
  [390, 844],
  [844, 390],
  [1366, 768],
  [1440, 900],
  [1920, 1080],
])
  test(`galería completa entra sin scroll y conserva paginación ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await model(page);
    await page.locator('.main-menu summary').click();
    await page.getByRole('button', { name: 'Galería de ejemplos', exact: true }).click();
    const gallery = page.getByRole('dialog', { name: 'Galería de ejemplos', exact: true }),
      select = gallery.getByLabel('Categoría de ejemplos', { exact: true }),
      values = await select
        .locator('option')
        .evaluateAll((rows) => rows.map((r) => (r as HTMLOptionElement).value));
    for (const value of values) {
      await select.selectOption(value);
      while (true) {
        const size = await gallery.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return {
            top: r.top,
            bottom: r.bottom,
            x: el.scrollWidth - el.clientWidth,
            y: el.scrollHeight - el.clientHeight,
          };
        });
        expect(size.top).toBeGreaterThanOrEqual(0);
        expect(size.bottom).toBeLessThanOrEqual(height);
        expect(size.x).toBeLessThanOrEqual(1);
        expect(size.y).toBeLessThanOrEqual(1);
        await expect(
          gallery.getByRole('button', { name: 'Cerrar galería de ejemplos', exact: true }),
        ).toBeInViewport();
        const next = gallery.getByRole('button', { name: 'Más ejemplos', exact: true });
        await expect(next).toBeInViewport();
        if (!(await next.isEnabled())) break;
        await next.click();
      }
    }
    await page.screenshot({ path: `.runtime/gallery-fit-${width}-${height}.png` });
  });
