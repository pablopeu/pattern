#!/usr/bin/env node
import { mkdir, readFile, writeFile, unlink, cp, readdir, symlink } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  atomic,
  json,
  alive,
  lock,
  fingerprint,
  processStep,
  parseCounts,
  evidence,
  validEvidence,
  classify,
  compact,
  sha,
  stepFingerprint,
  treeEvidence,
} from './qa/core.mjs';
import { changedFiles, selectImpact } from './qa/impact.mjs';
import { executeE2E } from './qa/e2e-cache.mjs';
import { makePlan } from './qa/plan.mjs';
export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
async function ensureDev(root, signal) {
  try {
    const response = await fetch('http://127.0.0.1:4173/src/app/App.tsx', {
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok || !(await response.text()).includes('import'))
      throw Error('Puerto4173 ocupado por un servicio ajeno');
    return async () => {};
  } catch (error) {
    if (!/fetch failed|timeout|aborted/i.test(error.message)) throw error;
  }
  const child = spawn(
    process.execPath,
    ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4173', '--strictPort'],
    { cwd: root, detached: true, stdio: 'ignore' },
  );
  const exited = new Promise((ok) => {
    child.once('exit', ok);
    child.once('error', ok);
  });
  const stop = () => {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {}
  };
  signal.addEventListener('abort', stop, { once: true });
  child.on('error', () => {});
  for (let i = 0; i < 100; i++) {
    if (signal.aborted) {
      stop();
      throw Error('Cancelado');
    }
    try {
      const r = await fetch('http://127.0.0.1:4173/src/app/App.tsx', {
        signal: AbortSignal.timeout(500),
      });
      if (r.ok)
        return async () => {
          stop();
          signal.removeEventListener('abort', stop);
          await Promise.race([exited, new Promise((ok) => setTimeout(ok, 1000))]);
          try {
            process.kill(-child.pid, 'SIGKILL');
          } catch {}
        };
    } catch {}
    await new Promise((ok) => setTimeout(ok, 100));
  }
  stop();
  throw Error('No se pudo iniciar Vite para QA; servicios preexistentes intactos');
}
export async function runQA(profile, options = {}) {
  if (!['fast', 'integration', 'full'].includes(profile)) throw Error('Perfil QA inválido');
  const cwd = options.root ?? root,
    runtime = resolve(cwd, '.runtime/qa');
  await mkdir(runtime, { recursive: true });
  const release = await lock(resolve(runtime, 'active.lock'));
  const id =
      options.id ??
      `${new Date().toISOString().replaceAll(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`,
    dir = resolve(runtime, id);
  const controller = new AbortController();
  const abort = () => controller.abort();
  process.once('SIGINT', abort);
  process.once('SIGTERM', abort);
  let stopDev;
  const started = Date.now();
  const report = {
    id,
    profile,
    status: 'RUNNING',
    pid: process.pid,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    path: resolve(dir, 'report.json'),
    steps: [],
    failures: [],
    required: [],
  };
  const save = async () => {
    report.updatedAt = new Date().toISOString();
    await atomic(report.path, report);
    await atomic(resolve(runtime, 'latest.json'), { id, path: report.path });
  };
  try {
    const changed = options.files ?? changedFiles(cwd, options.base),
      impact = await selectImpact(cwd, changed);
    const inputs = await fingerprint(cwd, profile);
    report.fingerprint = inputs.key;
    report.impact = impact;
    report.inputManifest = resolve(dir, 'manifest.json');
    await atomic(report.inputManifest, { ...inputs, impact, profile });
    await save();
    const previous = await json(resolve(runtime, 'cache', `${inputs.key}.json`)).catch(() => null);
    if (!options.fresh && previous?.status === 'PASS' && (await validEvidence(previous.evidence))) {
      const source = await json(previous.report);
      if (
        previous.reportHash === sha(await readFile(previous.report)) &&
        source.status === 'PASS' &&
        source.fingerprint === inputs.key &&
        source.required.every((id) => source.steps.some((s) => s.id === id && s.status === 'PASS'))
      ) {
        report.status = 'PASS';
        report.cachedFrom = source.path;
        report.steps = source.steps;
        report.required = source.required;
        report.evidence = previous.evidence;
        return report;
      }
    }
    const steps = await (options.planFactory ?? makePlan)(profile, impact, cwd, dir);
    report.required = steps.map((s) => s.id);
    for (const definition of steps) {
      if (controller.signal.aborted) {
        report.status = 'CANCELLED';
        break;
      }
      report.current = definition.id;
      await save();
      if (definition.dev && !stopDev) stopDev = await ensureDev(cwd, controller.signal);
      if (definition.independent) {
        await mkdir(resolve(definition.cwd, '.runtime'), { recursive: true });
        await symlink(resolve(cwd, 'scripts'), resolve(definition.cwd, 'scripts'), 'dir').catch(
          (error) => {
            if (error.code !== 'EEXIST') throw error;
          },
        );
      }
      const reusable = ['typescript', 'unit', 'e2e', 'infrastructure', 'monitor'].includes(
        definition.id,
      );
      const stepKey = stepFingerprint(inputs, definition, dir);
      const stepPath = resolve(runtime, 'steps', stepKey + '.json');
      const previousStep =
        reusable && !options.fresh ? await json(stepPath).catch(() => null) : null;
      if (previousStep?.item.status === 'PASS' && (await validEvidence(previousStep.evidence))) {
        const item = {
          ...previousStep.item,
          cachedFrom: previousStep.item.log,
          durationMs: 0,
          stepEvidence: previousStep.evidence,
        };
        report.steps.push(item);
        await save();
        continue;
      }
      const item =
        profile === 'full' && definition.id === 'e2e'
          ? await executeE2E({
              definition,
              fresh: options.fresh,
              root: cwd,
              dir,
              inputs,
              signal: controller.signal,
              timeout: options.timeout ?? definition.timeout,
            })
          : await processStep(definition.command, {
              cwd: definition.cwd ?? cwd,
              env: definition.env,
              log: resolve(dir, `${definition.id}.log`),
              timeout: options.timeout ?? definition.timeout,
              signal: controller.signal,
            });
      item.id = definition.id;
      report.steps.push(item);
      if (definition.parser && !['TIMEOUT', 'CANCELLED'].includes(item.status)) {
        try {
          if (definition.parser === 'inventory') {
            const data = await json(definition.data);
            item.data = definition.data;
            if (!data.listOnly || !data.tests.length || data.errors.length)
              throw Error('Inventario E2E inválido');
          } else if (definition.parser === 'tap') {
            const log = await readFile(item.log, 'utf8');
            const num = (k) => Number(log.match(new RegExp(`^# ${k} (\\d+)$`, 'm'))?.[1] ?? NaN);
            item.counts = {
              passed: num('pass'),
              failed: num('fail'),
              skipped: num('skipped'),
              total: num('tests'),
            };
            if (!Number.isInteger(item.counts.total) || item.counts.total < 1 || item.counts.failed)
              throw Error('TAP malformado o fallido');
          } else {
            const data = await json(definition.data);
            item.data = definition.data;
            item.counts = parseCounts(data, definition.parser);
            if (
              !item.counts.total ||
              item.counts.failed ||
              item.counts.flaky ||
              data.errors?.length
            )
              throw Error('Reporte incompleto, flaky o fallido');
          }
        } catch (error) {
          item.status = 'FAIL';
          item.diagnostic = error.message;
        }
      }
      if (item.status !== 'PASS') {
        let messages = [];
        if (definition.parser === 'tap')
          messages = (await readFile(item.log, 'utf8'))
            .split(/^# Subtest: /m)
            .filter((block) => /^not ok /m.test(block));
        if (definition.data) {
          const data = await json(definition.data).catch(() => null);
          if (data?.tests)
            messages = data.tests
              .filter((t) => t.outcome === 'unexpected' || t.outcome === 'flaky')
              .map(
                (t) =>
                  `${t.title}: ${t.results.flatMap((r) => r.errors.map((e) => e.message)).join('\n')}`,
              );
          if (data?.testResults)
            messages = data.testResults.flatMap((t) =>
              t.assertionResults
                .filter((a) => a.status === 'failed')
                .map((a) => `${a.fullName}: ${a.failureMessages.join('\n')}`),
            );
        }
        if (!messages.length)
          messages = [item.diagnostic ?? (await readFile(item.log, 'utf8')).slice(-4000)];
        for (const message of messages)
          report.failures.push({
            step: item.id,
            category: classify(message),
            message,
            log: item.log,
          });
        report.status = item.status;
        break;
      }
      if (reusable) {
        const now = await fingerprint(cwd, profile);
        if (stepFingerprint(now, definition, dir) === stepKey) {
          const files = [item.log, ...(item.data ? [item.data] : [])];
          const stepEvidence = {
            ...(await evidence(files)),
            ...(await treeEvidence(resolve(dir, `${item.id}-artifacts`))),
            ...(item.proofs ?? {}),
          };
          item.stepEvidence = stepEvidence;
          await atomic(stepPath, { item, evidence: stepEvidence });
        }
      }
      if (definition.build === 'root')
        await cp(resolve(cwd, 'dist'), resolve(dir, 'dist-root'), { recursive: true });
      await save();
    }
    if (report.status === 'RUNNING')
      report.status = report.required.every((id) =>
        report.steps.some((s) => s.id === id && s.status === 'PASS'),
      )
        ? 'PASS'
        : 'FAIL';
    const after = await fingerprint(cwd, profile);
    if (after.key !== inputs.key) {
      report.status = 'STALE';
      report.failures.push({
        step: 'inputs',
        category: 'NEEDS_PARENT',
        message: 'Las entradas cambiaron durante QA; no se publica ni cachea el resultado.',
        log: report.inputManifest,
      });
    }
    if (report.status === 'PASS') {
      const paths = report.steps.flatMap((s) => [
        s.log,
        ...(s.data ? [s.data] : []),
        ...Object.keys(s.stepEvidence ?? {}),
        ...Object.keys(s.proofs ?? {}),
      ]);
      for (const folder of [
        'dist-root',
        'dist-sub',
        'e2e-artifacts',
        'static-root-artifacts',
        'static-sub-artifacts',
        'independent/.runtime',
      ]) {
        const visit = async (directory) => {
          for (const e of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
            const f = resolve(directory, e.name);
            if (e.isDirectory()) await visit(f);
            else paths.push(f);
          }
        };
        await visit(resolve(dir, folder));
      }
      report.evidence = await evidence([...paths, report.inputManifest]);
    }
  } catch (error) {
    report.status = controller.signal.aborted ? 'CANCELLED' : 'FAIL';
    report.failures.push({
      step: report.current ?? 'setup',
      category: classify(error.message),
      message: error.message,
      log: report.path,
    });
  } finally {
    await stopDev?.();
    report.durationMs = Date.now() - started;
    delete report.current;
    await atomic(resolve(dir, 'failures.json'), report.failures);
    await save();
    await writeFile(resolve(dir, 'summary.txt'), compact(report));
    if (report.status === 'PASS' && !report.cachedFrom)
      await atomic(resolve(runtime, 'cache', `${report.fingerprint}.json`), {
        status: 'PASS',
        report: report.path,
        reportHash: sha(await readFile(report.path)),
        evidence: report.evidence,
      });
    process.removeListener('SIGINT', abort);
    process.removeListener('SIGTERM', abort);
    await release();
  }
  return report;
}
export async function main(args = process.argv.slice(2)) {
  const [command = 'fast', ...flags] = args;
  const option = (name) => (flags.indexOf(name) < 0 ? undefined : flags[flags.indexOf(name) + 1]);
  const runtime = resolve(root, '.runtime/qa');
  if (command === 'status' || command === 'failures') {
    const latest = await json(resolve(runtime, 'latest.json')).catch(() => null);
    if (!latest) {
      console.log('QA NOT_RUN');
      return 1;
    }
    const report = await json(latest.path);
    if (report.status === 'RUNNING' && !alive(report.pid)) report.status = 'INTERRUPTED';
    console.log(
      command === 'failures'
        ? JSON.stringify(report.failures.slice(0, 5), null, 2)
        : compact(report),
    );
    return report.status === 'PASS' ? 0 : 1;
  }
  if (command === 'cancel') {
    const path = resolve(runtime, 'active.lock'),
      owner = await json(path);
    if (alive(owner.pid)) {
      process.kill(owner.pid, 'SIGTERM');
      console.log(`Cancelación solicitada PID ${owner.pid}`);
    } else if (flags.includes('--recover')) {
      await unlink(path);
      console.log('Lock inactivo retirado');
    } else throw Error('Supervisor inactivo; usar --recover');
    return 0;
  }
  const report = await runQA(command, {
    base: option('--base'),
    files: option('--files')?.split(','),
    timeout: option('--timeout') ? Number(option('--timeout')) : undefined,
    fresh: flags.includes('--fresh'),
  });
  console.log(compact(report));
  return report.status === 'PASS' ? 0 : 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(`QA FAIL: ${error.message}`);
      process.exitCode = 1;
    });
