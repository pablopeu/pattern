/** Headless proof artifacts only; not the app's pending representation/export UI. */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const directory = '.runtime/hyperbolic-proof';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:4173');
  const rows = await page.evaluate(async () => {
    const { regularHyperbolicPatch, hyperbolicCellPath, sourceEmbedding } = await import(
      '/src/hyperbolic/disk.ts'
    );
    const { projectCubic } = await import('/src/hyperbolic/project.ts');
    const { apply } = await import('/src/geometry/matrix.ts');
    const rows = [];
    // Original, simple fish silhouette. Fill contours only: strokes need outlining
    // before a nonlinear map; this diagnostic does not pretend to implement that.
    const source = [
      [
        { x: -3, y: 0 },
        { x: -1, y: -2 },
        { x: 1, y: -2 },
        { x: 3, y: 0 },
      ],
      [
        { x: 3, y: 0 },
        { x: 1, y: 2 },
        { x: -1, y: 2 },
        { x: -3, y: 0 },
      ],
      [
        { x: -3, y: 0 },
        { x: -3.7, y: 0.5 },
        { x: -4.2, y: 1 },
        { x: -4.2, y: 1 },
      ],
      [
        { x: -4.2, y: 1 },
        { x: -4.2, y: 0.33 },
        { x: -4.2, y: -0.33 },
        { x: -4.2, y: -1 },
      ],
      [
        { x: -4.2, y: -1 },
        { x: -3.7, y: -0.5 },
        { x: -3.3, y: -0.2 },
        { x: -3, y: 0 },
      ],
    ];
    for (const [p, q] of [
      [3, 7],
      [7, 3],
      [4, 5],
      [5, 4],
      [8, 3],
      [12, 12],
    ]) {
      const start = performance.now(),
        patch = regularHyperbolicPatch(p, q, { depth: 5, maxCells: 512, radius: 0.97 }),
        embedding = sourceEmbedding(p, q, { x: -4.2, y: -2, width: 7.2, height: 4 }),
        curves = source.map((c) => c.map((v) => apply(embedding.matrix, v))),
        colors = ['#3b82f6', '#f59e0b', '#10b981', '#a855f7'];
      let maximumBound = 0,
        segments = 0;
      const cells = patch.cells.map((c, i) => {
        const points = [];
        for (const curve of curves) {
          const projected = projectCubic(curve, c.frame, 0.0001);
          maximumBound = Math.max(maximumBound, projected.errorBound);
          segments += projected.segments;
          points.push(...projected.points.slice(points.length ? 1 : 0));
        }
        const d = 'M' + points.map((v) => `${v.x * 100} ${v.y * 100}`).join('L') + 'Z';
        return {
          id: c.id,
          center: c.center,
          vertices: c.vertices,
          polygon: hyperbolicCellPath(c.vertices, 100),
          motif: d,
          color: colors[i % colors.length],
        };
      });
      const svg = (body) =>
        `<svg xmlns="http://www.w3.org/2000/svg" width="200mm" height="200mm" viewBox="-100 -100 200 200">${body}</svg>`;
      rows.push({
        p,
        q,
        cells,
        limited: patch.limited,
        area: patch.area,
        maximumBound,
        segments,
        milliseconds: performance.now() - start,
        structure: svg(cells.map((c) => `<path d="${c.polygon}" fill="${c.color}"/>`).join('')),
        motif: svg(cells.map((c) => `<path d="${c.motif}" fill="${c.color}"/>`).join('')),
      });
    }
    return rows;
  });
  for (const row of rows) {
    const prefix = `${directory}/${row.p}-${row.q}`;
    await writeFile(prefix + '-structure.svg', row.structure);
    await writeFile(prefix + '-motif.svg', row.motif);
    const { structure, motif, ...data } = row;
    await writeFile(prefix + '.json', JSON.stringify(data, null, 2) + '\n');
    console.log(
      `{${row.p},${row.q}}: ${row.cells.length} cells, ${row.segments} motif segments, certified <=${(row.maximumBound * 100).toFixed(6)}mm, ${row.milliseconds.toFixed(1)}ms (includes serialization)`,
    );
  }
} finally {
  await browser.close();
}
