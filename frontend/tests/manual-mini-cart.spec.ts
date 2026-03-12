import { test, expect } from '@playwright/test'

test('mini-cart undo flow', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })

  await page.goto('http://localhost:3000/shop', { waitUntil: 'load' })

  // wait for client-side product cards to hydrate and show add buttons
  await page.waitForSelector('button.btn-full-black, button.btn-add-quick', { timeout: 20000 })
  await page.click('button.btn-full-black, button.btn-add-quick')

  // open mini cart
  await page.click('button[aria-label="Mini cart"]')
  await page.waitForSelector('.dropdown-menu', { timeout: 5000 })

  // click remove in mini cart
  await page.click('.dropdown-menu .menu-item.delete')

  // expect undo button to appear
  const undoBtn = page.locator('.dropdown-menu button:has-text("تراجع")')
  await expect(undoBtn).toHaveCount(1)

  // click undo and ensure item returns (badge or list)
  await undoBtn.click()
  // small wait for UI to update
  await page.waitForTimeout(500)

  const badge = page.locator('.nav-item.cart-link .cart-badge')
  await expect(badge).toHaveCount(1)
  await expect(badge).not.toHaveText('0')

  // remove again and let undo timeout expire
  // ensure mini cart dropdown is open (toggle button may close if already open)
  if (!(await page.locator('.dropdown-menu').isVisible())) {
    await page.click('button[aria-label="Mini cart"]')
  }
  await page.waitForSelector('.dropdown-menu .menu-item.delete', { timeout: 5000 })
  await page.click('.dropdown-menu .menu-item.delete')

  // wait longer than undo timeout (MiniCart uses 5000ms by default)
  await page.waitForTimeout(7000)

  // undo button should no longer be present
  await expect(page.locator('.dropdown-menu button:has-text("تراجع")')).toHaveCount(0)

  // filter out known Next.js dev hydration warning that's unrelated to the flow
  const filtered = consoleErrors.filter(m => !String(m).includes('Extra attributes from the server:') && !String(m).includes('class,data-theme'))
  expect(filtered).toEqual([])
})
