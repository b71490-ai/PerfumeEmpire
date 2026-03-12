import { buildPageMetadata } from '@/lib/seoMetadata'

export async function generateMetadata() {
  return buildPageMetadata({
    path: '/contact',
    fallbackTitle: 'اتصل بنا',
    fallbackDescription: 'تواصل مع فريق {storeName} عبر الهاتف أو البريد أو واتساب.'
  })
}

export default function ContactLayout({ children }) {
  return children
}
