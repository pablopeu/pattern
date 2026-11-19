import { test, expect } from '@playwright/test';
test('build estático por HTTP: edición y exportación sin recursos de Internet', async ({
  page,
  baseURL,
}) => {
  const external: string[] = [],
    errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.protocol.startsWith('http') && url.origin !== new URL(baseURL!).origin) {
      external.push(url.href);
      return route.abort();
    }
    return route.continue();
  });
  await page.goto(baseURL!);
  await expect(page.locator('.save-indicator')).toHaveText(/Guardado local/);
  await expect(page.locator('.studio-canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Rectángulo', exact: true }).click();
  const rect = await page.locator('.studio-canvas').boundingBox();
  await page.mouse.move(rect!.x + 170, rect!.y + 170);
  await page.mouse.down();
  await page.mouse.move(rect!.x + 270, rect!.y + 230);
  await page.mouse.up();
  await expect(page.getByLabel('Ancho', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  await expect(page.getByAltText('Previsualización de exportación')).toBeVisible();
  const d = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar archivo', exact: true }).click();
  expect((await d).suggestedFilename()).toMatch(/\.svg$/);
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});
