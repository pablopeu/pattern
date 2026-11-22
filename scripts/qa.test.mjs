import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, readFile, rm, access, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  atomic,
  json,
  lock,
  processStep,
  parseCounts,
  evidence,
  validEvidence,
  fingerprint,
  compact,
  classify,
} from './qa/core.mjs';
import { changedFiles, selectImpact } from './qa/impact.mjs';
import { makePlan } from './qa/plan.mjs';
import { staticServer } from './qa/static.mjs';
async function temporary(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'pattern-qa-'));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
const node = process.execPath;
test('exit real: PASS, FAIL parcial y comando inexistente conservan log completo', () =>
  temporary(async (dir) => {
    const a = await processStep([node, '-e', 'console.log("evidencia completa");'], {
      log: join(dir, 'a.log'),
    });
    assert.equal(a.status, 'PASS');
    assert.match(await readFile(a.log, 'utf8'), /evidencia completa/);
    const b = await processStep(
      [node, '-e', 'console.error("falló después de un paso");process.exit(7)'],
      { log: join(dir, 'b.log') },
    );
    assert.equal(b.status, 'FAIL');
    assert.equal(b.exitCode, 7);
    const c = await processStep(['/executable-inexistente-qa'], { log: join(dir, 'c.log') });
    assert.equal(c.status, 'FAIL');
    assert.match(await readFile(c.log, 'utf8'), /ENOENT/);
  }));
test('timeout mata el grupo completo y no deja el proceso nieto', () =>
  temporary(async (dir) => {
    const file = join(dir, 'pid');
    const code = `const {spawn}=require('node:child_process');const c=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});require('node:fs').writeFileSync(${JSON.stringify(file)},String(c.pid));setInterval(()=>{},1000);`;
    const a = await processStep([node, '-e', code], { log: join(dir, 'a.log'), timeout: 500 });
    assert.equal(a.status, 'TIMEOUT');
    const pid = Number(await readFile(file, 'utf8'));
    for (let i = 0; i < 30; i++) {
      try {
        const stat = await readFile(`/proc/${pid}/stat`, 'utf8');
        if (stat.split(' ')[2] === 'Z') return;
      } catch {
        return;
      }
      await new Promise((ok) => setTimeout(ok, 50));
    }
    assert.fail('Nieto continúa vivo');
  }));
test('cancelación distinta de timeout y captura estado real', () =>
  temporary(async (dir) => {
    const c = new AbortController();
    setTimeout(() => c.abort(), 200);
    const a = await processStep([node, '-e', 'setInterval(()=>{},1000)'], {
      log: join(dir, 'a.log'),
      signal: c.signal,
    });
    assert.equal(a.status, 'CANCELLED');
  }));
test('lock excluye otra suite y sólo su dueño puede liberarlo', () =>
  temporary(async (dir) => {
    const path = join(dir, 'active.lock'),
      release = await lock(path);
    await assert.rejects(() => lock(path), /bloqueado/);
    await release();
    const again = await lock(path);
    await again();
  }));
test('evidencia aprobada no sirve con logs inexistentes o alterados', () =>
  temporary(async (dir) => {
    const path = join(dir, 'unit.log');
    await writeFile(path, 'PASS');
    const before = await evidence([path]);
    assert.equal(await validEvidence(before), true);
    await writeFile(path, 'otro estado');
    assert.equal(await validEvidence(before), false);
    await rm(path);
    assert.equal(await validEvidence(before), false);
  }));
test('huellas incluyen árbol sucio, tests, fixtures, configuración, lock, entorno y perfil', () =>
  temporary(async (dir) => {
    for (const [name, content] of Object.entries({
      'source.ts': 'export const n=1',
      'test.test.ts': 'test1',
      'fixture.json': '{}',
      'package-lock.json': '{}',
      'playwright.config.ts': 'base',
      'README.md': 'docs',
      '.env': 'VITE_COLOR=original',
    }))
      await writeFile(join(dir, name), content);
    const base = (await fingerprint(dir, 'fast', {})).key;
    for (const file of [
      'source.ts',
      'test.test.ts',
      'fixture.json',
      'package-lock.json',
      'playwright.config.ts',
      '.env',
    ]) {
      const old = await readFile(join(dir, file));
      await writeFile(join(dir, file), 'changed');
      assert.notEqual((await fingerprint(dir, 'fast', {})).key, base, file);
      await writeFile(join(dir, file), old);
    }
    await writeFile(join(dir, 'README.md'), 'documentation updated');
    assert.equal((await fingerprint(dir, 'fast', {})).key, base);
    assert.notEqual((await fingerprint(dir, 'full', {})).key, base);
    assert.notEqual((await fingerprint(dir, 'fast', { BASE_PATH: '/pattern/' })).key, base);
  }));
