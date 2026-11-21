/** Real Chromium module workers: responsiveness, completion, errors and cancellation. */
import { chromium } from '@playwright/test';
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:4173');
  const result = await page.evaluate(async () => {
    const { deriveDiskInWorker, deriveProjectDiskInWorker } = await import(
        '/src/hyperbolic/worker-client.ts'
      ),
      { geometry, newProject } = await import('/src/app/model.ts');
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
    const project = newProject(),
      pat = project.patterns[0];
    project.mainSymmetry = {
      ...project.mainSymmetry,
      family: 'wallpaper',
      group: 'p1',
      width: 20,
      height: 20,
    };
    pat.sourceGeometry = [
      { ...shapes[0], pathData: 'M22 2H26V6H22Z', stroke: '#111111', strokeWidth: 0.5 },
    ];
    const projectBefore = JSON.stringify(project),
      prepared = await deriveProjectDiskInWorker(project, pat.id, { target: 'tile' }, settings);
    if (
      JSON.stringify(project) !== projectBefore ||
      prepared.flatSource.target !== 'tile' ||
      !prepared.report.numeric.hasUncertifiedClippingStep ||
      !prepared.report.numeric.hasUncertifiedOutlineStep ||
      !prepared.report.source.ids.includes(pat.sourceGeometry[0].id)
    )
      throw Error(
        'Project worker lost the finite scene, source identity or preparation provenance',
      );
    const next = await deriveDiskInWorker(shapes, settings);
    if (next.cells.length !== result.cells.length)
      throw Error('Fresh job failed after cancellation');
    return {
      cells: result.cells.length,
      projectCells: prepared.cells.length,
      finiteSourcePaints: prepared.flatSource.paints,
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
