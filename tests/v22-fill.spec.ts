import { test, expect, type Page } from '@playwright/test';
async function saved(page: Page) {
  await expect(page.locator('.save-indicator')).toHaveText(/Guardado local/);
}
async function setup(page: Page, kind = 'lines') {
  await page.goto('/');
  await saved(page);
  await page.evaluate(async (kind) => {
    const { newProject, geometry, node } = await import('/src/app/model.ts');
    const { newTiling } = await import('/src/tiling/tiles.ts');
    const { autosave } = await import('/src/persistence/storage.ts');
    const p = newProject();
    p.preferences.snap = false;
    p.preferences.grid = false;
    p.drawingStyle.fill = '#ed3040';
    const pattern = p.patterns[0];
    if (kind === 'closed')
      pattern.sourceGeometry = [
        {
          ...geometry('compound', [], true),
          pathData: 'M0 0L30 0L30 30L0 30Z M10 10L20 10L20 20L10 20Z',
        },
      ];
    else if (kind === 'tile') pattern.tiling = newTiling('square');
    else if (kind === 'periodic' || kind === 'cross-cell') {
      p.mainSymmetry = {
        ...p.mainSymmetry,
        family: 'wallpaper',
        group: 'p1',
        width: 20,
        height: 20,
      };
      pattern.sourceGeometry = [
        geometry('path', [node(0, 0), node(20, 0)]),
        geometry('path', [node(0, 0), node(0, 20)]),
      ];
      if (kind === 'cross-cell')
        pattern.sourceGeometry = [
          geometry('path', [node(10, 10), node(30, 10)]),
          geometry('path', [node(10, 10), node(10, 30)]),
        ];
    } else
      pattern.sourceGeometry = ['M0 0L30 0', 'M20 0L20 20', 'M30 20L0 20', 'M0 20L0 0'].map(
        (pathData) => ({ ...geometry('compound'), pathData }),
      );
    if (kind === 'tile-grid') {
      pattern.tiling = newTiling('square');
      pattern.sourceGeometry = [
        geometry('path', [node(-5, 15), node(65, 15)]),
        geometry('path', [node(15, -5), node(15, 65)]),
      ];
    }
    if (kind === 'bezier')
      pattern.sourceGeometry = ['M0 0C0 -10 20 -10 20 0', 'M20 0C20 10 0 10 0 0'].map(
        (pathData) => ({ ...geometry('compound'), pathData }),
      );
    if (kind === 'gap')
      pattern.sourceGeometry = ['M0.1 0L20 0', 'M20 0L20 20', 'M20 20L0 20', 'M0 20L0 0'].map(
        (pathData) => ({ ...geometry('compound'), pathData }),
      );
    if (kind === 'holes') {
      p.drawingStyle.fillRule = 'nonzero';
      pattern.sourceGeometry = ['M0 0L30 0', 'M30 0L30 30', 'M30 30L0 30', 'M0 30L0 0'].map(
        (pathData) => ({ ...geometry('compound'), pathData }),
      );
      pattern.sourceGeometry.push({
        ...geometry('compound', [], true),
        pathData: 'M10 10L20 10L20 20L10 20Z',
      });
    }
    if (kind === 'reflected') {
      p.mainSymmetry = {
        ...p.mainSymmetry,
        family: 'radial',
        group: 'Dn',
        sectors: 4,
        center: { x: 0, y: 0 },
      };
      pattern.sourceGeometry = ['M10 2L14 2', 'M14 2L14 5', 'M14 5L10 5', 'M10 5L10 2'].map(
        (pathData) => ({ ...geometry('compound'), pathData }),
      );
    }
    await autosave(p);
  }, kind);
  await page.reload();
  await saved(page);
  await page.getByRole('button', { name: 'Rellenar región', exact: true }).click();
}
async function model(page: Page) {
  await saved(page);
  return page.evaluate(async () => {
    const { recover } = await import('/src/persistence/storage.ts');
    return (await recover())!;
  });
}
async function screen(page: Page, x: number, y: number) {
  return page.locator('.studio-canvas').evaluate(
    (el, p) => {
      const q = new DOMPoint(p.x, p.y).matrixTransform((el as SVGSVGElement).getScreenCTM()!);
      return { x: q.x, y: q.y };
    },
    { x, y },
  );
}
async function paint(page: Page, x: number, y: number) {
  const p = await screen(page, x, y);
  await page.mouse.move(p.x, p.y);
  await expect(page.locator('[data-fill-preview]')).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator('[data-fill-preview]')
        .evaluate((el, p) => (el as SVGGeometryElement).isPointInFill(new DOMPoint(p.x, p.y)), {
          x,
          y,
        }),
    )
    .toBe(true);
  await page.getByRole('button', { name: 'Confirmar relleno', exact: true }).click();
  await saved(page);
}
async function redAt(page: Page, x: number, y: number) {
  return page.locator('.studio-canvas').evaluate(
    async (el, p) => {
      const svg = el as SVGSVGElement,
        copy = svg.cloneNode(true) as SVGSVGElement,
        b = svg.getBoundingClientRect();
      copy
        .querySelectorAll('[data-fill-preview],[data-editing-handles]')
        .forEach((e) => e.remove());
      copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      copy.setAttribute('width', String(b.width));
      copy.setAttribute('height', String(b.height));
      const img = new Image();
      img.src =
        'data:image/svg+xml,' + encodeURIComponent(new XMLSerializer().serializeToString(copy));
      await img.decode();
      const c = document.createElement('canvas');
      c.width = Math.ceil(b.width);
      c.height = Math.ceil(b.height);
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const q = new DOMPoint(p.x, p.y).matrixTransform(svg.getScreenCTM()!);
      const v = [...ctx.getImageData(Math.round(q.x - b.x), Math.round(q.y - b.y), 1, 1).data];
      return v[0] > 180 && v[1] < 90 && v[2] < 110;
    },
    { x, y },
  );
}
test('v2.2 Fill cuatro líneas: preview, tinta real, una fuente, undo y vínculo al editar límite', async ({
  page,
}) => {
  await setup(page);
  await paint(page, 10, 10);
  let p = await model(page);
  expect(p.patterns[0].sourceGeometry).toHaveLength(5);
  expect(p.patterns[0].sourceGeometry[0].fillRegion?.linked).toBe(true);
  expect(await redAt(page, 10, 10)).toBe(true);
  await page.screenshot({ path: 'test-results/v22-fill-lines.png' });
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  expect((await model(page)).patterns[0].sourceGeometry).toHaveLength(4);
  expect(await redAt(page, 10, 10)).toBe(false);
  await page.getByRole('button', { name: 'Rehacer', exact: true }).click();
  await saved(page);
  await page.getByRole('button', { name: 'Seleccionar', exact: true }).click();
  const q = await screen(page, 20, 10);
  await page.mouse.click(q.x, q.y);
  await page.getByLabel('Posición X', { exact: true }).fill('5');
  await page.getByLabel('Posición Y', { exact: true }).focus();
  await expect
    .poll(async () => {
      const p = await model(page);
      return p.patterns[0].sourceGeometry.find((g) => g.fillRegion)?.pathData;
    })
    .toContain('25');
  expect(await redAt(page, 23, 10)).toBe(true);
  p = await model(page);
  expect(p.patterns[0].sourceGeometry.find((g) => g.fillRegion)?.fillRegion?.status).toBe('linked');
});
test('v2.2 Fill path cerrado respeta agujero y recolorea fuente existente', async ({ page }) => {
  await setup(page, 'closed');
  await paint(page, 5, 5);
  expect((await model(page)).patterns[0].sourceGeometry).toHaveLength(1);
  expect(await redAt(page, 5, 5)).toBe(true);
  expect(await redAt(page, 15, 15)).toBe(false);
});
test('v2.2 Fill entre instancias propaga tinta en celdas distintas sin clonar fuentes', async ({
  page,
}) => {
  await setup(page, 'periodic');
  await paint(page, 10, 10);
  const p = await model(page);
  expect(p.patterns[0].sourceGeometry).toHaveLength(3);
  expect(
    new Set(p.patterns[0].sourceGeometry[0].fillRegion?.refs.map((r) => r.matrix.join(','))).size,
  ).toBeGreaterThan(1);
  expect(await redAt(page, 10, 10)).toBe(true);
  expect(await redAt(page, 30, 30)).toBe(true);
  await page.screenshot({ path: 'test-results/v22-fill-periodic.png' });
});
test('v2.2 Fill interior de tesela se ve en copias reales y persiste', async ({ page }) => {
  await setup(page, 'tile');
  await paint(page, 10, 10);
  const p = await model(page);
  expect(p.patterns[0].sourceGeometry).toHaveLength(1);
  expect(p.patterns[0].sourceGeometry[0].fillRegion).toMatchObject({ kind: 'tile', linked: true });
  expect(await redAt(page, 10, 10)).toBe(true);
  expect(await redAt(page, 70, 10)).toBe(true);
  await page.screenshot({ path: 'test-results/v22-fill-tile.png' });
  await page.reload();
  await saved(page);
  expect(await redAt(page, 70, 10)).toBe(true);
});

