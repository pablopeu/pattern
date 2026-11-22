import { pythonCommand } from './core.mjs';
import { availableParallelism } from 'node:os';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
export const independent = [
  ['exports', 'scripts/validate-exports.mjs', 'scripts/validate_exports.py'],
  ['isohedral', 'scripts/validate-v30-isohedral.mjs', 'scripts/validate_v30_isohedral.py'],
  ['figurative', 'scripts/validate-v30-figurative.mjs', 'scripts/validate_v30_figurative.py'],
  ['composition', 'scripts/validate-v30-composition.mjs', 'scripts/validate_v30_composition.py'],
  ['aperiodic', 'scripts/validate-v30-aperiodic.mjs', 'scripts/validate_v30_aperiodic.py'],
  ['girih', 'scripts/validate-v30-girih.mjs', 'scripts/validate_v30_girih.py'],
  ['hyperbolic', 'scripts/validate-v30-hyperbolic.mjs', 'scripts/validate_v30_hyperbolic.py'],
  [
    'hyperbolic-source',
    'scripts/validate-v30-hyperbolic-source.mjs',
    'scripts/validate_v30_hyperbolic_source.py',
  ],
  ['chambers', 'scripts/validate-v30-chambers.mjs', 'scripts/validate_v30_chambers.py'],
  ['artistic', 'scripts/validate-v30-artistic-disk.mjs', 'scripts/validate_v30_artistic_disk.py'],
];
export async function makePlan(profile, impact, root, dir) {
  const node = process.execPath,
    python = pythonCommand(root),
    steps = [];
  const add = (id, args, extra = {}) => steps.push({ id, command: args, ...extra });
  add('typescript', [node, 'node_modules/typescript/bin/tsc', '-b']);
  if (profile === 'full' || impact.infrastructure) {
    const names = (await readdir(resolve(root, 'scripts')))
      .filter((f) => f.endsWith('.test.mjs'))
      .sort()
      .map((f) => `scripts/${f}`);
    add('infrastructure', [node, '--test', '--test-reporter=tap', ...names], { parser: 'tap' });
    add('monitor', [python, 'scripts/test_monitor.py']);
  }
  if (profile === 'full' || impact.units.length)
    add(
      'unit',
      [
        node,
        'node_modules/vitest/vitest.mjs',
        'run',
        ...(profile === 'full' ? [] : impact.units),
        '--reporter=json',
        `--outputFile=${dir}/unit.json`,
      ],
      { parser: 'vitest', data: `${dir}/unit.json` },
    );
  if (profile === 'full')
    add(
      'e2e-inventory',
      [
        node,
        'node_modules/@playwright/test/cli.js',
        'test',
        '--list',
        `--workers=${process.env.QA_WORKERS ?? Math.min(availableParallelism(), process.env.CI ? 2 : 4)}`,
      ],
      {
        parser: 'inventory',
        data: `${dir}/inventory.json`,
        env: {
          QA_PLAYWRIGHT_REPORT: `${dir}/inventory.json`,
          QA_LIST_ONLY: '1',
          TEST_STATIC: '',
          TEST_BASE_URL: 'http://127.0.0.1:4173',
        },
      },
    );
  if (profile === 'full' || impact.e2e.length)
    add(
      'e2e',
      [
        node,
        'node_modules/@playwright/test/cli.js',
        'test',
        ...(profile === 'full' ? [] : impact.e2e),
        `--workers=${process.env.QA_WORKERS ?? Math.min(availableParallelism(), process.env.CI ? 2 : 4)}`,
        `--output=${dir}/e2e-artifacts`,
      ],
      {
        parser: 'playwright',
        data: `${dir}/e2e.json`,
        dev: true,
        env: {
          QA_PLAYWRIGHT_REPORT: `${dir}/e2e.json`,
          QA_LIST_ONLY: '',
          TEST_STATIC: '',
          TEST_BASE_URL: 'http://127.0.0.1:4173',
        },
        timeout: 1200000,
      },
    );
  if (profile === 'full' || (profile === 'integration' && impact.exports))
    for (const [name, js, py] of independent.filter(
      (row) => profile === 'full' || ['exports', 'exports-v22'].includes(row[0]),
    )) {
      const work = resolve(dir, 'independent');
      if (js)
        add(`independent-${name}`, [node, resolve(root, js)], {
          dev: true,
          timeout: 300000,
          cwd: work,
          independent: true,
        });
      if (name === 'hyperbolic-source')
        add(
          'independent-hyperbolic-pipeline',
          [node, resolve(root, 'scripts/validate-v30-hyperbolic-pipeline.mjs')],
          { dev: true, timeout: 300000, cwd: work, independent: true },
        );
      add(`verify-${name}`, [python, resolve(root, py)], { cwd: work, independent: true });
    }
  if (profile !== 'fast') {
    add('build', ['npm', 'run', 'build'], { env: { BASE_PATH: './' }, build: 'root' });
    add(
      'static-root',
      [
        node,
        'scripts/qa/static.mjs',
        `${dir}/dist-root`,
        '/',
        `${dir}/static-root.json`,
        `${dir}/static-root-artifacts`,
      ],
      { parser: 'playwright', data: `${dir}/static-root.json` },
    );
    if (profile === 'full') {
      add('build-sub', ['npm', 'run', 'build', '--', `--outDir=${dir}/dist-sub`], {
        env: { BASE_PATH: '/pattern/' },
      });
      add(
        'static-sub',
        [
          node,
          'scripts/qa/static.mjs',
          `${dir}/dist-sub`,
          '/pattern/',
          `${dir}/static-sub.json`,
          `${dir}/static-sub-artifacts`,
        ],
        { parser: 'playwright', data: `${dir}/static-sub.json` },
      );
    }
  }
  return steps;
}
