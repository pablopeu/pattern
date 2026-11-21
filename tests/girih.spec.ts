import { test, expect, type Page } from '@playwright/test';
import { context } from './navigation';
async function model(page: Page) {
  await expect(page.locator('.save-indicator')).toHaveText(/Guardado local/);
  return page.evaluate(async () => (await import('/src/persistence/storage.ts')).recover());
}
async function open(page: Page) {
  await page.goto('/');
  await model(page);
  await context(page, 'Teselas');
  await page.getByLabel('Categoría de teselación', { exact: true }).selectOption('girih');
  await page.getByRole('button', { name: 'Activar Girih', exact: true }).click();
  await expect.poll(async () => (await model(page))!.patterns[0].generator.kind).toBe('girih');
}
for (const viewport of [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 390, height: 844 },
])
  test(`Girih catálogo, configuración y fuente sin scroll ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await open(page);
    const before = (await model(page))!.patterns[0].sourceGeometry,
      panel = page.getByRole('complementary', { name: 'Panel contextual' }),
      scroll = panel.locator('.panel-scroll');
    expect(await scroll.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
    await page
      .getByRole('button', { name: 'Catálogo de cinco teselas Girih', exact: true })
      .click();
    const dialog = page.getByRole('dialog', { name: 'Catálogo Girih' });
    await expect(dialog.locator('.girih-catalog-grid button')).toHaveCount(5);
    expect(await dialog.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
    await dialog.getByRole('button', { name: 'Cerrar catálogo Girih', exact: true }).click();
    for (const tab of ['Bandas', 'Color', 'Unir']) {
      await panel.getByRole('tab', { name: tab, exact: true }).click();
      expect(await scroll.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(
        1,
      );
    }
    await panel.getByRole('tab', { name: 'Color', exact: true }).click();
    await page.getByLabel('Color Girih 2', { exact: true }).fill('#de7395');
    await expect
      .poll(async () => (await model(page))!.patterns[0].generator.girih!.palette[1])
      .toBe('#de7395');
    expect((await model(page))!.patterns[0].sourceGeometry).toEqual(before);
    await page.screenshot({ path: `.runtime/girih-panel-${viewport.width}.png` });
    await page.reload();
    await model(page);
    await context(page, 'Teselas');
    await expect(page.getByLabel('Categoría de teselación', { exact: true })).toHaveValue('girih');
    expect((await model(page))!.patterns[0].generator.version).toBe(3);
  });
test('Girih: une un borde, rechaza colisión y conserva custom al recargar', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Catálogo de cinco teselas Girih', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Catálogo Girih' })
    .getByRole('button', { name: 'Usar tesela Girih Decágono', exact: true })
    .click();
  const panel = page.getByRole('complementary', { name: 'Panel contextual' });
  await panel.getByRole('tab', { name: 'Unir', exact: true }).click();
  await page.getByRole('button', { name: 'Unir por este borde', exact: true }).click();
  await expect
    .poll(async () => (await model(page))!.patterns[0].generator.girih!.tiles?.length)
    .toBe(2);
  const before = (await model(page))!;
  await page.getByRole('button', { name: 'Unir por este borde', exact: true }).click();
  await expect(page.locator('.toast')).toContainText('superponen');
  expect(await model(page)).toEqual(before);
  await page.reload();
  const after = (await model(page))!;
  expect(after.patterns[0].generator.girih!.recipe).toBe('custom');
  expect(after.patterns[0].generator.girih!.tiles).toHaveLength(2);
});
test('Girih: fuente con ciclo impar exige corrección explícita sin modificar sus ejes', async ({
  page,
}) => {
  await page.goto('/');
  await model(page);
  await page.evaluate(async () => {
    const { newProject, geometry, node } = await import('/src/app/model.ts'),
      { defaultGirih } = await import('/src/girih/model.ts'),
      { autosave } = await import('/src/persistence/storage.ts');
    const p = newProject();
    p.metadata.name = 'Conflicto Girih';
    p.preferences.grid = false;
    p.patterns[0].generator = {
      ...p.patterns[0].generator,
      kind: 'girih',
      version: 3,
      girih: { ...defaultGirih(), recipe: 'single', weaveSource: true },
    };
    p.patterns[0].sourceGeometry = [
      [
        [0, 3],
        [-3, -2],
        [3, -2],
      ],
      [
        [0, 0],
        [0, 5],
      ],
      [
        [0, 0],
        [-5, -3],
      ],
      [
        [0, 0],
        [5, -3],
      ],
    ].map((points, i) => ({
      ...geometry(
        'path',
        points.map(([x, y]) => node(x, y)),
        i === 0,
      ),
      fill: 'none',
    }));
    await autosave(p);
  });
  await page.reload();
  await model(page);
  await context(page, 'Teselas');
  const panel = page.getByRole('complementary', { name: 'Panel contextual' });
  await panel.getByRole('tab', { name: 'Bandas', exact: true }).click();
  const source = (await model(page))!.patterns[0].sourceGeometry;
  await expect(panel.getByRole('status')).toContainText('Conflicto');
  await page.getByLabel('Permitir cortes explícitos de alternancia', { exact: true }).check();
  await expect(panel.getByRole('status')).toContainText('cortes de alternancia aceptados');
  await expect
    .poll(async () => (await model(page))!.patterns[0].generator.girih!.allowBreaks)
    .toBe(true);
  expect((await model(page))!.patterns[0].sourceGeometry).toEqual(source);
  await page.getByRole('button', { name: 'Editar trazos fuente', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Ver resultado Girih', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Ver resultado Girih', exact: true }).click();
  expect((await model(page))!.patterns[0].sourceGeometry).toEqual(source);
});
test('Girih: fase cambia el paso superior en píxeles de SVG exportado', async ({ page }) => {
  await open(page);
  const panel = page.getByRole('complementary', { name: 'Panel contextual' });
  await panel.getByRole('tab', { name: 'Bandas', exact: true }).click();
  const expected = await page.evaluate(async () => {
    const { recover } = await import('/src/persistence/storage.ts'),
      { girihDefinition } = await import('/src/girih/model.ts'),
      { girihStrands, solveWeave } = await import('/src/girih/weave.ts'),
      { multiply, rotate, scale, apply } = await import('/src/geometry/matrix.ts');
    const p = (await recover())!,
      g = p.patterns[0].generator,
      frame = multiply(rotate(g.rotation), scale(g.spacing)),
      strands = girihStrands(girihDefinition(g).tiles).map((s) => ({
        ...s,
        points: s.points.map((p) => apply(frame, p)),
      })),
      weave = solveWeave(strands, g.girih!.phase);
    for (const c of weave.crossings) {
      const over = c.incidences.find((i) => i.over)!,
        under = c.incidences.find((i) => !i.over)!;
      if (
        over.strand % 5 !== under.strand % 5 &&
        Math.abs(c.point.x) < 85 &&
        Math.abs(c.point.y) < 65
      )
        return {
          point: c.point,
          colors: [g.girih!.palette[over.strand % 5], g.girih!.palette[under.strand % 5]],
        };
    }
    throw Error('No hay cruce visible con colores distintos');
  });
  async function pixel() {
    return page.evaluate(async (q) => {
      const { recover } = await import('/src/persistence/storage.ts'),
        { prepareExport } = await import('/src/export/svg.ts');
      const p = (await recover())!,
        svg = prepareExport(p, {
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
        }).svg,
        url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })),
        img = new Image();
      img.src = url;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 1800;
      canvas.height = 1400;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, 1800, 1400);
      URL.revokeObjectURL(url);
      return [
        ...ctx.getImageData(Math.floor((q.x + 90) * 10), Math.floor((q.y + 70) * 10), 1, 1).data,
      ].slice(0, 3);
    }, expected.point);
  }
  const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  expect(await pixel()).toEqual(rgb(expected.colors[0]));
  await page.getByRole('button', { name: 'Invertir arriba/abajo', exact: true }).click();
  await expect.poll(async () => (await model(page))!.patterns[0].generator.girih!.phase).toBe(1);
  expect(await pixel()).toEqual(rgb(expected.colors[1]));
});
test('Girih: presupuesto de ejes informa error recuperable y conserva el original', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await model(page);
  await page.evaluate(async () => {
    const { newProject, geometry, node } = await import('/src/app/model.ts'),
      { defaultGirih } = await import('/src/girih/model.ts'),
      { autosave } = await import('/src/persistence/storage.ts');
    const p = newProject();
    p.patterns[0].generator = {
      ...p.patterns[0].generator,
      kind: 'girih',
      version: 3,
      girih: { ...defaultGirih(), recipe: 'single', weaveSource: true },
    };
    p.patterns[0].sourceGeometry = [
      geometry(
        'path',
        Array.from({ length: 4100 }, (_, i) => node(i * 0.001, Math.sin(i))),
      ),
    ];
    await autosave(p);
  });
  await page.reload();
  await model(page);
  await context(page, 'Teselas');
  await expect(page.getByRole('alert')).toContainText('4096 segmentos');
  await page.getByRole('button', { name: 'Editar trazos fuente', exact: true }).click();
  await expect(page.locator('.studio-canvas path[stroke]')).toHaveCount(1);
  const original = (await model(page))!.patterns[0].sourceGeometry;
  const panel = page.getByRole('complementary', { name: 'Panel contextual' });
  await panel.getByRole('tab', { name: 'Bandas', exact: true }).click();
  await page.getByLabel('Entrelazar trazos del motivo', { exact: true }).uncheck();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect
    .poll(async () => (await model(page))!.patterns[0].generator.girih!.weaveSource)
    .toBe(false);
  expect((await model(page))!.patterns[0].sourceGeometry).toEqual(original);
  expect(errors).toEqual([]);
});
