"use client"

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { TOAST_AUTO_HIDE_MS } from '@/lib/toast'
import { buildTrackingUrl, copyTextToClipboard, shareOrCopyTrackingUrl } from '@/lib/tracking'
import { clearManagedTimer, setTemporaryState } from '@/lib/uiTimers'
import { digitsOnly, toEnglishDigits } from '@/lib/intl'
import Toast from '@/components/Toast'
import { useToast } from '@/hooks/useToast'

export default function CheckoutSuccessPage() {
  const copiedOrderIdTimerRef = useRef(null)
  const copiedTrackLinkTimerRef = useRef(null)
  const sharedTrackLinkTimerRef = useRef(null)
  const [orderId, setOrderId] = useState('')
  const [orderIdState, setOrderIdState] = useState('missing')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [copiedOrderId, setCopiedOrderId] = useState(false)
  const [copiedTrackLink, setCopiedTrackLink] = useState(false)
  const [sharedTrackLink, setSharedTrackLink] = useState(false)
  const { toast, showToast, closeToast } = useToast()

  const paymentMethodLabel = (method) => {
    if (method === 'online') return 'دفع إلكتروني'
    if (method === 'cash_on_delivery') return 'دفع عند الاستلام'
    return ''
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const rawValue = params.get('orderId') || ''
    const value = digitsOnly(rawValue)
    const method = params.get('paymentMethod') || ''

    const hasOrderIdParam = String(rawValue).trim().length > 0
    const acceptsOnlyDigits = /^[\s0-9٠-٩۰-۹]+$/.test(String(rawValue))
    const numericValue = Number(value)
    const isValidOrderId = value.length > 0
      && acceptsOnlyDigits
      && Number.isFinite(numericValue)
      && Number.isInteger(numericValue)
      && numericValue > 0

    setOrderId(value)
    setOrderIdState(hasOrderIdParam ? (isValidOrderId ? 'valid' : 'invalid') : 'missing')
    setPaymentMethod(method)
  }, [])

  useEffect(() => {
    return () => {
      clearManagedTimer(copiedOrderIdTimerRef)
      clearManagedTimer(copiedTrackLinkTimerRef)
      clearManagedTimer(sharedTrackLinkTimerRef)
    }
  }, [])

  const copyOrderId = async () => {
    if (orderIdState !== 'valid' || !orderId || typeof navigator === 'undefined' || !navigator.clipboard) return
    try {
      await navigator.clipboard.writeText(String(orderId))
      setTemporaryState({
        timerRef: copiedOrderIdTimerRef,
        setState: setCopiedOrderId,
        activeValue: true,
        resetValue: false,
        duration: TOAST_AUTO_HIDE_MS,
      })
      showToast('success', 'تم نسخ رقم الطلب')
    } catch {
      setCopiedOrderId(false)
      showToast('error', 'تعذر نسخ رقم الطلب')
    }
  }

  const copyTrackLink = async () => {
    if (orderIdState !== 'valid' || !orderId) return
    try {
      const trackUrl = buildTrackingUrl({ orderId })
      if (!trackUrl) return
      const copied = await copyTextToClipboard(trackUrl)
      if (!copied) return
      setTemporaryState({
        timerRef: copiedTrackLinkTimerRef,
        setState: setCopiedTrackLink,
        activeValue: true,
        resetValue: false,
        duration: TOAST_AUTO_HIDE_MS,
      })
      showToast('success', 'تم نسخ رابط التتبع')
    } catch {
      setCopiedTrackLink(false)
      showToast('error', 'تعذر نسخ رابط التتبع')
    }
  }

  const shareTrackLink = async () => {
    if (orderIdState !== 'valid' || !orderId) return

    try {
      const shared = await shareOrCopyTrackingUrl({
        orderId,
        title: `تتبع الطلب #${toEnglishDigits(orderId)}`,
        text: 'رابط تتبع الطلب'
      })
      if (!shared) return

      setTemporaryState({
        timerRef: sharedTrackLinkTimerRef,
        setState: setSharedTrackLink,
        activeValue: true,
        resetValue: false,
        duration: TOAST_AUTO_HIDE_MS,
      })
      showToast('success', 'تمت مشاركة رابط التتبع')
    } catch {
      setSharedTrackLink(false)
      showToast('error', 'تعذر مشاركة رابط التتبع')
    }
  }

  return (
    <main className="container customer-page-shell checkout-success-page">
      <Toast toast={toast} onClose={closeToast} />
      <div className="form-container customer-card checkout-success-card">
        <h1>✅ تم استلام طلبك بنجاح</h1>
        <p className="checkout-success-text">شكراً لثقتك بنا، جاري مراجعة الطلب وسيتم التواصل معك قريباً.</p>

        <div className="checkout-success-summary-grid">
          <div className="checkout-success-summary-item">
            <span>رقم الطلب</span>
            <strong>{orderId ? `#${toEnglishDigits(orderId)}` : '-'}</strong>
          </div>
          <div className="checkout-success-summary-item">
            <span>طريقة الدفع</span>
            <strong>{paymentMethodLabel(paymentMethod) || '-'}</strong>
          </div>
          <div className="checkout-success-summary-item">
            <span>حالة الطلب</span>
            <strong>قيد التجهيز</strong>
          </div>
        </div>

        {orderIdState === 'valid' && (
          <div className="checkout-success-copy-actions">
            <button type="button" className={`btn btn-secondary checkout-success-copy-btn${copiedOrderId ? ' success' : ''}`} onClick={copyOrderId}>
              {copiedOrderId ? '✅ تم نسخ رقم الطلب' : '📋 نسخ رقم الطلب'}
            </button>
            <button type="button" className={`btn btn-secondary checkout-success-copy-btn${copiedTrackLink ? ' success' : ''}`} onClick={copyTrackLink}>
              {copiedTrackLink ? '✅ تم نسخ رابط التتبع' : '🔗 نسخ رابط التتبع'}
            </button>
            <button type="button" className={`btn btn-secondary checkout-success-copy-btn${sharedTrackLink ? ' success' : ''}`} onClick={shareTrackLink}>
              {sharedTrackLink ? '✅ تمت مشاركة الرابط' : '📤 مشاركة رابط التتبع'}
            </button>
          </div>
        )}

        {orderIdState === 'missing' && (
          <div className="status-banner warning">
            <strong>لم يتم العثور على رقم الطلب في الرابط.</strong>
            <p>إذا لم تُحفظ هذه الصفحة، يمكنك العثور على الطلب من صفحة طلباتي أو تتبعه يدويًا عبر رقم الطلب والهاتف.</p>
          </div>
        )}

        {orderIdState === 'invalid' && (
          <div className="status-banner warning">
            <strong>رقم الطلب في الرابط غير صالح.</strong>
            <p>يرجى إدخال رقم طلب صحيح من صفحة التتبع، أو فتح طلباتك للوصول إلى الطلب مباشرة.</p>
          </div>
        )}

        <div className="checkout-success-next-steps">
          <h3>الخطوات القادمة</h3>
          <ul>
            <li>احتفظ برقم الطلب لتتبع الحالة بسهولة.</li>
            <li>سيتواصل فريق المتجر معك لتأكيد التفاصيل.</li>
            <li>يمكنك متابعة حالة الطلب في أي وقت من صفحة التتبع.</li>
          </ul>
        </div>

        <div className="checkout-success-actions">
          <Link href="/shop" className="btn btn-primary">العودة للمتجر</Link>
          {orderIdState === 'valid' && <Link href={`/track-order?orderId=${orderId}`} className="btn btn-secondary">تتبع الطلب</Link>}
          {orderIdState !== 'valid' && <Link href="/my-orders" className="btn btn-secondary">طلباتي</Link>}
          {orderIdState !== 'valid' && <Link href="/track-order" className="btn btn-secondary">تتبع يدوي</Link>}
          <Link href="/contact" className="btn btn-secondary">التواصل مع الدعم</Link>
        </div>
      </div>
    </main>
  )
}
