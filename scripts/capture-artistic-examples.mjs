/** Native original sources, actual artistic worker thumbnails and UI captures. */
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto('http://127.0.0.1:4173');
  await mkdir('public/examples', { recursive: true });
  await mkdir('docs/examples', { recursive: true });
  for (const id of ['fish', 'rings']) {
    const result = await page.evaluate(async (id) => {
      const { artisticDiskProject } = await import('/src/examples/artistic.ts'),
        { deriveArtisticDiskInWorker } = await import('/src/artistic/worker-client.ts'),
        { artisticDiskSVG } = await import('/src/artistic/disk.ts'),
        { serialize } = await import('/src/persistence/schema.ts');
      const project = artisticDiskProject(id),
        v = project.visualization,
        disk = await deriveArtisticDiskInWorker(project, v.source.patternId, v.source.selection, {
          ...v.settings,
          angle: v.settings.view.angle,
          center: v.settings.view.center,
        }),
        svg = artisticDiskSVG(disk),
        image = new Image();
      image.src = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      try {
        await image.decode();
      } finally {
        URL.revokeObjectURL(image.src);
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
        report: disk.report,
      };
    }, id);
    await writeFile(`public/examples/artistic-${id}.png`, Buffer.from(result.png, 'base64'));
    await writeFile(`docs/examples/artistic-${id}.pattern.json`, result.json + '\n');
    console.log(
      JSON.stringify({
        id,
        paints: result.report.resources.paints,
        segments: result.report.resources.segments,
      }),
    );
    if (id === 'fish') {
      await page.evaluate(async (json) => {
        const { parseProject } = await import('/src/persistence/schema.ts'),
          { autosave } = await import('/src/persistence/storage.ts');
        await autosave(parseProject(json));
      }, result.json);
      await page.reload();
      const modal = page.getByRole('dialog', { name: 'Visualización artística', exact: true });
      await expect(modal.getByRole('button', { name: 'SVG', exact: true })).toBeEnabled({
        timeout: 20000,
      });
      await expect
        .poll(() =>
          modal
            .locator('.disk-image img')
            .evaluate((image) => image.complete && image.naturalWidth > 0),
        )
        .toBe(true);
      await page.mouse.move(50, 50);
      await modal.screenshot({ path: 'docs/images/artistic-studio.png' });
      await modal.getByRole('button', { name: 'Volver a la fuente', exact: true }).click();
    }
  }
} finally {
  await browser.close();
}
