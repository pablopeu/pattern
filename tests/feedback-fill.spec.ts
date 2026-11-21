import { test, expect, type Page } from '@playwright/test';
import { context } from './navigation';
async function model(page: Page) {
  await expect(page.locator('.save-indicator')).toHaveText(/Guardado local/);
  return page.evaluate(async () => (await import('/src/persistence/storage.ts')).recover());
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
for (const width of [1440, 390]) {
  test(`preferencias continúan entre nuevos estudios y recarga ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto('/');
    await model(page);
    const canvas = (await page.locator('.studio-canvas').boundingBox())!;
    await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
    await page.mouse.down();
    await page.mouse.move(canvas.x + canvas.width / 2 + 25, canvas.y + canvas.height / 2 + 15, {
      steps: 3,
    });
    await page.mouse.up();
    expect((await model(page))!.patterns[0].sourceGeometry.length).toBeGreaterThan(0);
    await context(page, 'Preferencias');
    await page.getByLabel('Ajustar a grilla', { exact: true }).uncheck();
    await page.getByLabel('Atracción entre nodos', { exact: true }).uncheck();
    await page.getByLabel('Distancia de atracción a nodos', { exact: true }).fill('17');
    await page.getByLabel('Unidades', { exact: true }).selectOption('cm');
    await page.getByLabel('Fondo del lienzo', { exact: true }).fill('#e5e9ef');
    await model(page);
    await page.locator('.main-menu summary').click();
    await page.getByRole('button', { name: 'Nuevo proyecto', exact: true }).click();
    let p = (await model(page))!;
    expect(p.patterns[0].sourceGeometry).toEqual([]);
    expect(p.mainSymmetry.group).toBe('p3');
    expect(p.preferences).toMatchObject({
      snap: false,
      snapNodes: false,
      snapRadiusPx: 17,
      background: '#e5e9ef',
      structureVisible: true,
      structureOpacity: 0.5,
    });
    expect(p.documentUnits).toBe('cm');
    await expect(page.getByRole('button', { name: 'Dibujo libre', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.reload();
    p = (await model(page))!;
    expect(p.preferences.snapRadiusPx).toBe(17);
    expect(p.documentUnits).toBe('cm');
  });
  test(`selector Fill primero, color activa herramienta y trazos cubren relleno ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto('/');
    await model(page);
    expect((await model(page))!.drawingStyle.fill).toBe('#3b82f6');
    const raw = await page.evaluate(async () => {
      const { newProject, geometry, node } = await import('/src/app/model.ts');
      const p = newProject();
      p.preferences.grid = false;
      p.preferences.guides = false;
      p.preferences.structureVisible = false;
      p.patterns[0].sourceGeometry = [
        [
          [0, 0],
          [20, 0],
        ],
        [
          [20, 0],
          [20, 20],
        ],
        [
          [20, 20],
          [0, 20],
        ],
        [
          [0, 20],
          [0, 0],
        ],
      ].map((points) => ({
        ...geometry(
          'path',
          points.map(([x, y]) => node(x, y)),
        ),
        stroke: '#101010',
        strokeWidth: 2,
        fill: 'none',
      }));
      return p;
    });
    await page.locator('input[type=file][accept=".json,application/json"]').setInputFiles({
      name: 'Fill.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(raw)),
    });
    await model(page);
    await page.getByRole('button', { name: 'Ajustar contenido', exact: true }).click();
    await page.getByRole('button', { name: 'Panel derecho: Fill', exact: true }).click();
    const picker = page.getByRole('slider', { name: 'Selector de relleno', exact: true }),
      hex = page.getByLabel('HEX de relleno', { exact: true });
    await expect(picker).toBeFocused();
    expect((await hex.boundingBox())!.y).toBeGreaterThan(
      (await picker.boundingBox())!.y + (await picker.boundingBox())!.height,
    );
    await page.getByLabel('Tono de relleno', { exact: true }).press('Home');
    const r = (await picker.boundingBox())!;
    await page.mouse.click(r.x + r.width - 2, r.y + 2);
    await expect(
      page.getByRole('button', { name: 'Rellenar región', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    const chosen = (await model(page))!.drawingStyle.fill;
    expect(chosen).not.toBe('none');
    await page.screenshot({ path: `.runtime/fill-picker-${width}.png` });
    await page.getByRole('button', { name: 'Cerrar panel de estilos', exact: true }).click();
    const q = await screen(page, 10, 10);
    await page.mouse.click(q.x, q.y);
    await expect
      .poll(async () =>
        Number(await page.locator('.fill-actions').getAttribute('data-fill-applied')),
      )
      .toBe(1);
    const p = (await model(page))!;
    expect(p.patterns[0].sourceGeometry.filter((g) => g.fillRegion)).toHaveLength(1);
    const pixels = await page.locator('.studio-canvas').evaluate(async (el) => {
      const svg = el as SVGSVGElement,
        copy = svg.cloneNode(true) as SVGSVGElement,
        b = svg.getBoundingClientRect();
      copy
        .querySelectorAll('[data-fill-preview],[data-editing-handles]')
        .forEach((e) => e.remove());
      copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      copy.setAttribute('width', String(b.width * 4));
      copy.setAttribute('height', String(b.height * 4));
      const image = new Image();
      image.src =
        'data:image/svg+xml,' + encodeURIComponent(new XMLSerializer().serializeToString(copy));
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(b.width * 4);
      canvas.height = Math.ceil(b.height * 4);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(image, 0, 0);
      return [
        [0.7, 10],
        [19.3, 10],
        [10, 0.7],
        [10, 19.3],
      ].map(([x, y]) => {
        const p = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM()!);
        return [
          ...ctx.getImageData(Math.round((p.x - b.x) * 4), Math.round((p.y - b.y) * 4), 1, 1).data,
        ];
      });
    });
    for (const pixel of pixels) {
      expect(pixel[0]).toBeLessThan(60);
      expect(pixel[1]).toBeLessThan(60);
      expect(pixel[2]).toBeLessThan(60);
      expect(pixel[3]).toBe(255);
    }
  });
}