test('archivos de entrada con symlink se rechazan', () =>
  temporary(async (dir) => {
    await symlink('/etc/passwd', join(dir, 'input.ts'));
    await assert.rejects(() => fingerprint(dir, 'fast', {}), /Symlink/);
  }));
test('Git identifica cambios sin commit y documentos nuevos sin incorporarlos', () =>
  temporary(async (dir) => {
    execFileSync('git', ['init', '-q'], { cwd: dir });
    await writeFile(join(dir, 'app.ts'), 'a');
    execFileSync('git', ['add', 'app.ts'], { cwd: dir });
    execFileSync(
      'git',
      ['-c', 'user.name=QA', '-c', 'user.email=qa@example.invalid', 'commit', '-qm', 'baseline'],
      { cwd: dir },
    );
    await writeFile(join(dir, 'app.ts'), 'b');
    await writeFile(join(dir, 'future.txt'), 'pending');
    assert.deepEqual(changedFiles(dir), ['app.ts', 'future.txt']);
  }));
test('selección usa imports transitivos, asociaciones de UI y amplía contratos compartidos', () =>
  temporary(async (dir) => {
    const entries = {
      'src/fill/tool.ts': 'export const tool=1',
      'src/editor/gesture.ts': "import {tool} from '../fill/tool';",
      'src/tests/gesture.test.ts': "import '../editor/gesture';",
      'tests/feedback-fill.spec.ts': '',
      'tests/studio.spec.ts': '',
      'tests/aperiodic.spec.ts': '',
      'src/app/model.ts': '',
    };
    for (const [file, data] of Object.entries(entries)) {
      await mkdir(join(dir, file, '..'), { recursive: true });
      await writeFile(join(dir, file), data);
    }
    const result = await selectImpact(dir, ['src/fill/tool.ts']);
    assert(result.units.includes('src/tests/gesture.test.ts'));
    assert(result.e2e.includes('tests/feedback-fill.spec.ts'));
    assert(!result.e2e.includes('tests/aperiodic.spec.ts'));
    const broad = await selectImpact(dir, ['src/app/model.ts']);
    assert.equal(broad.broad, true);
    assert.equal(broad.e2e.length, 3);
    const unknown = await selectImpact(dir, ['unknown.config']);
    assert.equal(unknown.broad, true);
    const docs = await selectImpact(dir, ['docs/prd/future.txt']);
    assert.equal(docs.broad, false);
    assert.equal(docs.e2e.length, 0);
  }));
