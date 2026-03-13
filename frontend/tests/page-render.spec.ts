import { test } from '@playwright/test'

test('render shop and product pages and detect dynamic elements', async ({ page }) => {
  const base = process.env.FRONTEND || 'http://localhost:3000'

  async function check(path: string, checks: Record<string, string[]>) {
    const url = base + path
    console.log(`NAVIGATE ${url}`)
    await page.goto(url, { waitUntil: 'networkidle' })
    // short delay to allow client-rendered UI to appear
    await page.waitForTimeout(600)
    const result: Record<string, boolean> = {}
    for (const [name, selectors] of Object.entries(checks)) {
      let found = false
      for (const sel of selectors) {
        try {
          const count = await page.locator(sel).count()
          if (count > 0) {
            try { if (await page.locator(sel).first().isVisible()) { found = true; break } } catch (e) { found = true; break }
          }
        } catch (e) {
          // ignore bad selectors
        }
      }
      result[name] = found
    }
    console.log(`RESULT ${path} -> ${JSON.stringify(result)}`)
    return result
  }

  const shopChecks = {
    filters: ['.quick-filters', '.filters', '.shop-filters', '#filters', '[data-testid="filters"]'],
    productGrid: ['.shop-products-grid', '.products-grid', '.product-grid', '.shop-grid', '.perfume-list', '.shop-products'],
    productCard: ['.shop-product-card', '.perfume-card', '.perfume-card .shop-product-title', 'a[href*="/shop/product/"]'],
    pagination: ['.pagination', '.shop-pagination', '[aria-label="pagination"]']
  }

  const productChecks = {
    gallery: ['.product-gallery', '.perfume-gallery', '.product-images', '.gallery', '.product-media', '.perfume-gallery'],
    addToCart: ['.btn-add-to-cart', '.btn-add-to-cart-small', 'button:has-text("أضف")', 'button:has-text("أضف إلى السلة")', 'button:has-text("إضافة إلى السلة")', 'button:has-text("إضافة")'],
    productTitle: ['h1.product-title', '.product-title', '.perfume-title', 'h1']
  }

  await check('/shop', shopChecks)
  await check('/shop/product/1', productChecks)
})
