import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { context, symmetry, styles, field } from './navigation';

async function project(page: Page) {
  await expect(page.locator('.save-indicator')).toHaveText(/Guardado local/);
  return page.evaluate(
    async () => (await (await import('/src/persistence/storage.ts')).recover())!,
  );
}
async function catalog(page: Page) {
  await context(page, 'Teselas');
  const panel = page.getByRole('complementary', { name: 'Panel contextual' });
  await panel.getByRole('tab', { name: 'Forma', exact: true }).click();
  await panel.getByRole('button', { name: 'Explorar catálogo IH1–IH93', exact: true }).click();
  return page.getByRole('dialog', { name: 'Catálogo isoédrico' });
}
async function useType(page: Page, type: number, curved = false) {
  const dialog = await catalog(page);
  await dialog.getByLabel('Buscar tipo IH').fill(`IH${type}`);
  await dialog.getByLabel('Bordes iniciales del catálogo').selectOption(String(curved));
  await dialog.getByRole('button', { name: `Usar IH${type}`, exact: true }).click();
  return project(page);
}
async function screen(page: Page, x: number, y: number) {
  return page.locator('.studio-canvas').evaluate(
    (el, p) => {
      const q = new DOMPoint(p.x, p.y).matrixTransform((el as SVGSVGElement).getScreenCTM()!);
      return { x: q.x, y: q.y };
    },
    { x, y },
  );
}
for (const viewport of [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 390, height: 844 },
]) {
  test(`IH catálogo y bordes accesibles, cancelar conserva documento ${viewport.width}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const before = await project(page),
      dialog = await catalog(page);
    const layout = await dialog.evaluate((el) => ({
      x: el.scrollWidth - el.clientWidth,
      y: el.scrollHeight - el.clientHeight,
    }));
    expect(layout.x).toBeLessThanOrEqual(1);
    expect(layout.y).toBeLessThanOrEqual(1);
    await expect
      .poll(() =>
        dialog
          .locator('img')
          .evaluateAll((all) => all.every((i) => (i as HTMLImageElement).naturalWidth > 0)),
      )
      .toBe(true);
    await dialog.getByLabel('Buscar tipo IH').fill('IH19');
    await expect(dialog.getByRole('button', { name: 'Usar IH19', exact: true })).toBeEnabled();
    await dialog.getByRole('button', { name: 'Cerrar catálogo isoédrico' }).click();
    expect(await project(page)).toEqual(before);
    const p = await useType(page, 1, true);
    expect(p.patterns[0].tiling?.isohedral?.type).toBe(1);
    expect(p.patterns[0].sourceGeometry).toEqual(before.patterns[0].sourceGeometry);
    const panel = page.getByRole('complementary', { name: 'Panel contextual' });
    for (const tab of ['Forma', 'Colocación', 'Bordes', 'Tangentes']) {
      await panel.getByRole('tab', { name: tab, exact: true }).click();
      const overflow = await panel.locator('.panel-scroll').evaluate((el) => ({
        x: el.scrollWidth - el.clientWidth,
        y: el.scrollHeight - el.clientHeight,
      }));
      expect(overflow.x).toBeLessThanOrEqual(1);
      expect(overflow.y).toBeLessThanOrEqual(1);
    }
    await useType(page, 19);
    const markedOverflow = await panel
      .locator('.panel-scroll')
      .evaluate((el) => el.scrollHeight - el.clientHeight);
    expect(markedOverflow).toBeLessThanOrEqual(1);
  });
}
test('IH41: gesto real, nodo sin cambiar contorno, rechazo de inversión, Fill/undo y archivos', async ({
  page,
}) => {
  await page.goto('/');
  await project(page);
  await symmetry(page, 'Simetría Libre');
  await page.getByRole('button', { name: 'Rectángulo', exact: true }).click();
  const a = await screen(page, 20, 20),
    b = await screen(page, 30, 30);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 3 });
  await page.mouse.up();
  const original = (await project(page)).patterns[0].sourceGeometry;
  expect(original).toHaveLength(1);
  await useType(page, 41, true);
  const panel = page.getByRole('complementary', { name: 'Panel contextual' });
  await panel.getByRole('tab', { name: 'Bordes', exact: true }).click();
  const handle = page.getByLabel('Nodo de borde 1.2', { exact: true }),
    box = (await handle.boundingBox())!;
  const oldY = (await project(page)).patterns[0].tiling!.edges[0][1].y;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 12, { steps: 4 });
  await page.mouse.up();
  await expect
    .poll(async () => (await project(page)).patterns[0].tiling!.edges[0][1].y)
    .not.toBe(oldY);
  expect((await project(page)).patterns[0].sourceGeometry).toEqual(original);
  await panel.getByRole('button', { name: 'Añadir nodo al borde', exact: true }).click();
  expect((await project(page)).patterns[0].tiling!.edges[0]).toHaveLength(4);
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  expect((await project(page)).patterns[0].tiling!.edges[0]).toHaveLength(3);
  await page.getByRole('button', { name: 'Rehacer', exact: true }).click();
  await panel.getByRole('tab', { name: 'Forma', exact: true }).click();
  const last = (await project(page)).patterns[0].tiling!;
  await page.getByLabel('Parámetro IH 1', { exact: true }).fill('-4');
  await expect(
    page.getByText('La edición invierte la orientación de la tesela.', { exact: true }),
  ).toBeVisible();
  expect((await project(page)).patterns[0].tiling).toEqual(last);
  await styles(page, 'Colores');
  await (await field(page, 'Editar estilo de')).selectOption('current');
  await (await field(page, 'HEX de relleno')).fill('#df3646');
  await page.getByRole('button', { name: 'Cerrar panel de estilos' }).click();
  await page.getByRole('button', { name: 'Rellenar región', exact: true }).click();
  const point = await screen(page, 10, 45);
  await page.mouse.move(point.x, point.y);
  await expect(page.locator('[data-fill-preview]')).toBeVisible();
  await page.mouse.click(point.x, point.y);
  await page.mouse.move(2, 2);
  await expect(page.locator('.fill-actions')).toHaveAttribute('data-fill-applied', '1');
  const filled = await project(page);
  expect(filled.patterns[0].sourceGeometry).toHaveLength(2);
  expect(filled.patterns[0].sourceGeometry.find((g) => g.fillRegion)?.fillRegion?.scope).toBe(
    'tile',
  );
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Guardar proyecto', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar archivo', exact: true }).click();
  const json = JSON.parse(await readFile((await (await download).path())!, 'utf8'));
  expect(json.patterns[0].tiling.isohedral.type).toBe(41);
  expect(json.patterns[0].sourceGeometry).toHaveLength(2);
  await page.reload();
  expect((await project(page)).patterns[0].tiling).toEqual(json.patterns[0].tiling);
  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  await expect(page.getByAltText('Previsualización de exportación')).toBeVisible();
  const exported = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar archivo', exact: true }).click();
  const svg = await readFile((await (await exported).path())!, 'utf8');
  expect(svg).toContain('#df3646');
  expect(svg).toContain('clipPath');
  expect(svg).toContain('isohedral');
});
test('IH93 y búsqueda Ctrl+K: espejo recto y fuente intacta', async ({ page }) => {
  await page.goto('/');
  const before = await project(page);
  await page.keyboard.press('Control+k');
  const command = page.getByRole('dialog', { name: 'Buscar comandos' });
  await command.getByRole('combobox').fill('catálogo isoédrico');
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Catálogo isoédrico' });
  await dialog.getByLabel('Buscar tipo IH').fill('IH93');
  await dialog.getByRole('button', { name: 'Usar IH93', exact: true }).click();
  await page.getByRole('tab', { name: 'Bordes', exact: true }).click();
  await expect(page.getByText(/Este borde es un eje de espejo/)).toBeVisible();
  await expect(page.locator('[data-tile-editor] rect[aria-label]')).toHaveCount(0);
  expect((await project(page)).patterns[0].sourceGeometry).toEqual(
    before.patterns[0].sourceGeometry,
  );
});
test('IH19 marcado: seis detalles interiores comparten una fuente editable y exportan paths', async ({
  page,
}) => {
  await page.goto('/');
  await project(page);
  await symmetry(page, 'Simetría Libre');
  await page.getByRole('button', { name: 'Rectángulo', exact: true }).click();
  const a = await screen(page, 17, 5),
    b = await screen(page, 25, 9);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 3 });
  await page.mouse.up();
  const original = (await project(page)).patterns[0].sourceGeometry;
  await useType(page, 19);
  expect((await project(page)).patterns[0].sourceGeometry).toEqual(original);
  const summary = await page.evaluate(async () => {
    const p = (await (await import('/src/persistence/storage.ts')).recover())!;
    const { buildScene } = await import('/src/patterns/engine.ts'),
      { resolvePattern } = await import('/src/symmetry/config.ts');
    const pattern = resolvePattern(p.patterns[0], p),
      scene = buildScene(pattern, { x: -100, y: -100, width: 200, height: 200 });
    return {
      objects: scene.generated.geometry.length,
      interior: scene.tiling!.inner.instances.length,
      reflected: scene.tiling!.inner.instances.filter(
        (i) => i.matrix[0] * i.matrix[3] - i.matrix[1] * i.matrix[2] < 0,
      ).length,
    };
  });
  expect(summary.objects).toBe(1);
  expect(summary.interior).toBeGreaterThanOrEqual(6);
  expect(summary.reflected).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Una celda', exact: true }).click();
  await page.getByRole('button', { name: 'Seleccionar', exact: true }).click();
  const point = await screen(page, 21, 5);
  await page.mouse.click(point.x, point.y);
  await (await field(page, 'Ancho')).fill('12');
  await expect
    .poll(async () => (await project(page)).patterns[0].sourceGeometry[0].parameters!.width)
    .toBe(12);
  expect((await project(page)).patterns[0].sourceGeometry).toHaveLength(1);
  await page.getByRole('button', { name: 'Cerrar panel de estilos' }).click();
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  expect((await project(page)).patterns[0].sourceGeometry).toEqual(original);
  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Exportar patrón' });
  await dialog.getByRole('tab', { name: 'Precisión', exact: true }).click();
  await dialog.getByLabel('Representación', { exact: true }).selectOption('expanded');
  await expect
    .poll(async () =>
      decodeURIComponent(
        (await dialog.getByAltText('Previsualización de exportación').getAttribute('src')) ?? '',
      ),
    )
    .not.toContain('<use');
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Descargar archivo', exact: true }).click();
  const svg = await readFile((await (await download).path())!, 'utf8');
  expect(svg).not.toContain('<use');
  expect(svg).toContain('isohedral');
  expect((svg.match(/<path /g) ?? []).length).toBeGreaterThanOrEqual(6);
});
