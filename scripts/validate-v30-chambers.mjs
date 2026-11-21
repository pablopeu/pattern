/** Actual reflection-chamber workers and SVG/raster, including partial alpha seams. */
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:4173');
  for (const kind of ['uniform', 'holes', 'pressure']) {
    const result = await page.evaluate(async (kind) => {
      const { newProject, geometry, node } = await import('/src/app/model.ts'),
        { deriveChamberDiskInWorker } = await import('/src/hyperbolic/chambers-worker-client.ts'),
        { chamberDiskSVG } = await import('/src/hyperbolic/chambers.ts');
      const project = newProject(),
        pat = project.patterns[0];
      pat.sourceGeometry = [
        {
          ...geometry('compound', [], true),
          id: 'body<&"',
          pathData: 'M0 0H100V100H0Z' + (kind === 'holes' ? ' M40 40H60V60H40Z' : ''),
          fill: '#3b82f6',
          stroke: 'none',
          opacity: 0.5,
          fillRule: kind === 'holes' ? 'evenodd' : 'nonzero',
        },
      ];
      if (kind === 'pressure')
        pat.sourceGeometry.push({
          ...geometry('path', [node(20, 80), node(80, 80)]),
          fill: '#ff0000',
          stroke: '#c7337c',
          strokeWidth: 12,
          strokeProfile: {
            version: 1,
            kind: 'custom',
            points: [
              { at: 0, width: 0.2 },
              { at: 1, width: 1 },
            ],
          },
        });
      const saved = JSON.stringify(project),
        settings = {
          p: 7,
          q: 3,
          radiusMm: 100,
          toleranceMm: 0.01,
          depth: 1,
          maxCells: 20,
          debugBoundaries: true,
        },
        selection = { target: 'view', bounds: { x: 0, y: 0, width: 100, height: 100 } };
      let ticks = 0;
      const timer = setInterval(() => ticks++, 1);
      let disk;
      try {
        disk = await deriveChamberDiskInWorker(project, pat.id, selection, settings);
      } finally {
        clearInterval(timer);
      }
      if (!ticks || JSON.stringify(project) !== saved) throw Error('UI blocked or source changed');
      if (disk.report.resources.boundaryCurveCacheHits < 10)
        throw Error('No real shared boundary curves');
      const svg = chamberDiskSVG(disk),
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
      if (kind === 'uniform') {
        const controller = new AbortController(),
          job = deriveChamberDiskInWorker(
            project,
            pat.id,
            selection,
            { ...settings, depth: 8, maxCells: 4096, maxSegments: 1000000 },
            controller.signal,
          );
        setTimeout(() => controller.abort(), 30);
        try {
          await job;
          throw Error('Worker not aborted');
        } catch (error) {
          if (error.name !== 'AbortError') throw error;
        }
        const recovered = await deriveChamberDiskInWorker(project, pat.id, selection, settings);
        if (recovered.report.resources.segments !== disk.report.resources.segments)
          throw Error('Non-deterministic recovery');
      }
      return {
        svg,
        png: canvas.toDataURL('image/png').split(',')[1],
        report: disk.report,
        edges: disk.edges.filter(
          (e) =>
            e.owners.length === 2 &&
            Math.min(
              Math.hypot(e.a.x - e.midpoint.x, e.a.y - e.midpoint.y),
              Math.hypot(e.b.x - e.midpoint.x, e.b.y - e.midpoint.y),
            ) > 0.03,
        ),
        ticks,
        sourceUnchanged: true,
      };
    }, kind);
    await writeFile(`.runtime/chambers-${kind}.svg`, result.svg);
    await writeFile(`.runtime/chambers-${kind}.png`, Buffer.from(result.png, 'base64'));
    const { svg, png, ...metadata } = result;
    await writeFile(`.runtime/chambers-${kind}.json`, JSON.stringify(metadata, null, 2));
    console.log(
      JSON.stringify({
        kind,
        cells: result.report.resources.visible,
        chambers: result.report.resources.chambers,
        segments: result.report.resources.segments,
        boundaryHits: result.report.resources.boundaryCurveCacheHits,
        boundMm: result.report.numeric.curveProjectionBoundMm,
        adjustment: result.report.numeric.canonicalAdjustmentEstimateMm,
        ticks: result.ticks,
      }),
    );
  }
} finally {
  await browser.close();
}
