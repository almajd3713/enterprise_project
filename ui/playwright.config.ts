import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'VITE_API_PROXY_TARGET=${PLAYWRIGHT_GATEWAY_BASE:-http://localhost:8080} pnpm dev --host 127.0.0.1 --port 5173',
    port: 5173,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
