import { buildPageMetadata } from '@/lib/seoMetadata'

export async function generateMetadata() {
  return buildPageMetadata({
    path: '/wishlist',
    fallbackTitle: 'المفضلة',
    fallbackDescription: 'احفظ منتجاتك المفضلة في {storeName} وارجع لها في أي وقت.'
  })
}

export default function WishlistLayout({ children }) {
  return children
}
