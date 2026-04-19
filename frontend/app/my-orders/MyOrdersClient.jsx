"use client"

import Link from 'next/link'
import { useState } from 'react'
import Toast from '@/components/Toast'
import { fetchCustomerOrders, requestCustomerOtp, verifyCustomerOtp } from '@/lib/api'
import { useToast } from '@/hooks/useToast'
import { digitsOnly, formatMoney, getUserLocale, formatDateTime } from '@/lib/intl'

export default function MyOrdersClient() {
  const [phone, setPhone] = useState('')
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasSearched, setHasSearched] = useState(false)
  const [otpRequested, setOtpRequested] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [otpAccessToken, setOtpAccessToken] = useState('')
  const [otpExpiresAt, setOtpExpiresAt] = useState(null)
  const { toast, showToast, closeToast } = useToast()
  const locale = getUserLocale('ar-SA')
  const formatAmount = (v) => formatMoney(v || 0, 'ر.س', { locale })
  const sanitizedPhone = digitsOnly(phone || '').trim()
  const normalizedOtpCode = digitsOnly(otpCode || '').trim()
  const canSubmit = !loading && sanitizedPhone.length > 0 && (!otpRequested || otpAccessToken || normalizedOtpCode.length === 6)

  const statusLabel = (value) => {
    switch (String(value || '').toLowerCase()) {
      case 'pending': return 'قيد التجهيز'
      case 'processing': return 'قيد المعالجة'
      case 'shipped': return 'قيد الشحن'
      case 'completed': return 'تم التسليم'
      case 'cancelled': return 'ملغي'
      default: return value || 'غير محدد'
    }
  }

  const paymentLabel = (value) => {
    switch (String(value || '').toLowerCase()) {
      case 'pending': return 'بانتظار الدفع'
      case 'paid': return 'مدفوع'
      case 'refunded': return 'مسترد'
      default: return value || 'غير محدد'
    }
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    const p = digitsOnly(phone || '').trim(); if (!p) return
    setPhone(p)
    setLoading(true); setError('')
    let accessToken = otpAccessToken
    try {
      if (!accessToken) {
        if (!otpRequested) {
          const r = await requestCustomerOtp(p)
          setOtpRequested(true); setOtpExpiresAt(r?.expiresAt || null); setOtpCode('')
          showToast('success', 'تم إرسال رمز التحقق إلى رقم الهاتف.')
          return
        }
        const code = digitsOnly(otpCode||'').trim()
        if (!code || code.length !== 6) { setError('أدخل رمز التحقق المكوّن من 6 أرقام.'); return }
        const vr = await verifyCustomerOtp(p, code)
        accessToken = String(vr?.accessToken || '')
        setOtpAccessToken(accessToken)
        setOtpExpiresAt(vr?.expiresAt || otpExpiresAt)
        showToast('success', 'تم التحقق بنجاح.')
      }
      if (!accessToken) { setError('تعذر إكمال التحقق. حاول مرة أخرى.'); return }
      setOrders([]); setHasSearched(true)
      const data = await fetchCustomerOrders(p, accessToken)
      setOrders(data || [])
    } catch (err) {
      const status = err?.response?.status
      if (status === 401) {
        setOtpAccessToken(''); setOtpRequested(false); setOtpCode(''); setOtpExpiresAt(null)
        setError('انتهت صلاحية التحقق. اطلب رمزًا جديدًا ثم حاول مرة أخرى.')
      } else {
        setError('تعذر تحميل الطلبات، تأكد من رقم الهاتف ورمز التحقق.')
      }
    } finally { setLoading(false) }
  }

  const reset = () => { setPhone(''); setOrders([]); setError(''); setHasSearched(false); setOtpRequested(false); setOtpCode(''); setOtpAccessToken(''); setOtpExpiresAt(null); showToast('info','تمت إعادة التعيين') }

  const totalSpent = orders.reduce((sum, order) => sum + Number(order?.total || 0), 0)
  const latestOrder = orders[0]

  return (
    <main className="container customer-page-shell my-orders-page">
      <Toast toast={toast} onClose={closeToast} />
      <div className="header-section customer-page-header my-orders-header">
        <h1>الطلبات</h1>
        <p>اعرض جميع طلباتك باستخدام رقم الهاتف المرتبط بالشراء، مع تحقق سريع لحماية بياناتك.</p>
        <div className="track-order-intro-note my-orders-intro-note">
          <strong>مهم:</strong> بعد إدخال رقم الهاتف سنرسل رمز تحقق لمرة واحدة، وبعدها ستظهر قائمة طلباتك مباشرة.
        </div>
      </div>

      <form onSubmit={onSubmit} className="form-container customer-card customer-form-card my-orders-form-card" aria-busy={loading}>
        <div className="customer-form-grid my-orders-form-grid">
          <div className="form-group my-orders-phone-group">
            <label htmlFor="phone">رقم الهاتف</label>
            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="أدخل رقم الهاتف"
              disabled={loading}
            />
            <small className="checkout-helper-note">استخدم نفس الرقم الذي أدخلته أثناء إتمام الطلب.</small>
          </div>

          {otpRequested && !otpAccessToken && (
            <div className="form-group my-orders-otp-group">
              <label htmlFor="otpCode">رمز التحقق</label>
              <input
                id="otpCode"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                dir="ltr"
                value={otpCode}
                onChange={(e) => {
                  setOtpCode(digitsOnly(e.target.value || '').slice(0, 6))
                  setError('')
                }}
                placeholder="أدخل الرمز المكوّن من 6 أرقام"
                disabled={loading}
              />
              <small className="checkout-helper-note">تم إرسال الرمز إلى الرقم المدخل. {otpExpiresAt ? `ينتهي تقريبًا ${formatDateTime(otpExpiresAt, { locale })}` : ''}</small>
            </div>
          )}
        </div>

        {otpAccessToken && (
          <p className="checkout-helper-note my-orders-verified-note" role="status">✅ تم التحقق بنجاح. يمكنك الآن مشاهدة الطلبات المرتبطة بهذا الرقم.</p>
        )}

        <div className="customer-actions-row my-orders-actions-row">
          <button type="submit" className="btn btn-primary my-orders-submit-btn" disabled={!canSubmit} aria-disabled={!canSubmit}>
            {loading ? 'جاري التحميل...' : otpRequested && !otpAccessToken ? 'تحقق' : 'ابحث'}
          </button>
          <button type="button" className="btn btn-secondary my-orders-reset-btn" onClick={reset} disabled={loading}>إعادة</button>
        </div>
      </form>

      {error && <div className="status-banner error my-orders-status-banner">{error}</div>}
      {loading && <div className="status-banner info my-orders-status-banner">جاري تحميل الطلبات...</div>}

      {orders.length > 0 && (
        <section className="customer-orders-result">
          <div className="my-orders-stats-grid">
            <div className="my-orders-stat-card">
              <span>إجمالي الطلبات</span>
              <strong>{orders.length}</strong>
            </div>
            <div className="my-orders-stat-card">
              <span>إجمالي المشتريات</span>
              <strong>{formatAmount(totalSpent)}</strong>
            </div>
            <div className="my-orders-stat-card">
              <span>آخر طلب</span>
              <strong>{latestOrder ? `#${latestOrder.id}` : '-'}</strong>
            </div>
          </div>

          <div className="my-orders-results-stack">
            {orders.map((order) => (
              <article key={order.id} className="my-orders-result-card">
                <div className="my-orders-result-top">
                  <div>
                    <h3>طلب #{order.id}</h3>
                    <p>{formatDateTime(order.createdAt, { locale })}</p>
                  </div>
                  <div className="my-orders-result-price">{formatAmount(order.total)}</div>
                </div>

                <div className="customer-result-grid my-orders-result-grid">
                  <div className="result-item">
                    <span>حالة الطلب</span>
                    <strong>{statusLabel(order.status)}</strong>
                  </div>
                  <div className="result-item">
                    <span>حالة الدفع</span>
                    <strong>{paymentLabel(order.paymentStatus)}</strong>
                  </div>
                  <div className="result-item">
                    <span>عدد المنتجات</span>
                    <strong>{Array.isArray(order.items) ? order.items.length : 0}</strong>
                  </div>
                  <div className="result-item">
                    <span>العنوان</span>
                    <strong>{order.address || 'غير متوفر'}</strong>
                  </div>
                </div>

                {Array.isArray(order.items) && order.items.length > 0 && (
                  <div className="mobile-order-items my-orders-items-list">
                    {order.items.map((item) => (
                      <div key={item.id || `${order.id}-${item.perfumeId}`} className="my-orders-item-row">
                        <span>{item.name}</span>
                        <strong>{item.quantity} × {formatAmount(item.price)}</strong>
                      </div>
                    ))}
                  </div>
                )}

                <div className="my-orders-mobile-actions">
                  <Link href={`/track-order?orderId=${order.id}`} className="btn-track-order-inline mobile-track-link">
                    تتبع هذا الطلب
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {hasSearched && !loading && orders.length === 0 && (
        <div className="form-container customer-card customer-empty-state my-orders-empty-state">
          <h3>لا توجد طلبات لهذا الرقم</h3>
          <p>تأكد من رقم الهاتف أو اطلب رمز تحقق جديد ثم أعد المحاولة.</p>
        </div>
      )}
    </main>
  )
}
