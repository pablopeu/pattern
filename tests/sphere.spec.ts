import { test, expect, type Page } from '@playwright/test';
async function model(page: Page) {
  await expect(page.locator('.save-indicator')).toHaveText(/Guardado local/);
  return page.evaluate(async () => (await import('/src/persistence/storage.ts')).recover());
}
async function fixture(page: Page) {
  await page.goto('/');
  await model(page);
  const p = await page.evaluate(async () => {
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
        fillRule: 'evenodd',
      },
    ];
    p.metadata.name = 'Prueba esfera';
    await autosave(p);
    return p;
  });
  await page.reload();
  await expect.poll(async () => (await model(page))?.metadata.id).toBe(p.metadata.id);
  return p;
}
const sphere = (page: Page) => page.getByRole('dialog', { name: 'Visualización esférica', exact: true });
async function canvasPixels(page: Page) {
  return sphere(page)
    .getByLabel('Esfera derivada de la fuente plana')
    .evaluate((el) => {
      const canvas = el as HTMLCanvasElement,
        ctx = canvas.getContext('2d')!,
        data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const colors = new Set<string>();
      for (let i = 0; i < data.length; i += 4 * 37)
        colors.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
      return colors.size;
    });
}
test('esfera derivada: sólidos geodésicos, textura artística, vista y persistencia', async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1440, height: 950 });
  const original = await fixture(page);
  await page.getByRole('button', { name: 'Visualizar patrón', exact: true }).click();
  const disk = page.getByRole('dialog', { name: 'Visualización de Poincaré', exact: true });
  await disk.getByLabel('Modalidad', { exact: true }).selectOption('sphere');
  await expect(sphere(page)).toBeVisible();
  // Modelo geodésico real: varias caras coloreadas distintas.
  await expect.poll(async () => canvasPixels(page), { timeout: 20000 }).toBeGreaterThan(5);
  await sphere(page).getByLabel('Sólido', { exact: true }).selectOption('dodeca');
  await sphere(page).getByLabel('Nivel geodésico', { exact: true }).fill('2');
  await expect
    .poll(async () => (await model(page))?.visualization?.settings?.level, { timeout: 20000 })
    .toBe(2);
  await expect.poll(async () => canvasPixels(page), { timeout: 20000 }).toBeGreaterThan(10);
  expect((await model(page))?.visualization?.settings?.solid).toBe('dodeca');
  // Orientación y zoom no tocan la fuente.
  await sphere(page).getByLabel('Orientación horizontal', { exact: true }).fill('60');
  await sphere(page).getByLabel('Zoom', { exact: true }).fill('1.2');
  expect((await model(page))?.patterns).toEqual(original.patterns);
  // Modo artístico: textura deformada sobre la esfera.
  await sphere(page).getByLabel('Modo', { exact: true }).selectOption('artistic');
  await expect.poll(async () => canvasPixels(page), { timeout: 30000 }).toBeGreaterThan(5);
  await expect(
    sphere(page).getByText(/no implica simetría esférica exacta/),
  ).toBeVisible();
  await expect
    .poll(async () => (await model(page))?.visualization?.settings?.mode)
    .toBe('artistic');
  // Exportación raster real.
  const downloadPromise = page.waitForEvent('download');
  await sphere(page).getByRole('button', { name: 'PNG de alta calidad', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/esfera\.png$/);
  // Persistencia tras recargar: se reabre en esfera con los ajustes guardados.
  await page.reload();
  await expect(sphere(page)).toBeVisible({ timeout: 20000 });
  await expect(sphere(page).getByLabel('Modo', { exact: true })).toHaveValue('artistic');
  await sphere(page).getByLabel('Modo', { exact: true }).selectOption('geodesic');
  await expect(sphere(page).getByLabel('Sólido', { exact: true })).toHaveValue('dodeca');
  expect((await model(page))?.patterns).toEqual(original.patterns);
});
