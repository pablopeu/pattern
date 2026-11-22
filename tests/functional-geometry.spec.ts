import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { context, styles } from './navigation';
async function model(page: Page) {
  await expect(page.locator('.save-indicator')).toHaveText(/Guardado local/);
  return page.evaluate(async () => (await import('/src/persistence/storage.ts')).recover());
}
for (const width of [1440, 390])
  test(`geometría funcional: fuente única, profundidad, guardar/reabrir y SVG con créditos ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto('/');
    await model(page);
    await page.locator('.main-menu summary').click();
    await page.getByRole('button', { name: 'Galería de ejemplos', exact: true }).click();
    const gallery = page.getByRole('dialog', { name: 'Galería de ejemplos', exact: true });
    await gallery
      .getByLabel('Buscar ejemplos', { exact: true })
      .fill('Límite cuadrado de geometría funcional');
    await gallery
      .getByRole('button', {
        name: 'Abrir ejemplo Peces · Límite cuadrado de geometría funcional',
        exact: true,
      })
      .click();
    await expect
      .poll(async () => (await model(page))?.metadata.example?.id)
      .toBe('v3-escher-square');
    const original = (await model(page))!;
    expect(original.patterns[0].sourceGeometry).toHaveLength(1);
    await context(page, 'Simetrías');
    await page.getByRole('tab', { name: 'Composición', exact: true }).click();
    const left = page.getByRole('complementary', { name: 'Panel contextual', exact: true });
    await left.getByRole('tab', { name: 'Receta', exact: true }).click();
    await expect(left.getByLabel('Receta de composición', { exact: true })).toHaveValue(
      'henderson',
    );
    await expect(left.getByLabel('Profundidad recursiva', { exact: true })).toHaveAttribute(
      'max',
      '5',
    );
    await expect(left.getByLabel('Reflejos alternados', { exact: true })).toHaveCount(0);
    await left.getByLabel('Profundidad recursiva', { exact: true }).fill('2');
    await expect
      .poll(async () =>
        (await model(page))?.patterns[0].composition?.kind === 'recursive'
          ? (await model(page))?.patterns[0].composition?.depth
          : undefined,
      )
      .toBe(2);
    expect((await model(page))?.patterns[0].sourceGeometry).toEqual(
      original.patterns[0].sourceGeometry,
    );
    await page.getByRole('button', { name: 'Seleccionar', exact: true }).click();
    await page.locator('.studio-canvas').focus();
    await page.keyboard.press('Control+a');
    const panel = await styles(page, 'Trazo');
    await panel.getByLabel('Grosor de trazo', { exact: true }).fill('0.012');
    await expect
      .poll(async () => (await model(page))?.patterns[0].sourceGeometry[0].strokeWidth)
      .toBe(0.012);
    expect((await model(page))?.patterns[0].sourceGeometry).toHaveLength(1);
    await page.locator('.main-menu summary').click();
    await page.getByRole('button', { name: 'Guardar archivo JSON', exact: true }).click();
    const wait = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Guardar archivo', exact: true }).click();
    const native = JSON.parse(await readFile((await (await wait).path())!, 'utf8'));
    expect(native.metadata.example.artwork).toBe('licensed');
    expect(native.patterns[0].composition.recipe).toBe('henderson');
    expect(native.patterns[0].sourceGeometry).toHaveLength(1);
    await page.reload();
    await expect
      .poll(async () => (await model(page))?.patterns[0].sourceGeometry[0].strokeWidth)
      .toBe(0.012);
    await page.getByRole('button', { name: 'Exportar', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Exportar patrón', exact: true });
    await expect(dialog.getByAltText('Previsualización de exportación')).toBeVisible();
    const exported = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Descargar archivo', exact: true }).click();
    const svg = await readFile((await (await exported).path())!, 'utf8');
    expect(svg).toContain('FINITE_NONPERIODIC');
    expect(svg).toContain('mapio/programming-with-escher');
    expect(svg).toContain('data-patterns-example');
    expect(svg).toContain('<use');
  });
