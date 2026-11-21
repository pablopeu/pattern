/** Actual finite scene → worker → physical SVG → browser raster, no project writes. */
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:4173');
  const result = await page.evaluate(async () => {
    const { newProject, geometry } = await import('/src/app/model.ts'),
      { deriveProjectDiskInWorker } = await import('/src/hyperbolic/worker-client.ts'),
      { diskPreviewSVG } = await import('/src/hyperbolic/representation.ts'),
      { prepareFlatDiskSource } = await import('/src/hyperbolic/flat-source.ts'),
      { apply } = await import('/src/geometry/matrix.ts');
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
        pathData: 'M20 0H40V20H20Z M25 5H35V15H25Z',
        fill: '#3b82f6',
        fillRule: 'evenodd',
        stroke: '#111111',
        strokeWidth: 0.6,
      },
    ];
    const saved = JSON.stringify(project),
      selection = { target: 'tile' },
      settings = { p: 7, q: 3, radiusMm: 100, toleranceMm: 0.005, depth: 2, maxCells: 40 },
      disk = await deriveProjectDiskInWorker(project, pat.id, selection, settings),
      prepared = prepareFlatDiskSource(project, pat.id, selection, 7, 3),
      svg = diskPreviewSVG(disk),
      image = new Image();
    image.src = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    try {
      await image.decode();
    } finally {
      URL.revokeObjectURL(image.src);
    }
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 2000;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, 2000, 2000);
    const pixel = (x, y) => {
        const p = apply(prepared.source.embedding.matrix, { x, y });
        return [
          ...ctx.getImageData(Math.round((p.x + 1) * 1000), Math.round((p.y + 1) * 1000), 1, 1)
            .data,
        ];
      },
      hole = pixel(10, 10),
      blue = pixel(3, 10),
      boundary = pixel(5.1, 10);
    if (
      hole[3] !== 0 ||
      blue.join(',') !== '59,130,246,255' ||
      boundary.join(',') !== '17,17,17,255'
    )
      throw Error(JSON.stringify({ hole, blue, boundary }));
    if (saved !== JSON.stringify(project)) throw Error('Source mutated');
    return {
      svg,
      png: canvas.toDataURL('image/png').split(',')[1],
      report: {
        cells: disk.cells.length,
        sourcePaints: disk.flatSource.paints,
        sourceUnchanged: true,
        hole,
        blue,
        boundary,
        projectionBoundMm: disk.report.numeric.curveProjectionBoundMm,
        uncertifiedClipping: disk.report.numeric.hasUncertifiedClippingStep,
        uncertifiedOutlining: disk.report.numeric.hasUncertifiedOutlineStep,
      },
    };
  });
  await writeFile('.runtime/flat-source-proof.svg', result.svg);
  await writeFile('.runtime/flat-source-proof.png', Buffer.from(result.png, 'base64'));
  console.log(JSON.stringify(result.report));
} finally {
  await browser.close();
}
