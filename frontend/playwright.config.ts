import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
    baseURL: 'http://localhost:3001'
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } }
  ]
})
