import ProductDetailsClient from '@/app/product/ProductDetailsClient'
import { getServerApiUrl } from '@/lib/serverApi'

export async function generateMetadata({ params }) {
  const resolvedParams = await params
  const id = resolvedParams?.id
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const metadataBase = new URL(siteUrl)
  const canonicalPath = `/shop/product/${id}`

  const fallbackTitle = 'تفاصيل المنتج | عطور الإمبراطورية'
  const fallbackDescription = 'اكتشف تفاصيل المنتج في متجر عطور الإمبراطورية.'

  try {
    const [productRes, settingsRes] = await Promise.all([
      fetch(getServerApiUrl(`/perfumes/${id}`), { cache: 'no-store' }),
      fetch(getServerApiUrl('/store-settings'), { cache: 'no-store' })
    ])

    if (!productRes.ok) {
      return {
        metadataBase,
        alternates: { canonical: canonicalPath },
        title: fallbackTitle,
        description: fallbackDescription
      }
    }

    const product = await productRes.json()
    const settings = settingsRes.ok ? await settingsRes.json() : null
    const storeName = settings?.storeName || settings?.logoText || 'عطور الإمبراطورية'
    const logoIcon = settings?.logoIcon || '✨'
    const currencySymbol = settings?.currencySymbol || 'ر.س'

    const finalPrice = product.discount > 0
      ? product.price - (product.price * product.discount / 100)
      : product.price

    const title = `${logoIcon} ${product.name} | ${storeName}`
    const description = `${product.name} من ${product.brand} بسعر ${Number(finalPrice).toFixed(2)} ${currencySymbol} في ${storeName}.`

    return {
      metadataBase,
      alternates: { canonical: canonicalPath },
      title,
      description,
      openGraph: {
        title,
        description,
        siteName: storeName,
        locale: 'ar_SA',
        type: 'website',
        url: canonicalPath,
        images: product.imageUrl ? [{ url: product.imageUrl }] : undefined
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: product.imageUrl ? [product.imageUrl] : undefined
      }
    }
  } catch {
    return {
      metadataBase,
      alternates: { canonical: canonicalPath },
      title: fallbackTitle,
      description: fallbackDescription
    }
  }
}

export default async function ProductPage({ params }) {
  const resolvedParams = await params
  return <ProductDetailsClient productId={resolvedParams?.id} />
}
