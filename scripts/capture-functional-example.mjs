import { chromium, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto('http://127.0.0.1:4173');
  await expect(page.locator('.save-indicator')).toHaveText(/Guardado local/);
  const result = await page.evaluate(async () => {
    const { functionalGeometryProject } = await import('/src/examples/functional-geometry.ts'),
      { prepareExport } = await import('/src/export/svg.ts'),
      { serialize } = await import('/src/persistence/schema.ts');
    const project = functionalGeometryProject(),
      svg = prepareExport(project, {
        target: 'view',
        format: 'svg',
        representation: 'editable',
        width: 160,
        height: 160,
        dpi: 150,
        background: project.preferences.background,
        transparent: false,
        quality: 0.95,
        tolerance: 0.02,
        outlineStrokes: false,
        patternId: project.patterns[0].id,
      }).svg;
    const image = new Image(),
      url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    image.src = url;
    try {
      await image.decode();
    } finally {
      URL.revokeObjectURL(url);
    }
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 640;
    canvas.getContext('2d').drawImage(image, 0, 0, 640, 640);
    return { json: serialize(project), svg, png: canvas.toDataURL('image/png').split(',')[1] };
  });
  await writeFile('public/examples/v3-escher-square.png', Buffer.from(result.png, 'base64'));
  await writeFile('docs/examples/v3-escher-square.pattern.json', result.json + '\n');
  await writeFile('.runtime/henderson-native.svg', result.svg);
  await page.locator('.main-menu summary').click();
  await page.getByRole('button', { name: 'Galería de ejemplos', exact: true }).click();
  const gallery = page.getByRole('dialog', { name: 'Galería de ejemplos', exact: true });
  await gallery.getByLabel('Categoría de ejemplos').selectOption('Recursivas');
  await gallery
    .getByRole('button', {
      name: 'Abrir ejemplo Peces · Límite cuadrado de geometría funcional',
      exact: true,
    })
    .click();
  await expect(page.locator('.save-indicator')).toHaveText(/Guardado local/);
  await page.mouse.move(40, 40);
  await page.screenshot({ path: 'docs/images/functional-geometry.png' });
  console.log(
    JSON.stringify({
      sourceGeometries: 1,
      instances: 412,
      thumbnail: 'v3-escher-square.png',
      native: 'v3-escher-square.pattern.json',
    }),
  );
} finally {
  await browser.close();
}
