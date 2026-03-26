"use client"

import { useEffect, useRef, useState } from 'react'
import Toast from '@/components/Toast'
import { fetchCustomerOrders, fetchStoreSettings, requestCustomerOtp, verifyCustomerOtp } from '@/lib/api'
import { useToast } from '@/hooks/useToast'
import { digitsOnly, formatMoney, getUserLocale, formatDateTime } from '@/lib/intl'

const CUSTOMER_PHONE_KEY = 'customerPhoneLookup'

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

  useEffect(() => {
    try { const saved = localStorage.getItem(CUSTOMER_PHONE_KEY); if (saved) setPhone(saved) } catch {}
  }, [])

  const onSubmit = async (e) => {
    e.preventDefault()
    const p = digitsOnly(phone || '').trim(); if (!p) return
    setPhone(p); try { localStorage.setItem(CUSTOMER_PHONE_KEY, p) } catch {}
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

  return (
    <main className="container customer-page-shell my-orders-page">
      <Toast toast={toast} onClose={closeToast} />
      <div className="form-container customer-card">
        <h1>الطلبات</h1>
        <form onSubmit={onSubmit}>
          <label htmlFor="phone">رقم الهاتف</label>
          <input id="phone" value={phone} onChange={(e)=>setPhone(e.target.value)} placeholder="أدخل رقم الهاتف" />
          <div className="actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>{otpRequested ? 'تحقق' : 'ابحث'}</button>
            <button type="button" className="btn btn-secondary" onClick={reset}>إعادة</button>
          </div>
        </form>

        {error && <div className="status-banner error">{error}</div>}
        {loading && <div>جاري التحميل...</div>}
        {hasSearched && !loading && orders.length === 0 && <div className="no-results">لا توجد طلبات لرقم {phone}</div>}

        {orders.length > 0 && (
          <ul className="orders-list">
            {orders.map(o => (
              <li key={o.id} className="order-item">
                <div>طلب #{o.id} — {formatAmount(o.total)}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
