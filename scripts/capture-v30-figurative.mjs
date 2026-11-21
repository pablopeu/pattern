/** Real LAN app screenshots and native originals for the README. No browser chrome/IP is captured. */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('docs/images', { recursive: true });
await mkdir('docs/examples', { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:4173');
  const rows = await page.evaluate(async () => {
    const { figurativeExamples } = await import('/src/examples/figurative.ts'),
      { serialize } = await import('/src/persistence/schema.ts');
    return figurativeExamples.map((e) => ({ id: e.id, json: serialize(e.create()) }));
  });
  for (const row of rows) await writeFile(`docs/examples/v30-${row.id}.json`, row.json + '\n');
  await page.locator('.main-menu summary').click();
  await page.getByRole('button', { name: 'Galería de ejemplos', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Galería de ejemplos' });
  await dialog.getByLabel('Categoría de ejemplos').selectOption('Figurativas');
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.example-card img')].every(
      (img) => img.complete && img.naturalWidth > 0,
    ),
  );
  await page.screenshot({ path: 'docs/images/v30-figurative-gallery.png' });
  await dialog
    .getByRole('button', { name: 'Abrir ejemplo Peces encastrados · IH43', exact: true })
    .click();
  const close = page.getByRole('button', { name: 'Cerrar mensaje', exact: true });
  if (await close.count()) await close.click();
  await page
    .getByRole('complementary', { name: 'Panel contextual' })
    .getByRole('tab', { name: 'Bordes', exact: true })
    .click();
  await page.screenshot({ path: 'docs/images/v30-figurative-fish.png' });
} finally {
  await browser.close();
}
