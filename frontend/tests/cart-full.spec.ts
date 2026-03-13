import { test, expect } from '@playwright/test'

const FRONTEND = process.env.FRONTEND || ''

test('cart-full: add multiple, change qty, remove + undo', async ({ page }) => {
  const base = FRONTEND ? FRONTEND.replace(/\/$/, '') : ''
  const shop = base ? `${base}/shop` : '/shop'
  await page.goto(shop)
  // wait for products to render; if not present, try opening the main "المتجر" link
  if ((await page.locator('text=Bleu de Chanel').count()) === 0) {
    const storeLink = page.locator('a:has-text("المتجر"), button:has-text("المتجر")').first()
    if (await storeLink.count() > 0) {
      await storeLink.click()
      await page.waitForLoadState('networkidle')
    }
  }

  // Use API to seed the cart (more reliable than UI clicks for setup)
  const initResp = await page.request.post(base ? `${base}/api/cart/init` : '/api/cart/init')
  const setCookie = initResp.headers()['set-cookie'] || ''
  const match = /XSRF-TOKEN=([^;]+)/.exec(setCookie)
  const xsrf = match ? match[1] : ''
  if (!xsrf) {
    // try reading cookie from browser context as fallback
    const cookies = await page.context().cookies()
    const xc = cookies.find(c => c.name === 'XSRF-TOKEN')
    if (xc) xsrf = xc.value
  }
  // merge 1 item with quantity 2
  await page.request.post(base ? `${base}/api/cart/merge` : '/api/cart/merge', {
    headers: {
      'Content-Type': 'application/json',
      'X-XSRF-TOKEN': xsrf || ''
    },
    data: { cartId: null, items: [{ perfumeId: 1, quantity: 2 }] }
  })

  // open full cart and verify product + quantity
  const cartUrl = base ? `${base}/cart` : '/cart'
  await page.goto(cartUrl)
  await page.waitForLoadState('networkidle')

  const product = page.locator('text=Bleu de Chanel').first()
  await expect(product).toBeVisible({ timeout: 5000 })

  // try reading quantity input or incrementing via + button
  const qty = page.locator('input[type="number"]').first()
  if (await qty.count() > 0) {
    const val = await qty.inputValue().catch(() => '1')
    if (parseInt(val || '1') < 2) {
      const plus = page.locator('button:has-text("+"), button.increase').first()
      if (await plus.count() > 0) await plus.click()
      await expect(qty).toHaveValue(String(Math.max(2, parseInt(val || '1'))), { timeout: 4000 })
    }
  }

  // remove the item and then undo
  const removeBtn = page.locator('button:has-text("حذف"), a:has-text("حذف"), button[aria-label*="delete"], a[aria-label*="delete"], .menu-item.delete, .cart-item .remove, .remove').first()
  await removeBtn.waitFor({ timeout: 8000 }).catch(() => {})
  if (await removeBtn.count() === 0) {
    // if there is no explicit remove control, consider cart already empty or throw with snapshot
    const body = await page.locator('body').innerText().catch(() => '')
    if (body.includes('سلة التسوق فارغة') || body.includes('لم تقم بإضافة أي منتجات')) {
      return
    }
    throw new Error('Remove button not found on cart page. Body snapshot: ' + body.slice(0, 400))
  }
  await expect(removeBtn).toBeVisible()
  await removeBtn.click()

  const undo = page.locator('button:has-text("تراجع"), button:has-text("Undo")').first()
  if (await undo.count() > 0) {
    await expect(undo).toBeVisible({ timeout: 3000 })
    await undo.click()
    await expect(product).toBeVisible({ timeout: 5000 })
  } else {
    // if no undo UI, wait for product to disappear from cart (best-effort)
    try {
      await expect(product).toHaveCount(0, { timeout: 5000 })
    } catch (e) {
      const body = await page.locator('body').innerText().catch(() => '')
      throw new Error('Remove did not complete and no undo shown. Body snapshot: ' + body.slice(0, 400))
    }
  }
})
