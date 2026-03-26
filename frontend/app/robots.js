export default function robots() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/checkout', '/wishlist', '/track-order', '/my-orders']
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl
  }
}
