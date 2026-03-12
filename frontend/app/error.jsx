'use client'

import Link from 'next/link'
import { useEffect } from 'react'

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error('App error boundary caught:', error)
  }, [error])

  return (
    <main className="container customer-page-shell">
      <div className="form-container customer-card customer-empty-state">
        <h1>حدث خطأ غير متوقع</h1>
        <p>تعذر تحميل هذه الصفحة حالياً. حاول إعادة المحاولة أو العودة للمتجر.</p>
        <div className="customer-footer-actions">
          <button type="button" className="btn btn-primary" onClick={reset}>إعادة المحاولة</button>
          <Link href="/shop" className="btn btn-secondary">الذهاب للمتجر</Link>
        </div>
      </div>
    </main>
  )
}
