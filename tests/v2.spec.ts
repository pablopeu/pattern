import { test, expect, type Page } from '@playwright/test';

async function ready(page: Page) {
  await page.goto('/');
  await saved(page);
}
async function saved(page: Page) {
  await expect(page.locator('.save-indicator')).toHaveText(/Guardado local/);
}
async function model(page: Page) {
  return page.evaluate(async () => await (await import('/src/persistence/storage.ts')).recover());
}
async function at(page: Page, x: number, y: number) {
  return page
    .locator('.studio-canvas')
    .first()
    .evaluate(
      (svg, p) => {
        const q = new DOMPoint(p.x, p.y).matrixTransform((svg as SVGSVGElement).getScreenCTM()!);
        return { x: q.x, y: q.y };
      },
      { x, y },
    );
}
async function clickAt(page: Page, x: number, y: number) {
  const p = await at(page, x, y);
  await page.mouse.click(p.x, p.y);
}
async function line(page: Page, a: [number, number], b: [number, number]) {
  const p = await at(page, ...a),
    q = await at(page, ...b);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(q.x, q.y, { steps: 5 });
  await page.mouse.up();
  await saved(page);
}
async function fixture(page: Page, group: string) {
  await page.evaluate(async (group) => {
    const { newProject, geometry, node } = await import('/src/app/model.ts');
    const { autosave } = await import('/src/persistence/storage.ts');
    const p = newProject(),
      pat = p.patterns[0];
    pat.symmetryMode = 'own';
    pat.symmetry = { ...pat.symmetry, family: 'wallpaper', group, angle: 90 };
    const g = geometry('path', [node(7, 11), node(22, 17), node(13, 28)], true);
    g.fill = '#55765b';
    pat.sourceGeometry = [g];
    p.preferences.snap = false;
    await autosave(p);
  }, group);
  await page.reload();
  await saved(page);
}

