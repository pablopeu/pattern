import { test, expect, type Page } from '@playwright/test';
import { styles, field } from './navigation';
import { readFile } from 'node:fs/promises';
async function model(page: Page) {
  await expect(page.locator('.save-indicator')).toHaveText(/Guardado local/);
  return page.evaluate(async () => (await import('/src/persistence/storage.ts')).recover());
}
async function point(page: Page, x: number, y: number) {
  return page.locator('.studio-canvas').evaluate(
    (svg, [x, y]) => {
      const p = (svg as SVGSVGElement).createSVGPoint();
      p.x = x;
      p.y = y;
      const q = p.matrixTransform((svg as SVGSVGElement).getScreenCTM()!);
      return { x: q.x, y: q.y };
    },
    [x, y],
  );
}
for (const width of [1440, 390])
  test(`Shift selecciona trazados y Delete/Backspace borra todos sin diálogo ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto('/');
    await model(page);
    const original = await page.evaluate(async () => {
      const { newProject, geometry, node } = await import('/src/app/model.ts'),
        { autosave } = await import('/src/persistence/storage.ts');
      const p = newProject();
      p.patterns[0].sourceGeometry = [
        geometry('path', [node(-15, -10), node(5, -10), node(5, -5)]),
        geometry('path', [node(-15, 5), node(5, 5), node(5, 10)]),
        { ...geometry('path', [node(-15, 20), node(5, 20)]), locked: true },
      ];
      await autosave(p);
      return p;
    });
    await page.reload();
    await expect.poll(async () => (await model(page))?.metadata.id).toBe(original.metadata.id);
    await page.keyboard.press('v');
    for (const y of [-10, 5]) {
      const close = page.getByRole('button', { name: 'Cerrar panel de estilos', exact: true });
      if (await close.isVisible()) await close.click();
      const p = await point(page, 0, y);
      if (y === 5) await page.keyboard.down('Shift');
      await page.mouse.click(p.x, p.y);
      if (y === 5) await page.keyboard.up('Shift');
    }
    await expect(page.locator('[data-editing-handles]')).toHaveCount(2);
    const close = page.getByRole('button', { name: 'Cerrar panel de estilos', exact: true });
    if (await close.isVisible()) await close.click();
    await page.locator('.studio-canvas').focus();
    await page.keyboard.press('Delete');
    await expect(
      page.getByRole('dialog', { name: 'Conservar el trabajo', exact: true }),
    ).toHaveCount(0);
    await expect
      .poll(async () => (await model(page))?.patterns[0].sourceGeometry.map((g) => g.id))
      .toEqual([original.patterns[0].sourceGeometry[2].id]);
    expect((await model(page))?.metadata.id).toBe(original.metadata.id);
    await page.keyboard.press('Control+z');
    await expect
      .poll(async () => (await model(page))?.patterns[0].sourceGeometry)
      .toEqual(original.patterns[0].sourceGeometry);
    for (const y of [-10, 5]) {
      const close = page.getByRole('button', { name: 'Cerrar panel de estilos', exact: true });
      if (await close.isVisible()) await close.click();
      const p = await point(page, 0, y);
      if (y === 5) await page.keyboard.down('Shift');
      await page.mouse.click(p.x, p.y);
      if (y === 5) await page.keyboard.up('Shift');
    }
    const panel = await styles(page, 'Objeto');
    await panel.getByRole('tab', { name: 'Nodos', exact: true }).click();
    await expect(panel.getByText('Hay 2 objetos seleccionados.', { exact: false })).toBeVisible();
    await panel
      .getByRole('button', { name: 'Eliminar objetos seleccionados', exact: true })
      .click();
    await expect
      .poll(async () => (await model(page))?.patterns[0].sourceGeometry)
      .toEqual([original.patterns[0].sourceGeometry[2]]);
    await page.keyboard.press('Control+z');
    await expect
      .poll(async () => (await model(page))?.patterns[0].sourceGeometry)
      .toEqual(original.patterns[0].sourceGeometry);
    await page.locator('.studio-canvas').focus();
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Backspace');
    await expect
      .poll(async () => (await model(page))?.patterns[0].sourceGeometry)
      .toEqual([original.patterns[0].sourceGeometry[2]]);
  });

for (const width of [1440, 390])
  test(`test1 corregido abre con Fill vinculados y conserva cierre al cambiar60→61 ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto('/');
    await model(page);
    const raw = await readFile('tests/estudios/test1-corregido.json', 'utf8'),
      native = JSON.parse(raw);
    await page.locator('input[accept=".json,application/json"]').setInputFiles({
      name: 'test1-corregido.json',
      mimeType: 'application/json',
      buffer: Buffer.from(raw),
    });
    await expect.poll(async () => (await model(page))?.metadata.id).toBe(native.metadata.id);
    await expect
      .poll(async () =>
        (await model(page))?.patterns[0].sourceGeometry
          .filter((g) => g.fillRegion)
          .map((g) => g.fillRegion?.status),
      )
      .toEqual(['linked', 'linked']);
    const source = native.patterns[0].sourceGeometry.filter(
      (g: { fillRegion?: unknown }) => !g.fillRegion,
    );
    await (await field(page, 'Ancho de celda')).fill('61');
    await expect.poll(async () => (await model(page))?.patterns[0].symmetry.width).toBe(61);
    await expect
      .poll(async () =>
        (await model(page))?.patterns[0].sourceGeometry
          .filter((g) => g.fillRegion)
          .map((g) => g.fillRegion?.status),
      )
      .toEqual(['linked', 'linked']);
    expect((await model(page))?.patterns[0].sourceGeometry.filter((g) => !g.fillRegion)).toEqual(
      source,
    );
    await page.screenshot({ path: `.runtime/test1-corregido-${width}.png` });
    await page.reload();
    await expect
      .poll(async () =>
        (await model(page))?.patterns[0].sourceGeometry
          .filter((g) => g.fillRegion)
          .map((g) => g.fillRegion?.status),
      )
      .toEqual(['linked', 'linked']);
    expect((await model(page))?.patterns[0].symmetry.width).toBe(61);
  });
