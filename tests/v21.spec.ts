import { test, expect, type Page } from '@playwright/test';
async function saved(page: Page) {
  await expect(page.locator('.save-indicator')).toHaveText(/Guardado local/);
}
async function prepare(page: Page, family: string, group: string) {
  await page.goto('/');
  await saved(page);
  await page.evaluate(
    async ({ family, group }) => {
      const { newProject } = await import('/src/app/model.ts');
      const { autosave } = await import('/src/persistence/storage.ts');
      const p = newProject();
      p.preferences.snap = false;
      p.preferences.grid = false;
      p.preferences.structureVisible = true;
      p.mainSymmetry = { ...p.mainSymmetry, family: family as any, group, angle: 90 };
      await autosave(p);
    },
    { family, group },
  );
  await page.reload();
  await saved(page);
}
async function screen(page: Page, x: number, y: number) {
  return page.locator('.studio-canvas').evaluate(
    (el, q) => {
      const p = new DOMPoint(q.x, q.y).matrixTransform((el as SVGSVGElement).getScreenCTM()!);
      return { x: p.x, y: p.y };
    },
    { x, y },
  );
}
async function inkAt(page: Page, x: number, y: number) {
  return page.locator('.studio-canvas').evaluate(
    async (el, q) => {
      const svg = el as SVGSVGElement,
        b = svg.getBoundingClientRect(),
        copy = svg.cloneNode(true) as SVGSVGElement;
      copy
        .querySelectorAll('[data-editing-handles],[data-tile-editor]')
        .forEach((el) => el.remove());
      copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      copy.setAttribute('width', String(b.width));
      copy.setAttribute('height', String(b.height));
      const image = new Image();
      image.src =
        'data:image/svg+xml;charset=utf-8,' +
        encodeURIComponent(new XMLSerializer().serializeToString(copy));
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(b.width);
      canvas.height = Math.round(b.height);
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#f8faf5';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, b.width, b.height);
      const p = new DOMPoint(q.x, q.y).matrixTransform(svg.getScreenCTM()!);
      const px = Math.round(p.x - b.x),
        py = Math.round(p.y - b.y),
        pixels = ctx.getImageData(px - 2, py - 2, 5, 5).data;
      let dark = 0;
      for (let i = 0; i < pixels.length; i += 4)
        if ((pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3 < 130) dark++;
      return dark;
    },
    { x, y },
  );
}

for (const [family, group] of [
  ['wallpaper', 'p6m'],
  ['wallpaper', 'p4g'],
  ['wallpaper', 'pg'],
  ['frieze', 'p2mg'],
  ['radial', 'Dn'],
])
  test(`v2.1 ${family} ${group}: dibujar vacío y distante se ve realmente bajo el cursor`, async ({
    page,
  }) => {
    await prepare(page, family, group);
    await expect(page.locator('[data-symmetry-structure]')).toHaveCount(1);
    await page.getByRole('button', { name: 'Línea', exact: true }).click();
    for (const [ax, ay, bx, by] of [
      [-85, -65, -73, -59],
      [135, 45, 146, 54],
    ]) {
      const mid = { x: (ax + bx) / 2, y: (ay + by) / 2 };
      expect(await inkAt(page, mid.x, mid.y)).toBe(0);
      const a = await screen(page, ax, ay),
        b = await screen(page, bx, by);
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      await page.mouse.move(b.x, b.y, { steps: 5 });
      expect(await inkAt(page, mid.x, mid.y)).toBeGreaterThan(1);
      await page.mouse.up();
      await saved(page);
      expect(await inkAt(page, mid.x, mid.y)).toBeGreaterThan(1);
    }
    const sources = await page.evaluate(
      async () =>
        (await (await import('/src/persistence/storage.ts')).recover())!.patterns[0].sourceGeometry,
    );
    expect(sources).toHaveLength(2);
    await page.getByRole('button', { name: 'Simetría p4m', exact: true }).click();
    await saved(page);
    await page.getByRole('button', { name: 'Simetría p6m', exact: true }).click();
    await saved(page);
    expect(
      await page.evaluate(
        async () =>
          (await (await import('/src/persistence/storage.ts')).recover())!.patterns[0]
            .sourceGeometry,
      ),
    ).toEqual(sources);
  });

test('v2.1 overlay: botón independiente, opacidad persistente y exportación limpia', async ({
  page,
}) => {
  await prepare(page, 'wallpaper', 'p6m');
  const button = page.getByRole('button', {
    name: 'Mostrar/Ocultar estructura de simetría',
    exact: true,
  });
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Mostrar grilla', exact: true }).click();
  await expect(page.locator('[data-symmetry-structure]')).toHaveCount(1);
  await page.getByLabel('Opacidad de la estructura', { exact: true }).focus();
  await page.keyboard.press('End');
  await page.keyboard.press('ArrowLeft');
  await saved(page);
  await page.reload();
  await saved(page);
  await expect(page.getByLabel('Opacidad de la estructura', { exact: true })).toHaveValue('0.79');
  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  const preview = page.getByAltText('Previsualización de exportación');
  await expect(preview).toBeVisible();
  expect(decodeURIComponent((await preview.getAttribute('src'))!)).not.toContain(
    'data-symmetry-structure',
  );
  await page.getByRole('button', { name: 'Cerrar exportación', exact: true }).click();
  await button.click();
  await expect(page.locator('[data-symmetry-structure]')).toHaveCount(0);
  await button.click();
  await page.locator('.symmetry-gallery').getByLabel('Guías detalladas', { exact: true }).uncheck();
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-symmetry-structure]')).toHaveCount(0);
});

