/** Independent-parser artifacts for Girih vector bands and crossing gaps. */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const directory = '.runtime/girih-exports';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:4173');
  const rows = await page.evaluate(async () => {
    const { girihExamples } = await import('/src/examples/girih.ts');
    const { prepareExport } = await import('/src/export/svg.ts');
    const { rasterize } = await import('/src/export/raster.ts');
    const { exportDXF } = await import('/src/export/dxf.ts');
    const { girihDefinition } = await import('/src/girih/model.ts'),
      { girihStrands, solveWeave } = await import('/src/girih/weave.ts'),
      { apply, multiply, rotate, scale } = await import('/src/geometry/matrix.ts');
    const encode = async (blob) => {
      let binary = '';
      for (const b of new Uint8Array(await blob.arrayBuffer())) binary += String.fromCharCode(b);
      return btoa(binary);
    };
    const result = [];
    for (const entry of girihExamples) {
      const p = entry.create(),
        pattern = p.patterns[0],
        type = entry.id;
      const options = {
          patternId: pattern.id,
          target: 'view',
          format: 'svg',
          representation: 'editable',
          width: 240,
          height: 240,
          dpi: 96,
          background: '#ffffff',
          transparent: true,
          quality: 0.95,
          tolerance: 0.02,
          outlineStrokes: true,
        },
        editable = prepareExport(p, options),
        expanded = prepareExport(p, { ...options, representation: 'expanded' });
      result.push({
        type,
        editable: editable.svg,
        expanded: expanded.svg,
        dxf: exportDXF(expanded.geometries, 0.02),
        png: await encode(
          await rasterize(editable.svg, 240, 240, 96, 'png', 0.95, '#ffffff', true),
        ),
        jpeg: await encode(
          await rasterize(editable.svg, 240, 240, 96, 'jpeg', 0.95, '#ffffff', false),
        ),
        source: JSON.stringify(p),
        geometries: expanded.geometries.length,
        interior: pattern.sourceGeometry.length,
        samples: (() => {
          const g = pattern.generator,
            frame = multiply(rotate(g.rotation), scale(g.spacing)),
            strands = girihStrands(girihDefinition(g).tiles).map((s) => ({
              ...s,
              points: s.points.map((p) => apply(frame, p)),
            })),
            weave = solveWeave(strands, g.girih.phase);
          return weave.crossings.slice(0, 5).map((c) => {
            const over = c.incidences.find((i) => i.over),
              under = c.incidences.find((i) => !i.over),
              u = under.arms[0],
              v = over.arms[0],
              sin = Math.abs(u.x * v.y - u.y * v.x),
              offset = (g.girih.bandWidth / 2 + g.girih.gap * 0.65) / sin;
            return {
              point: c.point,
              color: g.girih.palette[over.strand % g.girih.palette.length],
              gap: { x: c.point.x + u.x * offset, y: c.point.y + u.y * offset },
            };
          });
        })(),
      });
    }
    return result;
  });
  for (const row of rows) {
    for (const mode of ['editable', 'expanded'])
      await writeFile(`${directory}/${row.type}-${mode}.svg`, row[mode]);
    await writeFile(`${directory}/${row.type}.dxf`, row.dxf);
    await writeFile(
      `${directory}/${row.type}-crossings.json`,
      JSON.stringify(row.samples, null, 2) + '\n',
    );
    await writeFile(`${directory}/${row.type}.json`, row.source + '\n');
    for (const mode of ['png', 'jpeg'])
      await writeFile(`${directory}/${row.type}.${mode}`, Buffer.from(row[mode], 'base64'));
    console.log(`${row.type}: ${row.interior} source objects; ${row.geometries} expanded contours`);
  }
} finally {
  await browser.close();
}
