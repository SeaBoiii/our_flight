import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 2,
  timeout: 40_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: { animations: 'disabled', maxDiffPixelRatio: 0.01 },
  },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
    locale: 'en-SG',
    timezoneId: 'Asia/Singapore',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'mobile-small', use: { viewport: { width: 375, height: 667 } } },
    { name: 'mobile-standard', use: { viewport: { width: 390, height: 844 } } },
    { name: 'mobile-android', use: { viewport: { width: 412, height: 915 } } },
    { name: 'mobile-large', use: { viewport: { width: 430, height: 932 } } },
  ],
  webServer: {
    command: 'npx vite --config e2e/vite.config.ts --mode e2e --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