test('FULL exige todas las baterías, doble build/estáticas, persistencia y parsers independientes', async () => {
  const p = await makePlan(
    'full',
    { units: [], e2e: [], infrastructure: false },
    process.cwd(),
    '/tmp/report',
  );
  for (const id of [
    'typescript',
    'infrastructure',
    'monitor',
    'unit',
    'e2e',
    'build',
    'build-sub',
    'static-root',
    'static-sub',
    'verify-exports',
    'verify-chambers',
    'verify-isohedral',
  ])
    assert(
      p.some((s) => s.id === id),
      id,
    );
  assert(!p.find((s) => s.id === 'e2e').command.some((s) => s === '--grep'));
  assert.equal(p.find((s) => s.id === 'build-sub').env.BASE_PATH, '/pattern/');
});
test('reportes malformados o inconsistentes no pueden dar PASS', () => {
  assert.throws(() => parseCounts({}, 'vitest'));
  assert.throws(() =>
    parseCounts({ counts: { passed: 1, total: 1 }, tests: [], errors: [] }, 'playwright'),
  );
  assert.deepEqual(
    parseCounts(
      {
        numTotalTests: 1,
        numPassedTests: 1,
        numFailedTests: 0,
        numPendingTests: 0,
        testResults: [],
      },
      'vitest',
    ),
    { passed: 1, failed: 0, skipped: 0, total: 1 },
  );
});
test('diagnóstico limitado conserva fallos en evidencia sin volcarlos completos al contexto', () => {
  const report = {
    profile: 'full',
    status: 'FAIL',
    steps: [],
    durationMs: 5000,
    path: 'report.json',
    failures: Array.from({ length: 8 }, (_, i) => ({
      step: String(i),
      message: 'x'.repeat(2000),
      log: 'file.log',
    })),
  };
  const text = compact(report);
  assert.equal((text.match(/FAIL \d/g) ?? []).length, 5);
  assert(text.length < 3000);
  assert.equal(report.failures[0].message.length, 2000);
  assert.equal(classify('geometry mismatch'), 'NEEDS_PARENT');
  assert.equal(classify('ECONNREFUSED'), 'INFRA_FAILURE');
  assert.equal(classify('unknown'), 'UNVERIFIED');
});
test('servidor estático aísla subdirectorio, MIME, assets y cierre sin tocar4173', () =>
  temporary(async (dir) => {
    await writeFile(join(dir, 'index.html'), '<html>Pattern</html>');
    await writeFile(join(dir, 'app.js'), 'export const n=1');
    const s = await staticServer(dir, '/pattern/');
    try {
      assert.match(await (await fetch(s.url)).text(), /Pattern/);
      assert.match((await fetch(s.url + 'app.js')).headers.get('content-type'), /javascript/);
      assert.equal((await fetch(s.url.replace('/pattern/', '/'))).status, 404);
      assert.equal((await fetch(s.url + 'missing.js')).status, 404);
      assert.equal((await fetch(s.url + '%2e%2e%2foutside')).status, 403);
    } finally {
      await s.close();
    }
  }));

import { runQA } from './qa-runner.mjs';
test('runner real: PASS cacheado sólo con evidencia íntegra y árbol idéntico', () =>
  temporary(async (dir) => {
    const input = join(dir, 'input.ts');
    await writeFile(input, 'baseline');
    let calls = 0;
    const planFactory = async () => {
      calls++;
      return [{ id: 'actual-process', command: [node, '-e', 'console.log("PASS")'] }];
    };
    const first = await runQA('fast', { root: dir, files: ['input.ts'], planFactory });
    assert.equal(first.status, 'PASS');
    assert.equal(calls, 1);
    const cached = await runQA('fast', { root: dir, files: ['input.ts'], planFactory });
    assert.equal(cached.status, 'PASS');
    assert.equal(cached.cachedFrom, first.path);
    assert.equal(calls, 1);
    await writeFile(first.steps[0].log, 'corrupt');
    const again = await runQA('fast', { root: dir, files: ['input.ts'], planFactory });
    assert.equal(again.status, 'PASS');
    assert(!again.cachedFrom);
    assert.equal(calls, 2);
    await writeFile(input, 'dirty work');
    await runQA('fast', { root: dir, files: ['input.ts'], planFactory });
    assert.equal(calls, 3);
  }));
test('runner FAIL parcial nunca se cachea y no inicia pasos posteriores', () =>
  temporary(async (dir) => {
    let calls = 0;
    const planFactory = async () => {
      calls++;
      return [
        { id: 'first', command: [node, '-e', 'process.exit(4)'] },
        { id: 'forbidden', command: [node, '-e', 'process.exit(0)'] },
      ];
    };
    for (let i = 0; i < 2; i++) {
      const r = await runQA('full', { root: dir, files: [], planFactory });
      assert.equal(r.status, 'FAIL');
      assert.equal(r.steps.length, 1);
      assert.equal(r.steps[0].exitCode, 4);
      assert(!r.cachedFrom);
    }
    assert.equal(calls, 2);
  }));
test('runner rechaza reporter malformado aunque el comando retorne0', () =>
  temporary(async (dir) => {
    const r = await runQA('full', {
      root: dir,
      files: [],
      planFactory: async () => [
        {
          id: 'unit',
          command: [node, '-e', 'console.log("fake pass")'],
          parser: 'vitest',
          data: join(dir, 'missing.json'),
        },
      ],
    });
    assert.equal(r.status, 'FAIL');
    assert.match(r.steps[0].diagnostic, /ENOENT/);
  }));
