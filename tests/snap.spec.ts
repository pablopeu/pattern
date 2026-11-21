import { test, expect, type Page } from '@playwright/test';
import { context } from './navigation';

test('Bézier abierta conserva el color elegido pero sólo pinta al cerrarse', async ({ page }) => {
  await page.goto('/');
  const raw = await page.evaluate(async () => {
    const { newProject, geometry, node } = await import('/src/app/model.ts');
    const p = newProject(),
      g = geometry('path', [node(0, 0), node(10, 0)]);
    g.nodes[0].out = { x: 0, y: 10 };
    g.nodes[1].in = { x: 0, y: 10 };
    g.fill = '#ed3040';
    p.patterns[0].sourceGeometry = [g];
    return p;
  });
  for (const closed of [false, true]) {
    raw.patterns[0].sourceGeometry[0].closed = closed;
    await page.locator('input[type=file][accept=".json,application/json"]').setInputFiles({
      name: 'Curva.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(raw)),
    });
    await model(page);
    await expect(
      page.locator('.studio-canvas path[d^="M0 0C0 10 10 10 10 0"]').first(),
    ).toHaveAttribute('fill', closed ? '#ed3040' : 'none');
  }
});

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
test('extremos se atraen al editar; dos regiones comparten un borde sin duplicarlo', async ({
  page,
}) => {
  await page.goto('/');
  await model(page);
  const json = await page.evaluate(async () => {
    const { newProject, geometry, node } = await import('/src/app/model.ts'),
      { serialize } = await import('/src/persistence/schema.ts');
    const p = newProject();
    p.preferences.grid = false;
    p.preferences.guides = false;
    p.preferences.structureVisible = false;
    p.preferences.snap = false;
    p.preferences.snapNodes = true;
    p.drawingStyle.fill = '#ed3040';
    p.patterns[0].sourceGeometry = [
      [
        [0, 0],
        [20, 0],
      ],
      [
        [0, 0],
        [10, -15],
      ],
      [
        [10, -15],
        [18, -2],
      ],
      [
        [20, 0],
        [10, 15],
      ],
      [
        [10, 15],
        [0, 0],
      ],
    ].map((points) => ({
      ...geometry(
        'path',
        points.map(([x, y]) => node(x, y)),
      ),
      fill: 'none',
    }));
    return serialize(p);
  });
  await page.locator('input[type=file][accept=".json,application/json"]').setInputFiles({
    name: 'Borde-compartido.json',
    mimeType: 'application/json',
    buffer: Buffer.from(json),
  });
  await model(page);
  await page.getByRole('button', { name: 'Editar nodos', exact: true }).click();
  const middle = await screen(page, 14, -8.5);
  await page.mouse.click(middle.x, middle.y);
  const end = page.getByLabel('Nodo 2', { exact: true });
  await expect(end).toBeVisible();
  const box = (await end.boundingBox())!,
    target = await screen(page, 20.4, 0.3);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 5 });
  await expect(page.getByLabel('Atracción a nodo', { exact: true })).toBeVisible();
  await page.mouse.up();
  expect((await model(page))!.patterns[0].sourceGeometry[2].nodes[1]).toMatchObject({
    x: 20,
    y: 0,
  });
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  expect((await model(page))!.patterns[0].sourceGeometry[2].nodes[1]).toMatchObject({
    x: 18,
    y: -2,
  });
  await page.getByRole('button', { name: 'Rehacer', exact: true }).click();
  const joined = (await end.boundingBox())!,
    next = await screen(page, 22, 2);
  await page.mouse.move(joined.x + joined.width / 2, joined.y + joined.height / 2);
  await page.mouse.down();
  await page.mouse.move(next.x, next.y, { steps: 5 });
  await page.mouse.up();
  const connected = (await model(page))!.patterns[0].sourceGeometry;
  for (const [shape, index] of [
    [0, 1],
    [2, 1],
    [3, 0],
  ]) {
    expect(connected[shape].nodes[index].x).toBeCloseTo(22, 4);
    expect(connected[shape].nodes[index].y).toBeCloseTo(2, 4);
    expect(connected[shape].nodes[index].x).toBe(connected[2].nodes[1].x);
    expect(connected[shape].nodes[index].y).toBe(connected[2].nodes[1].y);
  }
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  expect((await model(page))!.patterns[0].sourceGeometry[0].nodes[1]).toMatchObject({
    x: 20,
    y: 0,
  });
  await context(page, 'Preferencias');
  await page.getByLabel('Distancia de atracción a nodos', { exact: true }).fill('12');
  expect((await model(page))!.preferences.snapRadiusPx).toBe(12);
  await page.getByRole('button', { name: 'Rellenar región', exact: true }).click();
  for (const y of [-5, 5]) {
    const p = await screen(page, 10, y),
      count = Number(await page.locator('.fill-actions').getAttribute('data-fill-applied'));
    await page.mouse.click(p.x, p.y);
    await expect
      .poll(async () =>
        Number(await page.locator('.fill-actions').getAttribute('data-fill-applied')),
      )
      .toBe(count + 1);
  }
  const shapes = (await model(page))!.patterns[0].sourceGeometry;
  expect(shapes.filter((g) => !g.fillRegion)).toHaveLength(5);
  expect(shapes.filter((g) => g.fillRegion)).toHaveLength(2);
  expect(shapes.filter((g) => !g.fillRegion)[0].nodes.map((n) => [n.x, n.y])).toEqual([
    [0, 0],
    [20, 0],
  ]);
});