test('AC-21/29/30/31: Libre, miniaturas reales, hover puro y confirmación por teclado', async ({
  page,
}) => {
  await ready(page);
  expect((await model(page))?.mainSymmetry.family).toBe('none');
  await page.getByRole('button', { name: 'Línea', exact: true }).click();
  await line(page, [0, 0], [20, 15]);
  await expect(page.locator('.studio-canvas use')).toHaveCount(1);
  await expect(page.locator('.dynamic-symmetry-grid')).toHaveAttribute(
    'data-preview-completed',
    '27',
  );
  const before = JSON.stringify(await model(page)),
    thumb = page.locator('[data-symmetry-id="wallpaper:p4m"] img');
  const original = await thumb.getAttribute('src');
  await page.getByRole('button', { name: 'Simetría p4m', exact: true }).hover();
  await expect(page.locator('.gallery-details')).toContainText('Previsualización');
  expect(await page.locator('.studio-canvas use').count()).toBeGreaterThan(1);
  expect(JSON.stringify(await model(page))).toBe(before);
  await page.getByRole('button', { name: 'Línea', exact: true }).hover();
  await expect(page.locator('.studio-canvas use')).toHaveCount(1);
  const button = page.getByRole('button', { name: 'Simetría p4m', exact: true });
  await button.focus();
  await button.press('Enter');
  await saved(page);
  expect((await model(page))?.mainSymmetry.group).toBe('p4m');
  await expect(page.getByRole('button', { name: 'Línea', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  await saved(page);
  expect((await model(page))?.mainSymmetry.family).toBe('none');
  expect((await model(page))?.patterns[0].sourceGeometry).toHaveLength(1);
  await page.getByRole('button', { name: 'Rehacer', exact: true }).click();
  await saved(page);
  expect((await model(page))?.mainSymmetry.group).toBe('p4m');
  await line(page, [30, 30], [38, 42]);
  await expect(thumb).not.toHaveAttribute('src', original!);
});

// DOMPoint and Chromium pointer coordinates use float32; allow <0.00005 mm here.
// Pure inverse and round-trip preservation are verified separately without this tolerance.
for (const group of ['pm', 'p4', 'p6'])
  test(`AC-24/25/26/32: crear desde ${group} con inversa fija al cruzar celdas`, async ({
    page,
  }) => {
    await ready(page);
    await fixture(page, group);
    const data = await page.evaluate(async (group) => {
      const { recover } = await import('/src/persistence/storage.ts');
      const { buildScene } = await import('/src/patterns/engine.ts');
      const { apply, inverse } = await import('/src/geometry/matrix.ts');
      const p = (await recover())!,
        pat = p.patterns[0],
        scene = buildScene(pat, { x: -100, y: -100, width: 200, height: 200 });
      const instance = scene.instances.find(
        (i) =>
          i.cell[0] === 0 &&
          i.cell[1] === 0 &&
          (group === 'pm'
            ? i.matrix[0] * i.matrix[3] - i.matrix[1] * i.matrix[2] < 0
            : Math.abs(i.matrix[1]) > 0.5),
      )!;
      const a = apply(instance.matrix, { x: 13, y: 18 }),
        b = { x: a.x + 65, y: a.y + 10 };
      return {
        a,
        b,
        canonicalA: apply(inverse(instance.matrix), a),
        canonicalB: apply(inverse(instance.matrix), b),
        source: pat.sourceGeometry[0],
      };
    }, group);
    await page.getByRole('button', { name: 'Editar nodos', exact: true }).click();
    await clickAt(page, data.a.x, data.a.y);
    await expect(page.getByLabel('Nodo 1', { exact: true })).toBeVisible();
    // Explicitly selected instance has priority over nearest-cell changes during the stroke.
    await page.getByRole('button', { name: 'Línea', exact: true }).click();
    const a = await at(page, data.a.x, data.a.y),
      b = await at(page, data.b.x, data.b.y);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 7 });
    await expect(page.locator('.capture-indicator')).toContainText('Captura fija');
    expect(await page.locator('.studio-canvas defs g path').count()).toBe(2);
    await page.mouse.up();
    await saved(page);
    const p = await model(page),
      sources = p!.patterns[0].sourceGeometry;
    expect(sources).toHaveLength(2);
    expect(sources[0]).toEqual(data.source);
    expect(sources[1].nodes[0].x).toBeCloseTo(data.canonicalA.x, 4);
    expect(sources[1].nodes[0].y).toBeCloseTo(data.canonicalA.y, 4);
    expect(sources[1].nodes[1].x).toBeCloseTo(data.canonicalB.x, 4);
    expect(sources[1].nodes[1].y).toBeCloseTo(data.canonicalB.y, 4);
    await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
    await saved(page);
    expect((await model(page))?.patterns[0].sourceGeometry).toHaveLength(1);
  });

test('AC-27/31/32/40: Pluma abierta conserva captura y nodos al cambiar grupo y modo', async ({
  page,
}) => {
  await ready(page);
  await page.getByRole('button', { name: 'Pluma Bézier', exact: true }).click();
  await clickAt(page, 10, 10);
  await clickAt(page, 20, 10);
  await page.getByRole('button', { name: 'Simetría p4m', exact: true }).click();
  await page.getByRole('tab', { name: 'Patrón', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pluma Bézier', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await clickAt(page, 30, 20);
  await page.keyboard.press('Enter');
  await saved(page);
  let p = await model(page);
  expect(p?.patterns[0].sourceGeometry).toHaveLength(1);
  expect(p?.patterns[0].sourceGeometry[0].nodes.map((n) => [n.x, n.y])).toEqual([
    [10, 10],
    [20, 10],
    [30, 20],
  ]);
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  await saved(page);
  p = await model(page);
  expect(p?.mainSymmetry.family).toBe('none');
  expect(p?.patterns[0].sourceGeometry[0].nodes).toHaveLength(3);
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  await saved(page);
  expect((await model(page))?.patterns[0].sourceGeometry).toHaveLength(0);
});

test('AC-34/35: origen arrastrable y vista de una celda conservan fuentes y exportación', async ({
  page,
}) => {
  await ready(page);
  await fixture(page, 'p4m');
  const before = (await model(page))!.patterns[0].sourceGeometry;
  const a = await at(page, 0, 0),
    b = await at(page, 8, -7);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 4 });
  await page.mouse.up();
  await saved(page);
  let p = (await model(page))!;
  expect(p.patterns[0].symmetry.origin.x).toBeCloseTo(8, 4);
  expect(p.patterns[0].symmetry.origin.y).toBeCloseTo(-7, 4);
  expect(p.patterns[0].sourceGeometry).toEqual(before);
  await page.getByRole('button', { name: 'Una celda', exact: true }).click();
  await expect(page.locator('[data-single-cell="true"]')).toHaveCount(1);
  await saved(page);
  p = (await model(page))!;
  expect(p.patterns[0].sourceGeometry).toEqual(before);
  await page.getByRole('button', { name: 'Simetría Libre', exact: true }).click();
  await expect(page.locator('.origin-handle')).toHaveCount(0);
  await expect(page.locator('[data-single-cell="true"]')).toHaveCount(0);
});

test('AC-36: conjuntos heredados, propios y libres se editan y componen sin falsa celda común', async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(async () => {
    const { newProject, newPattern, geometry } = await import('/src/app/model.ts');
    const { autosave } = await import('/src/persistence/storage.ts');
    const p = newProject();
    p.mainSymmetry = { ...p.mainSymmetry, family: 'wallpaper', group: 'p4m', angle: 90 };
    p.preferences.snap = false;
    const inherited = p.patterns[0];
    inherited.name = 'Heredado';
    const own = newPattern();
    own.name = 'Radial propio';
    own.symmetry = { ...own.symmetry, family: 'radial', group: 'Dn' };
    const free = newPattern();
    free.name = 'Libre';
    free.symmetryMode = 'free';
    p.patterns = [inherited, own, free];
    for (let i = 0; i < 3; i++) {
      const g = geometry('rectangle', [], true);
      g.parameters = { x: i * 32 + 5, y: 8, width: 10, height: 7, radius: 0, sides: 4 };
      g.fill = ['#aa3344', '#227755', '#3355bb'][i];
      p.patterns[i].sourceGeometry = [g];
    }
    await autosave(p);
  });
  await page.reload();
  await saved(page);
  await expect(page.locator('.studio-canvas [data-pattern-id]')).toHaveCount(3);
  await expect(page.locator('.periodicity-status')).toContainText('sin celda común');
  await page.getByLabel('Editar simetría de', { exact: true }).selectOption('project');
  await page.getByRole('button', { name: 'Simetría p6m', exact: true }).click();
  await saved(page);
  const p = (await model(page))!;
  expect(p.mainSymmetry.group).toBe('p6m');
  expect(p.patterns[1].symmetry.group).toBe('Dn');
  expect(p.patterns[2].symmetryMode).toBe('free');
  await clickAt(page, 74, 11);
  await expect(page.getByLabel('Simetría del conjunto', { exact: true })).toHaveValue('free');
  for (const [x, y, name, index] of [
    [74, 11, 'Libre editado', 2],
    [43, 11, 'Radial editado', 1],
    [10, 11, 'Heredado editado', 0],
  ] as const) {
    await clickAt(page, x, y);
    await page.getByLabel('Nombre del objeto', { exact: true }).fill(name);
    await saved(page);
    expect((await model(page))!.patterns[index].sourceGeometry[0].name).toBe(name);
  }

  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  await expect(page.getByLabel('Contenido', { exact: true })).toHaveValue('composition');
  await expect(page.getByAltText('Previsualización de exportación')).toBeVisible();
  await page.getByLabel('Qué exportar', { exact: true }).selectOption('tile');
  await expect(page.getByRole('alert')).toContainText('común');
});

