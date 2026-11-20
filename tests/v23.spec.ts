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
    for (const action of [
      page.getByRole('button', { name: 'Buscar comandos', exact: true }),
      page.getByRole('button', { name: 'Exportar', exact: true }),
      page.locator('.main-menu summary'),
    ]) {
      await expect(action).toBeInViewport();
      const box = (await action.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
    }
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
  const box = (await style.boundingBox())!;
  const rail = (await page
    .getByRole('navigation', { name: 'Accesos del panel derecho' })
    .boundingBox())!;
  expect(Math.abs(box.x + box.width - rail.x)).toBeLessThanOrEqual(1);
  expect(rail.x + rail.width).toBeGreaterThan(1400);
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
    expect(
      await right.getByLabel('Tipo de relleno', { exact: true }).evaluate((el) => {
        const s = getComputedStyle(el);
        return (
          parseFloat(s.lineHeight) + parseFloat(s.paddingTop) + parseFloat(s.paddingBottom) <=
          el.clientHeight
        );
      }),
    ).toBe(true);
    const before = await project(page);
    for (const name of ['Trazo', 'Perfil', 'Fill', 'Paleta', 'Presets', 'Opciones', 'Objeto']) {
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
    await left
      .getByLabel('Nombre del documento', { exact: true })
      .fill(`Proyecto ${viewport.width}`);
    await expect
      .poll(async () => (await project(page))!.metadata.name)
      .toBe(`Proyecto ${viewport.width}`);
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
  await expect(page.getByRole('complementary', { name: 'Panel de estilos' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('.main-menu')).not.toHaveAttribute('open', '');
  await expect(page.locator('.statusbar')).toContainText('1 seleccionados');
  await page.getByRole('button', { name: 'Panel derecho: Objeto', exact: true }).click();
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

for (const width of [1440, 390]) {
  test(`barra derecha abre secciones, recuerda tab y habilita Objeto con selección ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const before = await project(page);
    const panel = page.getByRole('complementary', { name: 'Panel de estilos' });
    const rail = page.getByRole('navigation', { name: 'Accesos del panel derecho' });
    const object = rail.getByRole('button', { name: 'Panel derecho: Objeto', exact: true });
    await expect(object).toBeDisabled();
    for (const tab of ['Trazo', 'Perfil', 'Fill', 'Paleta', 'Presets', 'Opciones']) {
      const button = rail.getByRole('button', { name: `Panel derecho: ${tab}`, exact: true });
      await expect(button).toBeInViewport();
      await button.click();
      await expect(panel).toBeVisible();
      await expect(panel.getByRole('tab', { name: tab, exact: true })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      await rail.getByRole('button', { name: 'Plegar panel derecho', exact: true }).click();
      await expect(panel).toHaveCount(0);
      await rail.getByRole('button', { name: 'Desplegar panel derecho', exact: true }).click();
      await expect(panel.getByRole('tab', { name: tab, exact: true })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    }
    expect(await project(page)).toEqual(before);
    const layout = await rail.evaluate((el) => ({
      right: el.getBoundingClientRect().right,
      width: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(layout.right).toBeLessThanOrEqual(width);
    expect(layout.scroll).toBe(layout.width);
    await page.getByRole('button', { name: 'Crear polígono regular', exact: true }).click();
    await expect(object).toBeEnabled();
    await rail.getByRole('button', { name: 'Plegar panel derecho', exact: true }).click();
    await object.click();
    await expect(panel.getByRole('tab', { name: 'Objeto', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByLabel('Lados', { exact: true })).toBeVisible();
    await page.screenshot({ path: `.runtime/right-rail-${width}.png`, animations: 'disabled' });
  });
}

for (const width of [1440, 768, 390]) {
  test(`Archivo y Exportar cierran antes el panel derecho, incluso fijado ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await project(page);
    const panel = page.getByRole('complementary', { name: 'Panel de estilos' });
    const menu = page.locator('.main-menu');
    for (const keyboard of [false, true]) {
      await page.getByRole('button', { name: 'Panel derecho: Fill', exact: true }).click();
      const pin = page.getByRole('button', { name: 'Fijar panel de estilos', exact: true });
      if ((await pin.getAttribute('aria-pressed')) !== 'true') await pin.click();
      const before = await project(page);
      const summary = menu.locator('summary');
      if (keyboard) {
        await summary.focus();
        await page.keyboard.press('Enter');
      } else await summary.click();
      await expect(menu).toHaveAttribute('open', '');
      await expect(panel).toHaveCount(0);
      await menu
        .getByRole('button', { name: 'Nuevo proyecto', exact: true })
        .click({ trial: true });
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Panel derecho: Trazo', exact: true }).click();
      await page.getByRole('button', { name: 'Exportar', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Exportar patrón' })).toBeVisible();
      await expect(panel).toHaveCount(0);
      await expect(menu).not.toHaveAttribute('open', '');
      await page.keyboard.press('Escape');
      await expect(panel).toHaveCount(0);
      expect(await project(page)).toEqual(before);
    }
  });
}

for (const width of [1440, 390]) {
  test(`estudio nuevo inicia P3 al100 centrado con dibujo libre y estructura50 ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    let p = (await project(page))!;
    expect(p.mainSymmetry).toMatchObject({ family: 'wallpaper', group: 'p3' });
    expect(p.preferences).toMatchObject({ structureVisible: true, structureOpacity: 0.5 });
    await expect(page.getByRole('button', { name: 'Dibujo libre', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByLabel('Estructura matemática de simetría')).toBeVisible();
    await expect(page.getByLabel('Opacidad de la estructura', { exact: true })).toHaveValue('0.5');
    const checkView = async () => {
      const v = await page.locator('.studio-canvas').evaluate((el) => {
        const svg = el as SVGSVGElement,
          b = svg.getBoundingClientRect(),
          m = svg.getScreenCTM()!;
        return { scale: m.a, cx: m.e - (b.x + b.width / 2), cy: m.f - (b.y + b.height / 2) };
      });
      expect(v.scale).toBeCloseTo(7.559055118, 3);
      expect(Math.abs(v.cx)).toBeLessThan(1);
      expect(Math.abs(v.cy)).toBeLessThan(1);
    };
    await checkView();
    const ink = await page.locator('.studio-canvas').evaluate(async (el) => {
      const svg = el as SVGSVGElement,
        copy = svg.cloneNode(true) as SVGSVGElement,
        b = svg.getBoundingClientRect();
      copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      copy.setAttribute('width', String(b.width));
      copy.setAttribute('height', String(b.height));
      const image = new Image();
      image.src =
        'data:image/svg+xml,' + encodeURIComponent(new XMLSerializer().serializeToString(copy));
      await image.decode();
      const c = document.createElement('canvas');
      c.width = Math.ceil(b.width);
      c.height = Math.ceil(b.height);
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = getComputedStyle(svg).backgroundColor;
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(image, 0, 0);
      const point = new DOMPoint(5, 10).matrixTransform(svg.getScreenCTM()!);
      const pixels = ctx.getImageData(
        Math.floor(point.x - b.x) - 1,
        Math.floor(point.y - b.y) - 1,
        3,
        3,
      ).data;
      for (let i = 0; i < pixels.length; i += 4)
        if (pixels[i] < 110 && pixels[i + 1] < 110 && pixels[i + 2] < 110 && pixels[i + 3] > 200)
          return true;
      return false;
    });
    expect(ink).toBe(true);
    const grid = page.getByRole('button', { name: 'Mostrar grilla', exact: true });
    await expect(grid).toBeInViewport();
    await expect(grid).toHaveAttribute('title', /5 mm/);
    await grid.click();
    expect((await project(page))!.preferences.grid).toBe(false);
    expect((await project(page))!.preferences.snap).toBe(p.preferences.snap);
    await expect(page.getByLabel('Estructura matemática de simetría')).toBeVisible();
    await page.getByRole('button', { name: 'Acercar', exact: true }).click();
    await page.locator('.main-menu summary').click();
    await page.getByRole('button', { name: 'Nuevo proyecto', exact: true }).click();
    p = (await project(page))!;
    expect(p.mainSymmetry.group).toBe('p3');
    await checkView();
    await expect(page.getByRole('button', { name: 'Dibujo libre', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.screenshot({ path: `.runtime/p3-start-${width}.png`, animations: 'disabled' });
    // Recovery preserves the saved document rather than imposing fresh defaults.
    await page.evaluate(async () => {
      const { recover, autosave } = await import('/src/persistence/storage.ts');
      const p = (await recover())!;
      p.mainSymmetry = { ...p.mainSymmetry, family: 'none', group: 'none' };
      p.preferences.structureVisible = false;
      p.preferences.structureOpacity = 0.27;
      await autosave(p);
    });
    await page.reload();
    p = (await project(page))!;
    expect(p.mainSymmetry.group).toBe('none');
    expect(p.preferences.structureOpacity).toBe(0.27);
    await expect(page.getByRole('button', { name: 'Dibujo libre', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
}

test.describe('Guardado en hora local', () => {
  test.use({ timezoneId: 'America/Argentina/Buenos_Aires' });
  test('Archivo nombra la descarga, propone fecha local y cancelar conserva el documento', async ({
    page,
  }) => {
    await page.clock.setFixedTime(new Date('2026-11-20T19:47:00Z'));
    await page.goto('/');
    const before = (await project(page))!;
    await expect(page.locator('.topbar .app-title')).toHaveText('PatternsPatrones Geométricos');
    await expect(page.locator('.topbar input:visible')).toHaveCount(0);
    await page.locator('.main-menu summary').click();
    await page.getByRole('button', { name: 'Guardar archivo JSON', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Guardar proyecto', exact: true });
    await expect(dialog.getByLabel('Nombre del archivo')).toHaveValue('Estudio-26-11-20-16-47');
    await dialog.getByLabel('Nombre del archivo').fill('No conservar');
    await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
    expect(await project(page)).toEqual(before);
    await page.locator('.main-menu summary').click();
    await page.getByLabel('Nombre del proyecto', { exact: true }).fill('Mi patrón');
    await page.getByRole('button', { name: 'Guardar archivo JSON', exact: true }).click();
    await expect(dialog.getByLabel('Nombre del archivo')).toHaveValue('Mi patrón');
    await dialog.getByLabel('Nombre del archivo').fill('Patrón final');
    const downloaded = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Guardar archivo', exact: true }).click();
    const file = await downloaded;
    expect(file.suggestedFilename()).toBe('Patrón final.pattern.json');
    const { readFile } = await import('node:fs/promises');
    const stored = JSON.parse(await readFile((await file.path())!, 'utf8'));
    expect(stored.metadata.name).toBe('Patrón final');
    expect(stored.patterns).toEqual(before.patterns);
    expect((await project(page))!.metadata.name).toBe('Patrón final');
    await page.reload();
    await page.locator('.main-menu summary').click();
    await expect(page.getByLabel('Nombre del proyecto', { exact: true })).toHaveValue(
      'Patrón final',
    );
  });
});

test('celda centrada, escala compartida y Trazo con deslizador 0–2 sin perder anchos existentes', async ({
  page,
}) => {
  await page.goto('/');
  const before = (await project(page))!;
  await page.getByRole('button', { name: 'Vista dividida', exact: true }).click();
  const canvases = page.locator('.studio-canvas');
  await expect(canvases).toHaveCount(2);
  await expect(canvases.first().locator('[data-single-cell]')).toHaveCount(1);
  await expect(canvases.last().locator('[data-single-cell]')).toHaveCount(0);
  const scales = () =>
    canvases.evaluateAll((els) => els.map((el) => (el as SVGSVGElement).getScreenCTM()!.a));
  const shared = async () =>
    expect
      .poll(async () => {
        const v = await scales();
        return Math.abs(v[0] - v[1]);
      })
      .toBeLessThan(0.001);
  await shared();
  const initial = (await scales())[0];
  await page.getByRole('button', { name: 'Acercar', exact: true }).last().click();
  await shared();
  expect((await scales())[0]).toBeGreaterThan(initial);
  await page.getByRole('button', { name: 'Alejar', exact: true }).first().click();
  await shared();
  expect((await scales())[0]).toBeCloseTo(initial, 3);
  const rect = await canvases.last().boundingBox();
  await page.mouse.move(rect!.x + rect!.width / 2, rect!.y + rect!.height / 2);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -80);
  await page.keyboard.up('Control');
  await expect.poll(async () => (await scales())[0]).toBeGreaterThan(initial);
  await shared();
  await page.setViewportSize({ width: 1280, height: 900 });
  await shared();
  const centered = await canvases.first().evaluate((el) => {
    const svg = el as SVGSVGElement,
      boundary = svg.querySelector('[aria-label="Límite de la celda"]') as SVGGraphicsElement;
    const box = boundary.getBBox(),
      p = new DOMPoint(box.x + box.width / 2, box.y + box.height / 2).matrixTransform(
        svg.getScreenCTM()!,
      ),
      r = svg.getBoundingClientRect();
    return Math.hypot(p.x - r.x - r.width / 2, p.y - r.y - r.height / 2);
  });
  expect(centered).toBeLessThan(1);
  expect((await project(page))!.patterns).toEqual(before.patterns);
  await page.getByRole('button', { name: 'Una celda', exact: true }).click();
  await expect(canvases).toHaveCount(1);
  await expect(canvases.locator('[data-single-cell]')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Fuente pura', exact: true })).toHaveCount(0);
  const panel = await styles(page, 'Trazo');
  await expect(panel.getByLabel('Grosor de trazo deslizador', { exact: true })).toHaveAttribute(
    'max',
    '2',
  );
  await panel.getByLabel('Grosor de trazo', { exact: true }).fill('5');
  await expect(panel.getByLabel('Grosor de trazo', { exact: true })).toHaveValue('5');
  await expect(panel.getByLabel('Grosor de trazo deslizador', { exact: true })).toHaveValue('2');
  expect((await project(page))!.drawingStyle.strokeWidth).toBe(5);
});

test('celda de referencia recorta también selección y nodos de un garabato iniciado afuera', async ({
  page,
}) => {
  await page.goto('/');
  await project(page);
  const points = await page.locator('.studio-canvas').evaluate((el) =>
    [
      [5, -20],
      [20, -15],
      [10, -10],
      [30, -5],
    ].map(([x, y]) => {
      const p = new DOMPoint(x, y).matrixTransform((el as SVGSVGElement).getScreenCTM()!);
      return { x: p.x, y: p.y };
    }),
  );
  await page.mouse.move(points[0].x, points[0].y);
  await page.mouse.down();
  for (const p of points.slice(1)) await page.mouse.move(p.x, p.y, { steps: 8 });
  await page.mouse.up();
  const original = (await project(page))!.patterns;
  expect(original[0].sourceGeometry).toHaveLength(1);
  await page.getByRole('button', { name: 'Vista dividida', exact: true }).click();
  const reference = page.locator('.studio-canvas').first();
  const ink = () =>
    reference.evaluate(async (el) => {
      const svg = el as SVGSVGElement,
        copy = svg.cloneNode(true) as SVGSVGElement,
        r = svg.getBoundingClientRect();
      copy
        .querySelectorAll(
          'rect[fill*="-grid"], [aria-label="Estructura matemática de simetría"], [aria-label="Límite de la celda"]',
        )
        .forEach((node) => node.remove());
      copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      copy.setAttribute('width', String(r.width));
      copy.setAttribute('height', String(r.height));
      const image = new Image();
      image.src =
        'data:image/svg+xml,' + encodeURIComponent(new XMLSerializer().serializeToString(copy));
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(r.width);
      canvas.height = Math.ceil(r.height);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(image, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const view = svg.viewBox.baseVal,
        scale = r.width / view.width;
      let outside = 0,
        inside = 0;
      for (let y = 0; y < canvas.height; y++)
        for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4;
          if (data[i + 3] < 100 || data[i] > 180 || data[i + 1] > 190 || data[i + 2] > 180)
            continue;
          const worldY = view.y + y / scale;
          if (worldY < -1) outside++;
          else if (worldY > 1) inside++;
        }
      return { outside, inside };
    });
  const check = async () => {
    await expect.poll(async () => (await ink()).outside).toBe(0);
    expect((await ink()).inside).toBeGreaterThan(30);
    expect((await project(page))!.patterns).toEqual(original);
  };
  await check();
  await page.getByRole('button', { name: 'Editar nodos', exact: true }).click();
  await expect(reference.locator('[data-editing-handles]')).toHaveCount(1);
  await check();
  await page.getByRole('button', { name: 'Una celda', exact: true }).click();
  await expect(page.locator('.studio-canvas')).toHaveCount(1);
  await check();
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click(); // single-cell view
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click(); // split view
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click(); // drawing
  expect((await project(page))!.patterns[0].sourceGeometry).toHaveLength(0);
  await page.getByRole('button', { name: 'Rehacer', exact: true }).click();
  expect((await project(page))!.patterns).toEqual(original);
});

for (const mode of ['split', 'single'] as const) {
  test(`celda fija permite zoom y bloquea todos los gestos de pan: ${mode}`, async ({ page }) => {
    await page.goto('/');
    const original = (await project(page))!.patterns;
    if (mode === 'split')
      await page.getByRole('button', { name: 'Vista dividida', exact: true }).click();
    else {
      await page.getByRole('tab', { name: 'Patrón', exact: true }).click();
      await page.getByRole('button', { name: 'Una celda', exact: true }).click();
    }
    const reference = page.locator('.studio-canvas').first();
    const camera = () => reference.getAttribute('viewBox');
    const centered = async () => {
      const delta = await reference.evaluate((el) => {
        const svg = el as SVGSVGElement,
          rect = svg.getBoundingClientRect(),
          b = (
            svg.querySelector('[aria-label="Límite de la celda"]') as SVGGraphicsElement
          ).getBBox();
        const p = new DOMPoint(b.x + b.width / 2, b.y + b.height / 2).matrixTransform(
          svg.getScreenCTM()!,
        );
        return Math.hypot(p.x - rect.x - rect.width / 2, p.y - rect.y - rect.height / 2);
      });
      expect(delta).toBeLessThan(1);
    };
    await centered();
    const before = await camera();
    const drag = async (button: 'left' | 'middle' = 'left') => {
      const r = (await reference.boundingBox())!,
        x = r.x + r.width / 2,
        y = r.y + r.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down({ button });
      await page.mouse.move(x + 55, y + 25, { steps: 5 });
      await page.mouse.up({ button });
    };
    await drag('middle');
    expect(await camera()).toBe(before);
    await reference.focus();
    await page.keyboard.down('Space');
    await drag();
    await page.keyboard.up('Space');
    expect(await camera()).toBe(before);
    const r = (await reference.boundingBox())!;
    await page.mouse.move(r.x + 20, r.y + 50);
    await page.mouse.wheel(80, 100);
    await page.waitForTimeout(100);
    expect(await camera()).toBe(before);
    await page.getByRole('button', { name: 'Desplazar vista', exact: true }).click();
    await drag();
    expect(await camera()).toBe(before);
    await page.mouse.move(r.x + 20, r.y + 50);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -80);
    await page.keyboard.up('Control');
    await expect.poll(camera).not.toBe(before);
    await centered();
    const zoomed = await camera();
    await page.getByRole('button', { name: 'Alejar', exact: true }).first().click();
    await expect.poll(camera).not.toBe(zoomed);
    await centered();
    await page.getByRole('button', { name: 'Restablecer vista', exact: true }).first().click();
    await centered();
    if (mode === 'split') {
      const scales = await page
        .locator('.studio-canvas')
        .evaluateAll((els) => els.map((el) => (el as SVGSVGElement).getScreenCTM()!.a));
      expect(scales[0]).toBeCloseTo(scales[1], 3);
      await page.getByRole('button', { name: 'Vista dividida', exact: true }).click();
    } else await page.getByRole('button', { name: 'Una celda', exact: true }).click();
    const repeated = await camera();
    await drag();
    await expect.poll(camera).not.toBe(repeated);
    expect((await project(page))!.patterns).toEqual(original);
  });
}
