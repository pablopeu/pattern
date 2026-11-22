import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
async function model(page: Page) {
  await expect(page.locator('.save-indicator')).toHaveText(/Guardado local/);
  return page.evaluate(async () => (await import('/src/persistence/storage.ts')).recover());
}
function art(page: Page) {
  return page.getByRole('dialog', { name: 'Visualización artística', exact: true });
}
async function ready(page: Page) {
  await expect(
    art(page).getByRole('img', {
      name: 'Disco artístico derivado de la fuente plana',
      exact: true,
    }),
  ).toBeVisible({ timeout: 20000 });
  await expect(art(page).getByRole('button', { name: 'SVG', exact: true })).toBeEnabled();
}
async function fixture(page: Page) {
  await page.goto('/');
  await model(page);
  const project = await page.evaluate(async () => {
    const { newProject, geometry, node } = await import('/src/app/model.ts'),
      { autosave } = await import('/src/persistence/storage.ts');
    const p = newProject();
    p.mainSymmetry = { ...p.mainSymmetry, family: 'wallpaper', group: 'p1', width: 30, height: 30 };
    p.metadata.name = 'Disco artístico de prueba';
    p.patterns[0].sourceGeometry = [
      {
        ...geometry('compound', [], true),
        pathData: 'M2 2H28V28H2Z M10 10H20V20H10Z',
        fill: '#3b82f6',
        stroke: '#111111',
        strokeWidth: 0.6,
        fillRule: 'evenodd',
      },
      {
        ...geometry('path', [node(4, 25), node(26, 25)]),
        stroke: '#ff00ff',
        strokeWidth: 1.2,
        strokeProfile: {
          version: 1,
          kind: 'custom',
          points: [
            { at: 0, width: 0.2 },
            { at: 1, width: 1 },
          ],
        },
      },
    ];
    await autosave(p);
    return p;
  });
  await page.reload();
  await expect.poll(async () => (await model(page))?.metadata.id).toBe(project.metadata.id);
  await page.getByRole('button', { name: 'Visualizar patrón', exact: true }).click();
  const geometric = page.getByRole('dialog', { name: 'Visualización de Poincaré', exact: true });
  await expect(geometric.getByRole('button', { name: 'SVG', exact: true })).toBeEnabled({
    timeout: 20000,
  });
  await geometric.getByLabel('Modalidad', { exact: true }).selectOption('artistic-disk');
  await ready(page);
  return project;
}
for (const width of [1440, 390])
  test(`disco artístico: modalidad, fuente intacta, guardado/reapertura y regreso ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const original = await fixture(page);
    await expect(art(page).getByText(/Deformación radial artística · ARTISTIC/)).toBeVisible();
    await expect(art(page).getByLabel('Lados p', { exact: true })).toHaveCount(0);
    await expect(art(page).getByLabel('Estructura geodésica', { exact: true })).toHaveCount(0);
    expect(await art(page).evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await art(page)
      .getByRole('img', { name: 'Disco artístico derivado de la fuente plana', exact: true })
      .click();
    expect((await model(page))?.patterns).toEqual(original.patterns);
    await art(page).getByLabel('Compresión radial', { exact: true }).fill('6');
    await expect(art(page).getByRole('button', { name: 'SVG', exact: true })).toBeDisabled();
    await art(page).getByRole('button', { name: 'Actualizar vista', exact: true }).click();
    await ready(page);
    await art(page).getByRole('button', { name: 'Guardar estudio', exact: true }).click();
    const waiting = page.waitForEvent('download');
    await page
      .getByRole('dialog', { name: 'Guardar proyecto', exact: true })
      .getByRole('button', { name: 'Guardar archivo', exact: true })
      .click();
    const data = JSON.parse(await readFile((await (await waiting).path())!, 'utf8'));
    expect(data.schemaVersion).toBe(7);
    expect(data.visualization.kind).toBe('artistic-disk');
    expect(data.visualization.settings.compression).toBe(6);
    expect(data.visualization.settings.p).toBeUndefined();
    expect(data.patterns).toEqual(original.patterns);
    await page.reload();
    await ready(page);
    await art(page).getByLabel('Modalidad', { exact: true }).selectOption('poincare');
    const geometric = page.getByRole('dialog', { name: 'Visualización de Poincaré', exact: true });
    await expect(geometric.getByRole('button', { name: 'SVG', exact: true })).toBeEnabled({
      timeout: 20000,
    });
    await geometric.getByRole('button', { name: 'Volver a la fuente', exact: true }).click();
    expect((await model(page))?.patterns).toEqual(original.patterns);
    expect((await model(page))?.visualization?.active).toBe(false);
  });
test('disco artístico exporta regiones reales a SVG/PNG/JPEG y regenera después de editar la fuente plana', async ({
  page,
}) => {
  const original = await fixture(page);
  await art(page).getByLabel('Radio del disco', { exact: true }).fill('40');
  await art(page).getByRole('button', { name: 'Actualizar vista', exact: true }).click();
  await ready(page);
  await art(page).getByLabel('Resolución de imagen', { exact: true }).fill('96');
  for (const format of ['SVG', 'PNG', 'JPEG']) {
    const wait = page.waitForEvent('download');
    await art(page).getByRole('button', { name: format, exact: true }).click();
    const file = await wait,
      bytes = await readFile((await file.path())!);
    expect(file.suggestedFilename()).toContain('-disco-artistico.');
    if (format === 'SVG') {
      const text = bytes.toString();
      expect(text).toContain('width="80mm"');
      expect(text).toContain('ARTISTIC');
      expect(text).toContain('&quot;hyperbolicTessellation&quot;:false');
    } else {
      const raster = await page.evaluate(
        async ({ bytes, type }) => {
          const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type })),
            canvas = document.createElement('canvas');
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(bitmap, 0, 0);
          bitmap.close();
          const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          let blue = 0,
            magenta = 0;
          for (let i = 0; i < data.length; i += 4) {
            if (data[i] === 59 && data[i + 1] === 130 && data[i + 2] === 246 && data[i + 3] === 255)
              blue++;
            if (data[i] === 255 && data[i + 1] === 0 && data[i + 2] === 255 && data[i + 3] === 255)
              magenta++;
          }
          return {
            size: [canvas.width, canvas.height],
            center: [...ctx.getImageData(151, 151, 1, 1).data],
            blue,
            magenta,
          };
        },
        { bytes: [...bytes], type: format === 'PNG' ? 'image/png' : 'image/jpeg' },
      );
      expect(raster.size).toEqual([302, 302]);
      if (format === 'PNG') {
        expect(raster.center[3]).toBe(0);
        expect(raster.blue).toBeGreaterThan(1000);
        expect(raster.magenta).toBeGreaterThan(50);
      } else expect(raster.center).toEqual([255, 255, 255, 255]);
    }
  }
  await art(page).getByRole('button', { name: 'Volver a la fuente', exact: true }).click();
  await page.getByRole('button', { name: 'Línea', exact: true }).click();
  const points = await page.locator('.studio-canvas').evaluate((svg) =>
    [new DOMPoint(4, 5), new DOMPoint(8, 7)].map((p) => {
      const q = p.matrixTransform((svg as SVGSVGElement).getScreenCTM()!);
      return { x: q.x, y: q.y };
    }),
  );
  await page.mouse.move(points[0].x, points[0].y);
  await page.mouse.down();
  await page.mouse.move(points[1].x, points[1].y, { steps: 3 });
  await page.mouse.up();
  await expect
    .poll(async () => (await model(page))?.patterns[0].sourceGeometry.length)
    .toBe(original.patterns[0].sourceGeometry.length + 1);
  const changed = (await model(page))!,
    newId = changed.patterns[0].sourceGeometry.find(
      (g) => !original.patterns[0].sourceGeometry.some((old) => old.id === g.id),
    )!.id;
  await page.getByRole('button', { name: 'Visualizar patrón', exact: true }).click();
  await ready(page);
  const wait = page.waitForEvent('download');
  await art(page).getByRole('button', { name: 'SVG', exact: true }).click();
  expect(await readFile((await (await wait).path())!, 'utf8')).toContain(newId);
  expect((await model(page))?.patterns).toEqual(changed.patterns);
});
test('disco artístico cancela un worker real y vuelve a generar sin perder la fuente', async ({
  page,
}) => {
  const original = await fixture(page);
  await art(page).getByLabel('Región fuente', { exact: true }).selectOption('view');
  for (const [name, value] of [
    ['Ventana X', '-90'],
    ['Ventana Y', '-90'],
    ['Ancho fuente', '180'],
    ['Alto fuente', '180'],
    ['Compresión radial', '64'],
    ['Precisión de proyección', '0.001'],
  ])
    await art(page).getByLabel(name, { exact: true }).fill(value);
  await art(page).getByRole('button', { name: 'Actualizar vista', exact: true }).click();
  await art(page).getByRole('button', { name: 'Cancelar cálculo', exact: true }).click();
  await expect(art(page).getByRole('alert')).toContainText('Cálculo cancelado');
  expect((await model(page))?.patterns).toEqual(original.patterns);
  await art(page).getByLabel('Compresión radial', { exact: true }).fill('4');
  await art(page).getByLabel('Precisión de proyección', { exact: true }).fill('0.02');
  await art(page).getByRole('button', { name: 'Actualizar vista', exact: true }).click();
  await ready(page);
  expect((await model(page))?.patterns).toEqual(original.patterns);
});

test('galería artística carga dos fuentes originales y sus miniaturas derivadas reales', async ({
  page,
}) => {
  await page.goto('/');
  await model(page);
  await page.locator('.main-menu summary').click();
  await page.getByRole('button', { name: 'Galería de ejemplos', exact: true }).click();
  const gallery = page.getByRole('dialog', { name: 'Galería de ejemplos', exact: true });
  await gallery.getByLabel('Categoría de ejemplos').selectOption('Discos artísticos');
  await expect(gallery.locator('.example-card')).toHaveCount(1);
  for (const url of await gallery
    .locator('.example-card img')
    .evaluateAll((rows) => rows.map((row) => (row as HTMLImageElement).src)))
    expect((await page.request.get(url)).ok()).toBe(true);
  await gallery
    .getByRole('button', { name: 'Abrir ejemplo Disco radial · Campo de aves', exact: true })
    .click();
  await ready(page);
  const p = (await model(page))!;
  expect(p.metadata.example?.validity).toBe('ARTISTIC');
  await art(page).getByRole('button', { name: 'Volver a la fuente', exact: true }).click();
  expect((await model(page))?.patterns).toEqual(p.patterns);
});