test('v2.2 Fill confirma con mouse sobre lienzo y autocierra panel sin perder operación', async ({
  page,
}) => {
  await setup(page);
  await page.getByRole('button', { name: 'Abrir panel de estilos' }).click();
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  const q = await screen(page, 10, 10);
  await page.mouse.move(q.x, q.y);
  await expect(page.locator('[data-fill-preview]')).toBeVisible();
  await page.mouse.click(q.x, q.y);
  await saved(page);
  await expect(page.getByRole('complementary', { name: 'Panel de estilos' })).not.toBeVisible();
  expect((await model(page)).patterns[0].sourceGeometry).toHaveLength(5);
  expect(await redAt(page, 10, 10)).toBe(true);
});

test('Fill recolorea desde otra copia sin duplicar la fuente y la miniatura incluye fondo de tesela', async ({
  page,
}) => {
  await setup(page, 'periodic');
  await paint(page, 10, 10);
  await page.getByRole('button', { name: 'Abrir panel de estilos' }).click();
  const panel = page.getByRole('complementary', { name: 'Panel de estilos' });
  await panel.getByLabel('Editar estilo de').selectOption('current');
  await panel.getByLabel('HEX de relleno', { exact: true }).fill('#2455dd');
  await page.getByRole('button', { name: 'Cerrar panel de estilos' }).click();
  await paint(page, 30, 30);
  let p = await model(page);
  expect(p.patterns[0].sourceGeometry).toHaveLength(3);
  expect(p.patterns[0].sourceGeometry.find((g) => g.fillRegion)?.fill).toBe('#2455dd');
  await setup(page, 'tile');
  await paint(page, 10, 10);
  await expect
    .poll(() =>
      page
        .getByRole('button', { name: 'Simetría Libre', exact: true })
        .locator('img')
        .evaluate(async (el) => {
          const img = el as HTMLImageElement;
          await img.decode();
          const c = document.createElement('canvas');
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          const ctx = c.getContext('2d')!;
          ctx.drawImage(img, 0, 0);
          const v = ctx.getImageData(0, 0, c.width, c.height).data;
          let red = 0;
          for (let i = 0; i < v.length; i += 4)
            if (v[i] > 180 && v[i + 1] < 90 && v[i + 2] < 110) red++;
          return red;
        }),
    )
    .toBeGreaterThan(50);
});

