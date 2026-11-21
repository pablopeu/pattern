import { test, expect, type Page } from '@playwright/test';
import { context } from './navigation';
async function model(page: Page) {
  await expect(page.locator('.save-indicator')).toHaveText(/Guardado local/);
  return page.evaluate(async () => (await import('/src/persistence/storage.ts')).recover());
}
async function open(page: Page, kind = 'hat') {
  await page.goto('/');
  await model(page);
  await context(page, 'Teselas');
  await page
    .getByRole('group', { name: 'Familias de teselas' })
    .getByRole('button', { name: 'Aperiódicas', exact: true })
    .click();
  await page.getByLabel('Construcción aperiódica', { exact: true }).selectOption(kind);
  await model(page);
}
for (const viewport of [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 390, height: 844 },
])
  test(`aperiódicas controles y jerarquía sin scroll ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await open(page);
    const panel = page.getByRole('complementary', { name: 'Panel contextual' }),
      scroll = panel.locator('.panel-scroll');
    const before = (await model(page))!.patterns[0].sourceGeometry;
    await page.getByLabel('Sustituciones', { exact: true }).fill('2');
    await page.getByLabel('Semilla de sustitución', { exact: true }).selectOption('F');
    expect(await scroll.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
    await panel.getByRole('tab', { name: 'Color', exact: true }).click();
    await page.getByLabel('Color aperiódico 2', { exact: true }).fill('#e06589');
    expect(await scroll.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
    await panel.getByRole('tab', { name: 'Jerarquía', exact: true }).click();
    await page.getByLabel('Mostrar jerarquía de sustitución', { exact: true }).check();
    expect(await scroll.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
    expect((await model(page))!.patterns[0].sourceGeometry).toEqual(before);
    if (viewport.width <= 900)
      await page.getByRole('button', { name: 'Cerrar panel izquierdo', exact: true }).click();
    await page.getByRole('button', { name: 'Ajustar al patrón', exact: true }).click();
    const frame = await page.evaluate(() => {
      const svg = document.querySelector('.studio-canvas') as SVGSVGElement,
        rect = svg.getBoundingClientRect(),
        toolbar = svg.parentElement!.querySelector('.canvas-floats')!.getBoundingClientRect();
      const boxes = [...svg.querySelectorAll('[data-composition-level], [data-fill-region]')].map(
        (el) => {
          const b = (el as SVGGraphicsElement).getBBox(),
            a = new DOMPoint(b.x, b.y).matrixTransform(svg.getScreenCTM()!),
            c = new DOMPoint(b.x + b.width, b.y + b.height).matrixTransform(svg.getScreenCTM()!);
          return { left: a.x, top: a.y, right: c.x, bottom: c.y };
        },
      );
      return {
        left: Math.min(...boxes.map((b) => b.left)),
        top: Math.min(...boxes.map((b) => b.top)),
        right: Math.max(...boxes.map((b) => b.right)),
        bottom: Math.max(...boxes.map((b) => b.bottom)),
        viewport: { left: rect.left, top: rect.top, right: rect.right, bottom: toolbar.top },
      };
    });
    expect(frame.left).toBeGreaterThanOrEqual(frame.viewport.left + 4);
    expect(frame.right).toBeLessThanOrEqual(frame.viewport.right - 4);
    expect(frame.top).toBeGreaterThanOrEqual(frame.viewport.top + 4);
    expect(frame.bottom).toBeLessThanOrEqual(frame.viewport.bottom - 4);
    if (viewport.width <= 900) await context(page, 'Teselas');
    await page.screenshot({ path: `.runtime/aperiodic-hierarchy-${viewport.width}.png` });
    await page.getByLabel('Construcción aperiódica', { exact: true }).selectOption('spectre');
    await panel.getByRole('tab', { name: 'Parche', exact: true }).click();
    await expect(panel).toContainText('una sola mano');
    await expect.poll(async () => (await model(page))!.patterns[0].generator.kind).toBe('spectre');
    await page.reload();
    await model(page);
    await context(page, 'Teselas');
    await expect(page.getByLabel('Construcción aperiódica', { exact: true })).toHaveValue(
      'spectre',
    );
    expect((await model(page))!.patterns[0].generator.version).toBe(2);
  });
test('Spectre: ejemplo, edición de fuente, copias, exportación y regreso al motivo', async ({
  page,
}) => {
  await page.goto('/');
  await model(page);
  await page.locator('.main-menu summary').click();
  await page.getByRole('button', { name: 'Galería de ejemplos', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Galería de ejemplos' });
  await dialog.getByLabel('Categoría de ejemplos', { exact: true }).selectOption('Aperiódicas');
  await dialog
    .getByRole('button', { name: 'Abrir ejemplo Spectre · generaciones curvas', exact: true })
    .click();
  await model(page);
  await context(page, 'Teselas');
  const initial = (await model(page))!;
  expect(initial.patterns[0].sourceGeometry).toHaveLength(1);
  await page.getByRole('button', { name: 'Editar motivo fuente', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Ver parche completo', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Dibujo libre', exact: true }).click();
  const svg = page.locator('.studio-canvas');
  const bounds = await svg.boundingBox();
  await page.mouse.move(bounds!.x + bounds!.width * 0.47, bounds!.y + bounds!.height * 0.47);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + bounds!.width * 0.53, bounds!.y + bounds!.height * 0.5, {
    steps: 8,
  });
  await page.mouse.up();
  expect((await model(page))!.patterns[0].sourceGeometry.length).toBe(2);
  await context(page, 'Teselas');
  await page.getByRole('button', { name: 'Ver parche completo', exact: true }).click();
  const exported = await page.evaluate(async () => {
    const { recover } = await import('/src/persistence/storage.ts'),
      { prepareExport } = await import('/src/export/svg.ts');
    const p = (await recover())!;
    return prepareExport(p, {
      patternId: p.patterns[0].id,
      target: 'view',
      format: 'svg',
      representation: 'editable',
      width: 180,
      height: 140,
      dpi: 96,
      background: '#fff',
      transparent: true,
      quality: 1,
      tolerance: 0.02,
      outlineStrokes: true,
    }).svg;
  });
  expect(exported).toContain('<use');
  expect(exported).toContain('C');
  await page.getByRole('button', { name: 'Volver al motivo guardado', exact: true }).click();
  const after = (await model(page))!;
  expect(after.patterns[0].generator.kind).toBe('motif');
  expect(after.patterns[0].sourceGeometry).toHaveLength(2);
  expect(after.patterns[0].sourceGeometry[0]).toEqual(initial.patterns[0].sourceGeometry[0]);
});
test('Fill en Spectre queda visible debajo del perímetro y persiste', async ({ page }) => {
  await open(page, 'spectre');
  await page.getByLabel('Sustituciones', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Rellenar región', exact: true }).click();
  await page.getByLabel('HEX de relleno', { exact: true }).fill('#f43f5e');
  await page.getByLabel('HEX de relleno', { exact: true }).press('Enter');
  await page.getByRole('button', { name: 'Cerrar panel de estilos', exact: true }).click();
  const point = await page.evaluate(async () => {
    const { recover } = await import('/src/persistence/storage.ts'),
      { resolvePattern } = await import('/src/symmetry/config.ts'),
      { buildScene } = await import('/src/patterns/engine.ts'),
      { apply } = await import('/src/geometry/matrix.ts'),
      { paperPath, scope } = await import('/src/geometry/paper.ts');
    const p = (await recover())!,
      pattern = resolvePattern(p.patterns[0], p),
      svg = document.querySelector('.studio-canvas') as SVGSVGElement,
      v = svg.viewBox.baseVal,
      scene = buildScene(pattern, { x: v.x, y: v.y, width: v.width, height: v.height }),
      toolbar = svg.parentElement!.querySelector('.canvas-floats')!.getBoundingClientRect();
    const body = paperPath(
      scene.generated.geometry.find((g) => g.id === scene.generated.aperiodic!.bodyId)!,
    );
    let interior = { x: 15, y: 10 };
    for (let x = 0; x < 30; x += 2)
      for (let y = 0; y < 24; y += 2) {
        const q = new scope.Point(x, y);
        if (body.contains(q) && body.getNearestPoint(q).getDistance(q) > 3) interior = { x, y };
      }
    body.remove();
    for (const m of scene.generated.placements) {
      const q = apply(m, interior),
        screen = new DOMPoint(q.x, q.y).matrixTransform(svg.getScreenCTM()!);
      if (
        q.x > v.x + 2 &&
        q.y > v.y + 2 &&
        q.x < v.x + v.width - 2 &&
        q.y < v.y + v.height - 2 &&
        screen.y < toolbar.top - 8
      )
        return { x: screen.x, y: screen.y, world: q };
    }
    throw Error('No hay interior visible');
  });
  await page.mouse.click(point.x, point.y);
  await expect
    .poll(async () => Number(await page.locator('.fill-actions').getAttribute('data-fill-applied')))
    .toBe(1);
  const p = (await model(page))!;
  expect(p.patterns[0].sourceGeometry).toHaveLength(1);
  expect(p.patterns[0].sourceGeometry[0].fill).toBe('#f43f5e');
  const pixel = await page.evaluate(async (q) => {
    const { recover } = await import('/src/persistence/storage.ts'),
      { prepareExport } = await import('/src/export/svg.ts');
    const p = (await recover())!;
    const svg = prepareExport(p, {
      patternId: p.patterns[0].id,
      target: 'view',
      format: 'svg',
      representation: 'editable',
      width: 180,
      height: 140,
      dpi: 96,
      background: '#fff',
      transparent: true,
      quality: 1,
      tolerance: 0.02,
      outlineStrokes: true,
    }).svg;
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 700;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, 900, 700);
    URL.revokeObjectURL(url);
    return [...ctx.getImageData(Math.floor((q.x + 90) * 5), Math.floor((q.y + 70) * 5), 1, 1).data];
  }, point.world);
  expect(pixel[0]).toBeGreaterThan(220);
  expect(pixel[1]).toBeLessThan(100);
  expect(pixel[2]).toBeLessThan(130);
  await page.reload();
  expect((await model(page))!.patterns[0].sourceGeometry[0].fill).toBe('#f43f5e');
});
