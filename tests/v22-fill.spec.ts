import { test, expect, type Page } from '@playwright/test';
async function saved(page: Page) {
  await expect(page.locator('.save-indicator')).toHaveText(/Guardado local/);
}
async function setup(page: Page, kind = 'lines') {
  await page.goto('/');
  await saved(page);
  await page.evaluate(async (kind) => {
    const { newProject, geometry, node } = await import('/src/app/model.ts');
    const { newTiling } = await import('/src/tiling/tiles.ts');
    const { autosave } = await import('/src/persistence/storage.ts');
    const p = newProject();
    p.preferences.snap = false;
    p.preferences.grid = false;
    p.drawingStyle.fill = '#ed3040';
    const pattern = p.patterns[0];
    if (kind === 'closed')
      pattern.sourceGeometry = [
        {
          ...geometry('compound', [], true),
          pathData: 'M0 0L30 0L30 30L0 30Z M10 10L20 10L20 20L10 20Z',
        },
      ];
    else if (kind === 'tile') pattern.tiling = newTiling('square');
    else if (kind === 'periodic') {
      p.mainSymmetry = {
        ...p.mainSymmetry,
        family: 'wallpaper',
        group: 'p1',
        width: 20,
        height: 20,
      };
      pattern.sourceGeometry = [
        geometry('path', [node(0, 0), node(20, 0)]),
        geometry('path', [node(0, 0), node(0, 20)]),
      ];
    } else
      pattern.sourceGeometry = ['M0 0L30 0', 'M20 0L20 20', 'M30 20L0 20', 'M0 20L0 0'].map(
        (pathData) => ({ ...geometry('compound'), pathData }),
      );
    await autosave(p);
  }, kind);
  await page.reload();
  await saved(page);
  await page.getByRole('button', { name: 'Rellenar región', exact: true }).click();
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
async function paint(page: Page, x: number, y: number) {
  const p = await screen(page, x, y);
  await page.mouse.move(p.x, p.y);
  await expect(page.locator('[data-fill-preview]')).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar relleno', exact: true }).click();
  await saved(page);
}
async function redAt(page: Page, x: number, y: number) {
  return page.locator('.studio-canvas').evaluate(
    async (el, p) => {
      const svg = el as SVGSVGElement,
        copy = svg.cloneNode(true) as SVGSVGElement,
        b = svg.getBoundingClientRect();
      copy
        .querySelectorAll('[data-fill-preview],[data-editing-handles]')
        .forEach((e) => e.remove());
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
      const q = new DOMPoint(p.x, p.y).matrixTransform(svg.getScreenCTM()!);
      const v = [...ctx.getImageData(Math.round(q.x - b.x), Math.round(q.y - b.y), 1, 1).data];
      return v[0] > 180 && v[1] < 90 && v[2] < 110;
    },
    { x, y },
  );
}
test('v2.2 Fill cuatro líneas: preview, tinta real, una fuente, undo y vínculo al editar límite', async ({
  page,
}) => {
  await setup(page);
  await paint(page, 10, 10);
  let p = await model(page);
  expect(p.patterns[0].sourceGeometry).toHaveLength(5);
  expect(p.patterns[0].sourceGeometry[0].fillRegion?.linked).toBe(true);
  expect(await redAt(page, 10, 10)).toBe(true);
  await page.screenshot({ path: 'test-results/v22-fill-lines.png' });
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  expect((await model(page)).patterns[0].sourceGeometry).toHaveLength(4);
  expect(await redAt(page, 10, 10)).toBe(false);
  await page.getByRole('button', { name: 'Rehacer', exact: true }).click();
  await saved(page);
  await page.getByRole('button', { name: 'Seleccionar', exact: true }).click();
  const q = await screen(page, 20, 10);
  await page.mouse.click(q.x, q.y);
  await page.getByLabel('Posición X', { exact: true }).fill('5');
  await page.getByLabel('Posición Y', { exact: true }).focus();
  await expect
    .poll(async () => {
      const p = await model(page);
      return p.patterns[0].sourceGeometry.find((g) => g.fillRegion)?.pathData;
    })
    .toContain('25');
  expect(await redAt(page, 23, 10)).toBe(true);
  p = await model(page);
  expect(p.patterns[0].sourceGeometry.find((g) => g.fillRegion)?.fillRegion?.status).toBe('linked');
});
test('v2.2 Fill path cerrado respeta agujero y recolorea fuente existente', async ({ page }) => {
  await setup(page, 'closed');
  await paint(page, 5, 5);
  expect((await model(page)).patterns[0].sourceGeometry).toHaveLength(1);
  expect(await redAt(page, 5, 5)).toBe(true);
  expect(await redAt(page, 15, 15)).toBe(false);
});
test('v2.2 Fill entre instancias propaga tinta en celdas distintas sin clonar fuentes', async ({
  page,
}) => {
  await setup(page, 'periodic');
  await paint(page, 10, 10);
  const p = await model(page);
  expect(p.patterns[0].sourceGeometry).toHaveLength(3);
  expect(
    new Set(p.patterns[0].sourceGeometry[0].fillRegion?.refs.map((r) => r.matrix.join(','))).size,
  ).toBeGreaterThan(1);
  expect(await redAt(page, 10, 10)).toBe(true);
  expect(await redAt(page, 30, 30)).toBe(true);
  await page.screenshot({ path: 'test-results/v22-fill-periodic.png' });
});
test('v2.2 Fill interior de tesela se ve en copias reales y persiste', async ({ page }) => {
  await setup(page, 'tile');
  await paint(page, 10, 10);
  const p = await model(page);
  expect(p.patterns[0].sourceGeometry).toHaveLength(1);
  expect(p.patterns[0].sourceGeometry[0].fillRegion).toMatchObject({ kind: 'tile', linked: true });
  expect(await redAt(page, 10, 10)).toBe(true);
  expect(await redAt(page, 70, 10)).toBe(true);
  await page.screenshot({ path: 'test-results/v22-fill-tile.png' });
  await page.reload();
  await saved(page);
  expect(await redAt(page, 70, 10)).toBe(true);
});

test('v2.2 Fill confirma con mouse sobre lienzo y autocierra panel sin perder operación', async ({
  page,
}) => {
  await setup(page);
  await page.getByRole('button', { name: 'Abrir panel de estilos' }).click();
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  const q = await screen(page, 10, 10);
  await page.mouse.move(q.x, q.y);
  await expect(page.locator('[data-fill-preview]')).toBeVisible();
  await page.mouse.click(q.x, q.y);
  await saved(page);
  await expect(page.getByRole('complementary', { name: 'Panel de estilos' })).not.toBeVisible();
  expect((await model(page)).patterns[0].sourceGeometry).toHaveLength(5);
  expect(await redAt(page, 10, 10)).toBe(true);
});
