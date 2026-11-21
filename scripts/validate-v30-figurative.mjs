/** Independent-parser artifacts for original figurative examples. */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const directory = '.runtime/figurative-exports';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:4173');
  const rows = await page.evaluate(async () => {
    const { figurativeExamples } = await import('/src/examples/figurative.ts');
    const { prepareExport } = await import('/src/export/svg.ts');
    const { rasterize } = await import('/src/export/raster.ts');
    const { exportDXF } = await import('/src/export/dxf.ts');
    const { tileFrame, tilePaintBasis } = await import('/src/tiling/tiles.ts');
    const { multiply } = await import('/src/geometry/matrix.ts');
    const encode = async (blob) => {
      let binary = '';
      for (const b of new Uint8Array(await blob.arrayBuffer())) binary += String.fromCharCode(b);
      return btoa(binary);
    };
    const result = [];
    for (const entry of figurativeExamples) {
      const p = entry.create(),
        pattern = p.patterns[0],
        type = entry.id;
      const options = {
          patternId: pattern.id,
          target: 'view',
          format: 'svg',
          representation: 'editable',
          width: 180,
          height: 140,
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
        lattice: prepareExport(p, { ...options, target: 'lattice' }).svg,
        paintBasis: multiply(tileFrame(pattern.tiling), tilePaintBasis(pattern.tiling)),
        dxf: exportDXF(expanded.geometries, 0.02),
        png: await encode(
          await rasterize(editable.svg, 180, 140, 96, 'png', 0.95, '#ffffff', true),
        ),
        jpeg: await encode(
          await rasterize(editable.svg, 180, 140, 96, 'jpeg', 0.95, '#ffffff', false),
        ),
        source: JSON.stringify(p),
        geometries: expanded.geometries.length,
        interior: pattern.sourceGeometry.length,
      });
    }
    return result;
  });
  for (const row of rows) {
    for (const mode of ['editable', 'expanded', 'lattice'])
      await writeFile(`${directory}/${row.type}-${mode}.svg`, row[mode]);
    await writeFile(`${directory}/${row.type}-basis.json`, JSON.stringify(row.paintBasis));
    await writeFile(`${directory}/${row.type}.dxf`, row.dxf);
    await writeFile(`${directory}/${row.type}.json`, row.source + '\n');
    for (const mode of ['png', 'jpeg'])
      await writeFile(`${directory}/${row.type}.${mode}`, Buffer.from(row[mode], 'base64'));
    console.log(`${row.type}: ${row.interior} source objects; ${row.geometries} expanded contours`);
  }
} finally {
  await browser.close();
}
