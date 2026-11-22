import ts from 'typescript';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
export const categories = {
  editor: ['src/editor/', 'src/geometry/', 'src/app/useStudio', 'tests/estudios/'],
  symmetry: ['src/symmetry/', 'src/patterns/', 'src/generators/'],
  tiles: ['src/tiling/', 'src/isohedral/'],
  fill: ['src/fill/'],
  composition: ['src/composition/', 'src/examples/'],
  aperiodic: ['src/aperiodic/'],
  girih: ['src/girih/'],
  hyperbolic: ['src/hyperbolic/', 'src/visualization/'],
  spherical: ['src/spherical/', 'src/sphere/'],
  animation: ['src/animation/', 'src/timeline/'],
  persistence: ['src/persistence/', 'src/import/'],
  export: ['src/export/'],
  ui: ['src/ui/', 'src/app/App', 'src/app/styles', 'src/assets/', 'public/'],
  deploy: ['.github/', 'scripts/prepare-ftp'],
  infra: ['scripts/', '.codex/', 'AGENTS.md'],
};
const associations = {
  editor: [
    'studio',
    'v2',
    'v21',
    'v22',
    'v23',
    'snap',
    'snap-permanent',
    'feedback-study',
    'frame-weld',
    'panel-stability',
  ],
  symmetry: ['v2', 'v21', 'v30-iso', 'v30-view', 'frame-weld', 'composition-preserve'],
  tiles: ['v21', 'v22', 'v30-iso', 'figurative', 'tile-colors'],
  fill: [
    'v22-fill',
    'feedback-fill',
    'snap-permanent',
    'feedback-study',
    'frame-weld',
    'tile-colors',
  ],
  composition: ['v30', 'figurative', 'functional-geometry', 'composition-preserve'],
  aperiodic: ['aperiodic'],
  girih: ['girih'],
  hyperbolic: ['poincare', 'artistic', 'chambers'],
  spherical: ['poincare', 'artistic', 'chambers'],
  animation: ['v30'],
  persistence: ['studio', 'v2', 'v21', 'v22', 'v23', 'v30', 'work-protection', 'feedback-study'],
  export: ['studio', 'v21', 'v22', 'v23', 'v30', 'poincare', 'artistic', 'chambers'],
  ui: ['navigation-feedback', 'v23', 'work-protection', 'composition-preserve'],
  deploy: ['studio'],
  infra: ['studio'],
};
export async function filesIn(root, directory = '') {
  const result = [];
  for (const entry of await readdir(resolve(root, directory), { withFileTypes: true })) {
    const path = directory ? `${directory}/${entry.name}` : entry.name;
    if (
      [
        '.git',
        'node_modules',
        '.runtime',
        'dist',
        'test-results',
        'playwright-report',
        '__pycache__',
      ].includes(entry.name)
    )
      continue;
    if (entry.isSymbolicLink()) throw Error(`Symlink de entrada no admitido: ${path}`);
    if (entry.isDirectory()) result.push(...(await filesIn(root, path)));
    else if (!/\.tsbuildinfo$|\.pyc$/.test(path)) result.push(path);
  }
  return result.sort();
}
export function changedFiles(root, base) {
  const git = (...args) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  return [
    ...new Set([
      ...git('diff', '--name-only', '-z', base ?? 'HEAD'),
      ...git('ls-files', '--others', '--exclude-standard', '-z'),
    ]),
  ].sort();
}
export function qaInput(file) {
  return (
    !file.startsWith('docs/prd/') &&
    !(file.endsWith('.md') && !file.startsWith('.codex/')) &&
    !/\.(log|zip)$/.test(file)
  );
}
export async function selectImpact(root, changed, available) {
  const all = available ?? (await filesIn(root));
  const units = all.filter((f) => /^src\/.*\.test\.tsx?$/.test(f));
  const e2e = all.filter((f) => /^tests\/.*\.spec\.ts$/.test(f) && f !== 'tests/static.spec.ts');
  const source = all.filter((f) => /^(src|tests)\/.*\.[cm]?[jt]sx?$/.test(f));
  const reverse = new Map();
  for (const file of source) {
    const text = await readFile(resolve(root, file), 'utf8');
    for (const entry of ts.preProcessFile(text, true, true).importedFiles) {
      if (!entry.fileName.startsWith('.')) continue;
      const stem = relative(root, resolve(root, dirname(file), entry.fileName)).replaceAll(
        '\\',
        '/',
      );
      const target = [
        stem,
        `${stem}.ts`,
        `${stem}.tsx`,
        `${stem}/index.ts`,
        `${stem}/index.tsx`,
      ].find((f) => all.includes(f));
      if (target) {
        if (!reverse.has(target)) reverse.set(target, new Set());
        reverse.get(target).add(file);
      }
    }
  }
  const affected = new Set(changed),
    queue = [...changed];
  while (queue.length)
    for (const file of reverse.get(queue.shift()) ?? [])
      if (!affected.has(file)) {
        affected.add(file);
        queue.push(file);
      }
  const names = Object.keys(categories).filter((k) =>
    [...affected].some((f) => categories[k].some((p) => f.startsWith(p))),
  );
  const relevant = changed.filter(qaInput);
  const shared = relevant.some((f) =>
    /^src\/app\/(model|styles)\.|^src\/persistence\/schema\.|^src\/patterns\/engine\.|^(package(-lock)?\.json|tsconfig.*|vite\.config\..*|playwright\.config\..*)$/.test(
      f,
    ),
  );
  const unknown = relevant.some(
    (f) =>
      !Object.values(categories)
        .flat()
        .some((p) => f.startsWith(p)) &&
      !source.includes(f) &&
      !/^tests\//.test(f),
  );
  const broad = shared || unknown;
  return {
    changed,
    categories: names,
    broad,
    reason: shared
      ? 'contrato/configuración compartida'
      : unknown
        ? 'impacto no reconocido'
        : 'imports y asociaciones E2E',
    units: broad
      ? units
      : units.filter(
          (f) => affected.has(f) || names.some((k) => categories[k].some((p) => f.startsWith(p))),
        ),
    e2e: broad
      ? e2e
      : e2e.filter(
          (f) =>
            affected.has(f) ||
            names.some((k) => associations[k].some((n) => f === `tests/${n}.spec.ts`)),
        ),
    infrastructure: names.includes('infra') || names.includes('deploy'),
    exports: names.includes('export'),
  };
}
