import { test, expect, type Page } from '@playwright/test';
async function model(page: Page) {
  await expect(page.locator('.save-indicator')).toHaveText(/Guardado local/);
  return page.evaluate(async () => (await import('/src/persistence/storage.ts')).recover());
}
async function fixture(page: Page, name = 'Original') {
  return page.evaluate(async (name) => {
    const { newStudy, geometry, node } = await import('/src/app/model.ts');
    const p = newStudy();
    p.metadata.name = name;
    p.patterns[0].sourceGeometry = [
      { ...geometry('path', [node(0, 0), node(10, 0), node(10, 10)], true), fill: '#3b82f6' },
    ];
    return JSON.stringify(p);
  }, name);
}
async function load(page: Page, text: string, waitForStored = true) {
  await page.locator('input[accept=".json,application/json"]').setInputFiles({
    name: 'fixture.pattern.json',
    mimeType: 'application/json',
    buffer: Buffer.from(text),
  });
  const id = JSON.parse(text).metadata?.id;
  if (waitForStored && id) await expect.poll(async () => (await model(page))?.metadata.id).toBe(id);
}
async function menu(page: Page, label: string) {
  const m = page.locator('.main-menu');
  if ((await m.getAttribute('open')) === null) await m.locator('summary').click();
  await m.getByRole('button', { name: label, exact: true }).click();
}
function guard(page: Page) {
  return page.getByRole('dialog', { name: 'Conservar el trabajo', exact: true });
}
for (const width of [1440, 390])
  test(`nuevo proyecto protege dibujo, cancelar/escape y descartar ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto('/');
    await model(page);
    await menu(page, 'Nuevo proyecto');
    await expect(guard(page)).toHaveCount(0);
    await load(page, await fixture(page));
    const original = await model(page);
    await menu(page, 'Nuevo proyecto');
    await expect(guard(page)).toBeVisible();
    for (const name of ['Cancelar', 'Guardar trabajo y continuar', 'Descartar y continuar'])
      await expect(guard(page).getByRole('button', { name, exact: true })).toBeInViewport();
    await expect(guard(page).getByRole('button', { name: 'Cancelar', exact: true })).toBeFocused();
    await guard(page).getByRole('button', { name: 'Cancelar', exact: true }).click();
    expect(await model(page)).toEqual(original);
    await menu(page, 'Nuevo proyecto');
    await page.keyboard.press('Escape');
    expect(await model(page)).toEqual(original);
    await menu(page, 'Nuevo proyecto');
    await guard(page).getByRole('button', { name: 'Descartar y continuar', exact: true }).click();
    await expect.poll(async () => (await model(page))!.patterns[0].sourceGeometry).toEqual([]);
  });
test('guardar y continuar descarga el original antes de reemplazar; cancelar guardado no reemplaza', async ({
  page,
}) => {
  await page.goto('/');
  await model(page);
  await load(page, await fixture(page));
  const original = await model(page);
  await menu(page, 'Nuevo proyecto');
  await guard(page).getByRole('button', { name: 'Guardar trabajo y continuar' }).click();
  let dialog = page.getByRole('dialog', { name: 'Guardar proyecto', exact: true });
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect((await model(page))!.patterns[0].sourceGeometry).toEqual(
    original!.patterns[0].sourceGeometry,
  );
  await menu(page, 'Nuevo proyecto');
  await guard(page).getByRole('button', { name: 'Guardar trabajo y continuar' }).click();
  dialog = page.getByRole('dialog', { name: 'Guardar proyecto', exact: true });
  await dialog.getByLabel('Nombre del archivo').fill('Mi dibujo protegido');
  const event = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Guardar archivo', exact: true }).click();
  const download = await event;
  const { readFile } = await import('node:fs/promises');
  const saved = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(saved.metadata.name).toBe('Mi dibujo protegido');
  expect(saved.patterns[0].sourceGeometry).toEqual(original!.patterns[0].sourceGeometry);
  await expect.poll(async () => (await model(page))!.patterns[0].sourceGeometry).toEqual([]);
  const library = await page.evaluate(async () =>
    (await import('/src/persistence/storage.ts')).savedProjects(),
  );
  expect(library.some((p) => p.name === 'Mi dibujo protegido')).toBe(true);
});
test('JSON válido y ejemplos piden permiso; JSON inválido conserva el proyecto', async ({
  page,
}) => {
  await page.goto('/');
  await model(page);
  await load(page, await fixture(page));
  const original = await model(page);
  await load(page, '{"schemaVersion":999}');
  await expect(page.locator('.toast[role=status]')).toContainText(/versión/);
  expect((await model(page))!.metadata.id).toBe(original!.metadata.id);
  await expect(guard(page)).toHaveCount(0);
  const next = await fixture(page, 'Otro estudio');
  await load(page, next, false);
  await expect(guard(page)).toBeVisible();
  await guard(page).getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect((await model(page))!.metadata.id).toBe(original!.metadata.id);
  await load(page, next, false);
  await guard(page).getByRole('button', { name: 'Descartar y continuar' }).click();
  await expect.poll(async () => (await model(page))?.metadata.name).toBe('Otro estudio');
  await menu(page, 'Jardín geométrico');
  await expect(guard(page)).toBeVisible();
  await guard(page).getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect((await model(page))!.metadata.name).toBe('Otro estudio');
});
test('borrar selección se puede cancelar y sólo se ejecuta al confirmar', async ({ page }) => {
  await page.goto('/');
  await model(page);
  await page.getByRole('button', { name: 'Crear polígono regular', exact: true }).click();
  const original = await model(page);
  await page
    .locator('.tool-rail')
    .getByRole('button', { name: 'Eliminar selección', exact: true })
    .click();
  await expect(guard(page)).toBeVisible();
  await guard(page).getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect((await model(page))!.patterns[0].sourceGeometry).toEqual(
    original!.patterns[0].sourceGeometry,
  );
  await page
    .locator('.tool-rail')
    .getByRole('button', { name: 'Eliminar selección', exact: true })
    .click();
  await guard(page).getByRole('button', { name: 'Descartar y continuar' }).click();
  await expect.poll(async () => (await model(page))!.patterns[0].sourceGeometry).toEqual([]);
});
test('un error real de IndexedDB impide continuar y conserva el trabajo', async ({ page }) => {
  await page.goto('/');
  await model(page);
  await load(page, await fixture(page));
  await model(page);
  await menu(page, 'Nuevo proyecto');
  await guard(page).getByRole('button', { name: 'Guardar trabajo y continuar' }).click();
  await page.evaluate(() => {
    const previous = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function () {
      throw new DOMException('Prueba de almacenamiento lleno', 'QuotaExceededError');
    };
    Object.defineProperty(window, 'restoreTestPut', {
      value: () => {
        IDBObjectStore.prototype.put = previous;
      },
    });
  });
  const dialog = page.getByRole('dialog', { name: 'Guardar proyecto', exact: true });
  await dialog.getByRole('button', { name: 'Guardar archivo', exact: true }).click();
  await expect(page.locator('.toast[role=status]')).toContainText(/No se puede guardar/);
  await expect(dialog).toBeVisible();
  await page.evaluate(() => Reflect.get(window, 'restoreTestPut')());
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect((await model(page))!.patterns[0].sourceGeometry).toHaveLength(1);
});
