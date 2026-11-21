/** Independent-parser artifacts for finite aperiodic examples. */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const directory = '.runtime/aperiodic-exports';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:4173');
  const rows = await page.evaluate(async () => {
    const { aperiodicExamples } = await import('/src/examples/aperiodic.ts');
    const { prepareExport } = await import('/src/export/svg.ts');
    const { rasterize } = await import('/src/export/raster.ts');
    const { exportDXF } = await import('/src/export/dxf.ts');
    const encode = async (blob) => {
      let binary = '';
      for (const b of new Uint8Array(await blob.arrayBuffer())) binary += String.fromCharCode(b);
      return btoa(binary);
    };
    const result = [];
    for (const entry of aperiodicExamples) {
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
      });
    }
    return result;
  });
  for (const row of rows) {
    for (const mode of ['editable', 'expanded'])
      await writeFile(`${directory}/${row.type}-${mode}.svg`, row[mode]);
    await writeFile(`${directory}/${row.type}.dxf`, row.dxf);
    await writeFile(`${directory}/${row.type}.json`, row.source + '\n');
    for (const mode of ['png', 'jpeg'])
      await writeFile(`${directory}/${row.type}.${mode}`, Buffer.from(row[mode], 'base64'));
    console.log(`${row.type}: ${row.interior} source objects; ${row.geometries} expanded contours`);
  }
} finally {
  await browser.close();
}
