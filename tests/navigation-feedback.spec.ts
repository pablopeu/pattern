import { test, expect, type Page } from '@playwright/test';
import { context } from './navigation';
async function model(page: Page) {
  await expect(page.locator('.save-indicator')).toHaveText(/Guardado local/);
  return page.evaluate(async () => (await import('/src/persistence/storage.ts')).recover());
}
for (const viewport of [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 390, height: 844 },
])
  test(`contextos útiles, favoritos directos y familias visuales ${viewport.width}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await model(page);
    const rail = page.getByRole('group', { name: 'Categorías' });
    await expect(rail.getByRole('button')).toHaveText([
      'Simetrías',
      'Teselas',
      'Capas',
      'Preferencias',
    ]);
    await page.getByRole('button', { name: 'Dibujo libre', exact: true }).click();
    await expect(page.getByRole('complementary', { name: 'Panel contextual' })).toBeHidden();
    await expect(page.getByRole('complementary', { name: 'Panel de estilos' })).toBeVisible();
    await page.getByRole('button', { name: 'Crear polígono regular', exact: true }).click();
    await model(page);
    await expect(page.getByLabel('Lados', { exact: true })).toBeVisible();
    const before = (await model(page))!.patterns[0].sourceGeometry;
    await context(page, 'Simetrías');
    const panel = page.getByRole('complementary', { name: 'Panel contextual' }),
      scroll = panel.locator('.panel-scroll');
    const favorite = page.getByRole('button', { name: 'Favorito actual p3', exact: true });
    await favorite.click();
    await expect(favorite).toHaveAttribute('aria-pressed', 'true');
    await expect(
      panel
        .locator('.symmetry-shortcuts')
        .filter({ hasText: 'Favoritos' })
        .getByRole('button', { name: 'p3', exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel('Cambiar simetría en', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Repetición de este conjunto', { exact: true })).toHaveValue(
      'inherit',
    );
    await page.locator('.symmetry-frame-controls>summary').click();
    const orientation = page.getByRole('slider', {
      name: 'Orientación de red deslizador',
      exact: true,
    });
    await expect(orientation).toHaveAttribute('max', '6');
    await expect(
      page.getByRole('slider', { name: 'Origen X deslizador', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('slider', { name: 'Origen Y deslizador', exact: true }),
    ).toBeVisible();
    expect(await scroll.evaluate((e) => e.scrollHeight - e.clientHeight)).toBeLessThanOrEqual(1);
    await context(page, 'Teselas');
    await expect(
      page.getByRole('group', { name: 'Familias de teselas' }).getByRole('button'),
    ).toHaveText(['Encastre', 'Aperiódicas', 'Girih']);
    await expect(panel.getByRole('tab', { name: 'Forma', exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Usar teselas geométricas', { exact: true })).toBeVisible();
    await page
      .getByRole('group', { name: 'Familias de teselas' })
      .getByRole('button', { name: 'Aperiódicas', exact: true })
      .click();
    await expect(page.getByLabel('Construcción aperiódica', { exact: true })).toBeVisible();
    expect(await scroll.evaluate((e) => e.scrollHeight - e.clientHeight)).toBeLessThanOrEqual(1);
    expect((await model(page))!.patterns[0].sourceGeometry).toEqual(before);
    await page.getByRole('tab', { name: 'Aplicar', exact: true }).click();
    await expect(panel).toBeVisible();
    await expect(page.locator('.context-heading>span')).toHaveText('Aplicación');
    await expect(rail.getByRole('button', { name: 'Abrir Aplicación', exact: true })).toHaveCount(
      0,
    );
  });
test('dos zonas pertenecen al mismo conjunto, nuevo conjunto es explícito y un objeto bloqueado se conserva', async ({
  page,
}) => {
  await page.goto('/');
  await model(page);
  for (let i = 0; i < 2; i++)
    await page.getByRole('button', { name: 'Crear polígono regular', exact: true }).click();
  await model(page);
  await context(page, 'Capas');
  const panel = page.getByRole('complementary', { name: 'Panel contextual' });
  await panel.getByRole('tab', { name: 'Conjuntos', exact: true }).click();
  await expect(panel.locator('.pattern-set-row')).toHaveCount(1);
  await expect(panel).toContainText('Una zona cerrada no crea otro conjunto');
  await panel.getByRole('tab', { name: /^Objetos/ }).click();
  await expect(panel.locator('.layer-row')).toHaveCount(2);
  const row = panel.locator('.layer-row').first(),
    lockedId = (await model(page))!.patterns[0].sourceGeometry.at(-1)!.id;
  await row.getByRole('button', { name: /^Bloquear / }).click();
  await expect(row.locator('.layer-name')).toBeDisabled();
  await expect(row.getByRole('button', { name: /^Desbloquear / })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Seleccionar', exact: true }).click();
  await page.locator('.studio-canvas').focus();
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Delete');
  const guard = page.getByRole('dialog', { name: 'Conservar el trabajo' });
  await guard.getByRole('button', { name: 'Descartar y continuar' }).click();
  await expect.poll(async () => (await model(page))!.patterns[0].sourceGeometry.length).toBe(1);
  expect((await model(page))!.patterns[0].sourceGeometry[0].id).toBe(lockedId);
  await context(page, 'Capas');
  await panel.getByRole('tab', { name: /^Objetos/ }).click();
  await panel.getByRole('button', { name: /^Desbloquear / }).click();
  await expect(panel.locator('.layer-name')).toBeEnabled();
  await panel.getByRole('tab', { name: 'Conjuntos', exact: true }).click();
  await panel.getByRole('button', { name: 'Nuevo conjunto', exact: true }).click();
  await expect.poll(async () => (await model(page))!.patterns.length).toBe(2);
  await expect(panel.locator('.pattern-set-row')).toHaveCount(2);
});

test('Teselas no queda vacío al crear un estudio después de editar bordes', async ({ page }) => {
  await page.goto('/');
  await model(page);
  await context(page, 'Teselas');
  await page.getByLabel('Usar teselas geométricas', { exact: true }).check();
  await page
    .getByRole('complementary', { name: 'Panel contextual' })
    .getByRole('tab', { name: 'Bordes', exact: true })
    .click();
  await page.locator('.main-menu summary').click();
  await page.getByRole('button', { name: 'Nuevo proyecto', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Conservar el trabajo' })
    .getByRole('button', { name: 'Descartar y continuar' })
    .click();
  await model(page);
  await context(page, 'Teselas');
  await expect(page.getByLabel('Usar teselas geométricas', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Explorar catálogo IH1–IH93', exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('complementary', { name: 'Panel contextual' })
      .getByRole('tab', { name: 'Forma', exact: true }),
  ).toHaveCount(0);
});

test('este conjunto y compartida afectan exactamente los conjuntos elegidos', async ({ page }) => {
  await page.goto('/');
  await model(page);
  const id = await page.evaluate(async () => {
    const { newStudy, newPattern } = await import('/src/app/model.ts'),
      { autosave } = await import('/src/persistence/storage.ts');
    const p = newStudy();
    p.patterns.push({ ...newPattern(), name: 'Segundo conjunto', symmetryMode: 'inherit' });
    await autosave(p);
    return p.metadata.id;
  });
  await page.reload();
  await expect.poll(async () => (await model(page))?.metadata.id).toBe(id);
  const { symmetry } = await import('./navigation');
  await symmetry(page, 'Simetría p4');
  let p = (await model(page))!;
  expect(p.mainSymmetry.group).toBe('p3');
  expect(p.patterns[0].symmetryMode).toBe('own');
  expect(p.patterns[0].symmetry.group).toBe('p4');
  expect(p.patterns[1].symmetryMode).toBe('inherit');
  await context(page, 'Simetrías');
  await page.getByLabel('Cambiar simetría en', { exact: true }).selectOption('project');
  await symmetry(page, 'Simetría p6');
  p = (await model(page))!;
  expect(p.mainSymmetry.group).toBe('p6');
  expect(p.patterns[0].symmetry.group).toBe('p4');
  expect(p.patterns[0].symmetryMode).toBe('own');
  expect(p.patterns[1].symmetryMode).toBe('inherit');
});
