import { test, expect, type Page } from '@playwright/test';
import { context } from './navigation';
async function model(page: Page) {
  await expect(page.locator('.save-indicator')).toHaveText(/Guardado local/);
  return page.evaluate(async () => (await import('/src/persistence/storage.ts')).recover());
}
async function load(page: Page) {
  await page.goto('/');
  await model(page);
  await page.locator('.main-menu summary').click();
  await page.getByRole('button', { name: 'Galería de ejemplos', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Galería de ejemplos' });
  await dialog.getByLabel('Buscar ejemplos').fill('IH43');
  await dialog
    .getByRole('button', { name: 'Abrir ejemplo Peces de jade · IH43', exact: true })
    .click();
  await model(page);
  await context(page, 'Teselas');
  await page.getByRole('tab', { name: 'Forma', exact: true }).click();
  await page.getByRole('button', { name: 'Colores de tesela', exact: true }).click();
}
for (const viewport of [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 390, height: 844 },
])
  test(`paleta de tesela sin scroll y fuente única ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await load(page);
    const original = (await model(page))!.patterns[0].sourceGeometry;
    await page.getByLabel('Colores por ciclo', { exact: true }).fill('6');
    await page.getByLabel('Color de tesela 2', { exact: true }).fill('#45a6bd');
    const scroll = page
      .getByRole('complementary', { name: 'Panel contextual' })
      .locator('.panel-scroll');
    expect(await scroll.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
    const p = (await model(page))!;
    expect(p.patterns[0].tiling!.colors!.palette).toHaveLength(6);
    expect(p.patterns[0].tiling!.colors!.palette[1]).toBe('#45a6bd');
    expect(p.patterns[0].sourceGeometry).toEqual(original);
    expect(p.patterns[0].tiling!.version).toBe(2);
    await page.screenshot({ path: `.runtime/tile-palette-${viewport.width}.png` });
  });
test('Fill recolorea la clase clickeada después de cambiar el período, sin duplicar fondo', async ({
  page,
}) => {
  await load(page);
  await page.getByLabel('Colores por ciclo', { exact: true }).fill('3');
  const before = (await model(page))!,
    palette = before.patterns[0].tiling!.colors!.palette;
  await page.getByRole('button', { name: 'Rellenar región', exact: true }).click();
  await page.getByLabel('HEX de relleno', { exact: true }).fill('#f43f5e');
  await page.getByLabel('HEX de relleno', { exact: true }).press('Enter');
  await page.getByRole('button', { name: 'Cerrar panel de estilos', exact: true }).click();
  const point = await page.evaluate(async () => {
    const { recover } = await import('/src/persistence/storage.ts'),
      { resolvePattern } = await import('/src/symmetry/config.ts'),
      { buildScene } = await import('/src/patterns/engine.ts'),
      { apply } = await import('/src/geometry/matrix.ts'),
      { tileColorIndex } = await import('/src/tiling/colors.ts'),
      { immediateFillCandidates } = await import('/src/fill/service.ts');
    const p = (await recover())!,
      pattern = resolvePattern(p.patterns[0], p),
      svg = document.querySelector('.studio-canvas') as SVGSVGElement,
      toolbar = svg.parentElement!.querySelector('.canvas-floats')!.getBoundingClientRect(),
      v = svg.viewBox.baseVal,
      scene = buildScene(pattern, { x: v.x, y: v.y, width: v.width, height: v.height });
    for (const tile of scene.tiling!.tiles) {
      if (tileColorIndex(pattern.tiling!, tile) !== 2) continue;
      for (const local of [
        { x: 10, y: 10 },
        { x: 15, y: 40 },
        { x: 45, y: 10 },
        { x: 20, y: 50 },
      ]) {
        const q = apply(tile.matrix, local);
        if (q.x < v.x + 2 || q.y < v.y + 2 || q.x > v.x + v.width - 2 || q.y > v.y + v.height - 2)
          continue;
        const candidate = immediateFillCandidates([{ pattern, scene }], q)[0];
        if (candidate?.kind !== 'tile' || candidate.colorIndex !== 2) continue;
        const screen = new DOMPoint(q.x, q.y).matrixTransform(svg.getScreenCTM()!);
        if (screen.y >= toolbar.top - 8) continue;
        return { x: screen.x, y: screen.y };
      }
    }
    throw Error('No hay tesela visible de clase2 sin detalles encima');
  });
  await page.mouse.click(point.x, point.y);
  await expect
    .poll(async () => Number(await page.locator('.fill-actions').getAttribute('data-fill-applied')))
    .toBe(1);
  await expect
    .poll(async () => (await model(page))!.patterns[0].tiling!.colors!.palette)
    .toEqual([palette[0], palette[1], '#f43f5e']);
  const after = (await model(page))!;
  expect(after.patterns[0].sourceGeometry).toHaveLength(before.patterns[0].sourceGeometry.length);
  await page.reload();
  expect((await model(page))!.patterns[0].tiling!.colors!.palette[2]).toBe('#f43f5e');
});
