/** Produce artifacts for independent CairoSVG/Pillow/ezdxf validation. */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('http://127.0.0.1:4173');
const files = await page.evaluate(async () => {
  const { example } = await import('/src/app/examples.ts');
  const { prepareExport } = await import('/src/export/svg.ts');
  const { exportDXF } = await import('/src/export/dxf.ts');
  const { rasterize } = await import('/src/export/raster.ts');
  const p = example(6),
    options = {
      target: 'application',
      format: 'svg',
      representation: 'expanded',
      width: 100,
      height: 100,
      dpi: 200,
      background: '#ffffff',
      transparent: true,
      quality: 0.9,
      tolerance: 0.02,
      outlineStrokes: true,
      patternId: p.patterns[0].id,
      applicationId: p.applications[0].id,
    };
  const result = prepareExport(p, options);
  const encode = async (blob) => {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (const v of bytes) binary += String.fromCharCode(v);
    return btoa(binary);
  };
  const { newProject, geometry } = await import('/src/app/model.ts');
  const { newTiling, constrainTiling } = await import('/src/tiling/tiles.ts');
  const tileProject = newProject(),
    pat = tileProject.patterns[0];
  pat.tiling = newTiling('hexagon');
  pat.tiling.width = 40;
  pat.tiling.origin = { x: 5, y: -7 };
  pat.tiling.edges[0][1].y = 0.025;
  pat.tiling.edges[0][1].in = { x: -0.08, y: -0.01 };
  pat.tiling.edges[0][1].out = { x: 0.08, y: 0.01 };
  pat.tiling = constrainTiling(pat.tiling);
  const shape = geometry('rectangle', [], true);
  shape.fill = '#55765b';
  shape.parameters = { x: 7, y: 8, width: 20, height: 14, radius: 2, sides: 4 };
  pat.sourceGeometry = [shape];
  const tileOptions = {
      ...options,
      target: 'view',
      width: 100,
      height: 80,
      patternId: pat.id,
      applicationId: undefined,
      representation: 'editable',
    },
    tileEditable = prepareExport(tileProject, tileOptions),
    tileExpanded = prepareExport(tileProject, {
      ...tileOptions,
      representation: 'expanded',
      includeTileOutlines: true,
    });
  return {
    tileEditable: tileEditable.svg,
    tileExpanded: tileExpanded.svg,
    tileDXF: exportDXF(tileExpanded.geometries, 0.02),
    tilePNG: await encode(
      await rasterize(tileEditable.svg, 100, 80, 200, 'png', 0.9, '#ffffff', true),
    ),
    svg: result.svg,
    dxf: exportDXF(result.geometries, 0.02),
    png: await encode(
      await rasterize(
        result.svg,
        result.bounds.width,
        result.bounds.height,
        200,
        'png',
        0.9,
        '#ffffff',
        true,
      ),
    ),
    jpeg: await encode(
      await rasterize(
        result.svg,
        result.bounds.width,
        result.bounds.height,
        200,
        'jpeg',
        0.9,
        '#ffffff',
        false,
      ),
    ),
    bounds: result.bounds,
  };
});
await mkdir('.runtime/exports', { recursive: true });
for (const type of ['svg', 'dxf', 'png', 'jpeg'])
  await writeFile(
    '.runtime/exports/applied.' + type,
    ['png', 'jpeg'].includes(type) ? Buffer.from(files[type], 'base64') : files[type],
  );
await writeFile('.runtime/exports/expected.json', JSON.stringify(files.bounds));
await writeFile('.runtime/exports/tile-editable.svg', files.tileEditable);
await writeFile('.runtime/exports/tile-expanded.svg', files.tileExpanded);
await writeFile('.runtime/exports/tile.dxf', files.tileDXF);
await writeFile('.runtime/exports/tile.png', Buffer.from(files.tilePNG, 'base64'));
await browser.close();
console.log('Artifacts in .runtime/exports');
await import('./validate-v22-exports.mjs');
