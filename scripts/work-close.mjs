#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve, dirname, isAbsolute } from 'node:path';
import { readFile, lstat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { atomic, json, fingerprint, validEvidence, sha } from './qa/core.mjs';
import { makePlan } from './qa/plan.mjs';
import { changedFiles, qaInput } from './qa/impact.mjs';
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export function git(root, ...args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}
export async function validateFiles(root, files) {
  if (!files.length) throw Error('Se requiere selección explícita de archivos');
  const unique = [...new Set(files)];
  for (const file of unique) {
    if (
      isAbsolute(file) ||
      file.includes('\\') ||
      file.split('/').includes('..') ||
      file.startsWith('-') ||
      resolve(root, file) === root
    )
      throw Error(`Ruta no permitida: ${file}`);
    if (
      /(^|\/)(\.runtime|node_modules|dist|test-results|\.git)(\/|$)|(^|\/)\.env($|\.)|\.(zip|log|sqlite|db|pem|key|p12)$|docs\/prd\/prd_v3\.1\.txt$/.test(
        file,
      )
    )
      throw Error(`Archivo privado, temporal o fuera del incremento: ${file}`);
    const info = await lstat(resolve(root, file)).catch(() => null);
    if (info && (info.isSymbolicLink() || !info.isFile()))
      throw Error(`La selección debe nombrar archivos: ${file}`);
    if (info?.size > 5 * 1024 * 1024) throw Error(`Artefacto mayor a5MiB: ${file}`);
    if (info) {
      const data = await readFile(resolve(root, file));
      if (!data.includes(0)) {
        const text = data.toString();
        if (
          /(?:^|\n)-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----|\bghp_[A-Za-z0-9]{30,}|\bsk-[A-Za-z0-9]{40,}/.test(
            text,
          )
        )
          throw Error(`Posible secreto: ${file}`);
        if (
          /\b(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})\b/.test(
            text,
          )
        )
          throw Error(`IP privada: ${file}; usar placeholders`);
      }
    }
  }
  return unique;
}
export async function validateGate(root, profile, reportPath) {
  const report = await json(reportPath);
  if (
    report.status !== 'PASS' ||
    report.profile !== profile ||
    !report.required.length ||
    !report.required.every((id) => report.steps.some((s) => s.id === id && s.status === 'PASS'))
  )
    throw Error('Gate obligatorio incompleto o fallido');
  if (!report.evidence || !(await validEvidence(report.evidence)))
    throw Error('Evidencia QA ausente o modificada');
  if ((await fingerprint(root, profile)).key !== report.fingerprint)
    throw Error('El árbol actual no coincide con QA');
  const required = await makePlan(profile, report.impact, root, dirname(report.path));
  if (required.some((s) => !report.required.includes(s.id)))
    throw Error('Falta una categoría obligatoria del gate');
  return report;
}
export async function closeWork({
  root = project,
  files,
  gate = 'integration',
  reportPath,
  message = 'chore: completar incremento verificado',
  push = false,
  dryRun = false,
  expectedRemote = 'https://github.com/pablopeu/pattern.git',
  expectedBranch = 'main',
} = {}) {
  const result = { status: 'RUNNING', startedAt: new Date().toISOString(), files };
  const output = resolve(root, '.runtime/work-close.json');
  try {
    if (!['integration', 'full'].includes(gate))
      throw Error('Publicación requiere INTEGRATION o FULL');
    result.branch = git(root, 'branch', '--show-current');
    if (result.branch !== expectedBranch) throw Error('Rama no autorizada');
    if (git(root, 'remote', 'get-url', 'origin') !== expectedRemote)
      throw Error('Remoto no autorizado');
    if (git(root, 'diff', '--name-only', '--diff-filter=U')) throw Error('Hay conflictos Git');
    files = await validateFiles(root, files);
    result.files = files;
    const changed = changedFiles(root),
      other = changed.filter((f) => qaInput(f) && !files.includes(f));
    if (other.length) throw Error(`Trabajo de producto ajeno al incremento: ${other.join(', ')}`);
    const staged = git(root, 'diff', '--cached', '--name-only', '-z').split('\0').filter(Boolean);
    if (staged.some((f) => !files.includes(f))) throw Error('El index contiene trabajo ajeno');
    git(root, 'diff', '--check');
    git(root, 'diff', '--cached', '--check');
    const report = reportPath ?? (await json(resolve(root, '.runtime/qa/latest.json'))).path;
    result.qa = (await validateGate(root, gate, report)).path;
    result.before = git(root, 'rev-parse', 'HEAD');
    if (dryRun) {
      result.status = 'READY';
      return result;
    }
    git(root, 'add', '--', ...files);
    if (!git(root, 'diff', '--cached', '--name-only'))
      throw Error('No hay cambios seleccionados para commit');
    if (!message || message.includes('\n')) throw Error('Mensaje de commit inválido');
    if ((await fingerprint(root, gate)).key !== (await json(result.qa)).fingerprint)
      throw Error('Entradas modificadas antes del commit');
    const committed = spawnSync('git', ['commit', '-m', message], { cwd: root, encoding: 'utf8' });
    result.commitExit = committed.status;
    await atomic(resolve(root, '.runtime/work-close-commit.json'), {
      exitCode: committed.status,
      stdout: committed.stdout,
      stderr: committed.stderr,
    });
    if (committed.status !== 0)
      throw Error('Commit rechazado; evidencia local work-close-commit.json');
    result.sha = git(root, 'rev-parse', 'HEAD');
    if (push) {
      const sent = spawnSync('git', ['push', 'origin', expectedBranch], {
        cwd: root,
        encoding: 'utf8',
      });
      result.pushExit = sent.status;
      await atomic(resolve(root, '.runtime/work-close-push.json'), {
        exitCode: sent.status,
        stdout: sent.stdout,
        stderr: sent.stderr,
      });
      if (sent.status !== 0)
        throw Error('Push rechazado; commit local conservado, sin reescritura de historial');
      const remote = git(root, 'ls-remote', 'origin', `refs/heads/${expectedBranch}`).split(
        /\s/,
      )[0];
      if (remote !== result.sha)
        throw Error('La referencia remota no coincide con el commit publicado');
      result.remoteVerified = true;
    }
    result.status = 'PASS';
  } catch (error) {
    result.status = 'FAIL';
    result.error = error.message;
  } finally {
    await atomic(output, result);
  }
  return result;
}
async function main() {
  const args = process.argv.slice(2),
    get = (name) => (args.indexOf(name) < 0 ? undefined : args[args.indexOf(name) + 1]);
  const files = get('--files-from')
    ? (await readFile(get('--files-from'), 'utf8')).split('\n').filter(Boolean)
    : get('--files')?.split(',');
  const result = await closeWork({
    files: files ?? [],
    gate: get('--gate') ?? 'integration',
    message: get('--message'),
    push: args.includes('--push'),
    dryRun: args.includes('--dry-run'),
  });
  console.log(
    `WORK CLOSE ${result.status}\n${result.sha ?? result.before ?? ''}\n${result.error ?? `${result.files?.length ?? 0} archivos | QA ${result.qa}`}\nREPORT .runtime/work-close.json`,
  );
  process.exitCode = ['PASS', 'READY'].includes(result.status) ? 0 : 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