for (const kind of ['square', 'rectangle', 'parallelogram', 'triangle', 'hexagon'])
  test(`v2.1 tesela ${kind}: dibujo real, borde emparejado, gesto y persistencia`, async ({
    page,
  }) => {
    await prepare(page, 'none', 'none');
    await page.locator('.tile-panel>summary').click();
    await page.getByLabel('Usar teselas geométricas', { exact: true }).check();
    await page.getByLabel('Forma de tesela', { exact: true }).selectOption(kind);
    await saved(page);
    await expect(page.locator('[data-tiled-pattern]')).toHaveCount(1);
    const lines = await page.evaluate(async () => {
      const { recover } = await import('/src/persistence/storage.ts');
      const { tileVertices, tileInstances } = await import('/src/tiling/tiles.ts');
      const { apply } = await import('/src/geometry/matrix.ts');
      const t = (await recover())!.patterns[0].tiling!,
        v = tileVertices(t),
        center = {
          x: v.reduce((n, p) => n + p.x, 0) / v.length,
          y: v.reduce((n, p) => n + p.y, 0) / v.length,
        },
        tiles = tileInstances(t, { x: -110, y: -100, width: 300, height: 200 });
      const first = tiles.find((t) => t.cell[0] === 0 && t.cell[1] === 0 && t.orientation === 0)!,
        second = tiles.find(
          (i) =>
            i.cell[0] === (t.kind === 'triangle' ? 1 : 2) &&
            i.cell[1] === 0 &&
            i.orientation === (t.kind === 'triangle' ? 1 : 0),
        )!;
      return [first, second].map((tile, i) => ({
        a: apply(tile.matrix, { x: center.x + (i ? 3 : -7), y: center.y + (i ? 4 : -6) }),
        b: apply(tile.matrix, { x: center.x + (i ? 8 : -2), y: center.y + (i ? 6 : -3) }),
      }));
    });
    await page.getByRole('button', { name: 'Línea', exact: true }).click();
    for (const { a, b } of lines) {
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      expect(await inkAt(page, mid.x, mid.y)).toBe(0);
      const start = await screen(page, a.x, a.y),
        end = await screen(page, b.x, b.y);
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(end.x, end.y, { steps: 4 });
      expect(await inkAt(page, mid.x, mid.y)).toBeGreaterThan(1);
      await page.mouse.up();
      await saved(page);
    }
    const before = await page.evaluate(
      async () => (await (await import('/src/persistence/storage.ts')).recover())!.patterns[0],
    );
    expect(before.sourceGeometry).toHaveLength(2);
    await page.getByLabel('Editar bordes de tesela', { exact: true }).check();
    await page.getByLabel('Desvío del borde', { exact: true }).fill('2');
    await saved(page);
    const check = () =>
      page.evaluate(async () => {
        const { recover } = await import('/src/persistence/storage.ts');
        const { tilingIssue } = await import('/src/tiling/validate.ts');
        const p = (await recover())!.patterns[0];
        return { pattern: p, issue: tilingIssue(p.tiling!) };
      });
    expect((await check()).issue).toBeNull();
    expect((await check()).pattern.sourceGeometry).toEqual(before.sourceGeometry);
    const beforeMove = (await check()).pattern.tiling!.edges,
      box = await page.getByLabel('Nodo de borde 1.2', { exact: true }).boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2 + 4, { steps: 3 });
    await page.mouse.up();
    await saved(page);
    const after = await check();
    expect(after.issue).toBeNull();
    expect(after.pattern.tiling!.edges).not.toEqual(beforeMove);
    expect(after.pattern.sourceGeometry).toEqual(before.sourceGeometry);
    await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
    await saved(page);
    expect((await check()).pattern.tiling!.edges).toEqual(beforeMove);
    await page.getByRole('button', { name: 'Rehacer', exact: true }).click();
    await saved(page);
    await page.reload();
    await saved(page);
    expect((await check()).pattern.tiling!.edges).toEqual(after.pattern.tiling!.edges);
    expect((await check()).pattern.sourceGeometry).toEqual(before.sourceGeometry);
  });

