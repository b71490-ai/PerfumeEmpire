import { test, expect } from '@playwright/test'

const FRONTEND = process.env.FRONTEND || ''

test('checkout: smoke - load checkout page and attempt place order', async ({ page }) => {
  const base = FRONTEND ? FRONTEND.replace(/\/$/, '') : ''
  const shop = base ? `${base}/shop` : '/shop'
  await page.goto(shop)

  // add an item
  const quick = page.locator('.btn-add-quick').first()
  if (await quick.count() > 0) {
    await quick.click()
  } else {
    const full = page.locator('.btn-full-black, button[aria-label="أضف إلى السلة"]').first()
    await expect(full).toBeVisible()
    await full.click()
  }

  // go to cart and trigger checkout
  const cartUrl = base ? `${base}/cart` : '/cart'
  await page.goto(cartUrl)
  await page.waitForLoadState('networkidle')

  const checkoutBtn = page.locator('button:has-text("إتمام الطلب"), button:has-text("Checkout"), a:has-text("Checkout"), button:has-text("الدفع")').first()
  if (await checkoutBtn.count() > 0) {
    await expect(checkoutBtn).toBeVisible()
    await checkoutBtn.click()
    await page.waitForLoadState('networkidle')
  } else {
    // fallback: navigate directly
    const checkoutUrl = base ? `${base}/checkout` : '/checkout'
    await page.goto(checkoutUrl)
    await page.waitForLoadState('networkidle')
  }

  // basic assertions: page contains summary or checkout form (robust check)
  const summaryCandidates = ['.order-summary', 'text=تفاصيل الطلب', 'text=ملخص الطلب', 'text=Checkout', 'text=معلومات الطلب']
  let found = false
  for (const sel of summaryCandidates) {
    if (await page.locator(sel).count() > 0) {
      found = true
      break
    }
  }
  if (!found) {
    const body = await page.locator('body').innerText().catch(() => '')
    throw new Error('Checkout summary not found on page. Body snapshot: ' + body.slice(0, 400))
  }

  // try to fill a common field if present (best-effort)
  const nameField = page.locator('input[name="name"], input#name, input[placeholder*="الاسم"], input[placeholder*="Name"]').first()
  if (await nameField.count() > 0) {
    await nameField.fill('Test Customer')
  }

  // try to place order if button exists (best-effort)
  const place = page.locator('button:has-text("إرسال الطلب"), button:has-text("Place order"), button:has-text("ادفع الآن")').first()
  if (await place.count() > 0) {
    await expect(place).toBeVisible()
    await place.click()
    await page.waitForLoadState('networkidle')
    // expect an order confirmation message or /order path
    const conf = page.locator('text=شكراً, text=تم استلام طلبك, text=Order received, text=Thank you').first()
    await expect(conf).toHaveCount(1)
  } else {
    // not fatal: we've still validated checkout page loaded
    console.log('place order button not found; checkout page smoke validated')
  }
})
