import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { atomic, json, sha, evidence, validEvidence, parseCounts, processStep } from './core.mjs';
const PROOF_VERSION = 1;
export function fileKey(inputs, file, context) {
  const files = Object.fromEntries(
    Object.entries(inputs.files).filter(([path]) => {
      if (path.startsWith('scripts/') || path.startsWith('.codex/') || path.startsWith('.github/'))
        return false;
      return !/^tests\/.*\.spec\.ts$/.test(path) || path === file;
    }),
  );
  return sha(
    JSON.stringify({
      proof: PROOF_VERSION,
      file,
      files,
      versions: inputs.versions,
      environment: inputs.environment,
      context,
    }),
  );
}
export function consistentPass(test) {
  return (
    test.outcome === 'expected' &&
    test.results.length === 1 &&
    test.results[0].status === test.expectedStatus &&
    test.results[0].status !== 'skipped'
  );
}
export function sameInventory(a, b) {
  return (
    a.length === b.length &&
    a
      .map((t) => t.id)
      .sort()
      .join('\n') ===
      b
        .map((t) => t.id)
        .sort()
        .join('\n')
  );
}
export function combineTests(inventory, executed, reused) {
  const tests = [...executed, ...reused];
  if (new Set(tests.map((t) => t.id)).size !== tests.length || !sameInventory(tests, inventory))
    throw Error('Inventario E2E incompleto o duplicado; no se puede aprobar FULL');
  return tests;
}
export function reusableRun(report, step) {
  return (
    ['PASS', 'FAIL'].includes(report.status) &&
    ['PASS', 'FAIL'].includes(step?.status) &&
    ([0, 1].includes(step.exitCode) ||
      (Array.isArray(step.reusedFiles) && step.reusedFiles.length > 0))
  );
}
export async function executeE2E({
  definition,
  root,
  dir,
  inputs,
  signal,
  timeout,
  fresh = false,
}) {
  const inventory = (await json(resolve(dir, 'inventory.json'))).tests;
  const byFile = new Map();
  for (const test of inventory) {
    const file = relative(root, test.location.file).replaceAll('\\', '/');
    if (!byFile.has(file)) byFile.set(file, []);
    byFile.get(file).push(test);
  }
  const context = {
    workers: Number(definition.command.find((s) => s.startsWith('--workers=')).split('=')[1]),
    baseURL: definition.env.TEST_BASE_URL,
    testStatic: false,
  };
  const reused = new Map(),
    proofs = {};
  const legacyPath = resolve(root, '.runtime/qa/legacy-context.json');
  const legacy = await json(legacyPath).catch(() => null);
  const folders = (await readdir(resolve(root, '.runtime/qa'), { withFileTypes: true }))
    .filter((e) => e.isDirectory() && e.name !== dir.split('/').at(-1))
    .map((e) => e.name)
    .sort()
    .reverse();
  for (const name of fresh ? [] : folders) {
    if (reused.size === byFile.size) break;
    const previous = resolve(root, '.runtime/qa', name),
      dataPath = resolve(previous, 'e2e.json'),
      manifestPath = resolve(previous, 'manifest.json'),
      reportPath = resolve(previous, 'report.json');
    try {
      const data = await json(dataPath),
        manifest = await json(manifestPath),
        report = await json(reportPath);
      parseCounts(data, 'playwright');
      if (data.listOnly || data.errors.length || !['passed', 'failed'].includes(data.status))
        continue;
      let previousContext = data.context;
      if (
        !previousContext &&
        legacy &&
        manifest.files['scripts/qa/plan.mjs'] === legacy.planHash &&
        manifest.files['scripts/qa-playwright-reporter.mjs'] === legacy.reporterHash
      )
        previousContext = legacy.context;
      if (!previousContext || JSON.stringify(previousContext) !== JSON.stringify(context)) continue;
      if (data.proofs && !(await validEvidence(data.proofs))) continue;
      const original = report.steps.find((s) => s.id === 'e2e');
      if (!reusableRun(report, original)) continue;
      for (const [file, expected] of byFile) {
        if (
          reused.has(file) ||
          fileKey(inputs, file, context) !== fileKey(manifest, file, previousContext)
        )
          continue;
        const tests = data.tests.filter(
          (t) => relative(root, t.location.file).replaceAll('\\', '/') === file,
        );
        if (!sameInventory(tests, expected) || !tests.every(consistentPass)) continue;
        const paths = [
          dataPath,
          manifestPath,
          reportPath,
          original.log,
          ...tests.flatMap((t) =>
            t.results.flatMap((r) => r.attachments.filter((a) => a.path).map((a) => a.path)),
          ),
        ];
        if (!data.context) paths.push(legacyPath);
        Object.assign(proofs, data.proofs ?? {}, await evidence(paths));
        reused.set(file, tests);
      }
    } catch {
      /* Missing, malformed or unverifiable evidence is never reused. */
    }
  }
  const missing = [...byFile.keys()].filter((file) => !reused.has(file));
  let item, data;
  if (missing.length) {
    const command = [...definition.command.slice(0, 3), ...missing, ...definition.command.slice(3)];
    item = await processStep(command, {
      cwd: root,
      env: definition.env,
      log: resolve(dir, 'e2e.log'),
      timeout,
      signal,
    });
    data = await json(definition.data).catch(() => null);
    if (!data) return item;
  } else {
    await writeFile(
      resolve(dir, 'e2e.log'),
      `Reused ${inventory.length} completed passing cases with identical inputs and inventory.\n`,
    );
    item = {
      command: [],
      exitCode: null,
      status: 'PASS',
      durationMs: 0,
      log: resolve(dir, 'e2e.log'),
    };
    data = { tests: [], errors: [], status: 'passed' };
  }
  const tests = combineTests(inventory, data.tests, [...reused.values()].flat());
  const counts = { passed: 0, failed: 0, flaky: 0, skipped: 0, total: tests.length };
  for (const t of tests) {
    if (t.outcome === 'skipped') counts.skipped++;
    else if (t.outcome === 'flaky') counts.flaky++;
    else if (t.outcome === 'unexpected') counts.failed++;
    else counts.passed++;
  }
  item.reusedFiles = [...reused.keys()];
  item.executedFiles = missing;
  item.proofs = proofs;
  await atomic(definition.data, {
    ...data,
    tests,
    counts,
    context,
    proofs,
    reusedFiles: item.reusedFiles,
    executedFiles: missing,
  });
  return item;
}
