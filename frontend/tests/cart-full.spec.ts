import { test, expect } from '@playwright/test'

test('full cart basic operations', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })

  await page.goto('http://localhost:3000/shop', { waitUntil: 'load' })
  await page.waitForSelector('button.btn-full-black, button.btn-add-quick', { timeout: 20000 })

  // add first product twice
  await page.locator('button.btn-full-black, button.btn-add-quick').nth(0).click()
  await page.locator('button.btn-full-black, button.btn-add-quick').nth(0).click()

  // add second product once (if exists)
  const addButtons = page.locator('button.btn-full-black, button.btn-add-quick')
  if ((await addButtons.count()) > 1) {
    await addButtons.nth(1).click()
  }

  // go to cart and verify items
  await page.goto('http://localhost:3000/cart', { waitUntil: 'load' })
  await page.waitForSelector('.cart-item', { timeout: 10000 })

  const items = page.locator('.cart-item')
  const itemCount = await items.count()
  expect(itemCount).toBeGreaterThan(0)

  // increase quantity of first item
  const first = items.nth(0)
  const qtyDisplay = first.locator('.quantity-display-cart')
  const before = Number((await qtyDisplay.innerText()).trim() || '0')
  await first.locator('button.quantity-btn-cart').nth(1).click()
  await page.waitForTimeout(300)
  const after = Number((await qtyDisplay.innerText()).trim() || '0')
  expect(after).toBeGreaterThan(before)

  // remove second item if present and assert the items count decreases
  if ((await items.count()) > 1) {
    const beforeCount = await items.count()
    const second = items.nth(1)
    await second.locator('.btn-remove-item').click()
    await page.waitForTimeout(500)
    const afterCount = await page.locator('.cart-item').count()
    expect(afterCount).toBeLessThan(beforeCount)
  }

  // filter known benign warnings (dev hydration warning, image placeholder messages)
  const filtered = consoleErrors.filter(m => !String(m).includes('Extra attributes from the server:') && !String(m).includes('class,data-theme') && !String(m).includes('Image is missing required "src"'))
  expect(filtered).toEqual([])
})
