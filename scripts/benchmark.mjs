/** Reproducible browser benchmark. Run against the development server. */
import { chromium } from '@playwright/test';
import { writeFile, mkdir } from 'node:fs/promises';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(process.env.BENCH_URL || 'http://127.0.0.1:4173');
await page.waitForFunction(() =>
  document.querySelector('.save-indicator')?.textContent?.includes('Guardado local'),
);
const data = await page.evaluate(async () => {
  const { geometry, node, newProject, uid } = await import('/src/app/model.ts');
  const { buildScene } = await import('/src/patterns/engine.ts');
  const p = newProject();
  p.metadata.name = 'Benchmark · 100 fuentes / 300 celdas';
  const pat = p.patterns[0];
  pat.symmetryMode = 'own';
  pat.symmetry = {
    ...pat.symmetry,
    family: 'wallpaper',
    group: 'p4m',
    width: 60,
    height: 60,
    angle: 90,
  };
  pat.generator = { ...pat.generator, kind: 'warp', rows: 2, columns: 2, scale: 0.2, spacing: 15 };
  for (let i = 0; i < 100; i++) {
    const x = (i % 10) * 1.5 + 2,
      y = Math.floor(i / 10) * 1.5 + 2;
    const g = geometry('path', [node(x, y), { ...node(x + 0.7, y + 1), in: { x: -0.5, y: 0 } }]);
    g.strokeWidth = 0.12;
    pat.sourceGeometry.push(g);
  }
  const regionShape = geometry(
    'path',
    [{ ...node(-70, -50), out: { x: 80, y: -35 } }, node(90, 0), node(45, 80), node(-80, 35)],
    true,
  );
  const region = { id: uid(), name: 'Región irregular', geometry: [regionShape] };
  p.regions = [region];
  p.applications = [
    {
      id: uid(),
      name: 'Aplicación benchmark',
      patternId: pat.id,
      regionId: region.id,
      placementTransform: [1, 0, 0, 1, 0, 0],
      linked: true,
      showOutline: true,
    },
  ];
  const bounds = { x: 0, y: 0, width: 1200, height: 900 },
    times = [];
  for (let i = 0; i < 65; i++) {
    pat.sourceGeometry[0].nodes[0].x = 2 + i / 100;
    pat.generator.amplitude = 3 + i / 10;
    const t = performance.now();
    const scene = buildScene(pat, bounds);
    if (i >= 5) times.push(performance.now() - t);
    if (i === 64) {
      const cells = new Set(scene.instances.map((x) => x.cell.join(':'))).size;
      times.sort((a, b) => a - b);
      return {
        project: p,
        core: {
          sourceObjects: 100,
          visibleCells: cells,
          instances: scene.instances.length,
          motifPlacements: scene.generated.placements.length,
          iterations: times.length,
          medianMs: times[Math.floor(times.length / 2)],
          p95Ms: times[Math.floor(times.length * 0.95)],
        },
      };
    }
  }
});
await page.locator('input[type=file][accept=".json,application/json"]').setInputFiles({
  name: 'benchmark.json',
  mimeType: 'application/json',
  buffer: Buffer.from(JSON.stringify(data.project)),
});
await page.getByRole('button', { name: 'Mostrar grilla', exact: true }).click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: 'Abrir Simetrías', exact: true }).click();
await page.getByRole('tab', { name: 'Generador', exact: true }).click();
while (!(await page.getByLabel('Amplitud deslizador', { exact: true }).isVisible()))
  await page.getByRole('button', { name: 'Más parámetros', exact: true }).click();
// Drive an actual slider through repeated input events while measuring presented frames.
const ui = await page.evaluate(async () => {
  const slider = document.querySelector('input[aria-label="Amplitud deslizador"]');
  if (!slider) throw Error('No se encontró el slider de amplitud');
  const frames = [],
    start = performance.now();
  let previous = start;
  for (let i = 0; i < 40; i++) {
    const value = 3 + (i % 20) / 4;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(
      slider,
      String(value),
    );
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    slider.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(requestAnimationFrame);
    const now = performance.now();
    if (i > 4) frames.push(now - previous);
    previous = now;
  }
  frames.sort((a, b) => a - b);
  return {
    sampledFrames: frames.length,
    medianFrameMs: frames[Math.floor(frames.length / 2)],
    p95FrameMs: frames[Math.floor(frames.length * 0.95)],
    elapsedMs: performance.now() - start,
    visibleUseElements: document.querySelectorAll('.studio-canvas use').length,
  };
});
await page.getByRole('tab', { name: 'Grupo y red', exact: true }).click();
await page.getByRole('button', { name: 'Explorar todas las simetrías · 27' }).click();
// Measure committed group changes through React and two animation frames, without hover.
const groupChanges = await page.evaluate(async () => {
  const samples = [];
  for (const group of ['pm', 'p4', 'p6', 'p4m', 'pm', 'p4', 'p6', 'p4m']) {
    const start = performance.now();
    document.querySelector(`[data-symmetry-id="wallpaper:${group}"]`).click();
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    samples.push(performance.now() - start);
  }
  return {
    samplesMs: samples,
    medianMs: [...samples].sort((a, b) => a - b)[Math.floor(samples.length / 2)],
  };
});
const gallery = page.locator('.dynamic-symmetry-grid');
await page.waitForFunction(
  () =>
    document.querySelector('.dynamic-symmetry-grid')?.getAttribute('data-preview-completed') ===
      '27' &&
    document.querySelector('.dynamic-symmetry-grid')?.getAttribute('data-preview-pending') ===
      'false',
);
const thumbnails = {
  completed: Number(await gallery.getAttribute('data-preview-completed')),
  elapsedIncludingScheduledYieldsMs: Number(await gallery.getAttribute('data-preview-ms')),
};
await page.getByRole('button', { name: 'Cerrar catálogo', exact: true }).click();
await page.getByRole('button', { name: 'Abrir Capas', exact: true }).click();
await page.getByRole('tab', { name: /^Capas/ }).click();
await page.locator('.layer-name').last().click();
await page.getByRole('button', { name: 'Editar nodos', exact: true }).click();
const handle = await page.getByLabel('Nodo 1', { exact: true }).boundingBox();
const nodeFrames = [];
if (handle) {
  const x = handle.x + handle.width / 2,
    y = handle.y + handle.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 0; i < 30; i++) {
    const start = performance.now();
    await page.mouse.move(x + (i % 15) * 0.8, y + Math.sin(i / 5) * 3);
    await page.evaluate(() => new Promise(requestAnimationFrame));
    if (i >= 5) nodeFrames.push(performance.now() - start);
  }
  await page.mouse.up();
}
nodeFrames.sort((a, b) => a - b);
const nodeDrag = {
  sampledFrames: nodeFrames.length,
  medianFrameMs: nodeFrames[Math.floor(nodeFrames.length / 2)],
  p95FrameMs: nodeFrames[Math.floor(nodeFrames.length * 0.95)],
};
const report = {
  date: new Date().toISOString(),
  environment:
    'Chromium headless, 1920×1080, local machine; results are reference measurements, not universal guarantees',
  core: data.core,
  ui,
  nodeDrag,
  groupChanges,
  thumbnails,
};
await mkdir('.runtime', { recursive: true });
await writeFile('.runtime/benchmark.json', JSON.stringify(report, null, 2) + '\n');
await page.screenshot({ path: '.runtime/benchmark.png' });
console.log(JSON.stringify(report, null, 2));
await browser.close();
