import fs from 'node:fs';
import { defineConfig } from '@playwright/test';

const bundledChromium = '/opt/pw-browsers/chromium';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    launchOptions: fs.existsSync(bundledChromium)
      ? { executablePath: bundledChromium, args: ['--no-sandbox'] }
      : {},
  },
  webServer: {
    command:
      'sh -c "rm -rf .e2e-data && npx vite build && DATA_DIR=.e2e-data PORT=4173 npx tsx server/index.ts"',
    url: 'http://localhost:4173/api/health',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