test('runner marca STALE si una entrada cambia durante la verificación', () =>
  temporary(async (dir) => {
    const input = join(dir, 'input.ts');
    await writeFile(input, 'before');
    const r = await runQA('fast', {
      root: dir,
      files: ['input.ts'],
      planFactory: async () => [
        {
          id: 'mutation',
          command: [node, '-e', `require('fs').writeFileSync(${JSON.stringify(input)},'after')`],
        },
      ],
    });
    assert.equal(r.status, 'STALE');
    assert(r.failures.some((f) => f.step === 'inputs'));
  }));

import { verifyModel, administrativeReport } from './qa-admin.mjs';
import { validateFiles, validateGate, closeWork } from './work-close.mjs';
test('modelo efectivo: configuración o autodescripción no bastan; herencia incorrecta no es Luna', () => {
  const parent = { id: 'parent' },
    child = {
      parent: 'parent',
      role: 'qa_admin',
      model: 'gpt-6-luna',
      effort: 'low',
      sandbox: 'read-only',
      approval: 'never',
    };
  assert.equal(verifyModel(parent, []).status, 'UNVERIFIED');
  assert.equal(verifyModel(parent, [{ ...child, model: 'gpt-6.1-sol' }]).status, 'UNVERIFIED');
  assert.equal(verifyModel(parent, [{ ...child, effort: 'high' }]).status, 'UNVERIFIED');
  assert.equal(verifyModel(parent, [child]).status, 'VERIFIED');
});
test('QA administrativo correcto usa fallback determinístico sin lanzar modelos', () =>
  temporary(async (dir) => {
    const report = join(dir, 'report.json');
    await atomic(report, { status: 'PASS', failures: [] });
    assert.equal((await administrativeReport(report)).mode, 'SCRIPT_ONLY');
  }));
test('staging explícito rechaza secretos, temporales, traversal, PRD posterior e IP privada', () =>
  temporary(async (dir) => {
    await writeFile(join(dir, 'source.ts'), 'export const ok=1');
    assert.deepEqual(await validateFiles(dir, ['source.ts']), ['source.ts']);
    for (const path of [
      '../outside',
      '.runtime/private.json',
      '.env',
      '.env.production',
      'dump.sqlite',
      'docs/prd/prd_v3.1.txt',
    ])
      await assert.rejects(() => validateFiles(dir, [path]));
    await writeFile(join(dir, 'private.md'), ['192', '168', '1', '20'].join('.'));
    await assert.rejects(() => validateFiles(dir, ['private.md']), /IP privada/);
  }));
test('FULL fallido o incompleto bloquea la publicación antes de tocar el index', () =>
  temporary(async (dir) => {
    const report = join(dir, 'report.json');
    await atomic(report, { status: 'FAIL', profile: 'full', required: ['e2e'], steps: [] });
    await assert.rejects(() => validateGate(dir, 'full', report), /Gate obligatorio/);
  }));
async function gitFixture(base) {
  const root = join(base, 'work'),
    remote = join(base, 'remote.git');
  await mkdir(root);
  const git = (...args) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' });
  execFileSync('git', ['init', '--bare', '-q', remote]);
  git('init', '-q', '-b', 'main');
  git('config', 'user.name', 'QA');
  git('config', 'user.email', 'qa@example.invalid');
  git('remote', 'add', 'origin', remote);
  await writeFile(join(root, 'README.md'), 'initial\n');
  await writeFile(join(root, '.gitignore'), '.runtime/\n');
  git('add', '.gitignore');
  git('add', 'README.md');
  git('commit', '-qm', 'baseline');
  git('push', '-q', 'origin', 'main');
  await writeFile(join(root, 'README.md'), 'updated\n');
  const impact = {
    units: [],
    e2e: [],
    infrastructure: false,
    categories: [],
    changed: ['README.md'],
  };
  const dir = join(root, '.runtime/qa/fixture');
  await mkdir(dir, { recursive: true });
  const path = join(dir, 'report.json'),
    log = join(dir, 'evidence.log');
  await writeFile(log, 'synthetic validator fixture\n');
  const required = (await makePlan('integration', impact, root, dir)).map((s) => s.id);
  await atomic(path, {
    status: 'PASS',
    profile: 'integration',
    impact,
    path,
    required,
    steps: required.map((id) => ({ id, status: 'PASS', log })),
    fingerprint: (await fingerprint(root, 'integration')).key,
    evidence: await evidence([log]),
  });
  return { root, remote, git, path };
}
test('commit rechazado por hook queda FAIL sin push ni reescritura', () =>
  temporary(async (dir) => {
    const f = await gitFixture(dir);
    const hook = join(f.root, '.git/hooks/pre-commit');
    await writeFile(hook, '#!/bin/sh\nexit 1\n', { mode: 0o755 });
    const before = f.git('rev-parse', 'HEAD').trim();
    const r = await closeWork({
      root: f.root,
      expectedRemote: f.remote,
      files: ['README.md'],
      gate: 'integration',
      reportPath: f.path,
      push: true,
    });
    assert.equal(r.status, 'FAIL');
    assert.equal(r.commitExit, 1, r.error);
    assert.equal(f.git('rev-parse', 'HEAD').trim(), before);
    assert.equal(r.pushExit, undefined);
  }));
