/** Explicit, local recovery of an older periodic study. Never overwrites the input. */
import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const input = process.argv[2] ?? 'tests/estudios/test1.json',
  output = process.argv[3] ?? 'tests/estudios/test1-corregido.json';
if (resolve(input) === resolve(output))
  throw Error('Elegí una salida distinta: se conserva el original.');
const original = await readFile(input, 'utf8'),
  browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:4173');
  const result = await page.evaluate(async (raw) => {
    const { parseProject, serialize } = await import('/src/persistence/schema.ts'),
      { repairLegacyJunctionFrames } = await import('/src/editor/legacy-junctions.ts'),
      { recalculateRegion } = await import('/src/fill/recalculate.ts');
    const project = parseProject(raw),
      repaired = repairLegacyJunctionFrames(project),
      fills = [];
    for (const pattern of project.patterns)
      for (let i = 0; i < pattern.sourceGeometry.length; i++) {
        const old = pattern.sourceGeometry[i];
        if (!old.fillRegion?.linked) continue;
        const updated = recalculateRegion(project, old.id, old.fillRegion.captureMatrix, {
          allowBoundaryEvolution: true,
        });
        pattern.sourceGeometry[i] = updated;
        fills.push({ id: updated.id, status: updated.fillRegion.status });
      }
    const text = serialize(project);
    parseProject(text);
    return { text, repaired, fills };
  }, original);
  await writeFile(output, result.text + '\n');
  console.log(JSON.stringify({ input, output, repaired: result.repaired, fills: result.fills }));
} finally {
  await browser.close();
}
