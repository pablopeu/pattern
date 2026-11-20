import { context, styles, field } from './navigation';
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
      await expect(page.locator('.context-heading > span')).toHaveText(name);
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
    expect(
      changed.patterns[0].symmetryMode === 'inherit'
        ? changed.mainSymmetry.family
        : changed.patterns[0].symmetry.family,
    ).toBe('radial');
    if (viewport.width < 900)
      await page.getByRole('button', { name: 'Plegar panel', exact: true }).click();
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

for (const width of [1366, 1440, 1920, 390]) {
  test(`v2.3 propiedades y estilos compactos sin scroll ${width}`, async ({ page }) => {
    await page.setViewportSize({
      width,
      height: width === 1366 ? 768 : width === 1920 ? 1080 : 900,
    });
    await page.goto('/');
    await project(page);
    await page.getByRole('button', { name: 'Crear polígono regular', exact: true }).click();
    const right = page.getByRole('complementary', { name: 'Panel de estilos' });
    for (const label of ['Lados', 'Ancho', 'Alto', 'Rotación', 'Tipo de relleno'])
      await expect(right.getByLabel(label, { exact: true })).toBeInViewport();
    const before = await project(page);
    for (const name of [
      'Colores',
      'Trazo',
      'Perfil',
      'Fill',
      'Paleta',
      'Presets',
      'Opciones',
      'Objeto',
    ]) {
      await right.getByRole('tab', { name, exact: true }).click();
      expect(
        await right
          .locator('.style-panel-body')
          .evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
        name,
      ).toBe(true);
    }
    expect(await project(page)).toEqual(before);
    await right.getByRole('tab', { name: 'Transformar', exact: true }).click();
    await right.getByLabel('Posición X', { exact: true }).fill('5');
    await right.getByLabel('Posición Y', { exact: true }).focus();
    expect((await project(page))!.patterns[0].sourceGeometry[0].transform[4]).toBe(5);
  });
}

