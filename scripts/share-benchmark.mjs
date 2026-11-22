/**
 * Benchmark real del documento compartible (PRD v3.1 §5.3).
 * Serializa cada ejemplo con su galería y mide JSON compacto y GZIP.
 * Uso: node scripts/share-benchmark.mjs
 */
import { chromium } from '@playwright/test';
import { gzipSync } from 'node:zlib';
import { writeFile, mkdir } from 'node:fs/promises';

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:4173');
  await page.waitForFunction(() => !!document.querySelector('.save-indicator'));
  const rows = await page.evaluate(async () => {
    const { exampleCatalog } = await import('/src/examples/catalog.ts');
    const { shareDocument, byteLength } = await import('/src/share/document.ts');
    return exampleCatalog.map((entry) => {
      const doc = shareDocument(entry.create());
      return { id: entry.id, json: byteLength(doc), doc };
    });
  });
  const measured = rows.map((r) => ({ id: r.id, jsonBytes: r.json, gzipBytes: gzipSync(r.doc).byteLength, doc: r.doc }));
  const p = (arr, q) => arr[Math.min(arr.length - 1, Math.floor((arr.length - 1) * q))];
  const jsons = measured.map((m) => m.jsonBytes).sort((a, b) => a - b);
  const gz = measured.map((m) => m.gzipBytes).sort((a, b) => a - b);
  const summary = {
    generatedAt: new Date().toISOString(),
    examples: measured.length,
    json: { min: jsons[0], p50: p(jsons, 0.5), p90: p(jsons, 0.9), max: jsons.at(-1) },
    gzip: { min: gz[0], p50: p(gz, 0.5), p90: p(gz, 0.9), max: gz.at(-1) },
    ratio: +(gz.reduce((a, b) => a + b, 0) / jsons.reduce((a, b) => a + b, 0)).toFixed(3),
    limits: { documentBytes: 2 * 1024 * 1024, compressedBytes: 256 * 1024 },
    overLimit: measured.filter((m) => m.jsonBytes > 2 * 1024 * 1024 || m.gzipBytes > 256 * 1024).map((m) => m.id),
    rows: measured.map(({ id, jsonBytes, gzipBytes }) => ({ id, jsonBytes, gzipBytes })),
  };
  await mkdir('.runtime', { recursive: true });
  await writeFile('.runtime/share-benchmark.json', JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await browser.close();
}
