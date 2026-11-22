import { test, expect, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
async function stored(page: Page) {
  await expect(page.locator('.save-indicator')).toHaveText(/Guardado local/);
  return page.evaluate(async () => (await import('/src/persistence/storage.ts')).recover());
}
for (const width of [1440, 1920])
  test(`panel no reduce y agranda el dibujo entre cuadros pintados ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto('/');
    await stored(page);
    const original = await page.evaluate(async () => {
      const { newProject, geometry } = await import('/src/app/model.ts'),
        { autosave } = await import('/src/persistence/storage.ts');
      const p = newProject();
      p.preferences.grid = p.preferences.guides = p.preferences.structureVisible = false;
      p.patterns[0].sourceGeometry = [
        {
          ...geometry('compound', [], true),
          pathData: 'M-10 -10H10V10H-10Z',
          fill: '#ed00ed',
          stroke: 'none',
        },
      ];
      await autosave(p);
      return p;
    });
    await page.reload();
    await expect.poll(async () => (await stored(page))?.metadata.id).toBe(original.metadata.id);
    await page.getByRole('button', { name: 'Seleccionar', exact: true }).click();
    await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    });
    const expectedPixels = await page
      .locator('.studio-canvas')
      .evaluate((svg) => 20 * Math.abs((svg as SVGSVGElement).getScreenCTM()!.a));
    const client = await page.context().newCDPSession(page),
      frames: string[] = [];
    client.on('Page.screencastFrame', (event) => {
      frames.push(event.data);
      void client.send('Page.screencastFrameAck', { sessionId: event.sessionId });
    });
    await client.send('Page.startScreencast', {
      format: 'png',
      everyNthFrame: 1,
      maxWidth: width,
      maxHeight: 900,
    });
    const panel = page.getByRole('complementary', { name: 'Panel de estilos', exact: true });
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: 'Desplegar panel derecho', exact: true }).click();
      await expect(panel).toBeVisible();
      await page.waitForTimeout(200);
      await page.getByRole('button', { name: 'Plegar panel derecho', exact: true }).click();
      await expect(panel).toBeHidden();
      await page.waitForTimeout(200);
    }
    const point = await page.locator('.studio-canvas').evaluate((svg) => {
      const p = new DOMPoint(0, 0).matrixTransform((svg as SVGSVGElement).getScreenCTM()!);
      return { x: p.x, y: p.y };
    });
    await page.mouse.click(point.x, point.y);
    await expect(panel).toBeVisible();
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: 'Cerrar panel de estilos', exact: true }).click();
    await expect(panel).toBeHidden();
    await page.waitForTimeout(200);
    await client.send('Page.stopScreencast');
    await client.detach();
    for (const [i, f] of frames.entries())
      await writeFile(`.runtime/panel-frame-${width}-${i}.png`, Buffer.from(f, 'base64'));

    expect(frames.length).toBeGreaterThan(5);
    const widths = await page.evaluate(async (frames) => {
      const result: number[] = [];
      for (const frame of frames) {
        const image = new Image();
        image.src = 'data:image/png;base64,' + frame;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(image, 0, 0);
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        // Largest horizontal run of the unique magenta artwork, not a style swatch.
        let largest = 0;
        for (let y = 100; y < canvas.height - 80; y++) {
          let run = 0;
          for (let x = 60; x < canvas.width - 35; x++) {
            const i = (y * canvas.width + x) * 4;
            if (pixels[i] > 220 && pixels[i + 1] < 25 && pixels[i + 2] > 220) {
              run++;
              largest = Math.max(largest, run);
            } else run = 0;
          }
        }
        result.push(largest);
      }
      return result;
    }, frames);
    // The physical marker must keep its measured size at the current zoom.
    await writeFile(`.runtime/panel-frame-${width}-widths.json`, JSON.stringify(widths));
    expect(expectedPixels).toBeGreaterThan(20);
    for (const pixels of widths) expect(Math.abs(pixels - expectedPixels)).toBeLessThanOrEqual(2);
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(2);
    expect((await stored(page))?.patterns).toEqual(original.patterns);
  });
