/** Independent-parser artifacts for all12 marked IH constructions. */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const directory = '.runtime/isohedral-exports';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:4173');
  const rows = await page.evaluate(async () => {
    const { markedIsohedralTypes, newIsohedral, isohedralLayout } = await import(
      '/src/isohedral/engine.ts'
    );
    const { newIsohedralTiling } = await import('/src/tiling/tiles.ts');
    const { newProject, geometry, node } = await import('/src/app/model.ts');
    const { createTileFill } = await import('/src/fill/service.ts');
    const { drawingStyle } = await import('/src/app/styles.ts');
    const { prepareExport } = await import('/src/export/svg.ts');
    const { rasterize } = await import('/src/export/raster.ts');
    const { exportDXF } = await import('/src/export/dxf.ts');
    const encode = async (blob) => {
      let binary = '';
      for (const b of new Uint8Array(await blob.arrayBuffer())) binary += String.fromCharCode(b);
      return btoa(binary);
    };
    const result = [];
    for (const type of markedIsohedralTypes) {
      const p = newProject(),
        pattern = p.patterns[0],
        layout = isohedralLayout(newIsohedral(type)),
        center = {
          x: layout.vertices.reduce((s, p) => s + p.x, 0) / layout.vertices.length,
          y: layout.vertices.reduce((s, p) => s + p.y, 0) / layout.vertices.length,
        },
        radius =
          0.65 *
          Math.min(
            ...layout.vertices.map((a, i) => {
              const b = layout.vertices[(i + 1) % layout.vertices.length];
              return (
                Math.abs((b.x - a.x) * (center.y - a.y) - (b.y - a.y) * (center.x - a.x)) /
                Math.hypot(b.x - a.x, b.y - a.y)
              );
            }),
          );
      const arrow = geometry(
        'path',
        [
          [0.17, 0.11],
          [0.78, 0.16],
          [0.42, 0.53],
        ].map(([x, y]) => node(center.x + x * radius, center.y + y * radius)),
        true,
      );
      arrow.fill = '#ad563b';
      arrow.stroke = '#253f37';
      arrow.strokeWidth = 0.4;
      pattern.sourceGeometry = [arrow];
      pattern.tiling = newIsohedralTiling(type);
      pattern.sourceGeometry.unshift(
        createTileFill(
          p,
          pattern,
          {
            kind: 'tile',
            key: 'tile',
            pathData: '',
            patternId: pattern.id,
            matrix: [1, 0, 0, 1, 0, 0],
            z: 0,
          },
          drawingStyle({ fill: '#dfc995' }),
        ),
      );
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
        dxf: exportDXF(expanded.geometries, 0.02),
        png: await encode(
          await rasterize(editable.svg, 180, 140, 96, 'png', 0.95, '#ffffff', true),
        ),
        jpeg: await encode(
          await rasterize(editable.svg, 180, 140, 96, 'jpeg', 0.95, '#ffffff', false),
        ),
        source: JSON.stringify(p),
        geometries: expanded.geometries.length,
        interior: layout.motifSymmetries.length,
      });
    }
    return result;
  });
  for (const row of rows) {
    for (const mode of ['editable', 'expanded'])
      await writeFile(`${directory}/IH${row.type}-${mode}.svg`, row[mode]);
    await writeFile(`${directory}/IH${row.type}.dxf`, row.dxf);
    await writeFile(`${directory}/IH${row.type}.json`, row.source + '\n');
    for (const mode of ['png', 'jpeg'])
      await writeFile(`${directory}/IH${row.type}.${mode}`, Buffer.from(row[mode], 'base64'));
    console.log(
      `IH${row.type}: ${row.interior} interior operations; ${row.geometries} expanded contours`,
    );
  }
} finally {
  await browser.close();
}
