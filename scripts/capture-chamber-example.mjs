import { chromium, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto('http://127.0.0.1:4173');
  await expect(page.locator('.save-indicator')).toHaveText(/Guardado local/);
  const result = await page.evaluate(async () => {
    const { chamberProject } = await import('/src/examples/chambers.ts'),
      { deriveVisualizationInWorker } = await import('/src/visualization/worker-client.ts'),
      { serialize } = await import('/src/persistence/schema.ts');
    const project = chamberProject(),
      result = await deriveVisualizationInWorker(project, project.visualization),
      image = new Image();
    image.src = URL.createObjectURL(new Blob([result.svg], { type: 'image/svg+xml' }));
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
      report: result.disk.report,
    };
  });
  await writeFile('public/examples/poincare-chambers.png', Buffer.from(result.png, 'base64'));
  await writeFile('docs/examples/poincare-chambers.pattern.json', result.json + '\n');
  await page.evaluate(async (json) => {
    const { parseProject } = await import('/src/persistence/schema.ts'),
      { autosave } = await import('/src/persistence/storage.ts');
    await autosave(parseProject(json));
  }, result.json);
  await page.reload();
  const modal = page.getByRole('dialog', { name: 'Visualización de Poincaré', exact: true });
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
  await modal.screenshot({ path: 'docs/images/poincare-chambers.png' });
  console.log(JSON.stringify(result.report.resources));
} finally {
  await browser.close();
}
