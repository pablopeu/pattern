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

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 390, height: 844 },
]) {
  test(`v2.3 catálogo paginado accesible con hover, favoritos y undo ${viewport.width}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const before = await project(page);
    await page.getByRole('button', { name: 'Abrir Simetrías', exact: true }).click();
    await page.getByRole('button', { name: 'Explorar todas las simetrías · 27' }).click();
    const dialog = page.getByRole('dialog', { name: 'Catálogo de simetrías' });
    await expect(dialog).toBeVisible();
    const seen = new Set<string>();
    for (;;) {
      for (const id of await dialog
        .locator('[data-symmetry-id]')
        .evaluateAll((els) => els.map((el) => el.getAttribute('data-symmetry-id')!)))
        seen.add(id);
      const next = dialog.getByRole('button', { name: 'Siguiente', exact: true });
      if (!(await next.count()) || !(await next.isEnabled())) break;
      await next.click();
    }
    expect(seen.size).toBe(27);
    await dialog.getByLabel('Sistema', { exact: true }).selectOption('radial');
    const radial = dialog.getByRole('button', { name: 'Simetría Dn', exact: true });
    await radial.hover();
    expect(await project(page)).toEqual(before);
    await radial.click();
    await dialog.getByRole('button', { name: 'Favorito radial Dn', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.getByLabel('Sectores', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Explorar todas las simetrías · 27' }),
    ).toBeFocused();
    const changed = (await project(page))!;
    expect(changed.patterns[0].symmetryMode === 'inherit' ? changed.mainSymmetry.family : changed.patterns[0].symmetry.family).toBe('radial');
    await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
    expect((await project(page))!.patterns[0].symmetry.family).toBe(
      before!.patterns[0].symmetry.family,
    );
    await page.getByRole('button', { name: 'Abrir Preferencias', exact: true }).click();
    await page.getByRole('button', { name: 'Abrir Simetrías', exact: true }).click();
    await expect(
      page
        .locator('.symmetry-shortcuts')
        .filter({ hasText: 'Favoritos' })
        .getByRole('button', { name: 'Dn', exact: true }),
    ).toBeVisible();
  });
}
