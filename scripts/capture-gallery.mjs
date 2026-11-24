/** Render the current catalog through the real scene/export/worker pipelines. */
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:4173');
  await expect(page.locator('.save-indicator')).toContainText(/Guardado local|Saved locally/);
  await mkdir('public/examples', { recursive: true });
  await mkdir('docs/examples', { recursive: true });
  const ids = await page.evaluate(async () =>
    (await import('/src/examples/catalog.ts')).exampleCatalog.map((e) => e.id),
  );
  const only = process.env.CAPTURE_ONLY ? new Set(process.env.CAPTURE_ONLY.split(',')) : null;
  for (const id of ids) {
    if (only && !only.has(id)) continue;
    const result = await page.evaluate(async (id) => {
      const { compositionExample } = await import('/src/examples/catalog.ts'),
        { serialize } = await import('/src/persistence/schema.ts'),
        { deriveVisualizationInWorker } = await import('/src/visualization/worker-client.ts'),
        { prepareExport } = await import('/src/export/svg.ts'),
        { resolvePattern } = await import('/src/symmetry/config.ts'),
        { buildScene } = await import('/src/patterns/engine.ts'),
        { generatedBounds } = await import('/src/composition/generated.ts');
      const p = compositionExample(id),
        pat = p.patterns[0];
      let svg, report;
      if (p.visualization?.kind === 'sphere') {
        const { geodesicFaces } = await import('/src/sphere/geometry.ts'),
          { drawSphere } = await import('/src/sphere/render.ts'),
          settings = p.visualization.settings,
          faces = geodesicFaces(settings.solid, settings.level),
          canvas = document.createElement('canvas');
        canvas.width = canvas.height = 640;
        drawSphere(canvas.getContext('2d'), {
          faces,
          settings,
          width: 640,
          height: 640,
          texture: null,
        });
        const data = canvas.toDataURL('image/png');
        svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640"><image href="${data}" width="640" height="640"/></svg>`;
        report = `sphere:${faces.length}`;
      } else if (p.visualization?.active) {
        const output = await deriveVisualizationInWorker(p, p.visualization);
        svg = output.svg;
        report = output.disk.report.resources;
      } else {
        const effective = resolvePattern(pat, p),
          scene = buildScene(effective, { x: -150, y: -150, width: 300, height: 300 });
        let bounds;
        if (scene.generated.finite) {
          const b = generatedBounds(scene.generated),
            pad = Math.max(b.width, b.height) * 0.05;
          bounds = {
            x: b.x - pad,
            y: b.y - pad,
            width: b.width + pad * 2,
            height: b.height + pad * 2,
          };
        }
        const width = bounds
            ? 2 * Math.max(Math.abs(bounds.x), Math.abs(bounds.x + bounds.width))
            : pat.tiling
              ? pat.tiling.width * 2.6
              : 180,
          height = bounds
            ? 2 * Math.max(Math.abs(bounds.y), Math.abs(bounds.y + bounds.height))
            : width;
        svg = prepareExport(p, {
          target: p.applications.length ? 'application' : 'view',
          applicationId: p.applications[0]?.id,
          format: 'svg',
          representation: 'editable',
          width,
          height,
          dpi: 96,
          background: p.preferences.background,
          transparent: false,
          quality: 0.95,
          tolerance: 0.02,
          outlineStrokes: false,
          patternId: pat.id,
        }).svg;
        if (bounds && !p.applications.length) {
          const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
          doc.documentElement.setAttribute(
            'viewBox',
            `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`,
          );
          svg = new XMLSerializer().serializeToString(doc);
        }
      }
      const image = new Image(),
        url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      image.src = url;
      try {
        await image.decode();
      } finally {
        URL.revokeObjectURL(url);
      }
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 640;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = p.preferences.background;
      ctx.fillRect(0, 0, 640, 640);
      const factor = 640 / Math.max(image.width, image.height),
        w = image.width * factor,
        h = image.height * factor;
      ctx.drawImage(image, (640 - w) / 2, (640 - h) / 2, w, h);
      return { json: serialize(p), png: canvas.toDataURL('image/png').split(',')[1], report };
    }, id);
    await writeFile(`public/examples/${id}.png`, Buffer.from(result.png, 'base64'));
    await writeFile(`docs/examples/${id}.pattern.json`, result.json + '\n');
    console.log(JSON.stringify({ id, report: result.report ?? 'scene' }));
  }
} finally {
  await browser.close();
}
