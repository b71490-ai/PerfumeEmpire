"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { trackOrder, fetchStoreSettings, requestCustomerOtp, verifyCustomerOtp } from '@/lib/api'
import { TOAST_AUTO_HIDE_MS } from '@/lib/toast'
import { buildTrackingUrl, shareOrCopyTrackingUrl } from '@/lib/tracking'
import { clearManagedTimer, setTemporaryState } from '@/lib/uiTimers'
import { orderBadgeClass, paymentLabel, paymentMethodLabel, statusLabel } from '@/lib/orderPresentation'
import Toast from '@/components/Toast'
import { useToast } from '@/hooks/useToast'
import { digitsOnly, formatDateTime, formatMoney, formatTime, getUserLocale } from '@/lib/intl'

const TRACKING_PREFS_KEY = 'trackOrderPrefsV1'
const TRACKING_PHONE_KEY = 'trackOrderLastPhone'

function isValidOrderId(value) {
  const normalized = digitsOnly(value || '').trim()
  const numericValue = Number(normalized)
  return normalized.length > 0
    && Number.isFinite(numericValue)
    && Number.isInteger(numericValue)
    && numericValue > 0
}

export default function TrackOrderPage() {
  const noticeTimerRef = useRef(null)
  const copyTimerRef = useRef(null)
  const orderIdCopiedTimerRef = useRef(null)
  const trackLinkSharedTimerRef = useRef(null)
  const [form, setForm] = useState({ orderId: '', phone: '' })
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [otpRequested, setOtpRequested] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [otpAccessToken, setOtpAccessToken] = useState('')
  const [result, setResult] = useState(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true)
  const [notifyOnChange, setNotifyOnChange] = useState(true)
  const [statusNotice, setStatusNotice] = useState('')
  const [isCopyingSummary, setIsCopyingSummary] = useState(false)
  const [summaryCopied, setSummaryCopied] = useState(false)
  const [orderIdCopied, setOrderIdCopied] = useState(false)
  const [trackLinkShared, setTrackLinkShared] = useState(false)
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const { toast, showToast, closeToast } = useToast()
  const locale = getUserLocale('ar-SA')
  const formatAmount = (value) => formatMoney(value, currencySymbol, { locale })
  const [currencySymbol, setCurrencySymbol] = useState('ر.س')
  const [storeProfile, setStoreProfile] = useState({
    storeName: 'عطور الإمبراطورية',
    logoIcon: '✨',
    logoImageUrl: '',
    invoiceLogoAutoMask: true,
    businessLegalName: 'مؤسسة عطور الإمبراطورية',
    vatRegistrationNumber: '',
    commercialRegistrationNumber: '',
    contactPhone: '+966500000000',
    contactEmail: 'info@perfume-empire.local',
    contactAddress: 'الرياض، المملكة العربية السعودية',
    businessHours: 'السبت - الخميس: 9 صباحاً - 10 مساءً'
  })

  const isTerminalStatus = useCallback((status) => {
    return status === 'Completed' || status === 'Cancelled'
  }, [])

  const paymentMethodText = (method) => paymentMethodLabel(method, { showUnknownRaw: true })

  const fetchTrackingResult = useCallback(async ({ orderId, phone, silent = false, clearPrevious = true }) => {
    const normalizedOrderId = digitsOnly(orderId || '').trim()
    const normalizedPhone = digitsOnly(phone || '').trim()

    if (!normalizedOrderId || !normalizedPhone || !otpAccessToken) return false

    if (silent) {
      setRefreshing(true)
    } else {
      setLoading(true)
      setError('')
      if (clearPrevious) {
        setResult(null)
      }
    }

    try {
      const data = await trackOrder(normalizedOrderId, normalizedPhone, otpAccessToken)
      setResult((previousResult) => {
        if (silent && notifyOnChange && previousResult) {
          const orderStatusChanged = previousResult.status !== data.status
          const paymentStatusChanged = previousResult.paymentStatus !== data.paymentStatus

          if (orderStatusChanged || paymentStatusChanged) {
            const changes = []
            if (orderStatusChanged) {
              changes.push(`حالة الطلب: ${statusLabel(previousResult.status)} ← ${statusLabel(data.status)}`)
            }
            if (paymentStatusChanged) {
              changes.push(`حالة الدفع: ${paymentLabel(previousResult.paymentStatus)} ← ${paymentLabel(data.paymentStatus)}`)
            }

            setStatusNotice(`تم تحديث الطلب (${changes.join(' | ')})`)
            if (noticeTimerRef.current) {
              clearTimeout(noticeTimerRef.current)
            }
            noticeTimerRef.current = setTimeout(() => {
              setStatusNotice('')
              noticeTimerRef.current = null
            }, 7000)

            if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
              navigator.vibrate(120)
            }
          }
        }

        return data
      })

      if (!silent) {
        const hasItems = Array.isArray(data?.items) && data.items.length > 0
        const hasBreakdown = Number.isFinite(Number(data?.subtotal))
          && Number.isFinite(Number(data?.shipping))
          && Number.isFinite(Number(data?.vat))

        if (!hasItems || !hasBreakdown) {
          showToast('info', 'بعض تفاصيل الفاتورة غير مكتملة حالياً، سيتم عرض القيم المتاحة.')
        }
      }

      setLastUpdatedAt(new Date())
      setError('')
      return true
    } catch (err) {
      const statusCode = err?.response?.status
      if (statusCode === 401) {
        setOtpAccessToken('')
        setOtpRequested(false)
        setOtpCode('')
      }
      if (!silent) {
        if (statusCode === 401) {
          setError('انتهت صلاحية التحقق. اطلب رمزًا جديدًا وأعد المحاولة.')
        } else {
          setError('لم يتم العثور على الطلب. تأكد من رقم الطلب ورقم الهاتف.')
        }
      }
      return false
    } finally {
      if (silent) {
        setRefreshing(false)
      } else {
        setLoading(false)
      }
    }
  }, [notifyOnChange, otpAccessToken, showToast])

  useEffect(() => {
    try {
      const rawPrefs = localStorage.getItem(TRACKING_PREFS_KEY)
      if (rawPrefs) {
        const parsedPrefs = JSON.parse(rawPrefs)
        if (typeof parsedPrefs.autoRefreshEnabled === 'boolean') {
          setAutoRefreshEnabled(parsedPrefs.autoRefreshEnabled)
        }
        if (typeof parsedPrefs.notifyOnChange === 'boolean') {
          setNotifyOnChange(parsedPrefs.notifyOnChange)
        }
      }
    } catch {
      // ignore invalid storage values
    }

    const params = new URLSearchParams(window.location.search)
    const orderId = digitsOnly(params.get('orderId') || '')
    const phone = digitsOnly(params.get('phone') || '')

    let savedPhone = ''
    try {
      savedPhone = digitsOnly(localStorage.getItem(TRACKING_PHONE_KEY) || '')
    } catch {
      // ignore localStorage issues
    }

    if (orderId || phone) {
      setForm((prev) => ({
        ...prev,
        orderId: orderId || prev.orderId,
        phone: phone || savedPhone || prev.phone
      }))
    } else if (savedPhone) {
      setForm((prev) => ({ ...prev, phone: savedPhone }))
    }

    if (isValidOrderId(orderId) && phone) {
      setStatusNotice('أدخل رمز التحقق ثم اضغط عرض حالة الطلب.')
    }
  }, [fetchTrackingResult])

  useEffect(() => {
    ;(async () => {
      try {
        const settings = await fetchStoreSettings()
        if (settings) {
          setCurrencySymbol(settings.currencySymbol || 'ر.س')
          setStoreProfile({
            storeName: settings.storeName || settings.logoText || 'عطور الإمبراطورية',
            logoIcon: settings.logoIcon || '✨',
            logoImageUrl: settings.logoImageUrl || '',
            invoiceLogoAutoMask: settings.invoiceLogoAutoMask !== false,
            businessLegalName: settings.businessLegalName || 'مؤسسة عطور الإمبراطورية',
            vatRegistrationNumber: settings.vatRegistrationNumber || '',
            commercialRegistrationNumber: settings.commercialRegistrationNumber || '',
            contactPhone: settings.contactPhone || '+966500000000',
            contactEmail: settings.contactEmail || 'info@perfume-empire.local',
            contactAddress: settings.contactAddress || 'الرياض، المملكة العربية السعودية',
            businessHours: settings.businessHours || 'السبت - الخميس: 9 صباحاً - 10 مساءً'
          })
        }
      } catch {
        // keep default
      }
    })()
  }, [])

  const escapeHtml = (value) => {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;')
  }

  const onChange = (e) => {
    const { name, value } = e.target
    if (name === 'orderId' || name === 'phone') {
      const normalized = digitsOnly(value || '')
      if (name === 'phone' && normalized !== digitsOnly(form.phone || '')) {
        setOtpRequested(false)
        setOtpCode('')
        setOtpAccessToken('')
      }
      setForm((prev) => ({ ...prev, [name]: normalized }))
      return
    }

    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const sanitizedOrderId = digitsOnly(form.orderId || '').trim()
  const sanitizedPhone = digitsOnly(form.phone || '').trim()
  const hasOrderIdInput = sanitizedOrderId.length > 0
  const hasValidOrderId = isValidOrderId(sanitizedOrderId)
  const normalizedOtpCode = digitsOnly(otpCode || '').trim()
  const orderIdValidationError = hasOrderIdInput && !hasValidOrderId
    ? 'رقم الطلب غير صالح. يجب أن يكون رقمًا صحيحًا أكبر من 0.'
    : ''
  const canSubmit = hasValidOrderId
    && sanitizedPhone.length > 0
    && (!otpRequested || otpAccessToken.length > 0 || normalizedOtpCode.length === 6)
    && !loading
  const submitLabel = loading
    ? 'جاري المعالجة...'
    : !otpRequested
      ? 'إرسال رمز التحقق'
      : !otpAccessToken
        ? 'تحقق وعرض الحالة'
        : 'عرض حالة الطلب'
  const invoiceItems = Array.isArray(result?.items) ? result.items : []
  const hasInvoiceBreakdown = Boolean(result)
    && Number.isFinite(Number(result?.subtotal))
    && Number.isFinite(Number(result?.shipping))
    && Number.isFinite(Number(result?.vat))
  const derivedSubtotal = invoiceItems.reduce((sum, item) => {
    const quantity = Number(item?.quantity || 0)
    const price = Number(item?.price || 0)
    return sum + (price * quantity)
  }, 0)
  const displaySubtotal = hasInvoiceBreakdown ? Number(result?.subtotal || 0) : derivedSubtotal
  const displayDiscount = Number(result?.discount || 0)
  const displayShipping = hasInvoiceBreakdown ? Number(result?.shipping || 0) : 0
  const displayVat = hasInvoiceBreakdown ? Number(result?.vat || 0) : 0
  const invoiceDetailsMissing = Boolean(result) && (!hasInvoiceBreakdown || invoiceItems.length === 0)

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return

    if (!hasValidOrderId) {
      setError('رقم الطلب غير صالح. يرجى إدخال رقم طلب صحيح.')
      return
    }

    try {
      localStorage.setItem(TRACKING_PHONE_KEY, sanitizedPhone)
    } catch {
      // ignore localStorage issues
    }

    let accessToken = otpAccessToken

    if (!accessToken) {
      setLoading(true)
      setError('')
      try {
        if (!otpRequested) {
          const response = await requestCustomerOtp(sanitizedPhone)
          setOtpRequested(true)
          setOtpCode('')
          showToast('success', 'تم إرسال رمز التحقق إلى رقم الهاتف.')
          if (response?.devOtpCode) {
            showToast('info', `رمز التطوير: ${response.devOtpCode}`)
          }
          return
        }

        if (!normalizedOtpCode || normalizedOtpCode.length !== 6) {
          setError('أدخل رمز التحقق المكوّن من 6 أرقام.')
          return
        }

        const verifyResponse = await verifyCustomerOtp(sanitizedPhone, normalizedOtpCode)
        accessToken = String(verifyResponse?.accessToken || '')
        setOtpAccessToken(accessToken)
        showToast('success', 'تم التحقق بنجاح.')
      } catch (err) {
        const statusCode = err?.response?.status
        if (statusCode === 401) {
          setOtpAccessToken('')
          setOtpRequested(false)
          setOtpCode('')
          setError('انتهت صلاحية رمز التحقق. اطلب رمزًا جديدًا.')
        } else {
          setError('تعذر التحقق من الرمز. تأكد من الهاتف والرمز.')
        }
        return
      } finally {
        setLoading(false)
      }
    }

    if (!accessToken) {
      setError('تعذر إكمال التحقق. حاول مرة أخرى.')
      return
    }

    await fetchTrackingResult({
      orderId: sanitizedOrderId,
      phone: sanitizedPhone,
      silent: false,
      clearPrevious: true
    })
  }

  const resetTracking = () => {
    const hadState = Boolean(form.orderId || form.phone || result || error || statusNotice)
    setForm({ orderId: '', phone: '' })
    setOtpRequested(false)
    setOtpCode('')
    setOtpAccessToken('')
    setResult(null)
    setError('')
    setStatusNotice('')
    setLastUpdatedAt(null)
    if (hadState) {
      showToast('info', 'تمت إعادة تعيين التتبع')
    }
  }

  const handleCopyStatusSummary = async () => {
    if (!result || isCopyingSummary) return

    const summaryItems = Array.isArray(result.items) ? result.items : []
    const summaryHasBreakdown = Number.isFinite(Number(result?.subtotal))
      && Number.isFinite(Number(result?.shipping))
      && Number.isFinite(Number(result?.vat))
    const summaryDerivedSubtotal = summaryItems.reduce((sum, item) => {
      const quantity = Number(item?.quantity || 0)
      const price = Number(item?.price || 0)
      return sum + (price * quantity)
    }, 0)
    const summarySubtotal = summaryHasBreakdown ? Number(result?.subtotal || 0) : summaryDerivedSubtotal
    const summaryDiscount = Number(result?.discount || 0)
    const summaryShipping = summaryHasBreakdown ? Number(result?.shipping || 0) : 0
    const summaryVat = summaryHasBreakdown ? Number(result?.vat || 0) : 0
    const summaryItemsText = summaryItems.length > 0
      ? summaryItems.map((item) => {
          const quantity = Number(item?.quantity || 0)
          const price = Number(item?.price || 0)
          return `- ${item?.name || '-'} × ${quantity} = ${formatAmount(price * quantity)}`
        }).join('\n')
      : '- لا توجد عناصر مفصلة'

    const summaryText = [
      'ملخص حالة الطلب',
      `رقم الطلب: #${result.id}`,
      `العميل: ${result.customerName}`,
      `حالة الطلب: ${statusLabel(result.status)}`,
      `طريقة الدفع: ${paymentMethodText(result.paymentMethod)}`,
      `حالة الدفع: ${paymentLabel(result.paymentStatus)}`,
      '',
      'عناصر الطلب:',
      summaryItemsText,
      '',
      `المجموع الفرعي: ${formatAmount(summarySubtotal)}`,
      summaryDiscount > 0 ? `الخصم: - ${formatAmount(summaryDiscount)}` : 'الخصم: لا يوجد خصم',
      `الشحن: ${formatAmount(summaryShipping)}`,
      `الضريبة: ${formatAmount(summaryVat)}`,
      `الإجمالي: ${formatAmount(result.total || 0)}`,
      `تاريخ الإنشاء: ${formatDateTime(result.createdAt, { locale })}`,
      lastUpdatedAt ? `آخر تحديث: ${formatTime(lastUpdatedAt, { locale })}` : null,
    ].filter(Boolean).join('\n')

    setIsCopyingSummary(true)
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({
          title: `حالة الطلب #${result.id}`,
          text: summaryText
        })
      } else {
        await navigator.clipboard.writeText(summaryText)
      }

      setSummaryCopied(true)
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current)
      }
      copyTimerRef.current = setTimeout(() => {
        setSummaryCopied(false)
        copyTimerRef.current = null
      }, 2200)
      showToast('success', 'تم نسخ ملخص الحالة')
    } catch {
      setStatusNotice('تعذر نسخ الملخص حالياً، حاول مرة أخرى.')
      showToast('error', 'تعذر نسخ ملخص الحالة')
      if (noticeTimerRef.current) {
        clearTimeout(noticeTimerRef.current)
      }
      noticeTimerRef.current = setTimeout(() => {
        setStatusNotice('')
        noticeTimerRef.current = null
      }, 4000)
    } finally {
      setIsCopyingSummary(false)
    }
  }

  const handleCopyOrderId = async () => {
    if (!result?.id) return
    try {
      await navigator.clipboard.writeText(String(result.id))
      setTemporaryState({
        timerRef: orderIdCopiedTimerRef,
        setState: setOrderIdCopied,
        activeValue: true,
        resetValue: false,
        duration: TOAST_AUTO_HIDE_MS,
      })
      showToast('success', `تم نسخ رقم الطلب #${result.id}`)
    } catch {
      setOrderIdCopied(false)
      showToast('error', 'تعذر نسخ رقم الطلب')
    }
  }

  const handleShareTrackingLink = async () => {
    if (!result?.id) return

    try {
      const shared = await shareOrCopyTrackingUrl({
        orderId: result.id,
        title: `تتبع الطلب #${result.id}`,
        text: 'رابط تتبع الطلب'
      })
      if (!shared) return

      setTemporaryState({
        timerRef: trackLinkSharedTimerRef,
        setState: setTrackLinkShared,
        activeValue: true,
        resetValue: false,
        duration: TOAST_AUTO_HIDE_MS,
      })
      showToast('success', 'تمت مشاركة رابط التتبع')
    } catch {
      setTrackLinkShared(false)
      showToast('error', 'تعذر مشاركة رابط التتبع')
    }
  }

  const handleExportPdf = () => {
    if (!result || isExportingPdf) return

    setIsExportingPdf(true)
    try {
      const printWindow = window.open('', '_blank', 'width=900,height=700')
      if (!printWindow) {
        setStatusNotice('تعذر فتح نافذة الطباعة. تحقق من إعدادات المتصفح.')
        showToast('error', 'تعذر فتح نافذة الطباعة')
        return
      }

      const createdAt = formatDateTime(result.createdAt, { locale })
      const updatedAt = lastUpdatedAt ? formatTime(lastUpdatedAt, { locale }) : '-'
      const generatedAt = formatDateTime(new Date(), { locale })
      const trackingUrl = buildTrackingUrl({ orderId: result.id })
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(trackingUrl)}`
      const invoiceNumber = `INV-${result.id}`
      const fileSafeInvoiceName = `invoice-${result.id}`
      const invoiceMaskClass = storeProfile.invoiceLogoAutoMask ? 'invoice-mask-on' : 'invoice-mask-off'
      const storeName = escapeHtml(storeProfile.storeName)
      const logoIcon = escapeHtml(storeProfile.logoIcon)
      const logoImageUrl = escapeHtml(storeProfile.logoImageUrl || '')
      const siteDomain = escapeHtml(typeof window !== 'undefined' ? window.location.host : '')
      const contactPhone = escapeHtml(storeProfile.contactPhone)
      const contactEmail = escapeHtml(storeProfile.contactEmail)
      const contactAddress = escapeHtml(storeProfile.contactAddress)
      const businessHours = escapeHtml(storeProfile.businessHours)
      const businessLegalName = escapeHtml(storeProfile.businessLegalName || storeProfile.storeName)
      const vatRegistrationNumber = escapeHtml(storeProfile.vatRegistrationNumber || '-')
      const commercialRegistrationNumber = escapeHtml(storeProfile.commercialRegistrationNumber || '-')
      const customerName = escapeHtml(result.customerName)
      const customerEmail = escapeHtml(result.email || '-')
      const customerPhone = escapeHtml(result.phone || '-')
      const customerAddress = escapeHtml(result.address || '-')
      const orderStatus = escapeHtml(statusLabel(result.status))
      const paymentMethod = escapeHtml(paymentMethodText(result.paymentMethod))
      const paymentStatus = escapeHtml(paymentLabel(result.paymentStatus))
      const stampConfig = (() => {
        if (result.paymentStatus === 'Paid') return { label: 'PAID', arabicLabel: 'مدفوع', className: 'is-paid' }
        if (result.paymentStatus === 'Pending') return { label: 'PENDING', arabicLabel: 'بانتظار الدفع', className: 'is-pending' }
        if (result.paymentStatus === 'Failed') return { label: 'FAILED', arabicLabel: 'فشل الدفع', className: 'is-failed' }
        if (result.paymentStatus === 'Refunded') return { label: 'REFUNDED', arabicLabel: 'تم الاسترجاع', className: 'is-refunded' }
        if (result.status === 'Cancelled') return { label: 'CANCELLED', arabicLabel: 'ملغي', className: 'is-failed' }
        return { label: 'INVOICE', arabicLabel: 'فاتورة', className: 'is-default' }
      })()
      const stampLabel = escapeHtml(stampConfig.label)
      const stampArabicLabel = escapeHtml(stampConfig.arabicLabel)
      const stampClassName = stampConfig.className
      const createdAtText = escapeHtml(createdAt)
      const updatedAtText = escapeHtml(updatedAt)
      const generatedAtText = escapeHtml(generatedAt)
      const trackingUrlText = escapeHtml(trackingUrl)
      const qrCodeUrlText = escapeHtml(qrCodeUrl)
      const invoiceNumberText = escapeHtml(invoiceNumber)
      const items = Array.isArray(result.items) ? result.items : []
      const exportHasBreakdown = Number.isFinite(Number(result?.subtotal))
        && Number.isFinite(Number(result?.shipping))
        && Number.isFinite(Number(result?.vat))
      const exportDerivedSubtotal = items.reduce((sum, item) => {
        const quantity = Number(item?.quantity || 0)
        const price = Number(item?.price || 0)
        return sum + (price * quantity)
      }, 0)
      const exportSubtotal = exportHasBreakdown ? Number(result?.subtotal || 0) : exportDerivedSubtotal
      const exportShipping = exportHasBreakdown ? Number(result?.shipping || 0) : 0
      const exportVat = exportHasBreakdown ? Number(result?.vat || 0) : 0
      const exportDiscount = Number(result?.discount || 0)
      const subtotalText = escapeHtml(formatAmount(exportSubtotal))
      const discountText = exportDiscount > 0
        ? `- ${escapeHtml(formatAmount(exportDiscount))}`
        : 'لا يوجد خصم'
      const shippingText = escapeHtml(formatAmount(exportShipping))
      const vatText = escapeHtml(formatAmount(exportVat))
      const totalText = escapeHtml(formatAmount(result.total || 0))
      const invoiceRows = items.length > 0
        ? items.map((item, index) => {
            const itemName = escapeHtml(item?.name || '-')
            const quantity = Number(item?.quantity || 0)
            const unitPrice = Number(item?.price || 0)
            const lineTotal = unitPrice * quantity
            return `<tr>
              <td>${index + 1}</td>
              <td>${itemName}</td>
              <td>${quantity}</td>
              <td>${escapeHtml(formatAmount(unitPrice))}</td>
              <td>${escapeHtml(formatAmount(lineTotal))}</td>
            </tr>`
          }).join('')
        : `<tr><td colspan="5">لا توجد عناصر متاحة لهذه الفاتورة</td></tr>`

      const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${fileSafeInvoiceName}</title>
  <style>
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Tahoma,Arial,sans-serif;background:#f1f5f9;padding:24px;color:#0f172a}
    .card{position:relative;overflow:hidden;max-width:860px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:22px;box-shadow:0 16px 32px rgba(15,23,42,.08)}
    .invoice-watermark{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:0}
    .invoice-watermark img{width:520px;max-width:86%;opacity:.16;filter:none;object-fit:contain;background:transparent}
    .invoice-watermark-fallback{font-size:122px;line-height:1;opacity:.16;filter:none}
    .invoice-watermark-text{position:absolute;bottom:22px;left:50%;transform:translateX(-50%);font-size:24px;font-weight:700;opacity:.11;white-space:nowrap}
    .watermark-stamp{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-24deg);display:flex;flex-direction:column;align-items:center;gap:8px;font-size:108px;font-weight:800;letter-spacing:6px;opacity:.045;white-space:nowrap}
    .watermark-stamp small{font-size:34px;letter-spacing:0;font-weight:700}
    .watermark-stamp.is-default{color:#334155}
    .watermark-stamp.is-paid{color:#166534;opacity:.06}
    .watermark-stamp.is-pending{color:#92400e;opacity:.06}
    .watermark-stamp.is-failed{color:#991b1b;opacity:.06}
    .watermark-stamp.is-refunded{color:#7c2d12;opacity:.06}
    .brand{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;padding:14px;border:1px solid #e2e8f0;border-radius:14px;background:linear-gradient(135deg,#f8fafc,#eef2ff)}
    .brand-left{display:flex;align-items:center;gap:12px}
    .logo-media{width:44px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:12px;background:transparent;border:none;overflow:hidden;font-size:22px}
    .logo-media img{width:100%;height:100%;object-fit:contain;background:transparent}
    .brand-text h2{margin:0;font-size:18px;line-height:1.2}
    .brand-text small{display:block;color:#64748b;font-size:12px;margin-top:3px}
    .brand-domain{font-size:12px;color:#475569;background:#fff;border:1px solid #e2e8f0;padding:6px 10px;border-radius:999px}
    h1{margin:0 0 14px;font-size:24px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .item{border:1px solid #e2e8f0;border-radius:10px;padding:10px;background:#f8fafc}
    .label{display:block;color:#64748b;font-size:13px;margin-bottom:6px}
    .value{font-weight:700}
    .meta{margin-top:14px;color:#475569;font-size:13px}
    .legal-note{margin-top:10px;padding-top:10px;border-top:1px dashed #cbd5e1;color:#64748b;font-size:12px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}
    .invoice-title{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px}
    .invoice-number{font-size:13px;color:#334155;background:#eff6ff;border:1px solid #bfdbfe;border-radius:999px;padding:4px 10px;font-weight:700}
    .invoice-table{width:100%;border-collapse:collapse;margin-top:14px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden}
    .invoice-table th,.invoice-table td{border-bottom:1px solid #e2e8f0;padding:10px;font-size:13px;text-align:right}
    .invoice-table th{background:#f8fafc;color:#334155;font-weight:700}
    .invoice-table tbody tr:last-child td{border-bottom:none}
    .totals{margin-top:12px;display:grid;gap:8px}
    .total-row{display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc}
    .total-row.final{background:#eef2ff;border-color:#c7d2fe;font-weight:700}
    .qr-wrap{margin-top:14px;display:flex;gap:12px;align-items:center;justify-content:space-between;padding:10px;border:1px dashed #cbd5e1;border-radius:12px;background:#f8fafc}
    .qr-wrap img{width:110px;height:110px;border-radius:8px;border:1px solid #e2e8f0;background:#fff}
    .qr-wrap .qr-text{display:flex;flex-direction:column;gap:6px;flex:1}
    .qr-wrap .qr-text a{color:#1d4ed8;text-decoration:none;word-break:break-all;font-size:12px}
    .qr-wrap .qr-text a:hover{text-decoration:underline}
    .contact{margin-top:14px;padding-top:12px;border-top:1px dashed #cbd5e1;color:#334155;font-size:13px;line-height:1.8}
    .brand,.invoice-title,.grid,.invoice-table,.totals,.qr-wrap,.contact,.meta{position:relative;z-index:1}
    .invoice-mask-on .logo-media img,.invoice-mask-on .invoice-watermark img{mix-blend-mode:multiply}
    @media print { body{background:#fff;padding:0} .card{border:none;box-shadow:none;max-width:none;padding:8px} }
  </style>
</head>
<body>
  <section class="card ${invoiceMaskClass}">
    <div class="invoice-watermark">
      ${logoImageUrl ? `<img src="${logoImageUrl}" alt="" loading="lazy" decoding="async" />` : `<span class="invoice-watermark-fallback">${logoIcon}</span>`}
      <span class="watermark-stamp ${stampClassName}">${stampLabel}<small>${stampArabicLabel}</small></span>
      <span class="invoice-watermark-text">${storeName}</span>
    </div>
    <div class="brand">
      <div class="brand-left">
        <div class="logo-media">${logoImageUrl ? `<img src="${logoImageUrl}" alt="شعار المتجر" loading="lazy" decoding="async" />` : logoIcon}</div>
        <div class="brand-text">
          <h2>${storeName}</h2>
          <small>فاتورة احترافية</small>
        </div>
      </div>
      <span class="brand-domain">${siteDomain || '-'}</span>
    </div>
    <div class="invoice-title">
      <h1>فاتورة الطلب #${result.id}</h1>
      <span class="invoice-number">${invoiceNumberText}</span>
    </div>
    <div class="grid">
      <div class="item"><span class="label">العميل</span><span class="value">${customerName}</span></div>
      <div class="item"><span class="label">البريد الإلكتروني</span><span class="value">${customerEmail}</span></div>
      <div class="item"><span class="label">رقم الهاتف</span><span class="value">${customerPhone}</span></div>
      <div class="item"><span class="label">العنوان</span><span class="value">${customerAddress}</span></div>
      <div class="item"><span class="label">حالة الطلب</span><span class="value">${orderStatus}</span></div>
      <div class="item"><span class="label">طريقة الدفع</span><span class="value">${paymentMethod}</span></div>
      <div class="item"><span class="label">حالة الدفع</span><span class="value">${paymentStatus}</span></div>
      <div class="item"><span class="label">تاريخ الإنشاء</span><span class="value">${createdAtText}</span></div>
      <div class="item"><span class="label">آخر تحديث</span><span class="value">${updatedAtText}</span></div>
    </div>
    <table class="invoice-table" aria-label="عناصر الفاتورة">
      <thead>
        <tr>
          <th>#</th>
          <th>الصنف</th>
          <th>الكمية</th>
          <th>سعر الوحدة</th>
          <th>الإجمالي</th>
        </tr>
      </thead>
      <tbody>
        ${invoiceRows}
      </tbody>
    </table>
    <div class="totals">
      <div class="total-row"><span>المجموع الفرعي</span><strong>${subtotalText}</strong></div>
      <div class="total-row"><span>الخصم (إن وجد)</span><strong>${discountText}</strong></div>
      <div class="total-row"><span>الشحن</span><strong>${shippingText}</strong></div>
      <div class="total-row"><span>الضريبة</span><strong>${vatText}</strong></div>
      <div class="total-row final"><span>الإجمالي النهائي</span><strong>${totalText}</strong></div>
    </div>
    <div class="qr-wrap">
      <img src="${qrCodeUrlText}" alt="رمز QR لتتبع الطلب" loading="lazy" decoding="async" />
      <div class="qr-text">
        <strong>مسح سريع لتتبع الطلب</strong>
        <span>يمكنك مسح الرمز أو فتح الرابط مباشرة (قد يُطلب إدخال رقم الهاتف للتحقق):</span>
        <a href="${trackingUrlText}" target="_blank" rel="noreferrer">${trackingUrlText}</a>
      </div>
    </div>
    <div class="contact">
      <div><strong>الهاتف:</strong> ${contactPhone}</div>
      <div><strong>الإيميل:</strong> ${contactEmail}</div>
      <div><strong>العنوان:</strong> ${contactAddress}</div>
      <div><strong>ساعات العمل:</strong> ${businessHours}</div>
    </div>
    <p class="meta">تم إنشاء هذه الفاتورة من صفحة تتبع الطلب في ${storeName}.</p>
    <div class="legal-note">
      <span>الاسم القانوني: ${businessLegalName}</span>
      <span>الرقم الضريبي: ${vatRegistrationNumber}</span>
      <span>السجل التجاري: ${commercialRegistrationNumber}</span>
      <span>رقم التتبع: ${trackingUrlText}</span>
      <span>تاريخ الإصدار: ${generatedAtText}</span>
    </div>
  </section>
</body>
</html>`

      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      const blobUrl = URL.createObjectURL(blob)

      printWindow.onload = () => {
        setTimeout(() => {
          try {
            printWindow.focus()
            printWindow.print()
          } finally {
            URL.revokeObjectURL(blobUrl)
          }
        }, 180)
      }

      printWindow.location.href = blobUrl
      showToast('success', 'تم تجهيز الفاتورة للطباعة')
    } finally {
      setIsExportingPdf(false)
    }
  }

  useEffect(() => {
    try {
      localStorage.setItem(
        TRACKING_PREFS_KEY,
        JSON.stringify({ autoRefreshEnabled, notifyOnChange })
      )
    } catch {
      // ignore storage issues
    }
  }, [autoRefreshEnabled, notifyOnChange])

  useEffect(() => {
    if (!result || !autoRefreshEnabled) return
    if (isTerminalStatus(result.status)) return

    const intervalId = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      fetchTrackingResult({
        orderId: sanitizedOrderId,
        phone: sanitizedPhone,
        silent: true,
        clearPrevious: false
      })
    }, 30000)

    return () => clearInterval(intervalId)
  }, [result, autoRefreshEnabled, fetchTrackingResult, sanitizedOrderId, sanitizedPhone, isTerminalStatus])

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) {
        clearTimeout(noticeTimerRef.current)
      }
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current)
      }
      clearManagedTimer(orderIdCopiedTimerRef)
      clearManagedTimer(trackLinkSharedTimerRef)
    }
  }, [])

  return (
    <main className="container customer-page-shell">
      <Toast toast={toast} onClose={closeToast} />
      <div className="header-section customer-page-header">
        <h1>تتبع الطلب</h1>
        <p>أدخل رقم الطلب ورقم الهاتف المرتبط بالطلب للحصول على أحدث حالة.</p>
        <div className="track-order-intro-note">
          <strong>ملاحظة:</strong> إذا وصلت من صفحة نجاح الطلب وكان رقم الطلب جاهز، يكفي إدخال رقم الهاتف فقط ثم اضغط عرض حالة الطلب.
        </div>
      </div>

      <form onSubmit={onSubmit} className="form-container customer-card customer-form-card" aria-busy={loading}>
        <div className="customer-form-grid">
          <div className="form-group">
            <label htmlFor="orderId">رقم الطلب</label>
            <input
              id="orderId"
              name="orderId"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={form.orderId}
              onChange={onChange}
              required
              dir="ltr"
              disabled={loading}
            />
            {orderIdValidationError && <p className="error" role="alert">{orderIdValidationError}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="phone">رقم الهاتف</label>
            <input
              id="phone"
              name="phone"
              type="tel"
              value={form.phone}
              onChange={onChange}
              required
              dir="ltr"
              disabled={loading}
            />
          </div>

          {otpRequested && !otpAccessToken && (
            <div className="form-group">
              <label htmlFor="otpCode">رمز التحقق (6 أرقام)</label>
              <input
                id="otpCode"
                name="otpCode"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={otpCode}
                onChange={(e) => {
                  setOtpCode(digitsOnly(e.target.value || '').slice(0, 6))
                  setError('')
                }}
                required
                dir="ltr"
                disabled={loading}
              />
              <small className="checkout-helper-note">أدخل الرمز المرسل إلى الهاتف لإكمال التتبع.</small>
            </div>
          )}
        </div>

        {otpAccessToken && (
          <p className="checkout-helper-note" role="status">✅ تم التحقق. يمكنك الآن متابعة حالة الطلب بأمان.</p>
        )}

        <div className="customer-actions-row">
          <button type="submit" className="btn btn-primary" disabled={!canSubmit} aria-disabled={!canSubmit}>
            {submitLabel}
          </button>
          <button type="button" className="btn btn-secondary" onClick={resetTracking} disabled={loading && refreshing}>
            إعادة تعيين
          </button>
        </div>
      </form>

      {error && <p className="error" role="alert">{error}</p>}

      {result && (
        <div className="form-container customer-card customer-result-card">
          <div className="track-order-result-head">
            <h3 className="customer-result-title">نتيجة التتبع</h3>
            <div className="track-order-meta">
              <div className="track-order-actions-inline">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => fetchTrackingResult({ orderId: sanitizedOrderId, phone: sanitizedPhone, silent: true, clearPrevious: false })}
                  disabled={refreshing || loading}
                >
                  {refreshing ? 'جاري التحديث...' : 'تحديث الآن'}
                </button>
                <button
                  type="button"
                  className={`btn btn-secondary track-order-copy-btn${orderIdCopied ? ' success' : ''}`}
                  onClick={handleCopyOrderId}
                >
                  {orderIdCopied ? '✅ تم نسخ رقم الطلب' : '📋 نسخ رقم الطلب'}
                </button>
                <button
                  type="button"
                  className={`btn btn-secondary track-order-copy-btn${trackLinkShared ? ' success' : ''}`}
                  onClick={handleShareTrackingLink}
                >
                  {trackLinkShared ? '✅ تمت مشاركة الرابط' : '📤 مشاركة رابط التتبع'}
                </button>
                <button
                  type="button"
                  className={`btn btn-secondary track-order-copy-btn${summaryCopied ? ' success' : ''}`}
                  onClick={handleCopyStatusSummary}
                  disabled={isCopyingSummary}
                >
                  {isCopyingSummary ? 'جاري النسخ...' : summaryCopied ? '✅ تم النسخ' : '📋 نسخ ملخص الحالة'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleExportPdf}
                  disabled={isExportingPdf}
                >
                  {isExportingPdf ? 'جاري التحضير...' : '🧾 تصدير الفاتورة PDF'}
                </button>
              </div>
              <label className="track-order-auto">
                <input
                  type="checkbox"
                  checked={autoRefreshEnabled}
                  onChange={(event) => setAutoRefreshEnabled(event.target.checked)}
                />
                <span>تحديث تلقائي كل 30 ثانية</span>
              </label>
              <label className="track-order-auto">
                <input
                  type="checkbox"
                  checked={notifyOnChange}
                  onChange={(event) => setNotifyOnChange(event.target.checked)}
                />
                <span>تنبيه عند تغيّر الحالة</span>
              </label>
              {lastUpdatedAt && (
                <small className="track-order-updated-at">آخر تحديث: {formatTime(lastUpdatedAt, { locale })}</small>
              )}
              {result && isTerminalStatus(result.status) && (
                <small className="track-order-updated-at">التحديث التلقائي متوقف لأن حالة الطلب نهائية.</small>
              )}
              {statusNotice && (
                <p className="track-order-status-notice" role="status" aria-live="polite">{statusNotice}</p>
              )}
            </div>
          </div>
          <div className="customer-result-grid">
            <div className="result-item">
              <span>رقم الطلب</span>
              <strong>#{result.id}</strong>
            </div>
            <div className="result-item">
              <span>العميل</span>
              <strong>{result.customerName}</strong>
            </div>
            <div className="result-item">
              <span>حالة الطلب</span>
              <strong className={orderBadgeClass(result.status)}>{statusLabel(result.status)}</strong>
            </div>
            <div className="result-item">
              <span>طريقة الدفع</span>
              <strong>{paymentMethodText(result.paymentMethod)}</strong>
            </div>
            <div className="result-item">
              <span>حالة الدفع</span>
              <strong className={orderBadgeClass(result.paymentStatus)}>{paymentLabel(result.paymentStatus)}</strong>
            </div>
            <div className="result-item">
              <span>الإجمالي</span>
              <strong>{formatAmount(result.total || 0)}</strong>
            </div>
            <div className="result-item">
              <span>تاريخ الإنشاء</span>
              <strong>{formatDateTime(result.createdAt, { locale })}</strong>
            </div>
          </div>

          <div className="checkout-card-modern">
            <h3>تفاصيل الفاتورة</h3>
            {invoiceDetailsMissing && (
              <p className="checkout-helper-note">بعض تفاصيل الفاتورة غير مكتملة، يتم عرض البيانات المتاحة فقط.</p>
            )}
            <div className="checkout-items-list">
              {(Array.isArray(result.items) ? result.items : []).length > 0 ? (
                result.items.map((item) => {
                  const quantity = Number(item?.quantity || 0)
                  const unitPrice = Number(item?.price || 0)
                  const lineTotal = unitPrice * quantity
                  return (
                    <div className="checkout-item-row" key={item?.id || `${item?.name}-${item?.perfumeId || 'x'}`}>
                      <div className="checkout-item-main">
                        <strong>{item?.name || '-'}</strong>
                        <span>الكمية: {quantity} × {formatAmount(unitPrice)}</span>
                      </div>
                      <strong>{formatAmount(lineTotal)}</strong>
                    </div>
                  )
                })
              ) : (
                <p className="checkout-helper-note">لا توجد عناصر مفصلة متاحة لهذه الفاتورة.</p>
              )}
            </div>

            <div className="summary-row-modern">
              <span>المجموع الفرعي</span>
              <strong>{formatAmount(displaySubtotal)}</strong>
            </div>
            <div className="summary-row-modern">
              <span>الخصم</span>
              <strong>{displayDiscount > 0 ? `- ${formatAmount(displayDiscount)}` : 'لا يوجد خصم'}</strong>
            </div>
            <div className="summary-row-modern">
              <span>الشحن</span>
              <strong>{formatAmount(displayShipping)}</strong>
            </div>
            <div className="summary-row-modern">
              <span>الضريبة</span>
              <strong>{formatAmount(displayVat)}</strong>
            </div>
            <div className="summary-divider-modern"></div>
            <div className="summary-row-modern total">
              <span>الإجمالي النهائي</span>
              <strong>{formatAmount(result.total || 0)}</strong>
            </div>
          </div>
        </div>
      )}

      <div className="customer-footer-actions">
        <Link href="/shop" className="btn btn-secondary">العودة للمتجر</Link>
      </div>
    </main>
  )
}
