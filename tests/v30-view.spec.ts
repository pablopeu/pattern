import { test, expect, type Page } from '@playwright/test';

test('footer móvil completo al girar y redimensionar la pantalla', async ({ page }) => {
  await page.goto('/');
  for (const [width, height] of [
    [320, 568],
    [360, 640],
    [390, 844],
    [428, 926],
    [844, 390],
    [667, 375],
    [568, 320],
  ]) {
    await page.setViewportSize({ width, height });
    const footer = page.locator('.site-footer');
    await expect(footer).toBeInViewport({ ratio: 1 });
    for (const link of await footer.getByRole('link').all())
      await expect(link).toBeInViewport({ ratio: 1 });
    expect(await footer.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(
      height,
    );
  }
});

async function frameVisible(page: Page) {
  return page.locator('.studio-canvas').evaluate((el) => {
    const svg = el as SVGSVGElement,
      frame = svg.querySelector('[aria-label="Límite de la celda"]') as SVGGraphicsElement;
    if (!frame) return false;
    const b = frame.getBBox(),
      r = svg.getBoundingClientRect(),
      m = svg.getScreenCTM()!,
      p = new DOMPoint(b.x, b.y).matrixTransform(m),
      q = new DOMPoint(b.x + b.width, b.y + b.height).matrixTransform(m),
      toolbar = svg.parentElement!.querySelector('.canvas-floats')!.getBoundingClientRect();
    return (
      p.x >= r.left + 3 &&
      p.y >= r.top + 3 &&
      q.x <= r.right - 3 &&
      q.y <= Math.min(r.bottom - 3, toolbar.top - 3) &&
      Math.abs((p.x + q.x) / 2 - r.left - r.width / 2) < 1 &&
      Math.abs((p.y + q.y) / 2 - r.top - r.height / 2) < 1
    );
  });
}
for (const viewport of [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 390, height: 844 },
]) {
  test(`celda completa IH, Pan en lienzo y footer adaptable ${viewport.width}`, async ({
    page,
  }) => {
    test.setTimeout(180000);
    await page.setViewportSize(viewport);
    await page.goto('/');
    const fixtures = await page.evaluate(async () => {
      const { newProject, geometry, node } = await import('/src/app/model.ts'),
        { supportedIsohedralTypes } = await import('/src/isohedral/engine.ts'),
        { newIsohedralTiling } = await import('/src/tiling/tiles.ts'),
        { serialize } = await import('/src/persistence/schema.ts'),
        { createTileFill } = await import('/src/fill/service.ts'),
        { drawingStyle } = await import('/src/app/styles.ts');
      const ids = supportedIsohedralTypes;
      return ids.map((id) => {
        const p = newProject(),
          pattern = p.patterns[0];
        pattern.tiling = newIsohedralTiling(id);
        pattern.tiling.origin = { x: 17, y: -9 };
        pattern.tiling.rotation = 23;
        const g = geometry('path', [node(3, 3), node(7, 4), node(4, 8)], true);
        g.fill = '#ad563b';
        pattern.sourceGeometry = [g];
        const background = createTileFill(
          p,
          pattern,
          {
            kind: 'tile',
            key: 'tile',
            patternId: pattern.id,
            pathData: '',
            matrix: [1, 0, 0, 1, 0, 0],
            z: 0,
          },
          drawingStyle({ fill: '#dfc995' }),
        );
        pattern.sourceGeometry.unshift(background);
        p.preferences = {
          ...p.preferences,
          repetitionView: 'single',
          structureVisible: false,
          grid: false,
          split: false,
          sourceView: false,
        };
        return { id, patternId: pattern.id, json: serialize(p) };
      });
    });
    const input = page.locator('input[type=file][accept=".json,application/json"]'),
      svg = page.locator('.studio-canvas');
    for (const fixture of fixtures) {
      await input.setInputFiles({
        name: `IH${fixture.id}.pattern.json`,
        mimeType: 'application/json',
        buffer: Buffer.from(fixture.json),
      });
      await expect(svg.locator('[data-tiled-pattern]').first()).toHaveAttribute(
        'data-tiled-pattern',
        fixture.patternId,
      );
      await expect
        .poll(() => frameVisible(page), {
          message: `IH${fixture.id} complete at ${viewport.width}`,
        })
        .toBe(true);
      if (fixture.id === 89) {
        await page.getByRole('button', { name: 'Acercar', exact: true }).click();
        await page.getByRole('button', { name: 'Restablecer vista', exact: true }).click();
        await expect.poll(() => frameVisible(page)).toBe(true);
        await page.screenshot({ path: `.runtime/cell-ih89-${viewport.width}.png` });
      }
    }
    await expect(
      page.locator('.tool-rail').getByRole('button', { name: 'Desplazar vista', exact: true }),
    ).toHaveCount(0);
    const pan = page
      .locator('.canvas-floats')
      .getByRole('button', { name: 'Desplazar vista', exact: true });
    await expect(pan).toBeDisabled();
    await page.getByRole('button', { name: 'Una celda', exact: true }).click();
    await expect(pan).toBeEnabled();
    await pan.click();
    const before = await svg.getAttribute('viewBox'),
      r = (await svg.boundingBox())!;
    await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
    await page.mouse.down();
    await page.mouse.move(r.x + r.width / 2 + 35, r.y + r.height / 2 + 20, { steps: 3 });
    await page.mouse.up();
    await expect.poll(() => svg.getAttribute('viewBox')).not.toBe(before);
    const footer = page.locator('.site-footer');
    const size = await footer.evaluate((el) => ({
      overflow: el.scrollWidth - el.clientWidth,
      height: el.getBoundingClientRect().height,
    }));
    expect(size.overflow).toBeLessThanOrEqual(1);
    if (viewport.width === 390) {
      expect(size.height).toBeGreaterThan(60);
      for (const link of await footer.getByRole('link').all()) {
        const b = (await link.boundingBox())!;
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.x + b.width).toBeLessThanOrEqual(viewport.width);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.y + b.height).toBeLessThanOrEqual(viewport.height);
      }
      expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(
        viewport.height,
      );
    } else expect(size.height).toBe(38);
    await page.screenshot({ path: `.runtime/cell-view-${viewport.width}.png` });
  });
}