test('push rechazado conserva el commit local sin forzar', () =>
  temporary(async (dir) => {
    const f = await gitFixture(dir);
    await writeFile(join(f.remote, 'hooks/pre-receive'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
    const before = f.git('rev-parse', 'HEAD').trim();
    const r = await closeWork({
      root: f.root,
      expectedRemote: f.remote,
      files: ['README.md'],
      gate: 'integration',
      reportPath: f.path,
      push: true,
    });
    assert.equal(r.status, 'FAIL');
    assert.equal(r.commitExit, 0, r.error);
    assert.equal(r.pushExit, 1);
    assert.notEqual(f.git('rev-parse', 'HEAD').trim(), before);
  }));
test('workflow separa secretos/QA, bloquea deploy con needs y usa dist del mismo SHA', async () => {
  const text = await readFile('.github/workflows/deploy-ftp.yml', 'utf8');
  const quality = text.slice(text.indexOf('  quality:'), text.indexOf('  deploy:'));
  assert(!quality.includes('secrets.FTP'));
  assert.match(text, /needs: quality/);
  assert.match(text, /npm run qa:full/);
  assert.match(text, /pattern-dist-\$\{\{ github.sha \}\}/);
  assert.match(text, /github.ref == 'refs\/heads\/main'/);
});

import { stepFingerprint } from './qa/core.mjs';
test('caché por verificación completa: cambio de validador no repite E2E; fixture o reporter sí', () => {
  const inputs = {
    files: {
      'src/app.ts': 'a',
      'tests/a.spec.ts': 't',
      'tests/fixture.json': 'f',
      'scripts/validate-proof.mjs': 'v',
      'scripts/qa-playwright-reporter.mjs': 'r',
    },
    versions: { node: process.version },
    environment: {},
  };
  const step = { id: 'e2e', command: ['node', 'test', '/run/results'] },
    key = stepFingerprint(inputs, step, '/run');
  assert.equal(
    stepFingerprint(
      { ...inputs, files: { ...inputs.files, 'scripts/validate-proof.mjs': 'changed' } },
      step,
      '/run',
    ),
    key,
  );
  for (const file of ['src/app.ts', 'tests/fixture.json', 'scripts/qa-playwright-reporter.mjs'])
    assert.notEqual(
      stepFingerprint({ ...inputs, files: { ...inputs.files, [file]: 'changed' } }, step, '/run'),
      key,
    );
});

test('FULL aísla flags heredados de estáticas/base URL para no ejecutar otra suite', async () => {
  const plan = await makePlan(
    'full',
    { units: [], e2e: [], infrastructure: false },
    process.cwd(),
    '/tmp/report',
  );
  const step = plan.find((s) => s.id === 'e2e');
  assert.equal(step.env.TEST_STATIC, '');
  assert.equal(step.env.TEST_BASE_URL, 'http://127.0.0.1:4173');
});
test('runner conserva conteos y diagnóstico cuando el reporter registra FAIL real', () =>
  temporary(async (dir) => {
    const data = join(dir, 'failed.json');
    await atomic(data, {
      numTotalTests: 2,
      numPassedTests: 1,
      numFailedTests: 1,
      numPendingTests: 0,
      testResults: [
        {
          assertionResults: [
            {
              status: 'failed',
              fullName: 'falla intencional',
              failureMessages: ['Expected1,received2'],
            },
          ],
        },
      ],
    });
    const r = await runQA('fast', {
      root: dir,
      files: [],
      planFactory: async () => [
        { id: 'unit', command: [node, '-e', 'process.exit(1)'], parser: 'vitest', data },
      ],
    });
    assert.equal(r.status, 'FAIL');
    assert.equal(r.steps[0].counts.passed, 1);
    assert.equal(r.steps[0].counts.failed, 1);
    assert.match(r.failures[0].message, /falla intencional/);
  }));

test('fallo de infraestructura conserva el nombre y error del TAP en diagnóstico localizado', () =>
  temporary(async (dir) => {
    const code =
      'console.log("# Subtest: caso puntual\\nnot ok 1 - caso puntual\\n  ---\\n  error: detalle real\\n  ...\\n1..1\\n# tests 1\\n# pass 0\\n# fail 1\\n# skipped 0");process.exit(1)';
    const r = await runQA('fast', {
      root: dir,
      files: [],
      planFactory: async () => [
        { id: 'infrastructure', command: [node, '-e', code], parser: 'tap' },
      ],
    });
    assert.equal(r.status, 'FAIL');
    assert.equal(r.steps[0].counts.failed, 1);
    assert.match(r.failures[0].message, /caso puntual/);
    assert.match(r.failures[0].message, /detalle real/);
  }));

import { fileKey, consistentPass, sameInventory, combineTests } from './qa/e2e-cache.mjs';
test('caché E2E por archivo conserva sólo entradas idénticas, no el archivo fallido', () => {
  const inputs = {
    files: {
      'src/editor.ts': 'e',
      'tests/a.spec.ts': 'a',
      'tests/b.spec.ts': 'b',
      'tests/navigation.ts': 'h',
      'tests/fixture.json': 'f',
    },
    versions: { node: process.version },
    environment: {},
  };
  const context = { workers: 4, baseURL: 'local', testStatic: false },
    key = fileKey(inputs, 'tests/a.spec.ts', context);
  assert.equal(
    fileKey(
      { ...inputs, files: { ...inputs.files, 'tests/b.spec.ts': 'changed' } },
      'tests/a.spec.ts',
      context,
    ),
    key,
  );
  for (const file of [
    'src/editor.ts',
    'tests/a.spec.ts',
    'tests/navigation.ts',
    'tests/fixture.json',
  ])
    assert.notEqual(
      fileKey(
        { ...inputs, files: { ...inputs.files, [file]: 'changed' } },
        'tests/a.spec.ts',
        context,
      ),
      key,
    );
  assert.notEqual(fileKey(inputs, 'tests/a.spec.ts', { ...context, workers: 2 }), key);
  const pass = {
    id: 'a',
    outcome: 'expected',
    expectedStatus: 'passed',
    results: [{ status: 'passed' }],
  };
  assert(consistentPass(pass));
  assert(!consistentPass({ ...pass, outcome: 'flaky' }));
  assert(!consistentPass({ ...pass, results: [{ status: 'failed' }] }));
});
test('FULL combinado exige inventario íntegro, sin duplicados ni casos desaparecidos', () => {
  const a = { id: 'a' },
    b = { id: 'b' };
  assert(sameInventory([a, b], [b, a]));
  assert.deepEqual(combineTests([a, b], [a], [b]), [a, b]);
  assert.throws(() => combineTests([a, b], [a], []), /incompleto/);
  assert.throws(() => combineTests([a, b], [a], [a]), /duplicado/);
});

import { reusableRun } from './qa/e2e-cache.mjs';
test('archivos E2E de timeout, cancelación o supervisor incompleto nunca se reutilizan', () => {
  const step = { status: 'PASS', exitCode: 0 };
  assert(reusableRun({ status: 'PASS' }, step));
  assert(reusableRun({ status: 'FAIL' }, step));
  for (const status of ['RUNNING', 'STALE', 'TIMEOUT', 'CANCELLED', 'INTERRUPTED'])
    assert(!reusableRun({ status }, step));
  for (const status of ['TIMEOUT', 'CANCELLED'])
    assert(!reusableRun({ status: 'FAIL' }, { ...step, status }));
  assert(!reusableRun({ status: 'FAIL' }, { status: 'FAIL', exitCode: null, reusedFiles: [] }));
});
