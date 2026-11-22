import { test, expect, type Page } from '@playwright/test';

/**
 * Stub del contrato API de publicaciones. El backend PHP real se prueba con
 * scripts/share-php-test.mjs (integración sin mocks); aquí la E2E valida la UX
 * contra un servidor determinístico que respeta el mismo contrato (PRD §14.4).
 */
const sharedStub = new Map<string, { document: string; secret: string }>();
async function installShareStub(page: Page, shares = sharedStub) {
  await page.route('http://127.0.0.1:8180/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    const id = url.searchParams.get('id') ?? /api\/shares\/([0-9A-Za-z]{16})/.exec(url.pathname)?.[1];
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Content-Type': 'application/json',
    };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (request.method() === 'POST') {
      const body = JSON.parse(request.postData() ?? '{}');
      const madeId = Array.from({ length: 16 }, () => 'Ab3Kx9Qp7Lm2Rt5Z'[Math.floor(Math.random() * 16)]).join('');
      const secret = 'secreto-' + madeId;
      shares.set(madeId, { document: body.document, secret });
      return route.fulfill({
        status: 201,
        headers,
        body: JSON.stringify({ id: madeId, link: `http://127.0.0.1:4173/s/${madeId}`, secret, preview: false }),
      });
    }
    if (!id || !shares.has(id))
      return route.fulfill({ status: 404, headers, body: JSON.stringify({ error: 'not_found' }) });
    if (request.method() === 'DELETE') {
      if (request.headers()['x-share-secret'] !== shares.get(id)!.secret)
        return route.fulfill({ status: 403, headers, body: '{}' });
      shares.delete(id);
      return route.fulfill({ status: 204, headers, body: '' });
    }
    return route.fulfill({ status: 200, headers, body: shares.get(id)!.document });
  });
}

async function model(page: Page) {
  await expect(page.locator('.save-indicator')).toHaveText(/Guardado local/);
  return page.evaluate(async () => (await import('/src/persistence/storage.ts')).recover());
}
async function openFish(page: Page) {
  await page.goto('/');
  await model(page);
  await page.locator('.main-menu summary').click();
  await page.getByRole('button', { name: 'Galería de ejemplos', exact: true }).click();
  const gallery = page.getByRole('dialog', { name: 'Galería de ejemplos' });
  await gallery.getByLabel('Buscar ejemplos').fill('IH43');
  await gallery
    .getByRole('button', { name: 'Abrir ejemplo Peces de jade · IH43', exact: true })
    .click();
  await model(page);
}
async function saveFile(page: Page) {
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Guardar proyecto', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar archivo', exact: true }).click();
  await downloadEvent;
}
const suggestion = (page: Page) =>
  page.getByRole('status', { name: 'Sugerencia de compartir', exact: true });

test('publicar, copiar enlace y abrir la creación en una sesión aislada', async ({
  page,
  browser,
}) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.addInitScript(() => {
    (window as unknown as { __SHARE_API_BASE__: string }).__SHARE_API_BASE__ =
      'http://127.0.0.1:8180/api/index.php';
  });
  await installShareStub(page);
  await openFish(page);
  const originalName = (await model(page))!.patterns[0].name;
  await saveFile(page);
  await expect(suggestion(page)).toBeVisible();
  await suggestion(page).getByRole('button', { name: 'Compartir', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Compartir creación', exact: true });
  await expect(dialog.getByAltText('Miniatura de la creación')).toBeVisible({ timeout: 30000 });
  await dialog.getByRole('button', { name: 'Crear enlace público', exact: true }).click();
  const linkInput = dialog.getByLabel('Enlace público', { exact: true });
  await expect(linkInput).toBeVisible({ timeout: 30000 });
  const link = await linkInput.inputValue();
  const id = /\/s\/([0-9A-Za-z]{16})$/.exec(link)?.[1];
  expect(id).toMatch(/^[0-9A-Za-z]{16}$/);
  // Redes sociales apuntan al enlace correcto.
  for (const net of ['WhatsApp', 'Telegram', 'Facebook', 'X'])
    expect(await dialog.getByRole('link', { name: net, exact: true }).getAttribute('href')).toContain(
      encodeURIComponent(link),
    );
  await dialog.getByRole('button', { name: 'Copiar enlace', exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);
  // Sesión aislada: el enlace reabre la creación como copia editable.
  const isolated = await browser.newContext();
  try {
    const other = await isolated.newPage();
    await other.addInitScript(() => {
      (window as unknown as { __SHARE_API_BASE__: string }).__SHARE_API_BASE__ =
        'http://127.0.0.1:8180/api/index.php';
    });
    await installShareStub(other);
    await other.goto(`/?share=${id}`);
    await model(other);
    const restored = (await model(other))!;
    expect(restored.patterns[0].name).toBe(originalName);
    expect(restored.metadata.id).not.toBe(id);
    await expect(other.getByRole('status', { name: 'Creación compartida abierta' })).toBeVisible();
  } finally {
    await isolated.close();
  }
});

test('la preferencia deshabilita la sugerencia y el autosave nunca la dispara', async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.addInitScript(() => {
    (window as unknown as { __SHARE_API_BASE__: string }).__SHARE_API_BASE__ =
      'http://127.0.0.1:8180/api/index.php';
  });
  await installShareStub(page);
  await openFish(page);
  await expect(suggestion(page)).toHaveCount(0);
  await saveFile(page);
  await expect(suggestion(page)).toBeVisible();
  await suggestion(page).getByLabel('No volver a preguntarme', { exact: true }).check();
  await suggestion(page).getByRole('button', { name: 'Ahora no', exact: true }).click();
  await saveFile(page);
  await page.waitForTimeout(600);
  await expect(suggestion(page)).toHaveCount(0);
  await page.reload();
  await model(page);
  await saveFile(page);
  await page.waitForTimeout(600);
  await expect(suggestion(page)).toHaveCount(0);
});

test('retirar la publicación desde el dispositivo la hace inaccesible', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.addInitScript(() => {
    (window as unknown as { __SHARE_API_BASE__: string }).__SHARE_API_BASE__ =
      'http://127.0.0.1:8180/api/index.php';
  });
  await installShareStub(page);
  page.on('dialog', (d) => void d.accept());
  await openFish(page);
  await saveFile(page);
  await suggestion(page).getByRole('button', { name: 'Compartir', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Compartir creación', exact: true });
  await expect(dialog.getByAltText('Miniatura de la creación')).toBeVisible({ timeout: 30000 });
  await dialog.getByRole('button', { name: 'Crear enlace público', exact: true }).click();
  const link = await dialog.getByLabel('Enlace público', { exact: true }).inputValue();
  const id = /\/s\/([0-9A-Za-z]{16})$/.exec(link)![1];
  await dialog
    .getByRole('button', { name: 'Retirar publicación de este dispositivo', exact: true })
    .click();
  await expect.poll(async () => sharedStub.has(id)).toBe(false);
});
