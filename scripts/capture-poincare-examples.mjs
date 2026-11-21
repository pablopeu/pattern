/** Generate native examples and honest thumbnails from their actual worker output. */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:4173');
  await mkdir('public/examples', { recursive: true });
  await mkdir('docs/examples', { recursive: true });
  for (const id of ['fish', 'bird']) {
    const result = await page.evaluate(async (id) => {
      const { hyperbolicProject } = await import('/src/examples/hyperbolic.ts'),
        { deriveProjectDiskInWorker } = await import('/src/hyperbolic/worker-client.ts'),
        { diskPreviewSVG } = await import('/src/hyperbolic/representation.ts'),
        { serialize } = await import('/src/persistence/schema.ts');
      const project = hyperbolicProject(id),
        v = project.visualization,
        disk = await deriveProjectDiskInWorker(
          project,
          v.source.patternId,
          v.source.selection,
          v.settings,
        ),
        svg = diskPreviewSVG(disk, v.showStructure),
        url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })),
        image = new Image();
      image.src = url;
      try {
        await image.decode();
      } finally {
        URL.revokeObjectURL(url);
      }
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 640;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#faf8f0';
      ctx.fillRect(0, 0, 640, 640);
      ctx.drawImage(image, 0, 0, 640, 640);
      return {
        json: serialize(project),
        png: canvas.toDataURL('image/png').split(',')[1],
        cells: disk.cells.length,
        segments: disk.report.resources.segments,
      };
    }, id);
    await writeFile(`public/examples/poincare-${id}.png`, Buffer.from(result.png, 'base64'));
    await writeFile(`docs/examples/poincare-${id}.pattern.json`, result.json + '\n');
    console.log(JSON.stringify({ id, cells: result.cells, segments: result.segments }));
  }
} finally {
  await browser.close();
}
