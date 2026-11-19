/** Bundle licenses of distributed dependencies into the static build. */
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
const notices = [
  'Pattern Studio 2D — Third-party software notices\n',
  'No third-party application source or proprietary assets were copied from the visual references.\n',
];
for (const [path, entry] of Object.entries(lock.packages)) {
  if (!path || entry.dev || entry.link) continue;
  const meta = JSON.parse(await readFile(path + '/package.json', 'utf8'));
  const files = (await readdir(path)).filter((n) => /^(licen[sc]e|copying|notice)(\.|$)/i.test(n));
  notices.push(
    '\n' +
      '='.repeat(72) +
      '\n' +
      meta.name +
      ' ' +
      meta.version +
      '\nLicense: ' +
      (entry.license || meta.license || 'See included text') +
      '\n',
  );
  for (const file of files) {
    try {
      notices.push('\n' + file + '\n' + (await readFile(path + '/' + file, 'utf8')));
    } catch {
      /* Ignore license directories. */
    }
  }
}
await mkdir('public', { recursive: true });
await writeFile('public/THIRD_PARTY_NOTICES.txt', notices.join('\n') + '\n');
console.log('Generated public/THIRD_PARTY_NOTICES.txt');
