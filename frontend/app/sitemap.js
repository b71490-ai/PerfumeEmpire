import { getServerApiUrl } from '@/lib/serverApi'

const STATIC_ROUTES = [
  '/',
  '/shop',
  '/contact',
  '/policies/shipping-returns',
  '/policies/privacy'
]

export default async function sitemap() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const now = new Date()

  const staticEntries = STATIC_ROUTES.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: now,
    changeFrequency: route === '/' ? 'daily' : 'weekly',
    priority: route === '/' ? 1 : route === '/shop' ? 0.9 : 0.7
  }))

  try {
    const response = await fetch(getServerApiUrl('/perfumes'), { cache: 'no-store' })
    if (!response.ok) return staticEntries

    const perfumes = await response.json()
    const productEntries = (Array.isArray(perfumes) ? perfumes : [])
      .filter((item) => item?.id)
      .map((item) => ({
        url: `${siteUrl}/shop/product/${item.id}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.8
      }))

    return [...staticEntries, ...productEntries]
  } catch {
    return staticEntries
  }
}
