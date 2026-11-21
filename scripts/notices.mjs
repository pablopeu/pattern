/** Bundle licenses of distributed dependencies into the static build. */
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
const notices = [
  'Pattern Studio 2D — Third-party software notices\n',
  'Original illustrative examples; third-party dependencies and vendored modules are credited below.\n',
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
notices.push(
  '\n' +
    '='.repeat(72) +
    '\nTactileJS · Craig S. Kaplan\n' +
    'Pinned upstream commit fd58ec372a4398e3dfc22663d120da186790834e\n' +
    'https://github.com/isohedral/tactile-js\n\n' +
    (await readFile('src/vendor/tactile/LICENSE', 'utf8')),
);
notices.push(
  '\nHat / Spectre · Craig S. Kaplan\n' +
    'https://github.com/isohedral/hatviz\nhttps://cs.uwaterloo.ca/~csk/spectre/\n\n' +
    (await readFile('src/vendor/aperiodic/LICENSE', 'utf8')),
);
notices.push(
  '\nPoincaré Paint mathematical core · Yusuf Pisan2026\nhttps://github.com/pisan-labs/poincare-paint\n\n' +
    (await readFile('src/vendor/poincare/LICENSE', 'utf8')),
);
await writeFile('public/THIRD_PARTY_NOTICES.txt', notices.join('\n') + '\n');
console.log('Generated public/THIRD_PARTY_NOTICES.txt');
