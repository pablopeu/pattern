import { chromium } from '@playwright/test';
import { writeFile, mkdir } from 'node:fs/promises';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(process.env.BENCH_URL || 'http://127.0.0.1:4173');
await page.locator('.save-indicator').filter({ hasText: 'Guardado local' }).waitFor();
const project = await page.evaluate(async () => {
  const { newProject, geometry, node } = await import('/src/app/model.ts');
  const p = newProject();
  p.metadata.name = 'Benchmark overlay · 100 fuentes';
  p.mainSymmetry = { ...p.mainSymmetry, family: 'wallpaper', group: 'p6m', angle: 90 };
  p.preferences.grid = false;
  p.preferences.guides = false;
  for (let i = 0; i < 100; i++) {
    const x = 2 + (i % 10),
      y = 3 + Math.floor(i / 10);
    const g = geometry('path', [
      node(x, y),
      { ...node(x + 0.8, y + 0.6), in: { x: -0.4, y: 0.2 } },
    ]);
    g.strokeWidth = 0.12;
    p.patterns[0].sourceGeometry.push(g);
  }
  return p;
});
await page.locator('input[type=file][accept=".json,application/json"]').setInputFiles({
  name: 'benchmark-structure.json',
  mimeType: 'application/json',
  buffer: Buffer.from(JSON.stringify(project)),
});
await page.locator('.save-indicator').filter({ hasText: 'Guardado local' }).waitFor();
await page.getByRole('button', { name: 'Abrir Simetrías', exact: true }).click();
await page.waitForFunction(
  () =>
    Number(document.querySelector('.symmetry-gallery')?.getAttribute('data-preview-revision')) >=
      1 &&
    document.querySelector('.symmetry-gallery')?.getAttribute('data-preview-pending') === 'false' &&
    document.querySelector('.symmetry-gallery')?.getAttribute('data-preview-completed') === '27',
);
const statistics = (values) => {
  values.sort((a, b) => a - b);
  return {
    samples: values.length,
    medianMs: values[Math.floor(values.length / 2)],
    p95Ms: values[Math.floor(values.length * 0.95)],
  };
};
const pan = {};
for (const enabled of [false, true]) {
  if (enabled) {
    const old = await page.locator('.symmetry-gallery').getAttribute('data-preview-revision');
    await page
      .getByRole('button', { name: 'Mostrar/Ocultar estructura de simetría', exact: true })
      .click();
    await page.waitForFunction(
      (old) =>
        document.querySelector('.symmetry-gallery')?.getAttribute('data-preview-revision') !==
          old &&
        document.querySelector('.symmetry-gallery')?.getAttribute('data-preview-pending') ===
          'false' &&
        document.querySelector('.symmetry-gallery')?.getAttribute('data-preview-completed') ===
          '27',
      old,
    );
  }
  const svg = page.locator('.studio-canvas'),
    box = await svg.boundingBox(),
    x = box.x + box.width * 0.55,
    y = box.y + box.height * 0.4,
    times = [];
  await page.mouse.move(x, y);
  await page.mouse.down({ button: 'middle' });
  for (let i = 0; i < 30; i++) {
    const start = performance.now();
    await page.mouse.move(x + i * 2, y + Math.sin(i / 5) * 5);
    await page.evaluate(() => new Promise(requestAnimationFrame));
    if (i >= 5) times.push(performance.now() - start);
  }
  await page.mouse.up({ button: 'middle' });
  pan[enabled ? 'on' : 'off'] = statistics(times);
}
const geometry = await page.evaluate(async () => {
  const { symmetryStructure } = await import('/src/symmetry/structure.ts');
  const { wallpaperNames } = await import('/src/symmetry/groups.ts');
  const { newPattern } = await import('/src/app/model.ts');
  const box = document.querySelector('.studio-canvas').viewBox.baseVal,
    view = { x: box.x, y: box.y, width: box.width, height: box.height },
    rows = [];
  for (const group of wallpaperNames) {
    const s = {
        ...newPattern().symmetry,
        family: 'wallpaper',
        group,
        width: 60,
        height: 60,
        angle: 90,
      },
      times = [];
    let data;
    for (let i = 0; i < 25; i++) {
      const start = performance.now();
      data = symmetryStructure(s, view);
      if (i >= 5) times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    rows.push({
      group,
      medianMs: times[10],
      p95Ms: times[19],
      axes: data.axes.length,
      centers: data.centers.length,
      domainEdges: data.domain.length,
      limited: data.limited,
    });
  }
  return { view, groups: rows };
});
const report = {
  date: new Date().toISOString(),
  environment:
    'Chromium headless 1440x900, isolated browser; 100 sources, local dev server. Pan samples include Playwright protocol plus a frame, not renderer FPS.',
  pan,
  geometry,
};
await mkdir('.runtime', { recursive: true });
await writeFile('.runtime/benchmark-structure.json', JSON.stringify(report, null, 2) + '\n');
await page.screenshot({ path: '.runtime/v21-overlay.png' });
console.log(JSON.stringify(report, null, 2));
await browser.close();
