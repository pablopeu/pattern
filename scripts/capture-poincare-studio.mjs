import { chromium, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto('http://127.0.0.1:4173');
  await expect(page.locator('.save-indicator')).toHaveText(/Guardado local/);
  await page.locator('input[type="file"][accept=".json,application/json"]').setInputFiles({
    name: 'poincare-fish.pattern.json',
    mimeType: 'application/json',
    buffer: await readFile('docs/examples/poincare-fish.pattern.json'),
  });
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
  await modal.screenshot({ path: 'docs/images/poincare-studio.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => modal.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await modal.screenshot({ path: 'docs/images/poincare-mobile.png' });
  console.log('Poincaré real: captura de escritorio y móvil; sin desborde horizontal.');
} finally {
  await browser.close();
}
