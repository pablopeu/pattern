/** Diagnostic only: native source contours, holes and variable stroke under a nonlinear map. */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const directory = '.runtime/hyperbolic-source-proof';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:4173');
  const rows = await page.evaluate(async () => {
    const { geometry, node } = await import('/src/app/model.ts'),
      { prepareDiskSource, projectDiskSource } = await import('/src/hyperbolic/source.ts'),
      { diskPoint } = await import('/src/hyperbolic/disk.ts'),
      { apply } = await import('/src/geometry/matrix.ts'),
      iso = await import('/src/vendor/poincare/iso.ts'),
      { makeTiling } = await import('/src/vendor/poincare/tiling.ts');
    const ring = {
        ...geometry('compound', [], true),
        pathData: 'M-5 -5H5V5H-5Z M-2 -2H2V2H-2Z',
        fill: '#3b82f6',
        stroke: 'none',
        fillRule: 'evenodd',
      },
      line = {
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
      shapes = [ring, line],
      saved = JSON.stringify(shapes),
      source = prepareDiskSource(shapes, 7, 3),
      rows = [];
    for (const [name, frame] of [
      ['identity', iso.IDENTITY],
      ['peripheral', iso.translation(0.8, 0.1)],
      ['reflected', makeTiling(7, 3).mirrors[2]],
    ]) {
      const r = projectDiskSource(source, frame, 100, 0.005),
        paths = r.contours
          .map(
            (c) =>
              `<path d="${c.paths.map((path) => 'M' + path.map((v) => `${v.x} ${v.y}`).join('L') + 'Z').join('')}" fill="${c.color}" fill-rule="${c.fillRule}" opacity="${c.opacity}"/>`,
          )
          .join(''),
        samples = [
          { point: { x: 0, y: 0 }, color: null },
          { point: { x: 4, y: 0 }, color: '#3b82f6' },
          { point: { x: 0, y: 8 }, color: '#e83e8c' },
          { point: { x: -4, y: 8.4 }, color: null },
          { point: { x: 4, y: 8.4 }, color: '#e83e8c' },
        ].map((s) => ({ ...s, point: diskPoint(frame, apply(source.embedding.matrix, s.point)) }));
      if (saved !== JSON.stringify(shapes)) throw Error('Canonical source changed');
      if (r.contours.some((c) => c.color === '#ff0000')) throw Error('Open path filled');
      rows.push({
        name,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="200mm" height="200mm" viewBox="-100 -100 200 200">${paths}</svg>`,
        samples,
        curveProjectionBoundMm: r.curveProjectionBoundMm,
        outlineEstimateMm: r.outlineToleranceMappedEstimateMm,
        hasUncertifiedOutlineStep: r.hasUncertifiedOutlineStep,
        segments: r.segments,
      });
    }
    return rows;
  });
  for (const { name, svg, ...data } of rows) {
    await writeFile(`${directory}/${name}.svg`, svg);
    await writeFile(`${directory}/${name}.json`, JSON.stringify(data, null, 2) + '\n');
    console.log(name, data);
  }
} finally {
  await browser.close();
}