test('v2.1 motivo: editar nodos desde una copia reflejada dentro de otra tesela', async ({
  page,
}) => {
  await prepare(page, 'wallpaper', 'p4m');
  const data = await page.evaluate(async () => {
    const { recover, autosave } = await import('/src/persistence/storage.ts');
    const { geometry, node } = await import('/src/app/model.ts');
    const { newTiling } = await import('/src/tiling/tiles.ts');
    const { buildScene } = await import('/src/patterns/engine.ts');
    const { resolvePattern } = await import('/src/symmetry/config.ts');
    const { apply } = await import('/src/geometry/matrix.ts');
    const p = (await recover())!,
      pat = p.patterns[0];
    pat.tiling = newTiling();
    const g = geometry('path', [node(14, 3), node(25, 5), node(19, 9)], true);
    g.fill = '#55765b';
    pat.sourceGeometry = [g];
    await autosave(p);
    const scene = buildScene(resolvePattern(pat, p), { x: -100, y: -100, width: 300, height: 220 }),
      instance = scene.instances.find(
        (i) =>
          i.tileId === 'tile-1:0:0' &&
          i.matrix[0] * i.matrix[3] - i.matrix[1] * i.matrix[2] < 0 &&
          (() => {
            const p = apply(i.matrix, { x: 19, y: 5 });
            return p.x > 60 && p.x < 120 && p.y > 0 && p.y < 60;
          })(),
      )!;
    return { point: apply(instance.matrix, { x: 19, y: 5 }), id: g.id };
  });
  await page.reload();
  await saved(page);
  await page.getByRole('button', { name: 'Editar nodos', exact: true }).click();
  const p = await screen(page, data.point.x, data.point.y);
  await page.mouse.click(p.x, p.y);
  await expect(page.getByLabel('Nodo 1', { exact: true })).toBeVisible();
  const box = await page.getByLabel('Nodo 1', { exact: true }).boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 10, box!.y + box!.height / 2 + 10, { steps: 4 });
  await page.mouse.up();
  await saved(page);
  const source = await page.evaluate(
    async () =>
      (await (await import('/src/persistence/storage.ts')).recover())!.patterns[0]
        .sourceGeometry[0],
  );
  expect(source.id).toBe(data.id);
  expect(source.nodes[0]).not.toMatchObject({ x: 14, y: 3 });
  expect(source.nodes).toHaveLength(3);
});

