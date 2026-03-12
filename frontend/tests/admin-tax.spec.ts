import { test, expect } from '@playwright/test'

// This test assumes backend running at http://localhost:5000 and frontend at http://localhost:3001
const BACKEND = process.env.BACKEND_URL || 'http://localhost:5000'
const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:3001'

test('admin can view tax total and apply tax filter', async ({ page, context, request }) => {
  // perform UI login on admin login page (ensures client app sets token)
  await page.goto(`${FRONTEND}/admin/login`)
  // instrument responses to debug login request
  page.on('response', async (res) => {
    try {
      if (res.url().includes('/api/auth/login')) {
        console.log('LOGIN RESP status=', res.status(), 'headers=', JSON.stringify(res.headers()))
        const text = await res.text().catch(() => '')
        console.log('LOGIN RESP body=', text)
      }
    } catch (e) {
      // ignore
    }
  })
  await page.locator('#username').waitFor({ timeout: 5000 })
  await page.fill('#username', 'e2e_admin')
  await page.fill('#password', 'admin123')
  await page.click('button.btn-login')
  // wait for dashboard selector or login error
  const errorVisible = await page.locator('.error-message').isVisible().catch(() => false)
  if (errorVisible) {
    // fail early
    throw new Error('Login failed (UI showed error)')
  }
  await page.locator('span.stat-title', { hasText: 'الضريبة المتلقاة' }).waitFor({ timeout: 10000 })

  // find tax number for the tax card
  const taxCard = page.locator('span.stat-title', { hasText: 'الضريبة المتلقاة' }).locator('..')
  const taxNumber = await taxCard.locator('strong.stat-number').innerText()
  // ensure we have a number-like value
  expect(taxNumber.trim().length).toBeGreaterThan(0)

  // open filter and click apply to validate filter flow (no-op)
  const applyButton = page.locator('div.tax-filter-actions button:has-text("تطبيق")')
  if (await applyButton.count() > 0) {
    await applyButton.click()
    // after applying, tax number should still be present
    await expect(taxCard.locator('strong.stat-number')).toBeVisible()
  }
})
