import { readFile } from 'node:fs/promises';
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

test('v2.2 estático: panel derecho, Fill vectorial, perfiles/preset y workers sin Internet', async ({
  page,
  baseURL,
}) => {
  const errors: string[] = [],
    external: string[] = [];
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
  const saved = () => expect(page.locator('.save-indicator')).toHaveText(/Guardado local/);
  await saved();
  await page.getByRole('button', { name: 'Abrir panel de estilos' }).click();
  let panel = page.getByRole('complementary', { name: 'Panel de estilos' });
  await panel.getByLabel('HEX de trazo', { exact: true }).fill('#1848a0');
  await panel.getByLabel('Grosor de trazo', { exact: true }).fill('1.2');
  await panel.getByLabel('HEX de relleno', { exact: true }).fill('#df3646');
  await page.getByRole('button', { name: 'Cerrar panel de estilos' }).click();
  await saved();
  const point = (x: number, y: number) =>
    page.locator('.studio-canvas').evaluate(
      (el, p) => {
        const q = new DOMPoint(p.x, p.y).matrixTransform((el as SVGSVGElement).getScreenCTM()!);
        return { x: q.x, y: q.y };
      },
      { x, y },
    );
  const line = async (a: number[], b: number[]) => {
    const p = await point(a[0], a[1]),
      q = await point(b[0], b[1]);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move(q.x, q.y, { steps: 3 });
    await page.mouse.up();
  };
  await page.getByRole('button', { name: 'Línea', exact: true }).click();
  for (const [a, b] of [
    [
      [-15, -10],
      [15, -10],
    ],
    [
      [15, -10],
      [15, 10],
    ],
    [
      [15, 10],
      [-15, 10],
    ],
    [
      [-15, 10],
      [-15, -10],
    ],
  ])
    await line(a, b);
  await saved();
  await page.getByRole('button', { name: 'Rellenar región', exact: true }).click();
  const center = await point(0, 0);
  await page.mouse.move(center.x, center.y);
  await expect(page.locator('[data-fill-preview]')).toBeVisible();
  await page.mouse.click(center.x, center.y);
  await page.mouse.move(2, 2);
  await expect(page.locator('.fill-actions')).toHaveAttribute('data-fill-applied', '1');
  await saved();
  await expect(page.locator('.statusbar')).toContainText('5 objetos fuente');
  const red = await page.locator('.studio-canvas').evaluate(async (el) => {
    const svg = el as SVGSVGElement,
      copy = svg.cloneNode(true) as SVGSVGElement,
      b = svg.getBoundingClientRect();
    copy.querySelectorAll('[data-fill-preview],[data-editing-handles]').forEach((e) => e.remove());
    copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    copy.setAttribute('width', String(b.width));
    copy.setAttribute('height', String(b.height));
    const img = new Image();
    img.src =
      'data:image/svg+xml,' + encodeURIComponent(new XMLSerializer().serializeToString(copy));
    await img.decode();
    const c = document.createElement('canvas');
    c.width = Math.ceil(b.width);
    c.height = Math.ceil(b.height);
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const p = new DOMPoint(0, 0).matrixTransform(svg.getScreenCTM()!);
    const v = ctx.getImageData(Math.floor(p.x - b.x), Math.floor(p.y - b.y), 1, 1).data;
    return v[0] > 180 && v[1] < 120 && v[2] < 120;
  });
  expect(red).toBe(true);
  await page.getByRole('button', { name: 'Abrir panel de estilos' }).click();
  panel = page.getByRole('complementary', { name: 'Panel de estilos' });
  await panel.getByLabel('Editar estilo de').selectOption('current');
  await panel.getByLabel('Grosor de trazo', { exact: true }).fill('2');
  await panel.getByLabel('Estilo de línea', { exact: true }).selectOption('dashed');
  await panel.getByLabel('Perfil de grosor', { exact: true }).selectOption('taper-both');
  await panel.getByRole('button', { name: 'Sin relleno', exact: true }).click();
  await panel.getByLabel('Nombre del preset de estilo').fill('Producción');
  await panel.getByRole('button', { name: 'Guardar nuevo', exact: true }).click();
  await page.getByRole('button', { name: 'Cerrar panel de estilos' }).click();
  await saved();
  await page.getByRole('button', { name: 'Línea', exact: true }).click();
  await line([-20, 25], [20, 25]);
  await saved();
  let downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Guardar proyecto', exact: true }).click();
  let file = await downloaded;
  const project = JSON.parse(await readFile((await file.path())!, 'utf8'));
  expect(project.schemaVersion).toBe(4);
  expect(project.patterns[0].sourceGeometry).toHaveLength(6);
  expect(project.patterns[0].sourceGeometry.filter((g: any) => g.fillRegion)).toHaveLength(1);
  expect(project.patterns[0].sourceGeometry.at(-1).strokeProfile.kind).toBe('taper-both');
  expect(project.stylePresets[0].name).toBe('Producción');
  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  const preview = page.getByAltText('Previsualización de exportación');
  await expect(preview).toBeVisible();
  const text = decodeURIComponent((await preview.getAttribute('src'))!);
  expect(text).toContain('#df3646');
  expect(text).toContain('#1848a0');
  expect(text).not.toContain('data-stroke-error');
  downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar archivo', exact: true }).click();
  file = await downloaded;
  expect(file.suggestedFilename()).toMatch(/\.svg$/);
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});