test('AC-27: el contexto se conserva al confirmar un grupo con el puntero capturado', async ({
  page,
}) => {
  await ready(page);
  await page.getByRole('button', { name: 'Línea', exact: true }).click();
  const a = await at(page, 10, 10),
    b = await at(page, 25, 15),
    c = await at(page, 35, 25);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y);
  // A second input device can confirm the group without releasing the captured pointer.
  await page
    .locator('[data-symmetry-id="wallpaper:p6m"]')
    .evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.locator('.capture-indicator')).toContainText('Captura fija');
  await page.mouse.move(c.x, c.y);
  await page.mouse.up();
  await saved(page);
  const p = (await model(page))!;
  expect(p.mainSymmetry.group).toBe('p6m');
  expect(p.patterns[0].sourceGeometry).toHaveLength(1);
  expect(p.patterns[0].sourceGeometry[0].nodes.map((n) => [n.x, n.y])).toEqual([
    [10, 10],
    [35, 25],
  ]);
});

test('AC-23/32: Lápiz y estilo continúan al recorrer grupos sin cambiar de contexto', async ({
  page,
}) => {
  await ready(page);
  await page.getByRole('button', { name: 'Dibujo libre', exact: true }).click();
  let drawn = 0;
  for (const name of ['Simetría Libre', 'Simetría p4m', 'Simetría p6m', 'Simetría Libre']) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.getByRole('button', { name: 'Dibujo libre', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await line(page, [8, 10], [23, 24]);
    if (drawn++ === 0) {
      await page.getByLabel('Color de trazo', { exact: true }).fill('#b3364d');
      await page.getByLabel('Grosor de trazo', { exact: true }).fill('1.25');
      await saved(page);
    }
  }
  expect((await model(page))!.patterns[0].sourceGeometry).toHaveLength(4);
  expect(
    (await model(page))!.patterns[0].sourceGeometry.every(
      (g) => g.stroke === '#b3364d' && g.strokeWidth === 1.25,
    ),
  ).toBe(true);
  await expect(page.locator('.studio-canvas use')).toHaveCount(1);
});

test('AC-30/31: flechas, Espacio y toque confirman opciones sin reiniciar la herramienta', async ({
  browser,
}) => {
  const context = await browser.newContext({
      hasTouch: true,
      viewport: { width: 1440, height: 900 },
    }),
    page = await context.newPage();
  try {
    await ready(page);
    await page.getByRole('button', { name: 'Dibujo libre', exact: true }).tap();
    const first = page.getByRole('button', { name: 'Simetría p1', exact: true });
    await first.tap();
    await saved(page);
    expect((await model(page))!.mainSymmetry.group).toBe('p1');
    await first.focus();
    await first.press('ArrowRight');
    await expect(page.getByRole('button', { name: 'Simetría p2', exact: true })).toBeFocused();
    expect((await model(page))!.mainSymmetry.group).toBe('p1');
    await page.keyboard.press('Space');
    await saved(page);
    expect((await model(page))!.mainSymmetry.group).toBe('p2');
    await expect(page.getByRole('button', { name: 'Dibujo libre', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  } finally {
    await context.close();
  }
});

test('AC-29: cambios de preferencias no dejan una tanda de miniaturas incompleta', async ({
  page,
}) => {
  await ready(page);
  await page.getByRole('button', { name: 'Línea', exact: true }).click();
  await line(page, [10, 10], [20, 20]);
  await expect(page.locator('.dynamic-symmetry-grid')).toHaveAttribute(
    'data-preview-completed',
    '27',
  );
  const previous = await page
    .locator('[data-symmetry-id="none:none"]')
    .getAttribute('data-preview-revision');
  await line(page, [25, 10], [30, 20]);
  await page.getByRole('button', { name: 'Mostrar grilla', exact: true }).click();
  await expect(page.locator('[data-symmetry-id="none:none"]')).not.toHaveAttribute(
    'data-preview-revision',
    previous!,
  );
  await expect(page.locator('.dynamic-symmetry-grid')).toHaveAttribute(
    'data-preview-completed',
    '27',
  );
  await expect(page.locator('.dynamic-symmetry-grid')).toHaveAttribute(
    'data-preview-pending',
    'false',
  );
});

test('AC-31: deshacer un conjunto activo permite seguir dibujando en el conjunto existente', async ({
  page,
}) => {
  await ready(page);
  await page.getByRole('button', { name: 'Nuevo patrón', exact: true }).click();
  await saved(page);
  expect((await model(page))!.patterns).toHaveLength(2);
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  await saved(page);
  await page.getByRole('button', { name: 'Línea', exact: true }).click();
  await line(page, [10, 10], [20, 20]);
  expect((await model(page))!.patterns).toHaveLength(1);
  expect((await model(page))!.patterns[0].sourceGeometry).toHaveLength(1);
});
