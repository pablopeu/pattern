/** Isolated worker benchmark: one arrangement build, repeated cached queries, bounded failure. */
import { chromium } from '@playwright/test';
import { writeFile, mkdir } from 'node:fs/promises';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:4173');
  await page.locator('.save-indicator').filter({ hasText: 'Guardado local' }).waitFor();
  const results = await page.evaluate(async () => {
    const { newProject, geometry, node } = await import('/src/app/model.ts'),
      { buildScene } = await import('/src/patterns/engine.ts'),
      { resolvePattern } = await import('/src/symmetry/config.ts');
    const quantile = (values, q) =>
      [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * q))];
    const run = async (curved) => {
      const p = newProject(),
        raw = p.patterns[0];
      p.mainSymmetry = {
        ...p.mainSymmetry,
        family: 'wallpaper',
        group: 'p1',
        width: 30,
        height: 24,
      };
      raw.sourceGeometry = curved
        ? ['M0 0C10 -3 20 3 30 0', 'M0 0C-3 8 3 16 0 24'].map((pathData) => ({
            ...geometry('compound'),
            pathData,
          }))
        : [
            geometry('path', [node(0, 0), node(30, 0)]),
            geometry('path', [node(0, 0), node(0, 24)]),
          ];
      const pattern = resolvePattern(raw, p),
        bounds = { x: -60, y: -48, width: 150, height: 120 },
        scene = buildScene(pattern, bounds),
        worker = new Worker('/src/fill/worker.ts', { type: 'module' }),
        frameGaps = [],
        times = [];
      let readyCount = 0,
        previous = performance.now(),
        active = true;
      const frame = (t) => {
        frameGaps.push(t - previous);
        previous = t;
        if (active) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
      worker.addEventListener('message', (e) => {
        if (e.data.type === 'ready') readyCount++;
      });
      const request = (message, type) =>
        new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
              worker.removeEventListener('message', handler);
              reject(Error('Worker timeout'));
            }, 15000),
            handler = (e) => {
              if (e.data.type !== 'error' && e.data.type !== type) return;
              clearTimeout(timer);
              worker.removeEventListener('message', handler);
              if (e.data.type === 'error') reject(Error(e.data.message));
              else resolve(e.data);
            };
          worker.addEventListener('message', handler);
          worker.postMessage(message);
        });
      try {
        const start = performance.now(),
          ready = await request(
            { type: 'build', layers: [{ pattern, scene }], bounds, tolerance: 0 },
            'ready',
          ),
          buildMs = performance.now() - start;
        for (let i = 0; i < 60; i++) {
          const t = performance.now(),
            result = await request(
              {
                type: 'query',
                point: { x: 5 + ((i % 3) - 1) * 30, y: 5 + ((Math.floor(i / 3) % 3) - 1) * 24 },
                id: i,
              },
              'preview',
            );
          if (!result.candidates.length) throw Error('Query without actual face');
          times.push(performance.now() - t);
        }
        await new Promise((resolve) => {
          let count = 0;
          const frame = () => (++count >= 8 ? resolve() : requestAnimationFrame(frame));
          requestAnimationFrame(frame);
        });
        active = false;
        if (readyCount !== 1) throw Error('Hover rebuilt the arrangement');
        return {
          case: curved ? 'curved-grid' : 'line-grid',
          curves: ready.curves,
          faces: ready.faces,
          buildMs,
          queryMedianMs: quantile(times, 0.5),
          queryP95Ms: quantile(times, 0.95),
          readyMessages: readyCount,
          frameMedianMs: quantile(frameGaps, 0.5),
          frameMaxMs: Math.max(...frameGaps),
        };
      } finally {
        active = false;
        worker.terminate();
      }
    };
    const reports = [await run(false), await run(true)];
    const p = newProject(),
      raw = p.patterns[0];
    raw.sourceGeometry = Array.from({ length: 1201 }, (_, i) =>
      geometry('path', [node(i, 0), node(i, 1)]),
    );
    const bounds = { x: -1, y: -1, width: 1204, height: 4 },
      pattern = resolvePattern(raw, p),
      scene = buildScene(pattern, bounds),
      worker = new Worker('/src/fill/worker.ts', { type: 'module' }),
      start = performance.now();
    try {
      const message = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(Error('Limit timeout')), 15000);
        worker.onmessage = (e) => {
          if (e.data.type === 'error') {
            clearTimeout(timer);
            resolve(e.data.message);
          }
        };
        worker.postMessage({ type: 'build', layers: [{ pattern, scene }], bounds, tolerance: 0 });
      });
      if (!/1200/.test(message)) throw Error('Missing explicit geometry limit');
      reports.push({ case: 'explicit-limit', message, elapsedMs: performance.now() - start });
    } finally {
      worker.terminate();
    }
    return reports;
  });
  await mkdir('.runtime', { recursive: true });
  await writeFile('.runtime/benchmark-fill.json', JSON.stringify(results, null, 2));
  for (const result of results) console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
