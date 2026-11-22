#!/usr/bin/env node
import { resolve, dirname } from 'node:path';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { atomic, json, processStep } from './qa/core.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export function verifyModel(parent, children) {
  const child = children.find((c) => c.role === 'qa_admin' && c.parent === parent.id);
  const valid =
    child?.model === 'gpt-6-luna' &&
    child.effort === 'low' &&
    child.sandbox === 'read-only' &&
    child.approval === 'never';
  return {
    status: valid ? 'VERIFIED' : 'UNVERIFIED',
    requested: { role: 'qa_admin', model: 'gpt-6-luna', effort: 'low' },
    effective: child ?? null,
    fallback: 'deterministic',
    evidence: 'CLI session_meta + turn_context; no self-description',
  };
}
async function contexts(parentId) {
  const base = resolve(process.env.CODEX_HOME ?? resolve(homedir(), '.codex'), 'sessions');
  const today = new Date();
  const result = [];
  for (let days = 0; days < 2; days++) {
    const date = new Date(today.getTime() - days * 86400000)
        .toISOString()
        .slice(0, 10)
        .replaceAll('-', '/'),
      dir = resolve(base, date);
    for (const file of await readdir(dir).catch(() => [])) {
      if (!file.endsWith('.jsonl')) continue;
      let meta, context;
      for (const line of (await readFile(resolve(dir, file), 'utf8')).split('\n')) {
        if (!line) continue;
        let row;
        try {
          row = JSON.parse(line);
        } catch {
          continue;
        }
        if (row.type === 'session_meta') meta = row.payload;
        if (row.type === 'turn_context') {
          context = row.payload;
          break;
        }
      }
      const source = meta?.source?.subagent?.thread_spawn;
      if (meta?.id !== parentId && source?.parent_thread_id !== parentId) continue;
      result.push({
        id: meta.id,
        parent: source?.parent_thread_id,
        role: source?.agent_role,
        model: context?.model,
        effort: context?.effort,
        sandbox: context?.sandbox_policy?.type,
        approval: context?.approval_policy,
        path: resolve(dir, file),
      });
    }
  }
  return result;
}
export async function recordCapability(eventPath) {
  const rows = (await readFile(eventPath, 'utf8'))
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
  const id = rows.find((r) => r.type === 'thread.started')?.thread_id;
  const records = await contexts(id);
  const parent = records.find((c) => c.id === id) ?? { id };
  const report = verifyModel(parent, records);
  report.checkedAt = new Date().toISOString();
  report.eventPath = eventPath;
  report.cliUsage = rows.find((r) => r.type === 'turn.completed')?.usage;
  report.returnedToParent =
    rows.some((r) => r.type === 'turn.completed') &&
    rows.some((r) => r.item?.type === 'agent_message');
  if (!report.returnedToParent) report.status = 'UNVERIFIED';
  await atomic(resolve(root, '.runtime/qa/agent-capability.json'), report);
  return report;
}
export async function administrativeReport(path) {
  const report = await json(path);
  if (report.status === 'PASS')
    return {
      status: 'PASS',
      mode: 'SCRIPT_ONLY',
      evidence: path,
      action: 'No interpretar una batería correcta',
    };
  const capability = await json(resolve(root, '.runtime/qa/agent-capability.json')).catch(() => ({
    status: 'UNVERIFIED',
  }));
  if (capability.status !== 'VERIFIED')
    return {
      status: 'UNVERIFIED',
      mode: 'SCRIPT_ONLY',
      evidence: path,
      action: 'Escalar al principal; Luna no verificada',
    };
  const failures = report.failures?.slice(0, 5).map((f) => ({
    step: f.step,
    category: f.category,
    message: f.message.slice(0, 300),
    log: f.log,
  }));
  if (
    !failures?.length ||
    failures.every((f) => ['NEEDS_PARENT', 'INFRA_FAILURE', 'ROUTINE_FAILURE'].includes(f.category))
  )
    return {
      status: 'NEEDS_PARENT',
      mode: 'SCRIPT_ONLY',
      evidence: path,
      failures,
      action: 'Ya clasificado por reglas; no lanzar LLM',
    };
  const dir = resolve(root, '.runtime/qa/admin-' + Date.now());
  await mkdir(dir, { recursive: true });
  const prompt = `Classify this bounded report. Spawn exactly one configured qa_admin subagent and wait for its classification. No code edits, test runs or additional agents. Return status, evidence and action under300 tokens. Evidence: ${JSON.stringify({ path, status: report.status, failures })}`;
  const args = [
    'codex',
    '--ask-for-approval',
    'never',
    'exec',
    '--strict-config',
    '--sandbox',
    'read-only',
    '--model',
    'gpt-6-luna',
    '-c',
    'model_reasoning_effort="low"',
    '--json',
    prompt,
  ];
  const result = await processStep(args, {
    cwd: root,
    log: resolve(dir, 'events.jsonl'),
    timeout: 120000,
  });
  if (result.status !== 'PASS')
    return {
      status: 'UNVERIFIED',
      mode: 'SCRIPT_ONLY',
      evidence: result.log,
      action: 'Error de ejecución; escalar al principal',
    };
  const verified = await recordCapability(result.log);
  if (verified.status !== 'VERIFIED')
    return {
      status: 'UNVERIFIED',
      evidence: result.log,
      action: 'Modelo no verificado; escalar al principal',
    };
  const rows = (await readFile(result.log, 'utf8')).split('\n').flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });
  const answer =
    rows.filter((r) => r.item?.type === 'agent_message').at(-1)?.item.text ?? 'UNVERIFIED';
  return { status: 'INTERPRETED', evidence: result.log, answer: answer.slice(0, 1200) };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, path] = process.argv.slice(2);
  const value =
    command === 'record'
      ? await recordCapability(resolve(path))
      : command === 'analyze'
        ? await administrativeReport(resolve(path))
        : await json(resolve(root, '.runtime/qa/agent-capability.json')).catch(() => ({
            status: 'UNVERIFIED',
            fallback: 'deterministic',
          }));
  console.log(JSON.stringify(value, null, 2));
}
