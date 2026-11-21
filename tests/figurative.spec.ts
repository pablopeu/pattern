import { test, expect, type Page } from '@playwright/test';
import { context } from './navigation';
async function project(page: Page) {
  await expect(page.locator('.save-indicator')).toHaveText(/Guardado local/);
  return page.evaluate(async () => (await import('/src/persistence/storage.ts')).recover());
}
async function gallery(page: Page) {
  const menu = page.locator('.main-menu');
  if (!(await menu.evaluate((el) => (el as HTMLDetailsElement).open)))
    await menu.locator('summary').click();
  await menu.getByRole('button', { name: 'Galería de ejemplos', exact: true }).click();
  return page.getByRole('dialog', { name: 'Galería de ejemplos' });
}
for (const viewport of [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 390, height: 844 },
])
  test(`galería figurativa con mosaicos y fuentes portables ${viewport.width}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const before = await project(page),
      dialog = await gallery(page);
    await dialog.getByLabel('Categoría de ejemplos', { exact: true }).selectOption('Figurativas');
    expect(
      await dialog.evaluate((el) =>
        Math.max(el.scrollWidth - el.clientWidth, el.scrollHeight - el.clientHeight),
      ),
    ).toBeLessThanOrEqual(1);
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
    await page.screenshot({ path: `.runtime/figurative-gallery-${viewport.width}.png` });
    await dialog.getByRole('button', { name: 'Cerrar galería de ejemplos', exact: true }).click();
    expect(await project(page)).toEqual(before);
    const reopened = await gallery(page);
    await reopened.getByLabel('Buscar ejemplos', { exact: true }).fill('IH43');
    await reopened
      .getByRole('button', { name: 'Abrir ejemplo Peces encastrados · IH43', exact: true })
      .click();
    const p = (await project(page))!;
    expect(p.patterns[0].tiling?.isohedral?.type).toBe(43);
    expect(p.patterns[0].sourceGeometry).toHaveLength(8);
    expect(p.metadata.example?.artwork).toBe('original');
    expect(p.patterns[0].sourceGeometry[0].fillRegion?.scope).toBe('source');
    if (viewport.width > 900)
      await expect(page.locator('.context-heading > span')).toHaveText('Teselas');
  });
test('pez: borde enlazado actualiza silueta en vivo, conserva detalles y pasa a composición', async ({
  page,
}) => {
  await page.goto('/');
  await project(page);
  const dialog = await gallery(page);
  await dialog.getByLabel('Buscar ejemplos', { exact: true }).fill('IH43');
  await dialog
    .getByRole('button', { name: 'Abrir ejemplo Peces encastrados · IH43', exact: true })
    .click();
  const original = (await project(page))!.patterns[0].sourceGeometry,
    details = original.slice(1);
  const panel = page.getByRole('complementary', { name: 'Panel contextual' });
  await panel.getByRole('tab', { name: 'Bordes', exact: true }).click();
  const handle = page.getByLabel('Nodo de borde 1.2', { exact: true }),
    r = (await handle.boundingBox())!,
    silhouette = page.locator('.studio-canvas path[fill="#c78046"]').first(),
    old = await silhouette.getAttribute('d');
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2 + 5, { steps: 3 });
  await expect(silhouette).not.toHaveAttribute('d', old!);
  await page.mouse.up();
  expect((await project(page))!.patterns[0].sourceGeometry.slice(1)).toEqual(details);
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  await expect(silhouette).toHaveAttribute('d', old!);
  await context(page, 'Simetrías');
  await page.getByRole('tab', { name: 'Composición', exact: true }).click();
  await page.getByRole('button', { name: 'Composición recursiva', exact: true }).click();
  let p = (await project(page))!;
  expect(p.patterns[0].composition?.enabled).toBe(true);
  expect(p.patterns[0].sourceGeometry).toHaveLength(original.length);
  expect(p.patterns[0].sourceGeometry.slice(1)).toEqual(details);
  await expect(page.locator('.studio-canvas [data-tiled-pattern]')).toHaveCount(0);
  await expect(page.locator('.studio-canvas defs path[fill="#c78046"]').first()).toBeAttached();
  await page.screenshot({ path: '.runtime/figurative-to-composition.png' });
  await page.reload();
  p = (await project(page))!;
  expect(p.patterns[0].composition?.enabled).toBe(true);
  expect(p.patterns[0].sourceGeometry).toHaveLength(8);
});
