/** Real-browser artifacts; optional --capture updates the README's portable examples. */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const root = '.runtime/v30-exports';
await mkdir(root, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (error) => {
    throw error;
  });
  await page.goto('http://127.0.0.1:4173');
  const result = await page.evaluate(async () => {
    // This is the historical four-composition regression, independent of gallery curation.
    const { exampleCatalog: archive } = await import('/src/examples/archive.ts');
    const ids = ['fish-square', 'birds-quadrants', 'fish-spiral', 'birds-rosette'];
    const exampleCatalog = ids.map((id) => {
      const entry = archive.find((e) => e.id === id);
      if (!entry) throw Error(`Missing historical composition: ${id}`);
      return entry;
    });
    const { prepareExport } = await import('/src/export/svg.ts');
    const { exportDXF } = await import('/src/export/dxf.ts');
    const { rasterize } = await import('/src/export/raster.ts');
    const { serialize, parseProject } = await import('/src/persistence/schema.ts');
    const { buildScene } = await import('/src/patterns/engine.ts');
    const encode = async (blob) => {
      let binary = '';
      for (const v of new Uint8Array(await blob.arrayBuffer())) binary += String.fromCharCode(v);
      return btoa(binary);
    };
    const artifacts = [];
    for (const entry of exampleCatalog.filter((e) => e.featured)) {
      const project = entry.create(),
        pattern = project.patterns[0];
      const options = {
        target: 'view',
        format: 'svg',
        representation: 'editable',
        width: 180,
        height: 180,
        dpi: 120,
        background: project.preferences.background,
        transparent: true,
        quality: 0.95,
        tolerance: 0.02,
        outlineStrokes: true,
        patternId: pattern.id,
      };
      const editable = prepareExport(project, options),
        expanded = prepareExport(project, { ...options, representation: 'expanded' });
      const restored = parseProject(serialize(project));
      const canonical = (v) =>
        Array.isArray(v)
          ? v.map(canonical)
          : v && typeof v === 'object'
            ? Object.fromEntries(
                Object.entries(v)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([k, value]) => [k, canonical(value)]),
              )
            : v;
      if (
        JSON.stringify(canonical(restored.patterns)) !== JSON.stringify(canonical(project.patterns))
      )
        throw Error(`Roundtrip mismatch: ${entry.id}`);
      artifacts.push({
        id: entry.id,
        project: serialize(restored),
        editable: editable.svg,
        expanded: expanded.svg,
        dxf: exportDXF(expanded.geometries, 0.02),
        png: await encode(
          await rasterize(editable.svg, 180, 180, 120, 'png', 0.95, options.background, true),
        ),
        jpeg: await encode(
          await rasterize(editable.svg, 180, 180, 120, 'jpeg', 0.95, options.background, false),
        ),
        bounds: editable.bounds,
        geometryCount: expanded.geometries.length,
        placementCount: buildScene(pattern, editable.bounds).generated.placements.length,
        palette: pattern.composition.palette,
        background: options.background,
      });
    }
    // Maximum supported recursive request: source remains ten canonical objects.
    const project = exampleCatalog[0].create(),
      p = project.patterns[0];
    p.composition.recipe = 'quadrants';
    p.composition.depth = 6;
    p.composition.minSize = 0.02;
    const bounds = { x: -5, y: -5, width: 10, height: 10 },
      timings = [];
    let scene;
    for (let i = 0; i < 25; i++) {
      const start = performance.now();
      scene = buildScene(p, bounds, undefined, 8);
      if (i >= 5) timings.push(performance.now() - start);
    }
    timings.sort((a, b) => a - b);
    const full = buildScene(p, bounds);
    return {
      artifacts,
      measurement: {
        sourceObjects: p.sourceGeometry.length,
        requested: full.generated.placements.length,
        visible: scene.generated.placements.length,
        culled: scene.generated.composition.report.culled,
        nodes: scene.generated.composition.report.nodes.length,
        medianMs: timings[Math.floor(timings.length / 2)],
        p95Ms: timings.at(-1),
        budget: 4096,
        detailPixels: 0.65,
        machineDependent: true,
      },
    };
  });
  for (const row of result.artifacts) {
    for (const kind of ['editable', 'expanded'])
      await writeFile(`${root}/${row.id}-${kind}.svg`, row[kind]);
    await writeFile(`${root}/${row.id}.dxf`, row.dxf);
    await writeFile(`${root}/${row.id}.json`, row.project + '\n');
    for (const kind of ['png', 'jpeg'])
      await writeFile(`${root}/${row.id}.${kind}`, Buffer.from(row[kind], 'base64'));
    delete row.editable;
    delete row.expanded;
    delete row.dxf;
    delete row.png;
    delete row.jpeg;
    delete row.project;
  }
  await writeFile(`${root}/manifest.json`, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result.measurement, null, 2));
  if (process.argv.includes('--capture')) {
    await mkdir('docs/images', { recursive: true });
    await mkdir('docs/examples', { recursive: true });
    await page.locator('.save-indicator').filter({ hasText: 'Guardado local' }).waitFor();
    await page.locator('.main-menu summary').click();
    await page.getByRole('button', { name: 'Galería de ejemplos', exact: true }).click();
    await page.screenshot({ path: 'docs/images/v30-gallery.png' });
    const titles = {
      'fish-square': 'Peces al límite · original',
      'birds-quadrants': 'Vuelo en cuadrantes · original',
      'fish-spiral': 'Cardumen en espiral · original',
      'birds-rosette': 'Aves en roseta · original',
    };
    for (const [id, title] of Object.entries(titles)) {
      if (!(await page.getByRole('dialog', { name: 'Galería de ejemplos' }).count())) {
        await page.locator('.main-menu summary').click();
        await page.getByRole('button', { name: 'Galería de ejemplos', exact: true }).click();
      }
      await page.getByRole('button', { name: `Abrir ejemplo ${title}`, exact: true }).click();
      await page.locator('.save-indicator').filter({ hasText: 'Guardado local' }).waitFor();
      const open = page.getByRole('button', { name: 'Abrir Simetrías', exact: true });
      if ((await open.getAttribute('aria-pressed')) !== 'true') await open.click();
      await page.getByRole('tab', { name: 'Composición', exact: true }).click();
      const fit = page.getByRole('button', { name: 'Ajustar composición', exact: true });
      await fit.click();
      await page.mouse.move(10, 10);
      await page.waitForTimeout(300);
      await page.screenshot({ path: `docs/images/v30-${id}.png` });
      const json = await page.evaluate(async () => {
        const { recover } = await import('/src/persistence/storage.ts');
        const { serialize } = await import('/src/persistence/schema.ts');
        return serialize(await recover());
      });
      await writeFile(`docs/examples/v30-${id}.json`, json + '\n');
    }
  }
  console.log('Composition artifacts and measurements ready in ' + root);
} finally {
  await browser.close();
}