test('v2.1 exportación: mosaico raster de teselas curvas coincide con la escena grande', async ({
  page,
}) => {
  await page.goto('/');
  await saved(page);
  const results = await page.evaluate(async () => {
    const { newProject, geometry } = await import('/src/app/model.ts');
    const { newTiling, constrainTiling, tileRectangularCell } = await import(
      '/src/tiling/tiles.ts'
    );
    const { prepareExport, svgDocument } = await import('/src/export/svg.ts');
    const render = async (svg: string, width: number, height: number) => {
      const image = new Image();
      image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      await image.decode();
      const c = document.createElement('canvas');
      c.width = width;
      c.height = height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(image, 0, 0, width, height);
      return ctx.getImageData(0, 0, width, height).data;
    };
    const results = [];
    for (const kind of ['square', 'rectangle', 'triangle', 'hexagon'] as const) {
      const p = newProject(),
        pat = p.patterns[0];
      pat.tiling = newTiling(kind);
      pat.tiling.width = 40;
      pat.tiling.height = 34;
      pat.tiling.origin = { x: 8, y: -3 };
      pat.tiling.edges[0][1].y = 0.025;
      pat.tiling.edges[0][1].in = { x: -0.08, y: -0.01 };
      pat.tiling.edges[0][1].out = { x: 0.08, y: 0.01 };
      pat.tiling = constrainTiling(pat.tiling);
      const g = geometry('rectangle', [], true);
      g.parameters = { x: 8, y: 8, width: 40, height: 25, radius: 2, sides: 4 };
      g.fill = '#334455';
      g.strokeWidth = 0.5;
      pat.sourceGeometry = [g];
      const cell = tileRectangularCell(pat.tiling)!,
        options = {
          target: 'tile' as const,
          format: 'svg' as const,
          representation: 'editable' as const,
          width: cell.width * 3,
          height: cell.height * 3,
          dpi: 150,
          background: '#ffffff',
          transparent: false,
          quality: 0.9,
          tolerance: 0.01,
          outlineStrokes: true,
          patternId: pat.id,
        },
        tile = prepareExport(p, options),
        large = prepareExport(p, { ...options, target: 'view' }),
        content = `<defs><pattern id="mosaic" patternUnits="userSpaceOnUse" width="${cell.width}" height="${cell.height}"><image href="data:image/svg+xml;charset=utf-8,${encodeURIComponent(tile.svg)}" width="${cell.width}" height="${cell.height}"/></pattern></defs><rect x="${large.bounds.x}" y="${large.bounds.y}" width="${large.bounds.width}" height="${large.bounds.height}" fill="url(#mosaic)"/>`,
        mosaic = svgDocument(content, large.bounds, '#ffffff'),
        w = 480,
        h = Math.round((w * large.bounds.height) / large.bounds.width),
        a = await render(large.svg, w, h),
        b = await render(mosaic, w, h);
      let difference = 0;
      for (let i = 0; i < a.length; i++) difference += Math.abs(a[i] - b[i]);
      results.push({ kind, difference: difference / a.length });
    }
    return results;
  });
  for (const row of results) expect(row.difference, `${row.kind}: costuras raster`).toBeLessThan(2);
});

for (const kind of ['square', 'rectangle', 'parallelogram', 'triangle', 'hexagon'])
  test(`v2.1 cruzar borde ${kind}: continuidad real fuera de la tesela inicial`, async ({
    page,
  }) => {
    await prepare(page, 'none', 'none');
    await page.locator('.tile-panel>summary').click();
    await page.getByLabel('Usar teselas geométricas', { exact: true }).check();
    await page.getByLabel('Forma de tesela', { exact: true }).selectOption(kind);
    await saved(page);
    const data = await page.evaluate(async () => {
      const { recover } = await import('/src/persistence/storage.ts');
      const { tileVertices } = await import('/src/tiling/tiles.ts');
      const t = (await recover())!.patterns[0].tiling!,
        v = tileVertices(t),
        dx = v[1].x - v[0].x,
        dy = v[1].y - v[0].y,
        len = Math.hypot(dx, dy),
        normal = { x: -dy / len, y: dx / len },
        m = { x: (v[0].x + v[1].x) / 2, y: (v[0].y + v[1].y) / 2 };
      return {
        a: { x: m.x + normal.x * 4, y: m.y + normal.y * 4 },
        b: { x: m.x - normal.x * 8, y: m.y - normal.y * 8 },
        sample: { x: m.x - normal.x * 5, y: m.y - normal.y * 5 },
      };
    });
    await page.getByRole('button', { name: 'Línea', exact: true }).click();
    expect(await inkAt(page, data.sample.x, data.sample.y)).toBe(0);
    const a = await screen(page, data.a.x, data.a.y),
      b = await screen(page, data.b.x, data.b.y);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 5 });
    expect(await inkAt(page, data.sample.x, data.sample.y)).toBeGreaterThan(1);
    await page.mouse.up();
    await saved(page);
    expect(await inkAt(page, data.sample.x, data.sample.y)).toBeGreaterThan(1);
    expect(
      await page.evaluate(
        async () =>
          (await (await import('/src/persistence/storage.ts')).recover())!.patterns[0]
            .sourceGeometry.length,
      ),
    ).toBe(1);
    await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
    await saved(page);
    expect(await inkAt(page, data.sample.x, data.sample.y)).toBe(0);
    await page.getByRole('button', { name: 'Rehacer', exact: true }).click();
    await saved(page);
    expect(await inkAt(page, data.sample.x, data.sample.y)).toBeGreaterThan(1);
  });

