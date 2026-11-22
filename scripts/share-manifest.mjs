/** Escribe dist/assets-manifest.json con los assets reales de Vite para /s/{id}. */
import { readFile, writeFile } from 'node:fs/promises';
const html = await readFile('dist/index.html', 'utf8');
const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
const styles = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((m) => m[1]);
const clean = (url) => url.replace(/^\.?\//, '').replace(/^\/+/, '');
if (!scripts.length) throw Error('No se encontró el script de entrada en dist/index.html');
await writeFile(
  'dist/assets-manifest.json',
  JSON.stringify({ scripts: scripts.map(clean), styles: styles.map(clean) }, null, 2),
);
console.log('assets-manifest.json', scripts.length, 'scripts,', styles.length, 'styles');
