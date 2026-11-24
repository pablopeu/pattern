import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  outputDir: process.env.TEST_STATIC ? 'test-results/static' : 'test-results/editor',
  testMatch: process.env.TEST_STATIC
    ? '**/static.spec.ts'
    : [
        '**/studio.spec.ts',
        '**/v2.spec.ts',
        '**/v21.spec.ts',
        '**/v22.spec.ts',
        '**/v22-fill.spec.ts',
        '**/v23.spec.ts',
        '**/v30.spec.ts',
        '**/v30-iso.spec.ts',
        '**/v30-view.spec.ts',
        '**/snap.spec.ts',
        '**/snap-permanent.spec.ts',
        '**/feedback-fill.spec.ts',
        '**/figurative.spec.ts',
        '**/tile-colors.spec.ts',
        '**/aperiodic.spec.ts',
        '**/girih.spec.ts',
        '**/work-protection.spec.ts',
        '**/frame-weld.spec.ts',
        '**/navigation-feedback.spec.ts',
        '**/poincare.spec.ts',
        '**/sphere.spec.ts',
        '**/animation.spec.ts',
        '**/share.spec.ts',
        '**/experience.spec.ts',
        '**/i18n.spec.ts',
        '**/artistic.spec.ts',
        '**/chambers.spec.ts',
        '**/feedback-study.spec.ts',
        '**/panel-stability.spec.ts',
        '**/functional-geometry.spec.ts',
        '**/composition-preserve.spec.ts',
      ],
  timeout: 45000,
  expect: { timeout: 8000 },
  fullyParallel: false,
  use: {
    baseURL: process.env.TEST_BASE_URL || 'http://127.0.0.1:4173',
    locale: 'es-ES',
    // Las suites históricas validan la UI completa: estado semilla avanzado/es.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: process.env.TEST_BASE_URL || 'http://127.0.0.1:4173',
          localStorage: [
            {
              name: 'pattern.experience.v1',
              value: JSON.stringify({ language: 'es', theme: 'auto', uiMode: 'advanced' }),
            },
          ],
        },
      ],
    },
    viewport: { width: 1440, height: 900 },
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  reporter: [['./scripts/qa-playwright-reporter.mjs']],
  webServer: process.env.TEST_BASE_URL
    ? undefined
    : [
        { command: 'npm run dev', url: 'http://127.0.0.1:4173', reuseExistingServer: true },
      ],
});
