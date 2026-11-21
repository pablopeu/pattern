import { test, expect, type Page } from '@playwright/test';
async function model(page: Page) {
  await expect(page.locator('.save-indicator')).toHaveText(/Guardado local/);
  return page.evaluate(async () => (await import('/src/persistence/storage.ts')).recover());
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
async function dragNode(page: Page, index: number, x: number, y: number) {
  const rect = (await page.getByLabel(`Nodo ${index}`, { exact: true }).boundingBox())!,
    p = await screen(page, x, y);
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down();
  await page.mouse.move(p.x, p.y, { steps: 6 });
  await page.mouse.up();
  await model(page);
}
async function setup(page: Page) {
  await page.goto('/');
  await model(page);
  const raw = await page.evaluate(async () => {
    const { newProject, geometry, node } = await import('/src/app/model.ts');
    const p = newProject();
    p.preferences.snap = false;
    p.preferences.snapNodes = true;
    p.preferences.grid = false;
    p.preferences.guides = false;
    p.preferences.structureVisible = false;
    const curve = geometry('path', [node(2, 2), node(2, 22)]);
    curve.nodes[0].out = { x: 10, y: 0 };
    curve.nodes[1].in = { x: 10, y: 0 };
    p.patterns[0].sourceGeometry = [
      geometry('path', [node(0, 0), node(12, 0)]),
      geometry('path', [node(0, 24), node(12, 24)]),
      curve,
    ];
    return p;
  });
  await page.locator('input[type=file][accept=".json,application/json"]').setInputFiles({
    name: 'Uniones.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(raw)),
  });
  await model(page);
  await page.getByRole('button', { name: 'Ajustar contenido', exact: true }).click();
  return raw;
}
test('Bézier: unir ambos extremos, mover, recuperar, undo y separar snap conservan el otro vínculo', async ({
  page,
}) => {
  await setup(page);
  await page.getByRole('button', { name: 'Editar nodos', exact: true }).click();
  const middle = await screen(page, 9.5, 12);
  await page.mouse.click(middle.x, middle.y);
  await dragNode(page, 1, 0.15, 0.15);
  const first = (await model(page))!.patterns[0].sourceGeometry[2].nodes[0].junction!.id;
  await dragNode(page, 2, 0.15, 24.15);
  let p = (await model(page))!,
    [a, b, c] = p.patterns[0].sourceGeometry;
  expect(c.nodes[0].junction!.id).toBe(first);
  expect(c.nodes[0].junction!.id).toBe(a.nodes[0].junction!.id);
  expect(c.nodes[1].junction!.id).toBe(b.nodes[0].junction!.id);
  await dragNode(page, 1, 3, -4);
  p = (await model(page))!;
  [a, b, c] = p.patterns[0].sourceGeometry;
  expect(a.nodes[0].x).toBe(c.nodes[0].x);
  expect(a.nodes[0].y).toBe(c.nodes[0].y);
  expect(b.nodes[0]).toMatchObject({ x: 0, y: 24 });
  await page.reload();
  await model(page);
  await page.getByRole('button', { name: 'Editar nodos', exact: true }).click();
  const mid = await screen(page, (a.nodes[0].x + 12) / 2, a.nodes[0].y / 2);
  await page.mouse.click(mid.x, mid.y);
  await dragNode(page, 1, 4, -6);
  p = (await model(page))!;
  [a, b, c] = p.patterns[0].sourceGeometry;
  expect(a.nodes[0].x).toBe(c.nodes[0].x);
  expect(a.nodes[0].junction!.id).toBe(first);
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  expect((await model(page))!.patterns[0].sourceGeometry[0].nodes[0].y).toBeCloseTo(-4, 4);
  await page.getByRole('button', { name: 'Rehacer', exact: true }).click();
  const end = await screen(page, 4, -6);
  await page.mouse.click(end.x, end.y, { button: 'right' });
  await page.getByRole('menuitem', { name: 'Separar snap', exact: true }).click();
  p = (await model(page))!;
  c = p.patterns[0].sourceGeometry[2];
  expect(c.nodes[0].junction).toBeUndefined();
  expect(c.nodes[1].junction).toBeDefined();
  await dragNode(page, 1, 4.2, -5.8);
  const separated = (await model(page))!.patterns[0].sourceGeometry;
  expect(separated[0].nodes[0].x).toBeCloseTo(4, 4);
  expect(separated[2].nodes[0].x).toBeCloseTo(4.2, 4);
  expect(separated[2].nodes[1].junction).toBeDefined();
});

for (const tool of ['Línea', 'Pluma Bézier'])
  test(`${tool}: uniones permanentes al dibujar ambos extremos`, async ({ page }) => {
    await setup(page);
    await page.getByRole('button', { name: tool, exact: true }).click();
    const a = await screen(page, 12.1, 0.1),
      b = await screen(page, 12.1, 24.1);
    if (tool === 'Línea') {
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      await page.mouse.move(b.x, b.y, { steps: 5 });
      await page.mouse.up();
    } else {
      await page.mouse.click(a.x, a.y);
      await page.mouse.click(b.x, b.y);
      await page.mouse.click(b.x + 10, b.y, { button: 'right' });
    }
    const objects = (await model(page))!.patterns[0].sourceGeometry;
    expect(objects).toHaveLength(4);
    expect(objects[3].nodes[0].junction!.id).toBe(objects[0].nodes[1].junction!.id);
    expect(objects[3].nodes.at(-1)!.junction!.id).toBe(objects[1].nodes[1].junction!.id);
  });
for (const width of [1440, 390])
  test(`clic derecho termina Bézier; menú añade y borra nodos ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await setup(page);
    const before = (await model(page))!.patterns[0].sourceGeometry[2],
      mid = await screen(page, 9.5, 12);
    await page.mouse.click(mid.x, mid.y, { button: 'right' });
    await expect(page.getByRole('menu', { name: 'Edición rápida' })).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: `.runtime/context-menu-${width}.png` });
    await page.getByRole('menuitem', { name: 'Añadir nodo aquí', exact: true }).click();
    let c = (await model(page))!.patterns[0].sourceGeometry[2];
    expect(c.nodes).toHaveLength(3);
    const inserted = await screen(page, c.nodes[1].x, c.nodes[1].y);
    expect(Math.hypot(inserted.x - mid.x, inserted.y - mid.y)).toBeLessThan(1.5);
    await page.mouse.click(mid.x, mid.y, { button: 'right' });
    await page.getByRole('menuitem', { name: 'Eliminar nodo', exact: true }).click();
    c = (await model(page))!.patterns[0].sourceGeometry[2];
    expect(c.nodes).toHaveLength(before.nodes.length);
    await page.getByRole('button', { name: 'Pluma Bézier', exact: true }).click();
    if (width === 390)
      await page.getByRole('button', { name: 'Cerrar panel izquierdo', exact: true }).click();
    for (const [x, y] of [
      [-10, 0],
      [-8, 12],
    ]) {
      const q = await screen(page, x, y);
      await page.mouse.click(q.x, q.y);
    }
    const q = await screen(page, -6, 15);
    await page.mouse.click(q.x, q.y, { button: 'right' });
    const shapes = (await model(page))!.patterns[0].sourceGeometry;
    expect(shapes).toHaveLength(4);
    expect(shapes[3].nodes).toHaveLength(2);
    await expect(page.getByRole('menu', { name: 'Edición rápida' })).toHaveCount(0);
  });
