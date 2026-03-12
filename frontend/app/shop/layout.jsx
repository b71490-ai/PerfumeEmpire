import { buildPageMetadata } from '@/lib/seoMetadata'

export async function generateMetadata() {
  return buildPageMetadata({
    path: '/shop',
    fallbackTitle: 'المتجر',
    fallbackDescription: 'تصفح منتجات {storeName} واختر عطرك المفضل بكل سهولة.'
  })
}

export default function ShopLayout({ children }) {
  return children
}