test('v2.1 los 17 wallpaper, siete frisos y Cn/Dn producen overlays correctos en SVG', async ({
  page,
}) => {
  await prepare(page, 'wallpaper', 'p1');
  const choices = await page.evaluate(async () => {
    const { wallpaperNames, friezeNames } = await import('/src/symmetry/groups.ts');
    return [
      ...wallpaperNames.map((group) => ({ family: 'wallpaper', group })),
      ...friezeNames.map((group) => ({ family: 'frieze', group })),
      { family: 'radial', group: 'Cn' },
      { family: 'radial', group: 'Dn' },
    ];
  });
  for (const c of choices) {
    const button = page.locator(`[data-symmetry-id="${c.family}:${c.group}"]`);
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    const svg = page.locator('.studio-canvas [data-symmetry-structure]');
    await expect(svg).toHaveCount(1);
    const data = await svg.evaluate((el) => {
      const axes = [...el.querySelectorAll('path[data-axis]')].map((path) => {
        const p = path as SVGPathElement,
          a = p.getPointAtLength(0),
          b = p.getPointAtLength(p.getTotalLength());
        return {
          type: p.getAttribute('data-axis'),
          angle: (Math.round((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI) + 180) % 180,
        };
      });
      const centers = [...el.querySelectorAll('[data-rotation-order]')].map((g) => {
        let x = 0,
          y = 0;
        if (g.tagName === 'ellipse') {
          x = Number(g.getAttribute('cx'));
          y = Number(g.getAttribute('cy'));
        } else {
          const points = (g as SVGPolygonElement).points;
          for (let i = 0; i < points.numberOfItems; i++) {
            x += points.getItem(i).x;
            y += points.getItem(i).y;
          }
          x /= points.numberOfItems;
          y /= points.numberOfItems;
        }
        return { x, y, order: Number(g.getAttribute('data-rotation-order')) };
      });
      return {
        axes,
        centers,
        pointerEvents: getComputedStyle(el).pointerEvents,
        constantStroke: [...el.querySelectorAll('path')].every(
          (p) => p.getAttribute('vector-effect') === 'non-scaling-stroke',
        ),
      };
    });
    expect(data.pointerEvents).toBe('none');
    expect(data.constantStroke).toBe(true);
    if (c.family === 'frieze')
      for (const center of data.centers) expect(Math.abs(center.y)).toBeLessThan(0.001);
    if (c.family === 'radial') {
      expect(data.centers).toHaveLength(1);
      expect(data.centers[0].order).toBe(8);
      expect(data.axes).toHaveLength(c.group === 'Dn' ? 8 : 0);
    }
    if (c.family === 'wallpaper' && ['p3m1', 'p31m'].includes(c.group))
      expect(new Set(data.axes.map((a) => a.angle))).toEqual(
        new Set(c.group === 'p3m1' ? [30, 90, 150] : [0, 60, 120]),
      );
    if (c.family === 'wallpaper' && c.group === 'p2')
      expect(
        data.centers.some(
          (p) => Math.abs(p.x - 30) < 0.001 && Math.abs(p.y) < 0.001 && p.order === 2,
        ),
      ).toBe(true);
    if (['pg', 'pgg', 'p4g'].includes(c.group))
      expect(data.axes.some((a) => a.type === 'glide')).toBe(true);
  }
  await page.getByRole('button', { name: 'Simetría p2', exact: true }).click();
  await page.getByRole('button', { name: 'Línea', exact: true }).click();
  const a = await screen(page, 30, 0),
    b = await screen(page, 38, 8);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y);
  await page.mouse.up();
  await saved(page);
  expect(await inkAt(page, 34, 4)).toBeGreaterThan(1);
});
