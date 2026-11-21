/** Real monitor HTML/JS, mocked data only: never submits feedback to the actual queue. */
import { chromium } from '@playwright/test';
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.route('**/api/status', (route) =>
    route.fulfill({
      json: {
        usage: {
          status: 'working',
          primary: { used_percent: 1, resets_at: Date.now() / 1000 + 1000 },
          observed_at: new Date().toISOString(),
        },
        commits: 'abc NUEVO\ndef VIEJO',
        changes: '',
        progress: '# Avances\n\n## Primero\nAvance viejo\n\n## Segundo\nAvance reciente\n',
        feedback: [
          { time: '2026-11-20T00:00:00Z', message: 'Feedback viejo', delivery: 'reviewed' },
          {
            time: '2026-11-21T00:00:00Z',
            message: 'Feedback reciente <script>throw Error()</script>',
            delivery: 'queued',
          },
        ],
      },
    }),
  );
  await page.goto('http://127.0.0.1:4174');
  await page.waitForFunction(() =>
    document.getElementById('feedback')?.textContent.includes('Feedback reciente'),
  );
  const result = await page.evaluate(() => {
    const feedback = document.getElementById('feedback').textContent,
      progress = document.getElementById('progress').textContent,
      commits = document.getElementById('commits').textContent,
      sections = [...document.querySelectorAll('section h2')].map((h) => h.textContent);
    if (feedback.indexOf('Feedback reciente') > feedback.indexOf('Feedback viejo'))
      throw Error('Feedback order');
    if (
      progress.indexOf('Avance reciente') > progress.indexOf('Avance viejo') ||
      !progress.startsWith('# Avances')
    )
      throw Error('Progress order/header');
    if (commits !== 'abc NUEVO\ndef VIEJO') throw Error('Commit order changed');
    if (
      sections.slice(-3).join('|') !==
      'Feedback recibido|Avances documentados|Últimos commits locales'
    )
      throw Error('Section order');
    if (document.querySelectorAll('script').length !== 1)
      throw Error('Feedback interpreted as HTML');
    return {
      feedbackNewestFirst: true,
      progressNewestFirst: true,
      commitsLast: true,
      textEscaped: true,
    };
  });
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