test('v2.3 comandos usan herramientas reales, foco, teclado y exportación', async ({ page }) => {
  await page.goto('/');
  await project(page);
  await page.keyboard.press('Control+k');
  const dialog = page.getByRole('dialog', { name: 'Buscar comandos' });
  await dialog.getByRole('combobox').fill('poligono parametrico');
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
  expect((await project(page))!.patterns[0].sourceGeometry).toHaveLength(1);
  await page.keyboard.press('Control+k');
  await dialog.getByRole('combobox').fill('grosor');
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Grosor de trazo', { exact: true })).toBeFocused();
  await page.getByLabel('Grosor de trazo', { exact: true }).fill('2');
  await page.keyboard.press('Control+k');
  await dialog.getByRole('combobox').fill('exportar svg');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Exportar patrón' })).toBeVisible();
  await expect(page.getByLabel('Formato', { exact: true })).toHaveValue('svg');
});

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 390, height: 844 },
]) {
  test(`v2.3 teselas, red, generador, aplicación y exportación sin scroll ${viewport.width}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await project(page);
    const left = page.getByRole('complementary', { name: 'Panel contextual' });
    const noScroll = async () =>
      expect(
        await left
          .locator('.panel-scroll')
          .evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
      ).toBe(true);
    await page.getByRole('button', { name: 'Abrir Teselas', exact: true }).click();
    await page.getByLabel('Usar teselas geométricas', { exact: true }).check();
    for (const name of ['Forma', 'Colocación', 'Bordes', 'Tangentes']) {
      await left.getByRole('tab', { name, exact: true }).click();
      await noScroll();
    }
    await page.getByLabel('Saliente Y', { exact: true }).fill('2');
    await page.getByRole('button', { name: 'Abrir Simetrías', exact: true }).click();
    await page.getByRole('button', { name: 'Explorar todas las simetrías · 27' }).click();
    const gallery = page.getByRole('dialog', { name: 'Catálogo de simetrías' });
    await gallery.getByLabel('Sistema', { exact: true }).selectOption('wallpaper');
    await gallery.getByRole('button', { name: 'Simetría p1', exact: true }).click();
    await gallery.getByRole('button', { name: 'Cerrar catálogo' }).click();
    await noScroll();
    await page.getByRole('tab', { name: 'Colocación', exact: true }).click();
    await noScroll();
    await page.getByRole('tab', { name: 'Generador', exact: true }).click();
    await page.getByLabel('Familia', { exact: true }).selectOption('warp');
    await noScroll();
    while (await page.getByRole('button', { name: 'Más parámetros', exact: true }).isEnabled()) {
      await page.getByRole('button', { name: 'Más parámetros', exact: true }).click();
      await noScroll();
    }
    await page.getByRole('button', { name: 'Abrir Preferencias', exact: true }).click();
    await noScroll();
    await page.getByRole('tab', { name: 'Aplicar', exact: true }).click();
    await page.getByRole('button', { name: 'Crear polígono regular', exact: true }).click();
    await page.getByRole('button', { name: 'Abrir Aplicación', exact: true }).click();
    await page.getByRole('button', { name: 'Aplicar al perímetro', exact: true }).click();
    for (const name of ['Perímetro', 'Transformar', 'Vínculo']) {
      await left.getByRole('tab', { name, exact: true }).click();
      await noScroll();
    }
    await left.getByRole('button', { name: 'Cerrar panel izquierdo' }).click();
    await page.getByRole('button', { name: 'Exportar', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Exportar patrón' });
    for (const name of ['Contenido', 'Tamaño', 'Precisión']) {
      await dialog.getByRole('tab', { name, exact: true }).click();
      expect(await dialog.evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
      await expect(
        dialog.getByRole('button', { name: 'Descargar archivo', exact: true }),
      ).toBeInViewport();
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', { name: 'Exportar', exact: true })).toBeFocused();
  });
}

test('v2.3 cobertura de nodos, transformaciones, grupos y booleanas en propiedades', async ({
  page,
}) => {
  await page.goto('/');
  await project(page);
  await page.getByRole('button', { name: 'Crear polígono regular', exact: true }).click();
  let right = await styles(page, 'Objeto');
  await right.getByRole('tab', { name: 'Acciones', exact: true }).click();
  await right.getByRole('button', { name: 'Duplicar', exact: true }).click();
  expect((await project(page))!.patterns[0].sourceGeometry).toHaveLength(2);
  await page.locator('.studio-canvas').focus();
  await page.keyboard.press('Control+a');
  right = await styles(page, 'Objeto');
  await right.getByRole('tab', { name: 'Acciones', exact: true }).click();
  await right.getByRole('button', { name: 'Agrupar', exact: true }).click();
  const grouped = (await project(page))!.patterns[0].sourceGeometry;
  expect(grouped[0].groupId).toBeTruthy();
  expect(grouped[1].groupId).toBe(grouped[0].groupId);
  await context(page, 'Capas');
  await page.getByRole('tab', { name: /^Capas/ }).click();
  await page.locator('.layer-name').first().click();
  right = await styles(page, 'Objeto');
  await right.getByRole('tab', { name: 'Acciones', exact: true }).click();
  await right.getByRole('button', { name: 'Desagrupar', exact: true }).click();
  expect((await project(page))!.patterns[0].sourceGeometry.every((g) => !g.groupId)).toBe(true);
  await right.getByRole('tab', { name: 'Transformar', exact: true }).click();
  await right.getByRole('button', { name: 'Reflejar X', exact: true }).click();
  await right.getByRole('tab', { name: 'Nodos', exact: true }).click();
  await right.getByRole('button', { name: 'Convertir a paths editables', exact: true }).click();
  let path = (await project(page))!.patterns[0].sourceGeometry.find((g) => g.kind === 'path')!;
  expect(path).toBeTruthy();
  const count = path.nodes.length;
  await right.getByRole('button', { name: 'Insertar nodo', exact: true }).click();
  path = (await project(page))!.patterns[0].sourceGeometry.find((g) => g.kind === 'path')!;
  expect(path.nodes).toHaveLength(count + 1);
  await right.getByRole('button', { name: 'Eliminar nodo', exact: true }).click();
  await right.getByRole('button', { name: 'Curvar segmento', exact: true }).click();
  await right.getByRole('button', { name: 'Suavizar', exact: true }).click();
  await right.getByRole('button', { name: 'Nodo angular', exact: true }).click();
  expect(
    (await project(page))!.patterns[0].sourceGeometry.find((g) => g.kind === 'path')!.nodes[0].out,
  ).toEqual({ x: 0, y: 0 });
  await page.locator('.studio-canvas').focus();
  await page.keyboard.press('Control+a');
  right = await styles(page, 'Objeto');
  await right.getByRole('tab', { name: 'Acciones', exact: true }).click();
  await right.getByRole('button', { name: 'Unión', exact: true }).click();
  expect((await project(page))!.patterns[0].sourceGeometry).toHaveLength(1);
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  expect((await project(page))!.patterns[0].sourceGeometry).toHaveLength(2);
});

test('v2.3 presets completos y paleta siguen accesibles', async ({ page }) => {
  await page.goto('/');
  await project(page);
  await (await field(page, 'HEX de trazo')).fill('#123456');
  await (await field(page, 'Grosor de trazo')).fill('2');
  await (await field(page, 'Nombre del preset de estilo')).fill('Original');
  const right = page.getByRole('complementary', { name: 'Panel de estilos' });
  await right.getByRole('button', { name: 'Guardar nuevo', exact: true }).click();
  await right.getByRole('button', { name: 'Duplicar preset', exact: true }).click();
  await right.getByLabel('Nombre del preset de estilo').fill('Copia editada');
  await right.getByRole('button', { name: 'Renombrar', exact: true }).click();
  await (await field(page, 'Grosor de trazo')).fill('4');
  await styles(page, 'Presets');
  await right.getByRole('button', { name: 'Actualizar valores', exact: true }).click();
  expect(
    (await project(page))!.stylePresets.find((p) => p.name === 'Copia editada')!.style.strokeWidth,
  ).toBe(4);
  await right.getByRole('button', { name: 'Eliminar preset', exact: true }).click();
  expect((await project(page))!.stylePresets).toHaveLength(1);
  await right.getByLabel('Preset de estilo', { exact: true }).selectOption({ label: 'Original' });
  await right.getByRole('button', { name: 'Aplicar preset', exact: true }).click();
  expect((await project(page))!.drawingStyle.strokeWidth).toBe(2);
  await (await field(page, 'Aplicar color de paleta a')).selectOption('stroke');
  await right.getByRole('button', { name: 'Agregar a favoritos', exact: true }).click();
  await right.getByRole('button', { name: 'Agregar a proyecto', exact: true }).click();
  expect((await project(page))!.palette.colors).toContain('#123456');
  await right.getByLabel('Paleta', { exact: true }).selectOption('Favoritos');
  await expect(right.getByRole('button', { name: 'Favoritos #123456', exact: true })).toBeVisible();
});

test('v2.3 resize y Escape de menús conservan selección y evitan overlays simultáneos', async ({
  page,
}) => {
  await page.goto('/');
  await project(page);
  await page.getByRole('button', { name: 'Crear polígono regular', exact: true }).click();
  const before = await project(page);
  await page.locator('.main-menu summary').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.main-menu')).not.toHaveAttribute('open', '');
  await expect(page.locator('.statusbar')).toContainText('1 seleccionados');
  await page.setViewportSize({ width: 768, height: 800 });
  await expect(page.getByRole('complementary', { name: 'Panel contextual' })).toBeHidden();
  await expect(page.getByRole('complementary', { name: 'Panel de estilos' })).toBeVisible();
  await context(page, 'Preferencias');
  await expect(page.getByRole('complementary', { name: 'Panel de estilos' })).toBeHidden();
  await page.getByLabel('Unidades', { exact: true }).focus();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('complementary', { name: 'Panel contextual' })).toBeHidden();
  expect(await project(page)).toEqual(before);
  await expect(page.locator('.statusbar')).toContainText('1 seleccionados');
});