test('Fill recalcula vínculo tras cambio de grupo con undo/redo y una misma entidad', async ({
  page,
}) => {
  await setup(page);
  await paint(page, 10, 10);
  const initial = (await model(page)).patterns[0].sourceGeometry.find((g) => g.fillRegion)!;
  await page.getByRole('button', { name: 'Simetría p1', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir panel de estilos' }).click();
  const panel = page.getByRole('complementary', { name: 'Panel de estilos' });
  await expect(panel.getByText('Vínculo desactualizado', { exact: false })).toBeVisible();
  await panel.getByRole('button', { name: 'Recalcular y vincular región', exact: true }).click();
  await expect
    .poll(
      async () =>
        (await model(page)).patterns[0].sourceGeometry.find((g) => g.id === initial.id)?.fillRegion
          ?.status,
    )
    .toBe('linked');
  expect((await model(page)).patterns[0].sourceGeometry).toHaveLength(5);
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  await expect
    .poll(
      async () =>
        (await model(page)).patterns[0].sourceGeometry.find((g) => g.id === initial.id)?.fillRegion
          ?.status,
    )
    .toBe('stale');
  await page.getByRole('button', { name: 'Rehacer', exact: true }).click();
  await expect
    .poll(
      async () =>
        (await model(page)).patterns[0].sourceGeometry.find((g) => g.id === initial.id)?.fillRegion
          ?.status,
    )
    .toBe('linked');
});
test('cancelar actualización ignora un resultado tardío y conserva contorno e historial', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const Native = window.Worker;
    window.Worker = class extends Native {
      postMessage(message: any, transfer: Transferable[] = []) {
        if (message?.type === 'recalculate') {
          (window as any).pendingFillWorker = this;
          return;
        }
        super.postMessage(message, transfer);
      }
    };
  });
  await setup(page);
  await paint(page, 10, 10);
  const initial = (await model(page)).patterns[0].sourceGeometry.find((g) => g.fillRegion)!;
  await page.getByRole('button', { name: 'Abrir panel de estilos' }).click();
  const panel = page.getByRole('complementary', { name: 'Panel de estilos' });
  await panel.getByRole('button', { name: 'Recalcular y vincular región', exact: true }).click();
  await panel.getByRole('button', { name: 'Cancelar actualización', exact: true }).click();
  await page.evaluate((g) => {
    (window as any).pendingFillWorker.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'recalculated', geometry: { ...g, pathData: 'M0 0L5 0L5 5Z' } },
      }),
    );
  }, initial);
  expect(
    (await model(page)).patterns[0].sourceGeometry.find((g) => g.id === initial.id)?.pathData,
  ).toBe(initial.pathData);
  await expect(
    panel.getByRole('button', { name: 'Cancelar actualización', exact: true }),
  ).not.toBeVisible();
});

