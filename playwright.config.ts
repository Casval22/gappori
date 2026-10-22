import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  timeout: 60_000,
  expect: { timeout: 20_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:4173/pages-test/', trace: 'retain-on-failure' },
  projects: [
    {
      name: 'mobile-360',
      use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 800 } },
    },
    {
      name: 'mobile-390',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
  ],
  webServer: {
    command:
      'VITE_BASE_PATH=/pages-test/ npm run build && VITE_BASE_PATH=/pages-test/ npm run preview -- --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/pages-test/',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
