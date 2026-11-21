/** Isolated real app screenshot; never touches the user's browser projects. */
import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
await mkdir('docs/images', { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:4173');
  await expect(page.locator('.save-indicator')).toHaveText(/Guardado local/);
  await page.getByRole('button', { name: 'Crear polígono regular', exact: true }).click();
  await page.locator('.main-menu summary').click();
  await page.getByRole('button', { name: 'Nuevo proyecto', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Conservar el trabajo' })).toBeVisible();
  await page.screenshot({ path: 'docs/images/work-protection.png', animations: 'disabled' });
} finally {
  await browser.close();
}
