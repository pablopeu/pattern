#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { json, atomic, compact } from './qa/core.mjs';
const reportPath = process.argv[2] ?? (await json('.runtime/qa/latest.json')).path;
const report = await json(reportPath),
  summary = compact(report),
  baselinePath = process.argv[3] ?? '.runtime/curated-full-confirmed-2.log';
const baseline = await readFile(baselinePath, 'utf8').catch(() => null);
const metrics = {
  status: report.status,
  report: reportPath,
  baseline: baseline
    ? {
        path: baselinePath,
        outputBytes: Buffer.byteLength(baseline),
        e2ePassed: Number(baseline.match(/(\d+) passed/)?.[1] ?? 0),
      }
    : { status: 'UNVERIFIED', reason: 'No historical log available' },
  current: {
    profile: report.profile,
    outputBytes: Buffer.byteLength(summary),
    estimatedVisibleTokens: Math.ceil(summary.length / 4),
    estimateMethod: 'characters/4 heuristic, not measured billing',
    durationMs: report.durationMs,
    steps: report.steps.map((s) => ({
      id: s.id,
      status: s.status,
      counts: s.counts,
      durationMs: s.durationMs,
      reused: Boolean(s.cachedFrom),
    })),
  },
  supervision: {
    llmCallsByRunner: 0,
    automaticAdminCalls: 0,
    commandsToLaunchGate: 1,
    observerCallsOutsideRunner: 'UNVERIFIED',
    administrativeModel: 'deterministic scripts',
  },
  quotaComparison:
    'UNVERIFIED: visible text, model tokens, reasoning and product quota are distinct metrics',
};
if (baseline)
  metrics.visibleOutputReduction = 1 - metrics.current.outputBytes / metrics.baseline.outputBytes;
await atomic(resolve('.runtime/qa/metrics.json'), metrics);
console.log(
  `QA METRICS ${report.status}\nOUTPUT ${metrics.current.outputBytes}B | BASELINE ${metrics.baseline.outputBytes ?? 'UNVERIFIED'}B\nREPORT .runtime/qa/metrics.json`,
);
