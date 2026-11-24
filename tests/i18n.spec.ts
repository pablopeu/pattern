import { test, expect, type Page } from '@playwright/test';
const SPANISH = /[áéíóúñ¿¡]|\b(de|la|el|los|las|para|con|sin|que|del|una|más|tu|por)\b/i;
// Nombres de documento, marcas y términos técnicos se conservan por diseño (PRD §2.6/§2.7).
const ALLOW = ['Español','English','Poincaré','Estudio sin título','Patrón 01','Bézier'];
async function scan(page: Page, label: string) {
  const texts = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const out: string[] = []; let n: Node | null;
    while ((n = walker.nextNode())) {
      const el = n.parentElement; if (!el) continue;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const t = (n.textContent || '').trim(); if (t.length > 1) out.push(t);
    }
    return [...new Set(out)];
  });
  const bad = texts.filter((t) => SPANISH.test(t) && !ALLOW.some((a) => t.includes(a)));
  expect(bad, `${label} tiene texto sin traducir`).toEqual([]);
}
async function fresh(browser: import('@playwright/test').Browser) {
  const context = await browser.newContext({ locale: 'en-US', storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto('/');
  await expect(page.locator('.save-indicator')).toHaveText(/Saved/);
  return { context, page };
}
test('main and categories', async ({ browser }) => {
  const { context, page } = await fresh(browser);
  await scan(page, 'main');
  for (const cat of ['Symmetries', 'Tiles', 'Layers', 'Preferences']) {
    await page.getByRole('button', { name: `Open ${cat}`, exact: true }).click();
    await scan(page, cat);
  }
  await context.close();
});
test('gallery', async ({ browser }) => {
  const { context, page } = await fresh(browser);
  await page.locator('.main-menu summary').click();
  await page.getByRole('button', { name: 'Example gallery', exact: true }).click();
  await scan(page, 'gallery');
  await context.close();
});
test('export and share', async ({ browser }) => {
  const { context, page } = await fresh(browser);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await scan(page, 'export');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  await scan(page, 'share');
  await context.close();
});
test('palette and help', async ({ browser }) => {
  const { context, page } = await fresh(browser);
  await page.getByRole('button', { name: 'Search commands', exact: true }).click();
  await scan(page, 'palette');
  await page.keyboard.press('Escape');
  await page.locator('.main-menu summary').click();
  await page.getByRole('button', { name: 'Shortcuts and help', exact: true }).click();
  await scan(page, 'help');
  await context.close();
});
test('visualize sphere and animation', async ({ browser }) => {
  const { context, page } = await fresh(browser);
  await page.getByRole('button', { name: /Visualize/, exact: false }).click();
  const disk = page.getByRole('dialog').first();
  await expect(disk).toBeVisible({ timeout: 20000 });
  await scan(page, 'poincare');
  await disk.getByLabel(/Mode/, { exact: false }).first().selectOption('sphere');
  await expect(page.getByRole('dialog').first()).toBeVisible();
  await scan(page, 'sphere');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /Animate/, exact: false }).click();
  await expect(page.getByRole('dialog').first()).toBeVisible({ timeout: 20000 });
  await scan(page, 'animation');
  await context.close();
});
