import { test, expect } from '@playwright/test'

test('checkout flow (mocked order)', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })

  await page.goto('http://localhost:3000/shop', { waitUntil: 'load' })
  await page.waitForSelector('button.btn-full-black, button.btn-add-quick', { timeout: 20000 })
  await page.locator('button.btn-full-black, button.btn-add-quick').first().click()

  await page.goto('http://localhost:3000/cart', { waitUntil: 'load' })
  await page.waitForSelector('.cart-item', { timeout: 10000 })

  // intercept order creation and return a fake numeric id
  await page.route('**/api/orders', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 123456, paymentMethod: 'cash_on_delivery' })
    })
  })

  // click checkout
  await page.click('button.btn-checkout')
  await page.waitForURL('**/checkout', { timeout: 10000 })

  // fill checkout form
  await page.fill('input[name="name"]', 'Test User')
  await page.fill('input[name="email"]', 'test@example.com')
  await page.fill('input[name="phone"]', '0500000000')
  await page.fill('textarea[name="address"]', 'شارع الاختبار 42')

  // ensure payment method (cash_on_delivery) is available and selected
  const codRadio = page.locator('input[name="paymentMethod"][value="cash_on_delivery"]')
  await expect(codRadio).toBeVisible()
  if (!(await codRadio.isChecked())) await codRadio.check()

  // submit
  await Promise.all([
    page.waitForURL('**/checkout/success?**', { timeout: 10000 }),
    page.click('button[type="submit"], button.btn-checkout-modern')
  ])

  // verify success page shows expected content and order id in query
  await expect(page.getByRole('heading', { name: /تم استلام/ })).toBeVisible()
  const url = page.url()
  expect(url).toContain('orderId=123456')

  // filter known benign warnings (dev hydration warning, image placeholder messages)
  const filtered = consoleErrors.filter(m => !String(m).includes('Extra attributes from the server:') && !String(m).includes('class,data-theme') && !String(m).includes('Image is missing required "src"'))
  expect(filtered).toEqual([])
})
