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

test('v2.1 estático: logo local, teselas curvas y worker sin Internet', async ({
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
  const logo = page.getByAltText('PEU Patterns');
  await expect(logo).toBeVisible();
  await expect
    .poll(() =>
      logo.evaluate(
        (el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0,
      ),
    )
    .toBe(true);
  await page.getByRole('button', { name: 'Línea', exact: true }).click();
  const points = await page.locator('.studio-canvas').evaluate((svg) =>
    [new DOMPoint(20, 20), new DOMPoint(35, 30)].map((p) => {
      const q = p.matrixTransform((svg as SVGSVGElement).getScreenCTM()!);
      return { x: q.x, y: q.y };
    }),
  );
  await page.mouse.move(points[0].x, points[0].y);
  await page.mouse.down();
  await page.mouse.move(points[1].x, points[1].y, { steps: 4 });
  await page.mouse.up();
  await page.locator('.tile-panel>summary').click();
  await page.getByLabel('Usar teselas geométricas', { exact: true }).check();
  await page.getByLabel('Forma de tesela', { exact: true }).selectOption('hexagon');
  await page.getByLabel('Editar bordes de tesela', { exact: true }).check();
  await page.getByLabel('Desvío del borde', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Simetría p4m', exact: true }).click();
  await page
    .getByRole('button', { name: 'Mostrar/Ocultar estructura de simetría', exact: true })
    .click();
  await expect(page.locator('[data-tiled-pattern]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  const preview = page.getByAltText('Previsualización de exportación');
  await expect(preview).toBeVisible();
  const svg = decodeURIComponent((await preview.getAttribute('src'))!);
  expect(svg).toContain('clipPath');
  expect(svg).not.toContain('data-symmetry-structure');
  expect(svg).not.toContain('data-tile-outline');
  await page.getByLabel('Exportar contornos de teselas', { exact: true }).check();
  await expect
    .poll(async () => decodeURIComponent((await preview.getAttribute('src')) ?? ''))
    .toContain('data-tile-outline');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar archivo', exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/\.svg$/);
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});
