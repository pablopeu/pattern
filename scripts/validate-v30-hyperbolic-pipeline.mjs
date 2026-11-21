/** End-to-end headless compositor proof; not the still-pending app export route. */
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:4173');
  const rows = await page.evaluate(async () => {
    const { deriveDisk, diskPreviewSVG } = await import('/src/hyperbolic/representation.ts'),
      { geometry, node } = await import('/src/app/model.ts'),
      { regularHyperbolicPatch, diskPoint } = await import('/src/hyperbolic/disk.ts'),
      { apply } = await import('/src/geometry/matrix.ts');
    const shapes = [
        {
          ...geometry('compound', [], true),
          id: 'hole<&"',
          pathData: 'M-5 -5H5V5H-5Z M-2 -2H2V2H-2Z',
          fill: '#3b82f6',
          stroke: 'none',
          fillRule: 'evenodd',
        },
        {
          ...geometry('path', [node(-5, 8), node(5, 8)], false),
          fill: '#ff0000',
          stroke: '#e83e8c',
          strokeWidth: 1,
          strokeProfile: {
            version: 1,
            kind: 'custom',
            points: [
              { at: 0, width: 0.2 },
              { at: 1, width: 1.8 },
            ],
          },
        },
      ],
      saved = JSON.stringify(shapes),
      rows = [];
    for (const [name, view] of [
      ['pipeline-center', { center: { x: 0, y: 0 }, angle: 0 }],
      ['pipeline-moved', { center: { x: 0.8, y: 0.1 }, angle: 0.7 }],
    ]) {
      const settings = {
          p: 7,
          q: 3,
          radiusMm: 100,
          toleranceMm: 0.005,
          depth: 3,
          maxCells: 100,
          maxSegments: 150000,
          view,
        },
        disk = deriveDisk(shapes, settings),
        patch = regularHyperbolicPatch(7, 3, settings),
        frame = patch.cells[0].display.frame;
      const samples = [
        { point: { x: 0, y: 0 }, color: null },
        { point: { x: 4, y: 0 }, color: '#3b82f6' },
        { point: { x: 0, y: 8 }, color: '#e83e8c' },
        { point: { x: -4, y: 8.4 }, color: null },
        { point: { x: 4, y: 8.4 }, color: '#e83e8c' },
      ].map((s) => ({
        ...s,
        point: diskPoint(frame, apply(disk.report.source.embedding.matrix, s.point)),
      }));
      if (saved !== JSON.stringify(shapes)) throw Error('Source changed');
      rows.push({
        name,
        svg: diskPreviewSVG(disk),
        report: disk.report,
        samples,
        segments: disk.report.resources.segments,
        curveProjectionBoundMm: disk.report.numeric.curveProjectionBoundMm,
        hasUncertifiedOutlineStep: disk.report.numeric.hasUncertifiedOutlineStep,
      });
    }
    return rows;
  });
  for (const { name, svg, ...data } of rows) {
    await writeFile(`.runtime/hyperbolic-source-proof/${name}.svg`, svg);
    await writeFile(
      `.runtime/hyperbolic-source-proof/${name}.json`,
      JSON.stringify(data, null, 2) + '\n',
    );
    console.log(name, data.report.resources);
  }
} finally {
  await browser.close();
}