test('Fill conserva Bézier exacta y huecos de una región formada por varios límites', async ({
  page,
}) => {
  await setup(page, 'bezier');
  await paint(page, 10, 0);
  let p = await model(page);
  expect(p.patterns[0].sourceGeometry).toHaveLength(3);
  const bezier = p.patterns[0].sourceGeometry.find((g) => g.fillRegion)!;
  expect(bezier.pathData).toMatch(/[cC]/);
  expect(await redAt(page, 10, 0)).toBe(true);
  expect(await redAt(page, 10, 9)).toBe(false);
  await setup(page, 'holes');
  await paint(page, 5, 5);
  p = await model(page);
  expect(p.patterns[0].sourceGeometry).toHaveLength(6);
  expect(p.patterns[0].sourceGeometry.find((g) => g.fillRegion)?.fillRule).toBe('nonzero');
  expect(await redAt(page, 5, 5)).toBe(true);
  expect(await redAt(page, 15, 15)).toBe(false);
});
test('Fill rechaza abertura y sólo la cierra con tolerancia explícita sin tocar fuentes', async ({
  page,
}) => {
  await setup(page, 'gap');
  const before = (await model(page)).patterns[0].sourceGeometry,
    q = await screen(page, 10, 10);
  await page.mouse.move(q.x, q.y);
  await expect(page.locator('.fill-actions')).toContainText('0 caras');
  await expect(page.getByRole('button', { name: 'Confirmar relleno', exact: true })).toBeDisabled();
  await expect(page.locator('[data-fill-preview]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Abrir panel de estilos' }).click();
  await page
    .getByRole('complementary', { name: 'Panel de estilos' })
    .getByLabel('Tolerancia de cierre de Fill', { exact: true })
    .fill('.11');
  await page.getByRole('button', { name: 'Cerrar panel de estilos' }).click();
  await paint(page, 10, 10);
  const p = await model(page);
  expect(p.patterns[0].sourceGeometry.filter((g) => !g.fillRegion)).toEqual(before);
  expect(p.patterns[0].sourceGeometry.find((g) => g.fillRegion)?.fillRegion?.closeTolerance).toBe(
    0.11,
  );
  expect(await redAt(page, 10, 10)).toBe(true);
  await expect(page.locator('.fill-actions')).toContainText('cierre aproximado explícito');
});
test('Fill desde reflexión se propaga a rotación y sitúa selección sobre la copia pulsada', async ({
  page,
}) => {
  await setup(page, 'reflected');
  await paint(page, -12, 3.5);
  const p = await model(page);
  expect(p.patterns[0].sourceGeometry).toHaveLength(5);
  expect(await redAt(page, -12, 3.5)).toBe(true);
  expect(await redAt(page, -3.5, 12)).toBe(true);
  const q = await screen(page, -12, 3.5),
    box = (await page.locator('[data-editing-handles]').boundingBox())!;
  expect(Math.abs(box.x + box.width / 2 - q.x)).toBeLessThan(6);
  expect(Math.abs(box.y + box.height / 2 - q.y)).toBeLessThan(6);
  await paint(page, -3.5, 12);
  expect((await model(page)).patterns[0].sourceGeometry).toHaveLength(5);
});
test('Fill conserva una cara que cruza la frontera de celda sin partir su fuente', async ({
  page,
}) => {
  await setup(page, 'cross-cell');
  await paint(page, 20, 20);
  const p = await model(page),
    g = p.patterns[0].sourceGeometry.find((g) => g.fillRegion)!;
  expect(p.patterns[0].sourceGeometry).toHaveLength(3);
  const b = await page.evaluate(async (g) => {
    const { paperPath } = await import('/src/geometry/paper.ts');
    const p = paperPath(g, g.fillRegion!.captureMatrix);
    const b = p.bounds;
    p.remove();
    return { x: b.x, y: b.y, width: b.width, height: b.height };
  }, g);
  expect(b.x).toBeCloseTo(10);
  expect(b.y).toBeCloseTo(10);
  expect(b.width).toBeCloseTo(20);
  expect(b.height).toBeCloseTo(20);
  expect(await redAt(page, 19, 19)).toBe(true);
  expect(await redAt(page, 21, 21)).toBe(true);
});
test.describe('Fill táctil', () => {
  test.use({ hasTouch: true });
  test('primer toque sólo previsualiza y el botón táctil confirma una región', async ({ page }) => {
    await setup(page);
    const q = await screen(page, 10, 10);
    await page.touchscreen.tap(q.x, q.y);
    await expect(page.locator('[data-fill-preview]')).toBeVisible();
    expect((await model(page)).patterns[0].sourceGeometry).toHaveLength(4);
    await page.getByRole('button', { name: 'Confirmar relleno', exact: true }).tap();
    await expect.poll(async () => (await model(page)).patterns[0].sourceGeometry.length).toBe(5);
    expect(await redAt(page, 10, 10)).toBe(true);
  });
});

