"use client"

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { fetchCustomerOrders, fetchStoreSettings, requestCustomerOtp, verifyCustomerOtp } from '@/lib/api'
import { TOAST_AUTO_HIDE_MS } from '@/lib/toast'
import { shareOrCopyTrackingUrl } from '@/lib/tracking'
import { clearManagedTimer, setTemporaryState } from '@/lib/uiTimers'
import { orderBadgeClass, paymentLabel, paymentMethodLabel, statusLabel } from '@/lib/orderPresentation'
import Toast from '@/components/Toast'
import { useToast } from '@/hooks/useToast'
import { digitsOnly, formatDate, formatDateTime, formatMoney, getUserLocale } from '@/lib/intl'

const CUSTOMER_PHONE_KEY = 'customerPhoneLookup'

export default function MyOrdersPage() {
  const copiedOrderIdTimerRef = useRef(null)
  const sharedOrderIdTimerRef = useRef(null)
  const [phone, setPhone] = useState('')
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasSearched, setHasSearched] = useState(false)
  const [otpRequested, setOtpRequested] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [otpAccessToken, setOtpAccessToken] = useState('')
  const [otpExpiresAt, setOtpExpiresAt] = useState(null)
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
  const [copiedOrderId, setCopiedOrderId] = useState('')
  const [sharedOrderId, setSharedOrderId] = useState('')
  const [exportingInvoiceId, setExportingInvoiceId] = useState('')
  const { toast, showToast, closeToast } = useToast()
  const locale = getUserLocale('ar-SA')
  const formatAmount = (value) => formatMoney(value, currencySymbol, { locale })

  useEffect(() => {
    try {
      const savedPhone = localStorage.getItem(CUSTOMER_PHONE_KEY)
      if (savedPhone) {
        setPhone(savedPhone)
      }
    } catch {
      // ignore localStorage errors
    }

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

  useEffect(() => {
    return () => {
      clearManagedTimer(copiedOrderIdTimerRef)
      clearManagedTimer(sharedOrderIdTimerRef)
    }
  }, [])

  const onSubmit = async (e) => {
    e.preventDefault()
    const sanitizedPhone = digitsOnly(phone || '').trim()
    if (!sanitizedPhone) return

    setPhone(sanitizedPhone)
    try {
      localStorage.setItem(CUSTOMER_PHONE_KEY, sanitizedPhone)
    } catch {
      // ignore localStorage errors
    }

    setLoading(true)
    setError('')
    let accessToken = otpAccessToken

    try {
      if (!accessToken) {
        if (!otpRequested) {
          const response = await requestCustomerOtp(sanitizedPhone)
          setOtpRequested(true)
          setOtpExpiresAt(response?.expiresAt || null)
          setOtpCode('')
          showToast('success', 'تم إرسال رمز التحقق إلى رقم الهاتف.')
          if (response?.devOtpCode) {
            showToast('info', `رمز التطوير: ${response.devOtpCode}`)
          }
          return
        }

        const normalizedOtpCode = digitsOnly(otpCode || '').trim()
        if (!normalizedOtpCode || normalizedOtpCode.length !== 6) {
          setError('أدخل رمز التحقق المكوّن من 6 أرقام.')
          return
        }

        const verifyResponse = await verifyCustomerOtp(sanitizedPhone, normalizedOtpCode)
        accessToken = String(verifyResponse?.accessToken || '')
        setOtpAccessToken(accessToken)
        setOtpExpiresAt(verifyResponse?.expiresAt || otpExpiresAt)
        showToast('success', 'تم التحقق بنجاح.')
      }

      if (!accessToken) {
        setError('تعذر إكمال التحقق. حاول مرة أخرى.')
        return
      }

      setOrders([])
      setHasSearched(true)
      const data = await fetchCustomerOrders(sanitizedPhone, accessToken)
      setOrders(data || [])
    } catch (err) {
      const statusCode = err?.response?.status
      if (statusCode === 401) {
        setOtpAccessToken('')
        setOtpRequested(false)
        setOtpCode('')
        setOtpExpiresAt(null)
        setError('انتهت صلاحية التحقق. اطلب رمزًا جديدًا ثم حاول مرة أخرى.')
      } else {
        setError('تعذر تحميل الطلبات، تأكد من رقم الهاتف ورمز التحقق.')
      }
    } finally {
      setLoading(false)
    }
  }

  const resetLookup = () => {
    const hadState = Boolean(phone || orders.length || error || hasSearched)
    setPhone('')
    setOrders([])
    setError('')
    setHasSearched(false)
    setOtpRequested(false)
    setOtpCode('')
    setOtpAccessToken('')
    setOtpExpiresAt(null)
    setCopiedOrderId('')
    setSharedOrderId('')
    if (hadState) {
      showToast('info', 'تمت إعادة تعيين البحث')
    }
  }

  const copyOrderId = async (id) => {
    if (!id || typeof navigator === 'undefined' || !navigator.clipboard) return
    try {
      await navigator.clipboard.writeText(String(id))
      setTemporaryState({
        timerRef: copiedOrderIdTimerRef,
        setState: setCopiedOrderId,
        activeValue: String(id),
        resetValue: '',
        duration: 1600,
      })
      showToast('success', `تم نسخ رقم الطلب #${id}`)
    } catch {
      setCopiedOrderId('')
      showToast('error', 'تعذر نسخ رقم الطلب')
    }
  }

  const shareTrackingLink = async (id) => {
    if (!id) return

    try {
      const shared = await shareOrCopyTrackingUrl({
        orderId: id,
        title: `تتبع الطلب #${id}`,
        text: 'رابط تتبع الطلب'
      })
      if (!shared) return

      setTemporaryState({
        timerRef: sharedOrderIdTimerRef,
        setState: setSharedOrderId,
        activeValue: String(id),
        resetValue: '',
        duration: 1600,
      })
      showToast('success', `تمت مشاركة رابط الطلب #${id}`)
    } catch {
      setSharedOrderId('')
      showToast('error', 'تعذر مشاركة رابط الطلب')
    }
  }

  const escapeHtml = (value) => {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;')
  }

  const exportInvoicePdf = (order) => {
    if (!order?.id || exportingInvoiceId) return

    setExportingInvoiceId(String(order.id))
    try {
      const printWindow = window.open('', '_blank', 'width=900,height=700')
      if (!printWindow) {
        showToast('error', 'تعذر فتح نافذة الطباعة')
        return
      }

      const invoiceNumber = `INV-${order.id}`
      const fileSafeInvoiceName = `invoice-${order.id}`
      const orderDate = formatDateTime(order.createdAt, { locale })
      const generatedAt = formatDateTime(new Date(), { locale })
      const invoiceMaskClass = storeProfile.invoiceLogoAutoMask ? 'invoice-mask-on' : 'invoice-mask-off'
      const paymentMethodText = paymentMethodLabel(order.paymentMethod)
      const stampConfig = (() => {
        if (order.paymentStatus === 'Paid') return { label: 'PAID', arabicLabel: 'مدفوع', className: 'is-paid' }
        if (order.paymentStatus === 'Pending') return { label: 'PENDING', arabicLabel: 'بانتظار الدفع', className: 'is-pending' }
        if (order.paymentStatus === 'Failed') return { label: 'FAILED', arabicLabel: 'فشل الدفع', className: 'is-failed' }
        if (order.paymentStatus === 'Refunded') return { label: 'REFUNDED', arabicLabel: 'تم الاسترجاع', className: 'is-refunded' }
        if (order.status === 'Cancelled') return { label: 'CANCELLED', arabicLabel: 'ملغي', className: 'is-failed' }
        return { label: 'INVOICE', arabicLabel: 'فاتورة', className: 'is-default' }
      })()
      const stampLabel = escapeHtml(stampConfig.label)
      const stampArabicLabel = escapeHtml(stampConfig.arabicLabel)
      const stampClassName = stampConfig.className
      const siteDomain = escapeHtml(typeof window !== 'undefined' ? window.location.host : '')
      const logoImageUrl = escapeHtml(storeProfile.logoImageUrl || '')
      const businessLegalName = escapeHtml(storeProfile.businessLegalName || storeProfile.storeName)
      const vatRegistrationNumber = escapeHtml(storeProfile.vatRegistrationNumber || '-')
      const commercialRegistrationNumber = escapeHtml(storeProfile.commercialRegistrationNumber || '-')
      const items = Array.isArray(order.items) ? order.items : []
      const discountAmount = Number(order?.discount || 0)
      const discountText = discountAmount > 0
        ? `- ${escapeHtml(formatAmount(discountAmount))}`
        : 'لا يوجد خصم'

      const invoiceRows = items.length > 0
        ? items.map((item, index) => {
            const quantity = Number(item?.quantity || 0)
            const price = Number(item?.price || 0)
            const lineTotal = price * quantity
            return `<tr>
              <td>${index + 1}</td>
              <td>${escapeHtml(item?.name || '-')}</td>
              <td>${quantity}</td>
              <td>${escapeHtml(formatAmount(price))}</td>
              <td>${escapeHtml(formatAmount(lineTotal))}</td>
            </tr>`
          }).join('')
        : '<tr><td colspan="5">لا توجد عناصر متاحة لهذه الفاتورة</td></tr>'

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
    .invoice-title{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px}
    h1{margin:0;font-size:24px}
    .invoice-number{font-size:13px;color:#334155;background:#eff6ff;border:1px solid #bfdbfe;border-radius:999px;padding:4px 10px;font-weight:700}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .item{border:1px solid #e2e8f0;border-radius:10px;padding:10px;background:#f8fafc}
    .label{display:block;color:#64748b;font-size:13px;margin-bottom:6px}
    .value{font-weight:700}
    .invoice-table{width:100%;border-collapse:collapse;margin-top:14px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden}
    .invoice-table th,.invoice-table td{border-bottom:1px solid #e2e8f0;padding:10px;font-size:13px;text-align:right}
    .invoice-table th{background:#f8fafc;color:#334155;font-weight:700}
    .invoice-table tbody tr:last-child td{border-bottom:none}
    .totals{margin-top:12px;display:grid;gap:8px}
    .total-row{display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc}
    .total-row.final{background:#eef2ff;border-color:#c7d2fe;font-weight:700}
    .contact{margin-top:14px;padding-top:12px;border-top:1px dashed #cbd5e1;color:#334155;font-size:13px;line-height:1.8}
    .meta{margin-top:12px;color:#475569;font-size:13px}
    .legal-note{margin-top:10px;padding-top:10px;border-top:1px dashed #cbd5e1;color:#64748b;font-size:12px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}
    .brand,.invoice-title,.grid,.invoice-table,.totals,.contact{position:relative;z-index:1}
    .invoice-mask-on .logo-media img,.invoice-mask-on .invoice-watermark img{mix-blend-mode:multiply}
    @media print { body{background:#fff;padding:0} .card{border:none;box-shadow:none;max-width:none;padding:8px} }
  </style>
</head>
<body>
  <section class="card ${invoiceMaskClass}">
    <div class="invoice-watermark">
      ${logoImageUrl ? `<img src="${logoImageUrl}" alt="" loading="lazy" decoding="async" />` : `<span class="invoice-watermark-fallback">${escapeHtml(storeProfile.logoIcon)}</span>`}
      <span class="watermark-stamp ${stampClassName}">${stampLabel}<small>${stampArabicLabel}</small></span>
      <span class="invoice-watermark-text">${escapeHtml(storeProfile.storeName)}</span>
    </div>
    <div class="brand">
      <div class="brand-left">
        <div class="logo-media">${logoImageUrl ? `<img src="${logoImageUrl}" alt="شعار المتجر" loading="lazy" decoding="async" />` : escapeHtml(storeProfile.logoIcon)}</div>
        <div class="brand-text">
          <h2>${escapeHtml(storeProfile.storeName)}</h2>
          <small>فاتورة احترافية</small>
        </div>
      </div>
      <span class="brand-domain">${siteDomain || '-'}</span>
    </div>
    <div class="invoice-title">
      <h1>فاتورة الطلب #${order.id}</h1>
      <span class="invoice-number">${escapeHtml(invoiceNumber)}</span>
    </div>
    <div class="grid">
      <div class="item"><span class="label">العميل</span><span class="value">${escapeHtml(order.customerName || '-')}</span></div>
      <div class="item"><span class="label">البريد الإلكتروني</span><span class="value">${escapeHtml(order.email || '-')}</span></div>
      <div class="item"><span class="label">رقم الهاتف</span><span class="value">${escapeHtml(order.phone || '-')}</span></div>
      <div class="item"><span class="label">العنوان</span><span class="value">${escapeHtml(order.address || '-')}</span></div>
      <div class="item"><span class="label">طريقة الدفع</span><span class="value">${escapeHtml(paymentMethodText)}</span></div>
      <div class="item"><span class="label">حالة الطلب</span><span class="value">${escapeHtml(statusLabel(order.status))}</span></div>
      <div class="item"><span class="label">حالة الدفع</span><span class="value">${escapeHtml(paymentLabel(order.paymentStatus))}</span></div>
      <div class="item"><span class="label">تاريخ الإنشاء</span><span class="value">${escapeHtml(orderDate)}</span></div>
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
      <tbody>${invoiceRows}</tbody>
    </table>

    <div class="totals">
      <div class="total-row"><span>المجموع الفرعي</span><strong>${escapeHtml(formatAmount(order.subtotal || 0))}</strong></div>
      <div class="total-row"><span>الخصم (إن وجد)</span><strong>${discountText}</strong></div>
      <div class="total-row"><span>الشحن</span><strong>${escapeHtml(formatAmount(order.shipping || 0))}</strong></div>
      <div class="total-row"><span>الضريبة</span><strong>${escapeHtml(formatAmount(order.vat || 0))}</strong></div>
      <div class="total-row final"><span>الإجمالي النهائي</span><strong>${escapeHtml(formatAmount(order.total || 0))}</strong></div>
    </div>

    <div class="contact">
      <div><strong>الهاتف:</strong> ${escapeHtml(storeProfile.contactPhone)}</div>
      <div><strong>الإيميل:</strong> ${escapeHtml(storeProfile.contactEmail)}</div>
      <div><strong>العنوان:</strong> ${escapeHtml(storeProfile.contactAddress)}</div>
      <div><strong>ساعات العمل:</strong> ${escapeHtml(storeProfile.businessHours)}</div>
    </div>
    <p class="meta">تم إنشاء هذه الفاتورة من صفحة طلباتي في ${escapeHtml(storeProfile.storeName)}.</p>
    <div class="legal-note">
      <span>الاسم القانوني: ${businessLegalName}</span>
      <span>الرقم الضريبي: ${vatRegistrationNumber}</span>
      <span>السجل التجاري: ${commercialRegistrationNumber}</span>
      <span>الموقع: ${siteDomain || '-'}</span>
      <span>تاريخ الإصدار: ${escapeHtml(generatedAt)}</span>
    </div>
  </section>
</body>
</html>`

}
