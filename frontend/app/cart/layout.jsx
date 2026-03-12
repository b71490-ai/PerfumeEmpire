import { buildPageMetadata } from '@/lib/seoMetadata'

export async function generateMetadata() {
  return buildPageMetadata({
    path: '/cart',
    fallbackTitle: 'سلة المشتريات',
    fallbackDescription: 'راجع سلة مشترياتك في {storeName} قبل إتمام عملية الشراء.'
  })
}

export default function CartLayout({ children }) {
  return children
}