test('Fill cruza varias teselas y conserva vínculo al cambiar un perfil de borde', async ({
  page,
}) => {
  await setup(page, 'tile-grid');
  await paint(page, 45, 45);
  let p = await model(page);
  const initial = p.patterns[0].sourceGeometry.find((g) => g.fillRegion)!;
  expect(p.patterns[0].sourceGeometry).toHaveLength(3);
  expect(initial.fillRegion?.scope).toBe('orbit');
  const worldBounds = await page.evaluate(async (g) => {
    const { paperPath } = await import('/src/geometry/paper.ts');
    const p = paperPath(g, g.fillRegion!.captureMatrix),
      b = p.bounds;
    p.remove();
    return { x: b.x, y: b.y, width: b.width, height: b.height };
  }, initial);
  expect(worldBounds.x).toBeCloseTo(15);
  expect(worldBounds.y).toBeCloseTo(15);
  expect(worldBounds.width).toBeCloseTo(60);
  expect(worldBounds.height).toBeCloseTo(60);
  expect(await redAt(page, 65, 65)).toBe(true);
  await page.locator('.tile-panel>summary').click();
  await page.getByLabel('Contornos de teselas', { exact: true }).uncheck();
  await expect
    .poll(
      async () =>
        (await model(page)).patterns[0].sourceGeometry.find((g) => g.id === initial.id)?.fillRegion
          ?.status,
    )
    .toBe('linked');
  await page.getByLabel('Editar bordes de tesela', { exact: true }).check();
  await page.getByLabel('Desvío del borde', { exact: true }).fill('2');
  await page.getByLabel('Editar bordes de tesela', { exact: true }).uncheck();
  await expect
    .poll(async () => {
      const p = await model(page);
      return p.patterns[0].sourceGeometry.find((g) => g.id === initial.id)?.fillRegion?.context;
    })
    .not.toBe(initial.fillRegion?.context);
  p = await model(page);
  expect(p.patterns[0].sourceGeometry.find((g) => g.id === initial.id)?.fillRegion?.status).toBe(
    'linked',
  );
  expect(await redAt(page, 45, 45)).toBe(true);
  await page.screenshot({ path: 'test-results/v22-fill-across-curved-tiles.png' });
});
test('Fill de tesela fijo conserva fuente al editar borde y el vinculado cubre el material nuevo', async ({
  page,
}) => {
  await setup(page, 'tile');
  await page.getByRole('button', { name: 'Abrir panel de estilos' }).click();
  await page
    .getByRole('complementary', { name: 'Panel de estilos' })
    .getByLabel('Nuevos rellenos vinculados a sus límites')
    .uncheck();
  await page.getByRole('button', { name: 'Cerrar panel de estilos' }).click();
  await paint(page, 10, 10);
  const before = (await model(page)).patterns[0].sourceGeometry[0];
  expect(before.fillRegion?.linked).toBe(false);
  await page.locator('.tile-panel>summary').click();
  await page.getByLabel('Contornos de teselas', { exact: true }).uncheck();
  await page.getByLabel('Editar bordes de tesela', { exact: true }).check();
  await page.getByLabel('Desvío del borde', { exact: true }).fill('2');
  await page.getByLabel('Editar bordes de tesela', { exact: true }).uncheck();
  let p = await model(page);
  expect(p.patterns[0].sourceGeometry[0].nodes).toEqual(before.nodes);
  expect(p.patterns[0].sourceGeometry[0].fillRegion?.status).toBe('fixed');
  expect(await redAt(page, 30, 1)).toBe(false);
  expect(await redAt(page, 30, 5)).toBe(true);
  await setup(page, 'tile');
  await paint(page, 10, 10);
  await page.locator('.tile-panel>summary').click();
  await page.getByLabel('Contornos de teselas', { exact: true }).uncheck();
  await page.getByLabel('Editar bordes de tesela', { exact: true }).check();
  await page.getByLabel('Desvío del borde', { exact: true }).fill('2');
  await page.getByLabel('Editar bordes de tesela', { exact: true }).uncheck();
  await expect
    .poll(async () => JSON.stringify((await model(page)).patterns[0].sourceGeometry[0].nodes))
    .not.toBe(JSON.stringify(before.nodes));
  expect(await redAt(page, 30, 1)).toBe(true);
  p = await model(page);
  expect(p.patterns[0].sourceGeometry[0].fillRegion?.status).toBe('linked');
});
