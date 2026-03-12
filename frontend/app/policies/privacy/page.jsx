import Link from 'next/link'
import { getServerApiUrl } from '@/lib/serverApi'

export const metadata = {
  title: 'سياسة الخصوصية',
  description: 'سياسة الخصوصية ومعالجة البيانات في متجر عطور الإمبراطورية'
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

export default async function PrivacyPolicyPage() {
  const settings = await getSettings()
  const privacyPolicyText = String(settings?.privacyPolicyText || '')
  const lastUpdated = formatPolicyUpdatedAt(settings?.updatedAt)

  return (
    <main className="container customer-page-shell policy-page">
      <div className="header-section customer-page-header">
        <h1>سياسة الخصوصية</h1>
        <p>آخر تحديث: {lastUpdated}</p>
      </div>

      <section className="form-container customer-card policy-card">
        <h2>كيف نتعامل مع بياناتك</h2>
        {privacyPolicyText ? (
          <p>{privacyPolicyText}</p>
        ) : (
          <ul>
            <li>نجمع الحد الأدنى من البيانات اللازمة لمعالجة الطلبات وخدمة العملاء.</li>
            <li>نستخدم بيانات التواصل لإشعارات الطلب فقط (التأكيد، الشحن، التحديثات).</li>
            <li>لا نبيع بيانات العملاء لأي طرف ثالث.</li>
            <li>تُستخدم بيانات التحليلات لتحسين تجربة المتجر والأداء التسويقي.</li>
            <li>يمكنك طلب تعديل أو حذف بياناتك عبر التواصل مع الدعم.</li>
          </ul>
        )}
      </section>

      <section className="form-container customer-card policy-card">
        <h2>حقوق العميل</h2>
        <ul>
          <li>طلب الوصول لبياناتك أو تصحيحها.</li>
          <li>طلب حذف البيانات غير المطلوبة نظاميًا للاحتفاظ.</li>
          <li>الاستفسار عن كيفية استخدام البيانات عبر قنوات الدعم.</li>
        </ul>
      </section>

      <section className="form-container customer-card policy-card">
        <h2>التواصل</h2>
        <p>لأي استفسار متعلق بالخصوصية، تواصل معنا عبر صفحة التواصل.</p>
        <div className="policy-actions">
          <Link href="/contact" className="btn btn-primary">التواصل مع الدعم</Link>
          <Link href="/policies/shipping-returns" className="btn btn-secondary">سياسة الشحن والاسترجاع</Link>
          <Link href="/shop" className="btn btn-secondary">العودة للمتجر</Link>
        </div>
      </section>
    </main>
  )
}
