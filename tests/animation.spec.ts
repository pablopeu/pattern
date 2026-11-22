import { test, expect, type Page } from '@playwright/test';
import { stat } from 'node:fs/promises';
async function model(page: Page) {
  await expect(page.locator('.save-indicator')).toHaveText(/Guardado local/);
  return page.evaluate(async () => (await import('/src/persistence/storage.ts')).recover());
}
async function fixture(page: Page, withSphere: boolean) {
  await page.goto('/');
  await model(page);
  const p = await page.evaluate(async (withSphere) => {
    const { newProject, geometry } = await import('/src/app/model.ts'),
      { autosave } = await import('/src/persistence/storage.ts');
    const p = newProject();
    p.mainSymmetry = { ...p.mainSymmetry, family: 'wallpaper', group: 'p1', width: 30, height: 30 };
    p.patterns[0].sourceGeometry = [
      {
        ...geometry('compound', [], true),
        pathData: 'M2 2H28V28H2Z M10 10H20V20H10Z',
        fill: '#3b82f6',
        stroke: '#111111',
        strokeWidth: 0.6,
      },
    ];
    if (withSphere) {
      const { defaultSphereVisualization } = await import('/src/visualization/model.ts');
      const sphere = defaultSphereVisualization(p, p.patterns[0].id);
      sphere.settings.level = 1;
      sphere.active = false;
      p.visualization = sphere;
    }
    p.metadata.name = 'Prueba animación';
    await autosave(p);
    return p;
  }, withSphere);
  await page.reload();
  await expect.poll(async () => (await model(page))?.metadata.id).toBe(p.metadata.id);
  return p;
}

test('animación esférica: reproducción, línea temporal, GIF/WebM y persistencia', async ({
  page,
}) => {
  test.setTimeout(240000);
  await page.setViewportSize({ width: 1440, height: 950 });
  const original = await fixture(page, true);
  await page.getByRole('button', { name: 'Animar', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Animación', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Preset', { exact: true })).toHaveValue('sphere-spin');
  await expect
    .poll(async () => dialog.getByLabel('Cuadro de animación').evaluate((el) => {
      const canvas = el as HTMLCanvasElement,
        data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data,
        colors = new Set<string>();
      for (let i = 0; i < data.length; i += 4 * 101)
        colors.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
      return colors.size;
    }))
    .toBeGreaterThan(1);
  // Reproducción y pausa: la línea temporal avanza y se detiene.
  await dialog.getByRole('button', { name: 'Reproducir', exact: true }).click();
  await expect
    .poll(async () => Number(await dialog.getByLabel('Línea temporal', { exact: true }).inputValue()))
    .toBeGreaterThan(0.05);
  await dialog.getByRole('button', { name: 'Pausa', exact: true }).click();
  const paused = Number(await dialog.getByLabel('Línea temporal', { exact: true }).inputValue());
  await page.waitForTimeout(400);
  expect(Number(await dialog.getByLabel('Línea temporal', { exact: true }).inputValue())).toBe(
    paused,
  );
  await dialog.getByRole('button', { name: 'Detener', exact: true }).click();
  await expect(dialog.getByLabel('Línea temporal', { exact: true })).toHaveValue('0');
  // Exportaciones pequeñas pero reales.
  await dialog.getByLabel('Duración', { exact: true }).fill('500');
  await dialog.getByLabel('FPS', { exact: true }).selectOption('8');
  const gifPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Exportar', exact: true }).click();
  const gif = await gifPromise;
  expect(gif.suggestedFilename()).toMatch(/\.gif$/);
  expect((await stat((await gif.path())!)).size).toBeGreaterThan(1000);
  await expect
    .poll(async () => (await model(page))?.animation?.preset)
    .toBe('sphere-spin');
  await dialog.getByLabel('Formato', { exact: true }).selectOption('webm');
  const webmPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Exportar', exact: true }).click();
  const webm = await webmPromise;
  expect(webm.suggestedFilename()).toMatch(/\.webm$/);
  expect((await stat((await webm.path())!)).size).toBeGreaterThan(1000);
  await dialog.getByRole('button', { name: 'Cerrar animación', exact: true }).click();
  // Persistencia y fuente intacta.
  const restored = await model(page);
  expect(restored?.animation?.fps).toBe(8);
  expect(restored?.animation?.duration).toBe(500);
  expect(restored?.patterns).toEqual(original.patterns);
  await page.reload();
  await expect.poll(async () => (await model(page))?.animation?.preset).toBe('sphere-spin');
});

test('revejado recursivo por niveles se ofrece sin visualización activa', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto('/');
  await model(page);
  await page.evaluate(async () => {
    const { newProject, geometry } = await import('/src/app/model.ts'),
      { autosave } = await import('/src/persistence/storage.ts'),
      { defaultComposition } = await import('/src/composition/model.ts');
    const p = newProject(),
      pattern = p.patterns[0];
    pattern.sourceGeometry = [
      { ...geometry('rectangle', [], true), parameters: { x: 0, y: 0, width: 20, height: 10, radius: 0, sides: 4 } },
    ];
    pattern.composition = defaultComposition('recursive', { x: 0, y: 0, width: 20, height: 10 });
    if (pattern.composition.kind === 'recursive') pattern.composition.depth = 3;
    await autosave(p);
  });
  await page.reload();
  await page.getByRole('button', { name: 'Animar', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Animación', exact: true });
  await expect(dialog.getByLabel('Preset', { exact: true })).toHaveValue('recursive-levels');
  await expect(dialog.getByText(/no periódico|Preset no periódico/)).toBeVisible();
});
