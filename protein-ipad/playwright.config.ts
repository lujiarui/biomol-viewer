import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', timeout: 60_000, expect: { timeout: 20_000 }, workers: 1,
  use: { baseURL: 'http://localhost:5173', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1194, height: 834 } } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1194, height: 834 } } },
  ],
  webServer: { command: 'npm run dev -- --port 5173 --strictPort', url: 'http://localhost:5173', reuseExistingServer: !process.env.CI },
});
