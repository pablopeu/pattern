import { test, expect, type Page } from '@playwright/test';

async function project(page: Page) {
  await expect(page.locator('.save-indicator')).toHaveText(/Guardado local/);
  return page.evaluate(async () => {
    const { recover } = await import('/src/persistence/storage.ts');
    return recover();
  });
}

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 390, height: 844 },
]) {
  test(`v2.3 categorías conservan documento y herramientas visibles ${viewport.width}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const before = await project(page);
    for (const name of [
      'Dibujo',
      'Formas',
      'Simetrías',
      'Teselas',
      'Capas',
      'Aplicación',
      'Preferencias',
    ]) {
      const button = page.getByRole('button', { name: `Abrir ${name}`, exact: true });
      await expect(button).toBeInViewport();
      await button.click();
      await expect(page.locator('.context-heading')).toHaveText(name);
    }
    expect(await project(page)).toEqual(before);
    for (const name of [
      'Seleccionar',
      'Pluma Bézier',
      'Dibujo libre',
      'Línea',
      'Rellenar región',
    ]) {
      await expect(page.getByRole('button', { name, exact: true })).toBeInViewport();
    }
    await page.getByRole('button', { name: 'Abrir Simetrías', exact: true }).click();
    await page.getByRole('tab', { name: 'Generador', exact: true }).click();
    await page.getByRole('button', { name: 'Abrir Preferencias', exact: true }).click();
    await page.getByRole('button', { name: 'Abrir Simetrías', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Generador', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.getByRole('button', { name: 'Plegar panel', exact: true }).click();
    await expect(page.getByRole('complementary', { name: 'Panel contextual' })).toBeHidden();
    await page.getByRole('button', { name: 'Plegar panel', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Generador', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(await project(page)).toEqual(before);
  });
}

test('v2.3 polígono paramétrico identificado, controles y estilo vigente', async ({ page }) => {
  await page.goto('/');
  await project(page);
  const before = await project(page);
  await page.getByRole('button', { name: 'Abrir Formas', exact: true }).click();
  await page.getByRole('button', { name: 'Polígono paramétrico · crear', exact: true }).click();
  await expect(page.getByLabel('Lados', { exact: true })).toBeVisible();
  await page.getByLabel('Lados', { exact: true }).fill('8');
  await page.getByLabel('Ancho', { exact: true }).fill('42');
  const after = await project(page);
  const created = after!.patterns[0].sourceGeometry.at(-1)!;
  expect(created.parameters?.sides).toBe(8);
  expect(created.parameters?.width).toBe(42);
  expect(created.stroke).toBe(before!.drawingStyle.stroke);
  await expect(page.getByLabel('Vista previa de forma')).toBeVisible();
  await page.getByRole('button', { name: 'Abrir panel de estilos', exact: true }).click();
  const style = page.getByRole('complementary', { name: 'Panel de estilos' });
  await expect(style).toBeVisible();
  const box = await style.boundingBox();
  expect(box!.x + box!.width).toBeGreaterThan(1400);
});
