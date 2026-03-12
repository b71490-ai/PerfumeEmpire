import { getServerApiUrl } from '@/lib/serverApi'

export async function buildPageMetadata({
  path,
  fallbackTitle,
  fallbackDescription
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const metadataBase = new URL(siteUrl)

  try {
    const res = await fetch(getServerApiUrl('/store-settings'), { cache: 'no-store' })
    const settings = res.ok ? await res.json() : null

    const storeName = settings?.storeName || settings?.logoText || 'عطور الإمبراطورية'
    const logoIcon = settings?.logoIcon || '✨'
    const settingsDescription = settings?.seoDescription || ''
    const keywords = String(settings?.seoKeywords || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

    const title = `${logoIcon} ${fallbackTitle} | ${storeName}`
    const description = settingsDescription || fallbackDescription.replace('{storeName}', storeName)

    return {
      metadataBase,
      alternates: { canonical: path },
      title,
      description,
      keywords,
      openGraph: {
        title,
        description,
        siteName: storeName,
        locale: 'ar_SA',
        type: 'website',
        url: path
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description
      }
    }
  } catch {
    return {
      metadataBase,
      alternates: { canonical: path },
      title: fallbackTitle,
      description: fallbackDescription.replace('{storeName}', 'عطور الإمبراطورية'),
      openGraph: {
        title: fallbackTitle,
        description: fallbackDescription.replace('{storeName}', 'عطور الإمبراطورية'),
        siteName: 'عطور الإمبراطورية',
        locale: 'ar_SA',
        type: 'website',
        url: path
      },
      twitter: {
        card: 'summary_large_image',
        title: fallbackTitle,
        description: fallbackDescription.replace('{storeName}', 'عطور الإمبراطورية')
      }
    }
  }
}
