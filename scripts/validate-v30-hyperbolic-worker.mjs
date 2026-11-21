/** Real Chromium module workers: responsiveness, completion, errors and cancellation. */
import { chromium } from '@playwright/test';
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:4173');
  const result = await page.evaluate(async () => {
    const { deriveDiskInWorker } = await import('/src/hyperbolic/worker-client.ts'),
      { geometry } = await import('/src/app/model.ts');
    const shapes = [
        {
          ...geometry('compound', [], true),
          pathData: 'M-5 -5H5V5H-5Z',
          fill: '#3b82f6',
          stroke: 'none',
        },
      ],
      saved = JSON.stringify(shapes),
      settings = { p: 7, q: 3, radiusMm: 100, toleranceMm: 0.005, depth: 3, maxCells: 100 };
    let ticks = 0;
    const interval = setInterval(() => ticks++, 1);
    let result;
    try {
      result = await deriveDiskInWorker(shapes, settings);
    } finally {
      clearInterval(interval);
    }
    if (ticks < 1 || result.cells.length < 8 || saved !== JSON.stringify(shapes))
      throw Error('Worker blocked UI, lost cells or changed source');
    const pre = new AbortController();
    pre.abort();
    for (const mode of ['pre', 'active']) {
      const controller = mode === 'pre' ? pre : new AbortController(),
        job = deriveDiskInWorker(
          shapes,
          { ...settings, depth: 8, maxCells: 4096 },
          controller.signal,
        );
      if (mode === 'active') setTimeout(() => controller.abort(), 50);
      try {
        await job;
        throw Error('Job was not aborted');
      } catch (error) {
        if (error.name !== 'AbortError') throw error;
      }
    }
    try {
      await deriveDiskInWorker(shapes, { ...settings, p: 4, q: 4 });
      throw Error('Invalid model was accepted');
    } catch (error) {
      if (!error.message.includes('Poincaré')) throw error;
    }
    const next = await deriveDiskInWorker(shapes, settings);
    if (next.cells.length !== result.cells.length)
      throw Error('Fresh job failed after cancellation');
    return {
      cells: result.cells.length,
      ticks,
      sourceUnchanged: true,
      preAbort: true,
      activeAbort: true,
      errorRecovery: true,
    };
  });
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
