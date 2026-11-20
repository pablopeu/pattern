import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('docs/images', { recursive: true });
await mkdir('docs/examples', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 960 },
  deviceScaleFactor: 1,
});
page.on('pageerror', (e) => {
  throw e;
});
await page.goto('http://127.0.0.1:4173');
await page.locator('.save-indicator').filter({ hasText: 'Guardado local' }).waitFor();
async function load(kind) {
  await page.evaluate(async (kind) => {
    const { example } = await import('/src/app/examples.ts');
    const { geometry, node, newProject } = await import('/src/app/model.ts');
    const { autosave } = await import('/src/persistence/storage.ts');
    const { newTiling, constrainTiling } = await import('/src/tiling/tiles.ts');
    const p = kind === 'overview' ? example(2) : newProject();
    p.preferences.snap = false;
    p.preferences.grid = false;
    p.preferences.structureVisible = false;
    const pat = p.patterns[0];
    if (kind === 'fill') {
      p.metadata.name = 'Cuatro curvas y un hueco';
      p.mainSymmetry = {
        ...p.mainSymmetry,
        family: 'wallpaper',
        group: 'p1',
        width: 45,
        height: 45,
      };
      p.drawingStyle.fill = '#c67b45';
      p.drawingStyle.stroke = '#284b3b';
      pat.sourceGeometry = [
        'M-15 -15C-5 -20 5 -20 15 -15',
        'M15 -15C20 -5 20 5 15 15',
        'M15 15C5 20 -5 20 -15 15',
        'M-15 15C-20 5 -20 -5 -15 -15',
      ].map((pathData) => ({
        ...geometry('compound'),
        pathData,
        stroke: '#284b3b',
        strokeWidth: 0.7,
      }));
      const hole = geometry('ellipse', [], true);
      hole.parameters = { x: -5, y: -5, width: 10, height: 10, radius: 0, sides: 4 };
      hole.stroke = '#284b3b';
      pat.sourceGeometry.push(hole);
    }
    if (kind === 'tiles') {
      p.metadata.name = 'Teselas hexagonales curvas';
      pat.tiling = newTiling('hexagon');
      pat.tiling.width = 45;
      pat.tiling.edges[0][1].y = 0.09;
      pat.tiling.edges[1][1].y = -0.07;
      pat.tiling.edges[2][1].y = 0.06;
      pat.tiling.edges[0][1].in = { x: -0.1, y: -0.02 };
      pat.tiling.edges[0][1].out = { x: 0.1, y: 0.02 };
      pat.tiling = constrainTiling(pat.tiling);
      p.drawingStyle.fill = '#dfc48d';
      const a = geometry('ellipse', [], true);
      a.parameters = { x: 7, y: 5, width: 12, height: 20, radius: 0, sides: 4 };
      a.fill = '#496e55';
      a.stroke = 'none';
      const b = geometry('path', [node(13, 22), { ...node(13, 8), out: { x: 3, y: 0 } }]);
      b.stroke = '#eef2dd';
      b.strokeWidth = 0.55;
      pat.sourceGeometry = [a, b];
    }
    await autosave(p);
  }, kind);
  await page.reload();
  await page.locator('.save-indicator').filter({ hasText: 'Guardado local' }).waitFor();
}
async function shoot(name) {
  const close = page.getByRole('button', { name: 'Cerrar mensaje' });
  if (await close.count()) await close.click();
  await page.mouse.move(10, 10);
  // Finish the brief panel transition and let saved-state/toast settle.
  await page.waitForTimeout(600);
  await page.screenshot({ path: `docs/images/${name}.png` });
  const project = await page.evaluate(async () => {
    const { recover } = await import('/src/persistence/storage.ts');
    const { serialize, parseProject } = await import('/src/persistence/schema.ts');
    return serialize(parseProject(serialize(await recover())));
  });
  await writeFile(`docs/examples/${name}.json`, project + '\n');
}
async function fillAt(x, y) {
  await page.getByRole('button', { name: 'Rellenar región', exact: true }).click();
  const q = await page.locator('.studio-canvas').evaluate(
    (el, p) => {
      const q = new DOMPoint(p.x, p.y).matrixTransform(el.getScreenCTM());
      return { x: q.x, y: q.y };
    },
    { x, y },
  );
  await page.mouse.click(q.x, q.y);
  await page.locator('.fill-actions[data-fill-applied="1"]').waitFor();
  await page.locator('.save-indicator').filter({ hasText: 'Guardado local' }).waitFor();
}
await load('overview');
await page.getByRole('button', { name: 'Abrir panel de estilos' }).click();
await shoot('studio-symmetry');
await load('fill');
await fillAt(10, 0);
await page.getByRole('button', { name: 'Abrir panel de estilos' }).click();
await shoot('vector-fill');
await load('tiles');
await fillAt(30, 20);
await shoot('curved-tiles');
await browser.close();
console.log('README: 3 screenshots of the running application saved in docs/images/.');
