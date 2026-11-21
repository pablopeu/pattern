/** Real worker and raster with source holes, open pressure stroke and finite repeats. */
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:4173');
  const result = await page.evaluate(async () => {
    const { newProject, geometry, node } = await import('/src/app/model.ts'),
      { deriveArtisticDiskInWorker } = await import('/src/artistic/worker-client.ts'),
      { artisticDiskSVG } = await import('/src/artistic/disk.ts');
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
      {
        ...geometry('compound', [], true),
        pathData: 'M2 2H18V18H2Z M7 7H13V13H7Z',
        fill: '#3b82f6',
        stroke: '#111111',
        strokeWidth: 0.6,
        fillRule: 'evenodd',
      },
      {
        ...geometry('path', [node(4, 16), node(16, 16)]),
        fill: '#ff0000',
        stroke: '#ff00ff',
        strokeWidth: 2,
        strokeProfile: {
          version: 1,
          kind: 'custom',
          points: [
            { at: 0, width: 0.2 },
            { at: 1, width: 1 },
          ],
        },
      },
    ];
    const saved = JSON.stringify(project),
      selection = { target: 'view', bounds: { x: -60, y: -60, width: 120, height: 120 } },
      settings = {
        compression: 8,
        angle: 0.2,
        center: { x: 0.1, y: -0.1 },
        radiusMm: 100,
        toleranceMm: 0.005,
      },
      timer = setInterval(() => ticks++, 1);
    let ticks = 0,
      disk;
    try {
      disk = await deriveArtisticDiskInWorker(project, pat.id, selection, settings);
    } finally {
      clearInterval(timer);
    }
    if (
      !ticks ||
      saved !== JSON.stringify(project) ||
      disk.report.validity !== 'ARTISTIC' ||
      disk.report.hyperbolicTessellation
    )
      throw Error('Worker blocked UI or changed source/validity');
    for (const mode of ['pre', 'active']) {
      const abort = new AbortController();
      if (mode === 'pre') abort.abort();
      const job = deriveArtisticDiskInWorker(
        project,
        pat.id,
        selection,
        { ...settings, compression: 64, toleranceMm: 0.001, maxSegments: 1000000 },
        abort.signal,
      );
      if (mode === 'active') setTimeout(() => abort.abort(), 30);
      try {
        await job;
        throw Error('Artistic worker did not abort');
      } catch (error) {
        if (error.name !== 'AbortError') throw error;
      }
    }
    const recovered = await deriveArtisticDiskInWorker(project, pat.id, selection, settings);
    if (recovered.report.resources.segments !== disk.report.resources.segments)
      throw Error('Recovery changed deterministic output');
    const svg = artisticDiskSVG(disk),
      image = new Image();
    image.src = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    try {
      await image.decode();
    } finally {
      URL.revokeObjectURL(image.src);
    }
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 2048;
    canvas.getContext('2d').drawImage(image, 0, 0, 2048, 2048);
    return {
      svg,
      png: canvas.toDataURL('image/png').split(',')[1],
      report: disk.report,
      responsivenessTicks: ticks,
      sourceUnchanged: true,
      preAbort: true,
      activeAbort: true,
      recovery: true,
    };
  });
  await writeFile('.runtime/artistic-disk-proof.svg', result.svg);
  await writeFile('.runtime/artistic-disk-proof.png', Buffer.from(result.png, 'base64'));
  const { svg, png, ...report } = result;
  await writeFile('.runtime/artistic-disk-proof.json', JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify({
      paints: result.report.resources.paints,
      segments: result.report.resources.segments,
      boundMm: result.report.numeric.curveProjectionBoundMm,
      ticks: result.responsivenessTicks,
      sourceUnchanged: true,
      cancelAndRecover: true,
    }),
  );
} finally {
  await browser.close();
}
