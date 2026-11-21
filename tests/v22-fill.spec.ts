import { pureSource, context, styles, catalog, symmetry, field } from './navigation';
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
    if (kind === 'dense') {
      p.mainSymmetry = {
        ...p.mainSymmetry,
        family: 'wallpaper',
        group: 'p1',
        width: 20,
        height: 20,
      };
      pattern.sourceGeometry = [
        [0, 0, 20, 0],
        [20, 0, 20, 20],
        [20, 20, 0, 20],
        [0, 20, 0, 0],
      ].map(([x, y, ex, ey]) =>
        geometry(
          'path',
          Array.from({ length: 81 }, (_, i) =>
            node(x + ((ex - x) * i) / 80, y + ((ey - y) * i) / 80),
          ),
        ),
      );
    }
    if (kind === 'dense-closed') {
      pattern.sourceGeometry = [
        geometry(
          'path',
          Array.from({ length: 1501 }, (_, i) =>
            node(
              10 + 8 * Math.cos((i / 1501) * Math.PI * 2),
              10 + 8 * Math.sin((i / 1501) * Math.PI * 2),
            ),
          ),
          true,
        ),
      ];
    }
    if (kind === 'penrose') {
      p.mainSymmetry = { ...p.mainSymmetry, family: 'wallpaper', group: 'p1' };
      pattern.sourceGeometry = [];
      pattern.generator = { ...pattern.generator, kind: 'penrose', frequency: 1, radius: 50 };
    }
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
  const before = Number(await page.locator('.fill-actions').getAttribute('data-fill-applied'));
  const p = await screen(page, x, y);
  await page.mouse.click(p.x, p.y);
  await page.mouse.move(2, 2);
  await expect
    .poll(async () => Number(await page.locator('.fill-actions').getAttribute('data-fill-applied')))
    .toBeGreaterThan(before);
  await saved(page);
}
async function redAt(page: Page, x: number, y: number) {
  return page.locator('.studio-canvas').evaluate(
    async (el, p) => {
      const svg = el as SVGSVGElement,
        copy = svg.cloneNode(true) as SVGSVGElement,
        b = svg.getBoundingClientRect(),
        // Sample physical interiors precisely, including subpixel curved seams.
        scale = 4;
      copy
        .querySelectorAll('[data-fill-preview],[data-editing-handles]')
        .forEach((e) => e.remove());
      copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      copy.setAttribute('width', String(b.width * scale));
      copy.setAttribute('height', String(b.height * scale));
      const img = new Image();
      img.src =
        'data:image/svg+xml,' + encodeURIComponent(new XMLSerializer().serializeToString(copy));
      await img.decode();
      const c = document.createElement('canvas');
      c.width = Math.ceil(b.width * scale);
      c.height = Math.ceil(b.height * scale);
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const q = new DOMPoint(p.x, p.y).matrixTransform(svg.getScreenCTM()!);
      const v = [
        ...ctx.getImageData(Math.round((q.x - b.x) * scale), Math.round((q.y - b.y) * scale), 1, 1)
          .data,
      ];
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
  await (await field(page, 'Posición X')).fill('5');
  await (await field(page, 'Posición Y')).focus();
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
  await styles(page, 'Fill');
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  const q = await screen(page, 10, 10);
  await page.mouse.move(q.x, q.y);
  await expect(page.locator('[data-fill-preview]')).toBeVisible();
  await page.mouse.click(q.x, q.y);
  await expect(page.locator('.fill-actions')).toHaveAttribute('data-fill-applied', '1');
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
  await styles(page, 'Fill');
  const panel = page.getByRole('complementary', { name: 'Panel de estilos' });
  await (await field(page, 'Editar estilo de')).selectOption('current');
  await (await field(page, 'HEX de relleno')).fill('#2455dd');
  await page.getByRole('button', { name: 'Cerrar panel de estilos' }).click();
  await paint(page, 30, 30);
  let p = await model(page);
  expect(p.patterns[0].sourceGeometry).toHaveLength(3);
  expect(p.patterns[0].sourceGeometry.find((g) => g.fillRegion)?.fill).toBe('#2455dd');
  await setup(page, 'tile');
  await paint(page, 10, 10);
  await catalog(page);
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
  await symmetry(page, 'Simetría p1');
  await styles(page, 'Fill');
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
  await styles(page, 'Fill');
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
  await expect(page.getByRole('button', { name: 'Confirmar relleno', exact: true })).toHaveCount(0);
  await page.mouse.click(q.x, q.y);
  await expect(page.locator('.toast')).toContainText('No hay una región cerrada');
  expect((await model(page)).patterns[0].sourceGeometry).toEqual(before);
  await expect(page.locator('[data-fill-preview]')).toHaveCount(0);
  await styles(page, 'Fill');
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
  test('el primer toque aplica relleno persistente sin confirmación aparte', async ({ page }) => {
    await setup(page);
    const q = await screen(page, 10, 10);
    await page.touchscreen.tap(q.x, q.y);
    await expect(page.getByRole('button', { name: 'Confirmar relleno', exact: true })).toHaveCount(
      0,
    );
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
  await context(page, 'Teselas');
  await (await field(page, 'Contornos de teselas')).uncheck();
  await expect
    .poll(
      async () =>
        (await model(page)).patterns[0].sourceGeometry.find((g) => g.id === initial.id)?.fillRegion
          ?.status,
    )
    .toBe('linked');
  await (await field(page, 'Editar bordes de tesela')).check();
  await (await field(page, 'Desvío del borde')).fill('2');
  await (await field(page, 'Editar bordes de tesela')).uncheck();
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
  await styles(page, 'Fill');
  await page
    .getByRole('complementary', { name: 'Panel de estilos' })
    .getByLabel('Nuevos rellenos vinculados a sus límites')
    .uncheck();
  await page.getByRole('button', { name: 'Cerrar panel de estilos' }).click();
  await paint(page, 10, 10);
  const before = (await model(page)).patterns[0].sourceGeometry[0];
  expect(before.fillRegion?.linked).toBe(false);
  await context(page, 'Teselas');
  await (await field(page, 'Contornos de teselas')).uncheck();
  await (await field(page, 'Editar bordes de tesela')).check();
  await (await field(page, 'Desvío del borde')).fill('2');
  await (await field(page, 'Editar bordes de tesela')).uncheck();
  let p = await model(page);
  expect(p.patterns[0].sourceGeometry[0].nodes).toEqual(before.nodes);
  expect(p.patterns[0].sourceGeometry[0].fillRegion?.status).toBe('fixed');
  expect(await redAt(page, 30, 1)).toBe(false);
  expect(await redAt(page, 30, 5)).toBe(true);
  await setup(page, 'tile');
  // The browser preference deliberately survives projects; enable the second case explicitly.
  await styles(page, 'Fill');
  await page
    .getByRole('complementary', { name: 'Panel de estilos' })
    .getByLabel('Nuevos rellenos vinculados a sus límites')
    .check();
  await page.getByRole('button', { name: 'Cerrar panel de estilos' }).click();
  await paint(page, 10, 10);
  await context(page, 'Teselas');
  await (await field(page, 'Contornos de teselas')).uncheck();
  await (await field(page, 'Editar bordes de tesela')).check();
  await (await field(page, 'Desvío del borde')).fill('2');
  await (await field(page, 'Editar bordes de tesela')).uncheck();
  await expect
    .poll(async () => JSON.stringify((await model(page)).patterns[0].sourceGeometry[0].nodes))
    .not.toBe(JSON.stringify(before.nodes));
  expect(await redAt(page, 30, 1)).toBe(true);
  p = await model(page);
  expect(p.patterns[0].sourceGeometry[0].fillRegion?.status).toBe('linked');
});

test('Fill aplica clics rápidos y mantiene color al salir, autocerrar panel y deshacer', async ({
  page,
}) => {
  await setup(page, 'periodic');
  await styles(page, 'Fill');
  await paint(page, 10, 10);
  await expect(page.getByRole('complementary', { name: 'Panel de estilos' })).toHaveCount(0);
  expect(await redAt(page, 10, 10)).toBe(true);
  const before = (await model(page)).patterns[0].sourceGeometry;
  const q = await screen(page, 30, 30);
  await page.mouse.click(q.x, q.y);
  await page.mouse.click(q.x, q.y);
  await expect
    .poll(async () => Number(await page.locator('.fill-actions').getAttribute('data-fill-applied')))
    .toBe(3);
  expect((await model(page)).patterns[0].sourceGeometry).toHaveLength(before.length);
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  await expect.poll(async () => (await model(page)).patterns[0].sourceGeometry.length).toBe(2);
  expect(await redAt(page, 10, 10)).toBe(false);
});

test('Fill en Penrose conserva color al soltar y salir, perímetro y persistencia', async ({
  page,
}) => {
  await setup(page, 'penrose');
  const sample = await page.evaluate(async () => {
    const { generate } = await import('/src/generators/index.ts');
    const { recover } = await import('/src/persistence/storage.ts');
    const p = (await recover())!;
    const g = generate(p.patterns[0].generator, []).geometry[0];
    return {
      point: {
        x: g.nodes.reduce((sum, n) => sum + n.x, 0) / 3,
        y: g.nodes.reduce((sum, n) => sum + n.y, 0) / 3,
      },
      edge: { x: (g.nodes[0].x + g.nodes[1].x) / 2, y: (g.nodes[0].y + g.nodes[1].y) / 2 },
    };
  });
  const q = await screen(page, sample.point.x, sample.point.y);
  await page.mouse.move(q.x, q.y);
  await expect(page.locator('[data-fill-preview]')).toBeVisible();
  await page.mouse.down();
  await expect(page.locator('.fill-actions')).toHaveAttribute('data-fill-applied', '1');
  await page.mouse.up();
  await page.mouse.move(2, 2);
  expect(await redAt(page, sample.point.x, sample.point.y)).toBe(true);
  expect((await model(page)).patterns[0].sourceGeometry).toHaveLength(1);
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  expect(await redAt(page, sample.point.x, sample.point.y)).toBe(false);
  await page.getByRole('button', { name: 'Rehacer', exact: true }).click();
  await saved(page);
  await pureSource(page);
  expect(await redAt(page, sample.point.x, sample.point.y)).toBe(true);
  await pureSource(page);
  await page.reload();
  await saved(page);
  await page.getByRole('button', { name: 'Ajustar al patrón', exact: true }).click();
  const view = await page.locator('.studio-canvas').evaluate((el) => ({
    x: (el as SVGSVGElement).viewBox.baseVal.x,
    y: (el as SVGSVGElement).viewBox.baseVal.y,
    width: (el as SVGSVGElement).viewBox.baseVal.width,
    height: (el as SVGSVGElement).viewBox.baseVal.height,
  }));
  expect(Math.abs(view.x + view.width / 2)).toBeLessThan(0.001);
  expect(Math.abs(view.y + view.height / 2)).toBeLessThan(0.001);
  expect(await redAt(page, sample.point.x, sample.point.y)).toBe(true);
  const exports = await page.evaluate(async (sample) => {
    const { prepareExport } = await import('/src/export/svg.ts');
    const { recover } = await import('/src/persistence/storage.ts');
    const p = (await recover())!;
    const results = [];
    for (const representation of ['editable', 'expanded'] as const) {
      const output = prepareExport(p, {
        target: 'view',
        format: 'svg',
        representation,
        width: 120,
        height: 120,
        dpi: 120,
        background: '#ffffff',
        transparent: false,
        quality: 0.9,
        tolerance: 0.01,
        outlineStrokes: true,
        patternId: p.patterns[0].id,
      });
      const img = new Image();
      img.src = 'data:image/svg+xml,' + encodeURIComponent(output.svg);
      await img.decode();
      const c = document.createElement('canvas');
      c.width = c.height = 1200;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0, 1200, 1200);
      const at = (point: { x: number; y: number }) => ({
        x: Math.round(((point.x - output.bounds.x) / output.bounds.width) * 1200),
        y: Math.round(((point.y - output.bounds.y) / output.bounds.height) * 1200),
      });
      const point = at(sample.point),
        edge = at(sample.edge);
      const color = [...ctx.getImageData(point.x, point.y, 1, 1).data];
      const border = ctx.getImageData(edge.x - 2, edge.y - 2, 5, 5).data;
      let dark = false;
      for (let i = 0; i < border.length; i += 4)
        if (border[i] < 85 && border[i + 1] < 110 && border[i + 2] < 90) dark = true;
      results.push({
        representation,
        red: color[0] > 180 && color[1] < 90 && color[2] < 110,
        dark,
      });
    }
    return results;
  }, sample);
  expect(exports).toEqual([
    { representation: 'editable', red: true, dark: true },
    { representation: 'expanded', red: true, dark: true },
  ]);
  await page.screenshot({ path: '.runtime/fill-penrose-fixed.png', animations: 'disabled' });
});

for (const width of [1440, 390]) {
  test(`Fill activo reabre controles tras autocierre y colapsado manual ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page, 'periodic');
    if (width <= 900)
      await page.getByRole('button', { name: 'Plegar panel derecho', exact: true }).click();
    const tool = page.getByRole('button', { name: 'Rellenar región', exact: true });
    const panel = page.getByRole('complementary', { name: 'Panel de estilos' });
    await paint(page, 10, 10);
    await expect(panel).toHaveCount(0);
    await expect(tool).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Cancelar cálculo', exact: true })).toHaveCount(
      0,
    );
    const before = await model(page);
    await tool.click();
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('tab', { name: 'Fill', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await expect(panel.getByLabel('HEX de relleno', { exact: true })).toBeVisible();
    await expect(panel.getByRole('tab', { name: 'Colores', exact: true })).toHaveCount(0);
    await expect(panel.getByLabel('Regla de relleno', { exact: true })).toBeHidden();
    // Clicking an already active Fill also keeps narrow-screen panels exclusive.
    await tool.click();
    await expect(panel).toBeVisible();
    if (width <= 900)
      await expect(page.getByRole('complementary', { name: 'Panel contextual' })).toBeHidden();
    await page.getByRole('button', { name: 'Plegar panel derecho', exact: true }).click();
    await expect(panel).toHaveCount(0);
    const handle = page.getByRole('button', { name: 'Desplegar panel derecho', exact: true });
    await expect(handle).toBeInViewport();
    await handle.focus();
    await page.keyboard.press('Enter');
    await expect(panel).toBeVisible();
    await page.getByRole('button', { name: 'Plegar panel derecho', exact: true }).click();
    await page.locator('.studio-canvas').focus();
    await page.keyboard.press('f');
    await expect(panel).toBeVisible();
    expect(await model(page)).toEqual(before);
    expect(await redAt(page, 30, 30)).toBe(true);
  });
}

for (const kind of ['dense', 'dense-closed']) {
  test(`Fill supera límite global de curvas sin alterar fuentes: ${kind}`, async ({ page }) => {
    await setup(page, kind);
    const before = (await model(page)).patterns[0].sourceGeometry;
    await expect(page.locator('.fill-actions')).toContainText('Fill local');
    const point = kind === 'dense' ? { x: 4, y: 4 } : { x: 10, y: 10 };
    await paint(page, point.x, point.y);
    const after = (await model(page)).patterns[0].sourceGeometry;
    if (kind === 'dense') {
      expect(after.slice(1)).toEqual(before);
      expect(after[0].fillRegion?.status).toBe('linked');
      expect(await redAt(page, 24, 24)).toBe(true);
      await page.getByRole('button', { name: 'Rellenar región', exact: true }).click();
      await page.getByRole('button', { name: 'Recalcular y vincular región', exact: true }).click();
      await expect(page.locator('.toast')).toContainText('Región recalculada');
      expect((await model(page)).patterns[0].sourceGeometry[0].id).toBe(after[0].id);
    } else {
      expect(after).toHaveLength(1);
      expect(after[0].stroke).toBe(before[0].stroke);
      expect(after[0].fill).toBe('#ed3040');
    }
    expect(await redAt(page, point.x, point.y)).toBe(true);
    await page.reload();
    await saved(page);
    expect(await redAt(page, point.x, point.y)).toBe(true);
  });
}
