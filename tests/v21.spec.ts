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
});
