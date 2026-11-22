import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
export default class CompactReporter {
  onBegin(_config, suite) {
    this.suite = suite;
    this.context = {
      workers: _config.workers,
      baseURL: _config.projects[0].use.baseURL,
      testStatic: Boolean(process.env.TEST_STATIC),
    };
    this.started = Date.now();
    this.errors = [];
  }
  onStdOut(chunk) {
    process.stdout.write(chunk);
  }
  onStdErr(chunk) {
    process.stderr.write(chunk);
  }
  onError(error) {
    this.errors.push(error);
  }
  async onEnd(result) {
    const tests = this.suite.allTests().map((test) => ({
      id: test.id,
      title: test.titlePath().join(' › '),
      location: test.location,
      outcome: test.outcome(),
      expectedStatus: test.expectedStatus,
      results: test.results.map((r) => ({
        status: r.status,
        retry: r.retry,
        duration: r.duration,
        errors: r.errors,
        attachments: r.attachments,
      })),
    }));
    const counts = { passed: 0, failed: 0, flaky: 0, skipped: 0, total: tests.length };
    for (const test of tests) {
      if (test.outcome === 'skipped') counts.skipped++;
      else if (test.outcome === 'flaky') counts.flaky++;
      else if (test.outcome === 'unexpected') counts.failed++;
      else counts.passed++;
    }
    const path =
      process.env.QA_PLAYWRIGHT_REPORT ??
      resolve('.runtime/qa-direct', `${Date.now()}-${process.pid}.json`);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(
      path,
      JSON.stringify(
        {
          status: result.status,
          context: this.context,
          listOnly: process.env.QA_LIST_ONLY === '1',
          counts,
          tests,
          errors: this.errors,
          durationMs: Date.now() - this.started,
        },
        null,
        2,
      ) + '\n',
    );
    console.log(
      `E2E ${result.status.toUpperCase()} | ${counts.passed}/${counts.total} | FAIL ${counts.failed} | FLAKY ${counts.flaky} | SKIP ${counts.skipped}\nREPORT ${path}`,
    );
  }
  printsToStdio() {
    return true;
  }
}
