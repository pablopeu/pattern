/** Verify rejection with the REAL frozen JSON6 build, not a simulated old parser.
 * Before building current code, retain the previous dist in the supplied folder.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium, expect } from '@playwright/test';
const root = resolve(process.argv[2] ?? '.runtime/flat-source-static'),
  artistic = process.argv[3] === 'artistic';
await readFile(resolve(root, 'index.html'));
const server = createServer(async (req, res) => {
  let path = new URL(req.url, 'http://localhost').pathname;
  if (path.endsWith('/')) path += 'index.html';
  const file = resolve(root, '.' + path);
  if (!file.startsWith(root + '/')) {
    res.writeHead(403);
    res.end();
    return;
  }
  try {
    const data = await readFile(file),
      mime =
        {
          '.js': 'application/javascript',
          '.css': 'text/css',
          '.html': 'text/html',
          '.png': 'image/png',
          '.svg': 'image/svg+xml',
        }[extname(file)] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((resolve) => server.listen(4181, '127.0.0.1', resolve));
const browser = await chromium.launch();
try {
  const source = await browser.newPage();
  await source.goto('http://127.0.0.1:4173');
  const native = await source.evaluate(async (artistic) => {
    const { newProject, geometry, node } = await import('/src/app/model.ts'),
      { defaultVisualization, defaultArtisticVisualization } = await import(
        '/src/visualization/model.ts'
      ),
      { serialize } = await import('/src/persistence/schema.ts');
    const p = newProject();
    p.patterns[0].sourceGeometry = [geometry('path', [node(1, 1), node(2, 2)])];
    p.visualization = artistic
      ? defaultArtisticVisualization(p, p.patterns[0].id)
      : defaultVisualization(p, p.patterns[0].id);
    return serialize(p);
  }, artistic);
  const older = await browser.newPage();
  await older.goto('http://127.0.0.1:4181');
  await expect(older.locator('.save-indicator')).toHaveText(/Guardado local/);
  await older.locator('input[type="file"][accept=".json,application/json"]').setInputFiles({
    name: 'new.pattern.json',
    mimeType: 'application/json',
    buffer: Buffer.from(native),
  });
  await expect(
    older.getByText(
      artistic
        ? /Proyecto inválido en visualization.kind/
        : /Este archivo usa la versión 7; esta aplicación admite hasta la versión 6\./,
    ),
  ).toBeVisible();
  await expect(
    older.getByRole('dialog', { name: 'Conservar el trabajo', exact: true }),
  ).toHaveCount(0);
  console.log(
    JSON.stringify({
      olderReader: artistic ? 'JSON7 geometric' : 6,
      rejectedKind: artistic ? 'artistic-disk' : 'poincare',
      rejectedDocument: 7,
      actualFrozenBuild: true,
      silentFlatFallback: false,
    }),
  );
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
