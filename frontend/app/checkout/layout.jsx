import { buildPageMetadata } from '@/lib/seoMetadata'
import CheckoutProgress from '@/components/CheckoutProgress'
import PaymentLogos from '@/components/PaymentLogos'

export async function generateMetadata() {
  return buildPageMetadata({
    path: '/checkout',
    fallbackTitle: 'إتمام الطلب',
    fallbackDescription: 'أكمل طلبك بأمان في {storeName} مع خيارات تواصل ومتابعة واضحة.'
  })
}

export default function CheckoutLayout({ children }) {
  return (
    <main className="container checkout-page-modern">
      <CheckoutProgress />
      <div style={{display:'flex', justifyContent:'center', marginBottom:'8px'}}>
        <PaymentLogos />
      </div>
      {children}
    </main>
  )
}
