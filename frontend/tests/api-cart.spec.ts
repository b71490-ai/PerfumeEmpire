import { test, expect } from '@playwright/test'

const BACKEND = process.env.BACKEND_URL || 'http://localhost:5000'

// Helper to get a perfume to use in tests
async function getFirstPerfume(request) {
  const res = await request.get(`${BACKEND}/api/perfumes`)
  expect(res.ok()).toBeTruthy()
  const list = await res.json()
  expect(Array.isArray(list)).toBeTruthy()
  return list[0]
}

test.describe('Cart API', () => {
  test('initCart, updateCart, mergeCart', async ({ request }) => {
    const perfume = await getFirstPerfume(request)

    // 1) initCart — capture CSRF cookie from Set-Cookie header
    const initRes = await request.post(`${BACKEND}/api/cart/init`)
    expect(initRes.ok()).toBeTruthy()
    const initBody = await initRes.json()
    expect(initBody).toHaveProperty('cartId')
    const cartId = initBody.cartId

    // parse XSRF-TOKEN from Set-Cookie header if present
    const setCookie = initRes.headers()['set-cookie'] || ''
    let xsrfToken = ''
    if (setCookie) {
      const match = setCookie.match(/XSRF-TOKEN=([^;]+)/)
      if (match) xsrfToken = match[1]
    }

    // 2) updateCart - add quantity 2
    const updatePayload = {
      cartId,
      items: [{ perfumeId: perfume.id, name: perfume.name, price: perfume.price, quantity: 2 }]
    }
    const headers = {}
    if (xsrfToken) {
      headers['X-XSRF-TOKEN'] = xsrfToken
      headers['Cookie'] = `XSRF-TOKEN=${xsrfToken}`
    }
    const putRes = await request.put(`${BACKEND}/api/cart`, { data: updatePayload, headers })
    expect(putRes.ok()).toBeTruthy()
    const putBody = await putRes.json()
    expect(putBody.cartId).toBe(cartId)
    expect(Array.isArray(putBody.items)).toBeTruthy()
    expect(putBody.items.length).toBeGreaterThan(0)
    const updatedItem = putBody.items.find(i => i.perfumeId === perfume.id)
    expect(updatedItem).toBeTruthy()
    expect(updatedItem.quantity).toBe(2)

    // 3) mergeCart - simulate incoming additional quantity 5 for same perfume
    const incoming = {
      cartId,
      items: [{ perfumeId: perfume.id, name: perfume.name, price: perfume.price, quantity: 5 }]
    }
    const mergeRes = await request.post(`${BACKEND}/api/cart/merge`, { data: incoming, headers })
    expect(mergeRes.ok()).toBeTruthy()
    const mergeBody = await mergeRes.json()
    expect(mergeBody.cartId).toBe(cartId)
    const mergedItem = mergeBody.items.find(i => i.perfumeId === perfume.id)
    expect(mergedItem).toBeTruthy()

    // expected quantity = 2 + 5 = 7, but capped by stock if lower
    const expected = Math.min((perfume.stock ?? Number.MAX_SAFE_INTEGER), 2 + 5)
    expect(mergedItem.quantity).toBe(expected)
  })
})
