/** Real editor screenshots and portable finite patches for the public README. */
import { chromium } from '@playwright/test';
import { writeFile, mkdir } from 'node:fs/promises';
await mkdir('docs/examples', { recursive: true });
await mkdir('docs/images', { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:4173');
  const rows = await page.evaluate(async () => {
    const { aperiodicExamples } = await import('/src/examples/aperiodic.ts'),
      { serialize } = await import('/src/persistence/schema.ts');
    return aperiodicExamples.map((e) => ({ id: e.id, json: serialize(e.create()) }));
  });
  for (const row of rows) await writeFile(`docs/examples/v30-${row.id}.json`, row.json + '\n');
  await page.locator('.main-menu summary').click();
  await page.getByRole('button', { name: 'Galería de ejemplos', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Galería de ejemplos' });
  await dialog.getByLabel('Categoría de ejemplos', { exact: true }).selectOption('Aperiódicas');
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.example-card img')].every(
      (i) => i.complete && i.naturalWidth > 0,
    ),
  );
  await page.screenshot({ path: 'docs/images/v30-aperiodic-gallery.png' });
  await dialog
    .getByRole('button', { name: 'Abrir ejemplo Hat · jerarquía H/T/P/F', exact: true })
    .click();
  const close = page.getByRole('button', { name: 'Cerrar mensaje', exact: true });
  if (await close.count()) await close.click();
  await page
    .getByRole('complementary', { name: 'Panel contextual' })
    .getByRole('tab', { name: 'Jerarquía', exact: true })
    .click();
  await page.getByRole('button', { name: 'Ajustar al patrón', exact: true }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'docs/images/v30-aperiodic-hat.png' });
} finally {
  await browser.close();
}
