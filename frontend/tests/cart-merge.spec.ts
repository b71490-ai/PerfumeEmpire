import { test, expect } from '@playwright/test'

// Configure via env or defaults (prefer explicit env vars, fallback to 3000)
const FRONTEND = process.env.FRONTEND_URL || process.env.FRONTEND || process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'

test('guest cart persists across tab close and merges on login', async ({ page, context }) => {
  // 1) Open product page and add to cart as guest
  await page.goto(`${FRONTEND}/shop/product/1`)
  const addBtn = page.getByRole('button', { name: /إضافة إلى السلة/ })
  await addBtn.waitFor({ timeout: 8000 })
  await addBtn.click()

  // open cart and assert item present
  await page.goto(`${FRONTEND}/cart`)
  const items = page.locator('.cart-item')
  await expect(items).toHaveCount(1)
  const firstName = await page.locator('.cart-item-name').first().innerText()

  // 3) Close the tab (simulate user closing page)
  await page.close()

  // 4) Open a new tab in the same browser context (preserves localStorage/session)
  const page2 = await context.newPage()
  await page2.goto(`${FRONTEND}/cart`)

  // cart should still show the same item
  const items2 = page2.locator('.cart-item')
  await expect(items2).toHaveCount(1)
  await expect(page2.locator('.cart-item-name').first()).toHaveText(firstName)

  // 5) Perform login from this same tab so client can dispatch auth event and trigger merge
  // We perform a POST to backend login then dispatch the same event the app listens for.
  await page2.evaluate(async () => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    })
    const data = await res.json().catch(() => ({}))
    // dispatch auth event like setAuthToken does
    try {
      window.dispatchEvent(new CustomEvent('auth:login', { detail: { token: data?.token } }))
    } catch (e) {
      // ignore
    }
  })

  // wait a bit for merge to complete and UI to refresh
  await page2.waitForTimeout(1200)

  // ensure cart still contains the item and did not disappear after login
  await expect(page2.locator('.cart-item')).toHaveCount(1)
  await expect(page2.locator('.cart-item-name').first()).toHaveText(firstName)
})
