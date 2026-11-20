import { context, styles, catalog, symmetry, field } from './navigation';
import { test, expect, type Page } from '@playwright/test';
async function saved(page: Page) {
  await expect(page.locator('.save-indicator')).toHaveText(/Guardado local/);
}
async function setup(page: Page, objects = false) {
  await page.goto('/');
  await saved(page);
  await page.evaluate(async (objects) => {
    const { newProject, geometry, node } = await import('/src/app/model.ts');
    const { autosave } = await import('/src/persistence/storage.ts');
    const p = newProject();
    p.preferences.snap = false;
    p.preferences.grid = false;
    if (objects)
      p.patterns[0].sourceGeometry = [
        { ...geometry('path', [node(0, 0), node(40, 0)]), stroke: '#ff0000', strokeWidth: 1 },
        { ...geometry('path', [node(0, 30), node(40, 30)]), stroke: '#0000ff', strokeWidth: 3 },
      ];
    await autosave(p);
  }, objects);
  await page.reload();
  await saved(page);
}
async function model(page: Page) {
  await saved(page);
  return page.evaluate(async () => {
    const { recover } = await import('/src/persistence/storage.ts');
    return (await recover())!;
  });
}
async function screen(page: Page, x: number, y: number) {
  return page.locator('.studio-canvas').evaluate(
    (el, p) => {
      const q = new DOMPoint(p.x, p.y).matrixTransform((el as SVGSVGElement).getScreenCTM()!);
      return { x: q.x, y: q.y };
    },
    { x, y },
  );
}
async function draw(page: Page, x: number, y: number) {
  const a = await screen(page, x, y),
    b = await screen(page, x + 30, y);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await page.mouse.up();
}
const panel = (page: Page) => page.getByRole('complementary', { name: 'Panel de estilos' });
test('v2.2 estilo vigente sin selección, indicador y tinta con ancho variable', async ({
  page,
}) => {
  await setup(page);
  await styles(page, 'Colores');
  const p = panel(page);
  await (await field(page, 'HEX de trazo')).fill('#e02040');
  await (await field(page, 'Grosor de trazo')).fill('4');
  await (await field(page, 'Perfil de grosor')).selectOption('taper-start');
  await (await field(page, 'Estilo de línea')).selectOption('dashed');
  await (await field(page, 'Extremos del trazo')).selectOption('butt');
  await page.getByRole('button', { name: 'Línea', exact: true }).click();
  await draw(page, 0, 0);
  await expect(p).not.toBeVisible();
  const m = await model(page),
    g = m.patterns[0].sourceGeometry[0];
  expect(g.stroke).toBe('#e02040');
  expect(g.strokeWidth).toBe(4);
  expect(g.strokeDash).toEqual([4, 2]);
  expect(g.strokeProfile.kind).toBe('taper-start');
  await expect(page.getByRole('button', { name: 'Abrir panel de estilos' })).toContainText('4 mm');
  const ink = await page.locator('.studio-canvas').evaluate(async (el) => {
    const original = el as SVGSVGElement,
      svg = original.cloneNode(true) as SVGSVGElement;
    svg.querySelectorAll('[data-editing-handles],.selection').forEach((e) => e.remove());
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const box = original.getBoundingClientRect();
    svg.setAttribute('width', String(box.width));
    svg.setAttribute('height', String(box.height));
    const image = new Image();
    image.src =
      'data:image/svg+xml,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
    await image.decode();
    const c = document.createElement('canvas');
    c.width = Math.ceil(box.width);
    c.height = Math.ceil(box.height);
    const ctx = c.getContext('2d')!;
    ctx.drawImage(image, 0, 0);
    const pixel = (x: number, y: number) => {
      const q = new DOMPoint(x, y).matrixTransform(original.getScreenCTM()!);
      return [...ctx.getImageData(Math.floor(q.x - box.x), Math.floor(q.y - box.y), 1, 1).data];
    };
    return { paint: pixel(13, 0.5), gap: pixel(11, 0.5) };
  });
  expect(ink.paint[0]).toBeGreaterThan(180);
  expect(ink.paint[1]).toBeLessThan(80);
  expect(ink.gap[1]).toBeGreaterThan(150);
});
test('v2.2 selección mixta cambia un atributo y respeta política explícita', async ({ page }) => {
  await setup(page, true);
  await page.locator('.studio-canvas').focus();
  await page.keyboard.press('Control+a');
  await styles(page, 'Colores');
  const p = panel(page);
  await expect(p.getByText('Selección mixta.', { exact: false })).toBeVisible();
  await (await field(page, 'Edición de selección actualiza estilo vigente')).uncheck();
  await (await field(page, 'HEX de trazo')).fill('#00aa44');
  await (await field(page, 'Grosor de trazo')).focus();
  let m = await model(page);
  expect(m.patterns[0].sourceGeometry.map((g) => g.stroke)).toEqual(['#00aa44', '#00aa44']);
  expect(m.patterns[0].sourceGeometry.map((g) => g.strokeWidth)).toEqual([1, 3]);
  expect(m.drawingStyle.stroke).toBe('#233b2d');
  await (await field(page, 'Edición de selección actualiza estilo vigente')).check();
  await (await field(page, 'Grosor de trazo')).fill('5');
  await (await field(page, 'Límite de inglete')).focus();
  m = await model(page);
  expect(m.patterns[0].sourceGeometry.map((g) => g.strokeWidth)).toEqual([5, 5]);
  expect(m.drawingStyle.strokeWidth).toBe(5);
  expect(m.drawingStyle.stroke).toBe('#233b2d');
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  m = await model(page);
  expect(m.patterns[0].sourceGeometry.map((g) => g.strokeWidth)).toEqual([1, 3]);
});
test('v2.2 presets por valor, paletas y persistencia', async ({ page }) => {
  await setup(page);
  await styles(page, 'Colores');
  const p = panel(page);
  await (await field(page, 'HEX de trazo')).fill('#12345680');
  await (await field(page, 'Grosor de trazo')).fill('2');
  await (await field(page, 'Nombre del preset de estilo')).fill('Azul fino');
  await p.getByRole('button', { name: 'Guardar nuevo', exact: true }).click();
  await (await field(page, 'Aplicar color de paleta a')).selectOption('stroke');
  await p.getByRole('button', { name: 'Agregar a favoritos', exact: true }).click();
  await (await field(page, 'HEX de trazo')).fill('#abcdef');
  await styles(page, 'Presets');
  await p.getByRole('button', { name: 'Aplicar preset', exact: true }).click();
  let m = await model(page);
  expect(m.drawingStyle.stroke).toBe('#123456');
  expect(m.drawingStyle.strokeOpacity).toBeCloseTo(128 / 255);
  expect(m.palette.favorites).toContain('#123456');
  await page.reload();
  await saved(page);
  await styles(page, 'Colores');
  await (await field(page, 'Preset de estilo')).selectOption({ label: 'Azul fino' });
  await expect(panel(page).getByLabel('Grosor de trazo', { exact: true })).toHaveValue('2');
  m = await model(page);
  expect(m.stylePresets).toHaveLength(1);
});
test('v2.2 panel conserva escala, Escape y selección, pin y pantallas reducidas', async ({
  page,
}) => {
  await setup(page, true);
  const camera = () =>
    page.locator('.studio-canvas').evaluate((el) => {
      const svg = el as SVGSVGElement,
        m = svg.getScreenCTM()!;
      return { a: m.a, d: m.d, x: svg.viewBox.baseVal.x };
    });
  const before = await camera();
  await styles(page, 'Colores');
  await expect(panel(page)).toBeVisible();
  await expect.poll(async () => Math.abs((await camera()).a - before.a)).toBeLessThan(0.0001);
  await page.screenshot({ path: 'test-results/v22-panel-1440.png' });
  await page.getByRole('button', { name: 'Fijar panel de estilos' }).click();
  await page.getByRole('button', { name: 'Seleccionar', exact: true }).click();
  const q = await screen(page, 20, 0);
  await page.mouse.click(q.x, q.y);
  await expect(panel(page)).toBeVisible();
  await page.locator('.studio-canvas').focus();
  await page.keyboard.press('Escape');
  await expect(panel(page)).not.toBeVisible();
  await expect(page.locator('.statusbar')).toContainText('1 seleccionados');
  await styles(page, 'Colores');
  for (const width of [1100, 768]) {
    await page.setViewportSize({ width, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/v22-panel-${width}.png` });
  }
  await page.getByRole('button', { name: 'Cerrar panel de estilos' }).click();
  await page.screenshot({ path: 'test-results/v22-closed-768.png' });
});

test('v2.2 slider y edición visual del perfil generan un undo por gesto', async ({ page }) => {
  await setup(page);
  await styles(page, 'Colores');
  await styles(page, 'Trazo');
  const p = panel(page),
    range = p.getByLabel('Grosor de trazo deslizador');
  await range.scrollIntoViewIfNeeded();
  let b = (await range.boundingBox())!;
  await page.mouse.move(b.x + 10, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.3, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
  const width = (await model(page)).drawingStyle.strokeWidth;
  expect(width).toBeGreaterThan(5);
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  expect((await model(page)).drawingStyle.strokeWidth).toBe(0.65);
  await page.getByRole('button', { name: 'Rehacer', exact: true }).click();
  expect((await model(page)).drawingStyle.strokeWidth).toBe(width);
  await (await field(page, 'Perfil de grosor')).selectOption('custom');
  const control = p.getByRole('slider', { name: 'Control de perfil 1', exact: true });
  await control.scrollIntoViewIfNeeded();
  b = (await control.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 - 7, { steps: 5 });
  await page.mouse.up();
  expect((await model(page)).drawingStyle.strokeProfile.points[0].width).toBeGreaterThan(1.5);
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  expect((await model(page)).drawingStyle.strokeProfile.points[0].width).toBe(1);
});

test('feedback LAN: apariencia exclusivamente a la derecha, acceso desde inspector y autocierre', async ({
  page,
}) => {
  await setup(page, true);
  await page.locator('.studio-canvas').focus();
  await page.keyboard.press('Control+a');
  const left = page.locator('.context-panel');
  await expect(left.getByLabel('Color de trazo', { exact: true })).toHaveCount(0);
  await expect(left.getByLabel('Grosor de trazo', { exact: true })).toHaveCount(0);
  await styles(page, 'Colores');
  await expect(panel(page)).toBeVisible();
  await expect(panel(page).getByLabel('Color de trazo', { exact: true })).toHaveCount(1);
  const rightBox = (await panel(page).boundingBox())!,
    canvasBox = (await page.locator('.drawing-area').boundingBox())!;
  expect(rightBox.x).toBeGreaterThanOrEqual(canvasBox.x + canvasBox.width - 1);
  await page.screenshot({ path: 'test-results/v22-right-only-1440.png' });
  await page.getByRole('button', { name: 'Seleccionar', exact: true }).click();
  const q = await screen(page, 90, 70);
  await page.mouse.click(q.x, q.y);
  await expect(panel(page)).not.toBeVisible();
  await page.setViewportSize({ width: 768, height: 800 });
  const indicator = page.getByRole('button', { name: 'Abrir panel de estilos' });
  await expect(indicator).toBeVisible();
  await expect(indicator.locator('.style-chip').first()).toBeVisible();
  await expect(indicator.getByLabel('Patrón de línea vigente')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/v22-right-only-closed-768.png' });
});

test('trazo excesivo muestra aviso corregible y no desmonta lienzo ni galería', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await setup(page);
  await page.evaluate(async () => {
    const { newProject, geometry, node } = await import('/src/app/model.ts');
    const { profile } = await import('/src/app/styles.ts');
    const { autosave } = await import('/src/persistence/storage.ts');
    const p = newProject();
    p.patterns[0].sourceGeometry = [
      {
        ...geometry('path', [node(0, 0), node(100, 0)]),
        strokeDash: [0.01, 0.01],
        strokeProfile: profile('taper-start'),
      },
    ];
    await autosave(p);
  });
  await page.reload();
  await saved(page);
  await expect(page.getByRole('alert')).toContainText('Eje provisional en naranja');
  await expect(page.locator('.studio-canvas')).toBeVisible();
  await context(page, 'Simetrías');
  await expect(page.locator('.symmetry-gallery')).toBeVisible();
  await page.getByRole('button', { name: 'Corregir trazo', exact: true }).click();
  await expect(panel(page).getByRole('tab', { name: 'Trazo', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await (await field(page, 'Estilo de línea')).selectOption('solid');
  await expect(page.getByRole('alert')).not.toBeVisible();
  expect((await model(page)).patterns[0].sourceGeometry[0].strokeDash).toEqual([]);
  expect(errors).toEqual([]);
});

test('Pluma mantiene borrador y coordenadas al cerrar estilos con Escape desde un input', async ({
  page,
}) => {
  await setup(page);
  await page.getByRole('button', { name: 'Pluma Bézier', exact: true }).click();
  let q = await screen(page, 0, 0);
  await page.mouse.click(q.x, q.y);
  await styles(page, 'Colores');
  await (await field(page, 'Grosor de trazo')).fill('2');
  await page.keyboard.press('Escape');
  await expect(panel(page)).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Pluma Bézier', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  q = await screen(page, 30, 10);
  await page.mouse.click(q.x, q.y);
  await page.keyboard.press('Enter');
  const g = (await model(page)).patterns[0].sourceGeometry[0];
  expect(g.nodes).toHaveLength(2);
  expect(g.nodes[0].x).toBeCloseTo(0);
  expect(g.nodes[0].y).toBeCloseTo(0);
  expect(g.nodes[1].x).toBeCloseTo(30);
  expect(g.nodes[1].y).toBeCloseTo(10);
  expect(g.strokeWidth).toBe(0.65);
  expect((await model(page)).drawingStyle.strokeWidth).toBe(2);
  q = await screen(page, 50, 0);
  await page.mouse.click(q.x, q.y);
  q = await screen(page, 70, 10);
  await page.mouse.click(q.x, q.y);
  await page.keyboard.press('Enter');
  expect((await model(page)).patterns[0].sourceGeometry[1].strokeWidth).toBe(2);
});
test('indicador permanece visible y accionable con panel superpuesto a768px', async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 768, height: 800 });
  await styles(page, 'Colores');
  const indicator = panel(page).getByRole('button', { name: 'Abrir panel de estilos' });
  await expect(indicator).toBeVisible();
  await expect(indicator.locator('.style-chip').first()).toBeVisible();
  await expect(indicator.getByLabel('Patrón de línea vigente')).toBeVisible();
  await page.screenshot({ path: 'test-results/v22-indicator-open-768.png' });
  await indicator.click();
  await expect(panel(page)).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Abrir panel de estilos' })).toBeVisible();
});
