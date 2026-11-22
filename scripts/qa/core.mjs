import { existsSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, rename, mkdir, open, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { filesIn, qaInput } from './impact.mjs';
export const VERSION = 1;
export const pythonCommand = (root, env = process.env) =>
  env.QA_PYTHON ??
  (existsSync(resolve(root, '.runtime/validation-env/bin/python3'))
    ? resolve(root, '.runtime/validation-env/bin/python3')
    : 'python3');
export const sha = (value) => createHash('sha256').update(value).digest('hex');
export async function atomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${randomUUID()}.tmp`;
  await writeFile(tmp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  await rename(tmp, path);
}
export async function json(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
export function alive(pid) {
  if (!Number.isInteger(pid) || pid < 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}
export async function lock(path) {
  await mkdir(dirname(path), { recursive: true });
  const handle = await open(path, 'wx', 0o600).catch(async (error) => {
    if (error.code !== 'EEXIST') throw error;
    const owner = await json(path).catch(() => ({ pid: null }));
    throw Error(
      `QA bloqueado por PID ${owner.pid}; no se ejecutan suites simultáneas. Usar qa:cancel --recover si murió.`,
    );
  });
  const token = randomUUID();
  await handle.writeFile(
    JSON.stringify({ pid: process.pid, token, startedAt: new Date().toISOString() }),
  );
  await handle.close();
  return async () => {
    const current = await json(path).catch(() => null);
    if (current?.token === token) await import('node:fs/promises').then((fs) => fs.unlink(path));
  };
}
export async function fingerprint(root, profile, env = process.env) {
  const files = (await filesIn(root)).filter(qaInput);
  const hashes = {};
  for (const file of files) hashes[file] = sha(await readFile(resolve(root, file)));
  const versions = { node: process.version, platform: process.platform, arch: process.arch };
  for (const name of ['typescript', 'vitest', '@playwright/test'])
    versions[name] = await json(resolve(root, 'node_modules', name, 'package.json'))
      .then((p) => p.version)
      .catch(() => null);
  versions.python = execFileSync(pythonCommand(root, env), ['--version'], {
    encoding: 'utf8',
  }).trim();
  versions.pythonDependencies = sha(
    execFileSync(
      pythonCommand(root, env),
      [
        '-c',
        'import importlib.metadata,json; print(json.dumps(sorted((d.metadata["Name"],d.version) for d in importlib.metadata.distributions())))',
      ],
      { encoding: 'utf8' },
    ),
  );
  const environment = Object.fromEntries(
    Object.entries(env)
      .filter(([k]) =>
        /^(CI|BASE_PATH|NODE_ENV|TZ|LANG|QA_WORKERS|QA_PYTHON|NODE_OPTIONS|NODE_PATH|PYTHONPATH|PYTHONHASHSEED|PYTHONOPTIMIZE|TEST_.*|VITE_.*)$/.test(
          k,
        ),
      )
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, sha(v)]),
  );
  return {
    key: sha(JSON.stringify({ version: VERSION, profile, hashes, versions, environment })),
    files: hashes,
    versions,
    environment,
  };
}
export async function processStep(command, { cwd, env = {}, log, timeout = 300000, signal } = {}) {
  const output = await open(log, 'w', 0o600);
  const start = Date.now();
  let timedOut = false,
    cancelled = false;
  const child = spawn(command[0], command.slice(1), {
    cwd,
    env: { ...process.env, ...env },
    detached: true,
    stdio: ['ignore', output.fd, output.fd],
  });
  const kill = (kind) => {
    if (!child.pid) return;
    try {
      process.kill(-child.pid, kind);
    } catch (e) {
      if (e.code !== 'ESRCH') throw e;
    }
  };
  let escalation;
  const stop = () => {
    kill('SIGTERM');
    escalation ??= setTimeout(() => kill('SIGKILL'), 1000);
  };
  const abort = () => {
    cancelled = true;
    stop();
  };
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    stop();
  }, timeout);
  let error;
  const exit = await new Promise((resolve) => {
    child.on('error', (e) => {
      error = e.message;
      resolve({ code: null, signal: null });
    });
    child.on('close', (code, signal) => resolve({ code, signal }));
    if (signal?.aborted) abort();
  });
  clearTimeout(timer);
  clearTimeout(escalation);
  signal?.removeEventListener('abort', abort);
  kill('SIGKILL');
  await output.close();
  if (error) await writeFile(log, error + '\n');
  return {
    command,
    exitCode: exit.code,
    signal: exit.signal,
    status: timedOut ? 'TIMEOUT' : cancelled ? 'CANCELLED' : exit.code === 0 ? 'PASS' : 'FAIL',
    durationMs: Date.now() - start,
    log,
  };
}
export function parseCounts(data, kind) {
  if (kind === 'vitest') {
    if (
      !Number.isInteger(data.numTotalTests) ||
      !Array.isArray(data.testResults) ||
      !Number.isInteger(data.numPassedTests) ||
      !Number.isInteger(data.numFailedTests) ||
      data.numPassedTests + data.numFailedTests + (data.numPendingTests ?? 0) !== data.numTotalTests
    )
      throw Error('Reporter Vitest malformado');
    return {
      passed: data.numPassedTests,
      failed: data.numFailedTests,
      skipped: data.numPendingTests ?? 0,
      total: data.numTotalTests,
    };
  }
  if (!Array.isArray(data.tests) || !Array.isArray(data.errors) || !data.counts)
    throw Error('Reporter Playwright malformado');
  const c = data.counts;
  if (
    !Object.values(c).every(Number.isInteger) ||
    c.passed + c.failed + c.skipped + c.flaky !== c.total ||
    c.total !== data.tests.length
  )
    throw Error('Conteos Playwright inconsistentes');
  return c;
}
export async function evidence(paths) {
  const values = {};
  for (const path of paths) {
    await access(path);
    values[path] = sha(await readFile(path));
  }
  return values;
}
export async function validEvidence(record) {
  if (!record || !Object.keys(record).length) return false;
  try {
    const now = await evidence(Object.keys(record));
    return JSON.stringify(now) === JSON.stringify(record);
  } catch {
    return false;
  }
}
export function classify(error) {
  const text = String(error);
  if (
    /ENOENT|ECONNREFUSED|ENOSPC|browser.*(not found|doesn't exist)|Executable doesn't exist|ModuleNotFoundError/i.test(
      text,
    )
  )
    return 'INFRA_FAILURE';
  if (
    /geometry|junction|Bezier|Bézier|matrix|persist|migration|security|snapshot|conflict|rejected|race|concurren/i.test(
      text,
    )
  )
    return 'NEEDS_PARENT';
  if (/Timeout|timed out|toBeVisible|locator.*strict|not found/i.test(text))
    return 'ROUTINE_FAILURE';
  return 'UNVERIFIED';
}
export function compact(report) {
  const tests = report.steps
    .filter((s) => s.counts)
    .map(
      (s) =>
        `${s.id.toUpperCase()} ${s.counts.passed}/${s.counts.total}${s.counts.skipped ? ` SKIP ${s.counts.skipped}` : ''}${s.reusedFiles?.length ? ` REUSED ${s.reusedFiles.length} files` : ''}`,
    )
    .join(' | ');
  const errors = report.failures
    .slice(0, 5)
    .map((f) => `FAIL ${f.step}: ${f.message.slice(0, 500)}\nLOG ${f.log}`)
    .join('\n');
  return `QA ${report.profile.toUpperCase()} ${report.status}${report.cachedFrom ? ' (CACHE VERIFICADA)' : ''}\n${tests || 'Sin pruebas ejecutadas todavía'}\nTIME ${Math.round((report.durationMs ?? 0) / 1000)}s\nREPORT ${report.path}${errors ? '\n' + errors : ''}\n`;
}

/** Complete successful verifications can survive a later, unrelated failure.
 * Independent generators are never reused: their mutable artifacts are external. */
export function stepFingerprint(inputs, definition, dir) {
  const files = Object.fromEntries(
    Object.entries(inputs.files).filter(([file]) => {
      if (/^scripts\/(validate|capture)/.test(file)) return false;
      if (definition.id === 'unit' && /^tests\/.*\.spec\.ts$/.test(file)) return false;
      return true;
    }),
  );
  const command = definition.command.map((s) => s.replaceAll(dir, '$RUN'));
  return sha(
    JSON.stringify({
      version: VERSION,
      id: definition.id,
      files,
      versions: inputs.versions,
      environment: inputs.environment,
      command,
    }),
  );
}
export async function treeEvidence(directory) {
  const paths = [];
  const visit = async (dir) => {
    for (const e of await import('node:fs/promises')
      .then((fs) => fs.readdir(dir, { withFileTypes: true }))
      .catch(() => [])) {
      const p = resolve(dir, e.name);
      if (e.isDirectory()) await visit(p);
      else paths.push(p);
    }
  };
  await visit(directory);
  return evidence(paths);
}
