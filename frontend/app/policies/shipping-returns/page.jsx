import Link from 'next/link'
import { getServerApiUrl } from '@/lib/serverApi'

export const metadata = {
  title: 'سياسة الشحن والاسترجاع',
  description: 'سياسة الشحن، التسليم، والاسترجاع في متجر عطور الإمبراطورية'
}

async function getSettings() {
  try {
    const res = await fetch(getServerApiUrl('/store-settings'), { cache: 'no-store' })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

function formatPolicyUpdatedAt(value) {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('ar-SA-u-nu-latn', { dateStyle: 'long' }).format(date)
}

export default async function ShippingReturnsPolicyPage() {
  const settings = await getSettings()
  const currency = settings?.currencySymbol || 'ر.س'
  const freeShippingThreshold = Number(settings?.freeShippingThreshold ?? 500)
  const shippingFlatFee = Number(settings?.shippingFlatFee ?? 50)
  const mainMin = Number(settings?.shippingMainCitiesMinDays ?? 1)
  const mainMax = Number(settings?.shippingMainCitiesMaxDays ?? 3)
  const otherMin = Number(settings?.shippingOtherCitiesMinDays ?? 3)
  const otherMax = Number(settings?.shippingOtherCitiesMaxDays ?? 7)
  const returnWindow = Number(settings?.returnWindowDays ?? 14)
  const shippingPolicyText = String(settings?.shippingPolicyText || '')
  const returnsPolicyText = String(settings?.returnsPolicyText || '')
  const lastUpdated = formatPolicyUpdatedAt(settings?.updatedAt)

  return (
    <main className="container customer-page-shell policy-page">
      <div className="header-section customer-page-header">
        <h1>سياسة الشحن والاسترجاع</h1>
        <p>آخر تحديث: {lastUpdated}</p>
      </div>

      <section className="form-container customer-card policy-card">
        <h2>سياسة الشحن</h2>
        {shippingPolicyText ? (
          <p>{shippingPolicyText}</p>
        ) : (
          <ul>
            <li>يتم تجهيز الطلبات خلال 24-48 ساعة عمل بعد تأكيد الطلب.</li>
            <li>مدة التوصيل داخل المدن الرئيسية من {mainMin} إلى {mainMax} أيام عمل.</li>
            <li>مدة التوصيل للمناطق الأخرى من {otherMin} إلى {otherMax} أيام عمل.</li>
            <li>الشحن مجاني للطلبات التي تتجاوز {freeShippingThreshold.toFixed(2)} {currency}، وما دون ذلك تطبق رسوم شحن {shippingFlatFee.toFixed(2)} {currency}.</li>
            <li>يتم إرسال تحديثات حالة الطلب للعميل حتى الاستلام.</li>
          </ul>
        )}
      </section>

      <section className="form-container customer-card policy-card">
        <h2>سياسة الاسترجاع والاستبدال</h2>
        {returnsPolicyText ? (
          <p>{returnsPolicyText}</p>
        ) : (
          <ul>
            <li>يمكن طلب الاسترجاع أو الاستبدال خلال {returnWindow} يومًا من تاريخ الاستلام.</li>
            <li>يشترط أن يكون المنتج بحالته الأصلية وغير مستخدم مع التغليف الأصلي.</li>
            <li>لا يمكن استرجاع المنتجات التي تم فتحها أو استخدامها بما يخالف شروط النظافة والجودة.</li>
            <li>في حال وصول منتج تالف أو خاطئ يتم التعويض الكامل أو الاستبدال بدون رسوم إضافية.</li>
            <li>تتم إعادة المبلغ لنفس وسيلة الدفع وفق مدة مزود الدفع.</li>
          </ul>
        )}
      </section>

      <section className="form-container customer-card policy-card">
        <h2>التواصل بخصوص الطلبات</h2>
        <p>للاستفسار عن الشحن أو رفع طلب استرجاع، يمكن التواصل عبر صفحة الدعم أو تتبع الطلب باستخدام رقم الطلب والهاتف.</p>
        <div className="policy-actions">
          <Link href="/track-order" className="btn btn-primary">تتبع الطلب</Link>
          <Link href="/contact" className="btn btn-secondary">التواصل مع الدعم</Link>
          <Link href="/shop" className="btn btn-secondary">العودة للمتجر</Link>
        </div>
      </section>
    </main>
  )
}
