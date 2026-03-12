import { test, expect } from '@playwright/test'

const FRONTEND = process.env.FRONTEND_URL || process.env.FRONTEND || process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'

test('mini cart button opens dropdown', async ({ page }) => {
  await page.goto(FRONTEND)
  const btn = page.locator('button[aria-label="Mini cart"]')
  await expect(btn).toBeVisible()
  await btn.click()
  const menu = page.locator('.dropdown-menu')
  await expect(menu).toBeVisible()
})
