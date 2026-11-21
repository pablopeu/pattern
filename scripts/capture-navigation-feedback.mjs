/** Real UI in an isolated browser context; no projects from the user's session. */
import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
await mkdir('docs/images', { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:4173');
  await expect(page.locator('.save-indicator')).toHaveText(/Guardado local/);
  await expect(page.locator('.save-indicator')).toHaveText(/Guardado local/);
  await page.mouse.move(900, 50);
  await page.screenshot({ path: 'docs/images/new-study-p3.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Crear polígono regular', exact: true }).click();
  const close = page.getByRole('button', { name: 'Cerrar panel de estilos', exact: true });
  if (await close.count()) await close.click();
  await page.getByRole('button', { name: 'Abrir Simetrías', exact: true }).click();
  await page.getByRole('button', { name: 'Favorito actual p3', exact: true }).click();
  await page.locator('.symmetry-frame-controls>summary').click();
  await expect(page.locator('.save-indicator')).toHaveText(/Guardado local/);
  await page.mouse.move(900, 50);
  await page.screenshot({ path: 'docs/images/navigation-symmetry.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Abrir Teselas', exact: true }).click();
  await expect(page.locator('.save-indicator')).toHaveText(/Guardado local/);
  await page.mouse.move(900, 50);
  await page.screenshot({ path: 'docs/images/navigation-tiles.png', animations: 'disabled' });
} finally {
  await browser.close();
}
