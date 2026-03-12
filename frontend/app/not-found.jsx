import Link from 'next/link'

export default function AppNotFound() {
  return (
    <main className="container customer-page-shell">
      <div className="form-container customer-card customer-empty-state">
        <h1>الصفحة غير موجودة</h1>
        <p>الرابط الذي أدخلته غير صحيح أو تم نقل الصفحة.</p>
        <div className="customer-footer-actions">
          <Link href="/" className="btn btn-primary">الصفحة الرئيسية</Link>
          <Link href="/shop" className="btn btn-secondary">تصفح المنتجات</Link>
        </div>
      </div>
    </main>
  )
}
