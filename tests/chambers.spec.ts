import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
async function model(page: Page) {
  await expect(page.locator('.save-indicator')).toHaveText(/Guardado local/);
  return page.evaluate(async () => (await import('/src/persistence/storage.ts')).recover());
}
const dialog = (page: Page) =>
  page.getByRole('dialog', { name: 'Visualización de Poincaré', exact: true });
async function ready(page: Page) {
  await expect(dialog(page).getByRole('button', { name: 'SVG', exact: true })).toBeEnabled({
    timeout: 20000,
  });
  await expect(
    dialog(page).getByRole('img', {
      name: 'Disco de Poincaré derivado de la fuente plana',
      exact: true,
    }),
  ).toBeVisible();
}
async function fixture(page: Page) {
  await page.goto('/');
  await model(page);
  const original = await page.evaluate(async () => {
    const { newProject, geometry, node } = await import('/src/app/model.ts'),
      { defaultVisualization } = await import('/src/visualization/model.ts'),
      { autosave } = await import('/src/persistence/storage.ts');
    const p = newProject(),
      pat = p.patterns[0];
    p.metadata.name = 'Cámaras compartidas';
    pat.sourceGeometry = [
      {
        ...geometry('compound', [], true),
        pathData: 'M-30 -30H30V30H-30Z M-8 -8H8V8H-8Z',
        fill: '#487c78',
        stroke: 'none',
        fillRule: 'evenodd',
      },
      {
        ...geometry('path', [
          { ...node(-45, -12), out: { x: 30, y: -25 } },
          { ...node(45, 12), in: { x: -30, y: 25 } },
        ]),
        stroke: '#f4e9c9',
        strokeWidth: 1.2,
      },
    ];
    p.visualization = defaultVisualization(p, pat.id);
    p.visualization.active = false;
    p.visualization.showStructure = false;
    p.visualization.source.selection = {
      target: 'view',
      bounds: { x: -30, y: -30, width: 60, height: 60 },
    };
    p.visualization.settings.depth = 2;
    p.visualization.settings.maxCells = 20;
    p.visualization.settings.maxSegments = 1000000;
    await autosave(p);
    return p;
  });
  await page.reload();
  await expect.poll(async () => (await model(page))?.metadata.id).toBe(original.metadata.id);
  await page.getByRole('button', { name: 'Visualizar patrón', exact: true }).click();
  await ready(page);
  await dialog(page)
    .getByLabel('Adaptación del motivo', { exact: true })
    .selectOption('mirrored-chambers');
  await expect(dialog(page).getByLabel('Profundidad', { exact: true })).toHaveValue('1');
  await expect(dialog(page).getByLabel('Máximo de celdas', { exact: true })).toHaveValue('8');
  await dialog(page).getByRole('button', { name: 'Actualizar vista', exact: true }).click();
  await ready(page);
  return original;
}
for (const width of [1440, 390])
  test(`cámaras reflejadas: fuente intacta, guardar/recargar y volver ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const original = await fixture(page);
    await expect(dialog(page).getByText(/bordes de cámara compartidos/)).toBeVisible();
    expect((await model(page))?.patterns).toEqual(original.patterns);
    await dialog(page).getByRole('button', { name: 'Guardar estudio', exact: true }).click();
    const wait = page.waitForEvent('download');
    await page
      .getByRole('dialog', { name: 'Guardar proyecto', exact: true })
      .getByRole('button', { name: 'Guardar archivo', exact: true })
      .click();
    const native = JSON.parse(await readFile((await (await wait).path())!, 'utf8'));
    expect(native.schemaVersion).toBe(7);
    expect(native.visualization.version).toBe(2);
    expect(native.visualization.settings.adaptation).toBe('mirrored-chambers');
    expect(native.patterns).toEqual(original.patterns);
    await page.reload();
    await ready(page);
    await expect(dialog(page).getByLabel('Adaptación del motivo', { exact: true })).toHaveValue(
      'mirrored-chambers',
    );
    await dialog(page).getByRole('button', { name: 'Volver a la fuente', exact: true }).click();
    expect((await model(page))?.patterns).toEqual(original.patterns);
  });
test('cámaras exporta el mapa correcto y sus bordes canónicos con tamaño físico', async ({
  page,
}) => {
  await fixture(page);
  await dialog(page).getByLabel('Radio del disco', { exact: true }).fill('60');
  await dialog(page).getByRole('button', { name: 'Actualizar vista', exact: true }).click();
  await ready(page);
  const wait = page.waitForEvent('download');
  await dialog(page).getByRole('button', { name: 'SVG', exact: true }).click();
  const text = await readFile((await (await wait).path())!, 'utf8');
  expect(text).toContain('width="120mm"');
  expect(text).toContain('CANONICAL_C0');
  expect(text).toContain('canonicalNumericStepCertified');
  expect(text).toContain('mirrored-chambers');
});
test('cámaras cancela cálculo real, reintenta y conserva la fuente', async ({ page }) => {
  const original = await fixture(page);
  await dialog(page).getByLabel('Profundidad', { exact: true }).fill('8');
  await dialog(page).getByLabel('Máximo de celdas', { exact: true }).fill('4096');
  await dialog(page).getByRole('button', { name: 'Actualizar vista', exact: true }).click();
  await dialog(page).getByRole('button', { name: 'Cancelar cálculo', exact: true }).click();
  await expect(dialog(page).getByRole('alert')).toContainText('Cálculo cancelado');
  expect((await model(page))?.patterns).toEqual(original.patterns);
  await dialog(page).getByLabel('Profundidad', { exact: true }).fill('1');
  await dialog(page).getByLabel('Máximo de celdas', { exact: true }).fill('8');
  await dialog(page).getByRole('button', { name: 'Actualizar vista', exact: true }).click();
  await ready(page);
  expect((await model(page))?.patterns).toEqual(original.patterns);
});

test('galería regenera el ejemplo de bordes compartidos y permite editar la fuente', async ({
  page,
}) => {
  await page.goto('/');
  await model(page);
  await page.locator('.main-menu summary').click();
  await page.getByRole('button', { name: 'Galería de ejemplos', exact: true }).click();
  const gallery = page.getByRole('dialog', { name: 'Galería de ejemplos', exact: true });
  await gallery.getByLabel('Categoría de ejemplos').selectOption('Poincaré');
  await gallery
    .getByRole('button', { name: 'Abrir ejemplo Bordes compartidos · {7,3}', exact: true })
    .click();
  await ready(page);
  await expect(dialog(page).getByLabel('Adaptación del motivo', { exact: true })).toHaveValue(
    'mirrored-chambers',
  );
  const loaded = (await model(page))!;
  expect(loaded.patterns[0].sourceGeometry).toHaveLength(2);
  await dialog(page).getByRole('button', { name: 'Volver a la fuente', exact: true }).click();
  expect((await model(page))?.patterns).toEqual(loaded.patterns);
});
