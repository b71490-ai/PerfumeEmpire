"use client"

import { useEffect, useMemo, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import Button from '@/components/Button'
import Accordion from '@/components/Accordion'
import { useAdmin } from '@/context/AdminContext'
import { fetchStoreSettings, updateStoreSettings } from '@/lib/api'

export default function AdminSettingsPage() {
  const { isAdmin, loading, canManageSettings } = useAdmin()
  const router = useRouter()
  const isDataImage = (value) => typeof value === 'string' && value.startsWith('data:image/')
  const [form, setForm] = useState({
    storeName: '',
    storeTagline: '',
    logoText: '',
    logoIcon: '',
    logoImageUrl: '',
    logoBackgroundColor: '#ffffff',
    primaryColor: '#b8860b',
    buttonShape: 'rounded',
    invoiceLogoAutoMask: true,
    contactPhone: '',
    contactEmail: '',
    contactWhatsapp: '',
    contactInstagram: '',
    contactAddress: '',
    businessHours: '',
    seoDescription: '',
    seoKeywords: '',
    maintenanceMode: false,
    maintenanceMessage: '',
    announcementEnabled: false,
    announcementText: '',
    announcementLink: '',
    currencyCode: 'SAR',
    currencySymbol: 'ر.س',
    taxRatePercent: 15,
    businessLegalName: 'مؤسسة عطور الإمبراطورية',
    vatRegistrationNumber: '',
    commercialRegistrationNumber: '',
    paymentEnabled: false,
    codEnabled: true,
    paymentProvider: 'none',
    paymentSandboxMode: true,
    paymentPublicKey: '',
    paymentSecretKey: '',
    shippingFlatFee: 50,
    freeShippingThreshold: 500,
    shippingMainCitiesMinDays: 1,
    shippingMainCitiesMaxDays: 3,
    shippingOtherCitiesMinDays: 3,
    shippingOtherCitiesMaxDays: 7,
    returnWindowDays: 14,
    shippingPolicyText: '',
    returnsPolicyText: '',
    privacyPolicyText: '',
    notificationOrderCreatedTemplate: '',
    notificationOrderShippedTemplate: '',
    notificationOrderDeliveredTemplate: '',
    googleAnalyticsId: '',
    metaPixelId: '',
    tagManagerId: '',
    mediaProvider: 'local',
    mediaBaseUrl: '',
    mediaApiKey: ''
  })
  const [pageLoading, setPageLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveBarScrolled, setSaveBarScrolled] = useState(false)
  const [toast, setToast] = useState(null)
  const [saveMessage, setSaveMessage] = useState(null)
  const [showPaymentPublicKey, setShowPaymentPublicKey] = useState(false)
  const [showPaymentSecretKey, setShowPaymentSecretKey] = useState(false)
  const initialFormRef = useRef(null)

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    if (loading) return
    if (!isAdmin) {
      router.push('/admin/login')
      return
    }
    if (!canManageSettings) {
      router.push('/admin/dashboard')
    }
  }, [loading, isAdmin, canManageSettings, router])

  useEffect(() => {
    const load = async () => {
      if (!isAdmin || !canManageSettings) return
      try {
        const data = await fetchStoreSettings()
        setForm({
          storeName: data?.storeName || '',
          storeTagline: data?.storeTagline || '',
          logoText: data?.logoText || '',
          logoIcon: data?.logoIcon || '',
          logoImageUrl: data?.logoImageUrl || '',
          logoBackgroundColor: data?.logoBackgroundColor || '#ffffff',
          invoiceLogoAutoMask: data?.invoiceLogoAutoMask !== false,
          contactPhone: data?.contactPhone || '',
          contactEmail: data?.contactEmail || '',
          contactWhatsapp: data?.contactWhatsapp || '',
          contactInstagram: data?.contactInstagram || '',
          contactAddress: data?.contactAddress || '',
          businessHours: data?.businessHours || '',
          seoDescription: data?.seoDescription || '',
          seoKeywords: data?.seoKeywords || '',
          maintenanceMode: Boolean(data?.maintenanceMode),
          maintenanceMessage: data?.maintenanceMessage || '',
          announcementEnabled: Boolean(data?.announcementEnabled),
          announcementText: data?.announcementText || '',
          announcementLink: data?.announcementLink || '',
          currencyCode: data?.currencyCode || 'SAR',
          currencySymbol: data?.currencySymbol || 'ر.س',
          taxRatePercent: Number(data?.taxRatePercent ?? 15),
          businessLegalName: data?.businessLegalName || 'مؤسسة عطور الإمبراطورية',
          vatRegistrationNumber: data?.vatRegistrationNumber || '',
          commercialRegistrationNumber: data?.commercialRegistrationNumber || '',
          paymentEnabled: Boolean(data?.paymentEnabled),
          codEnabled: data?.codEnabled !== false,
          paymentProvider: data?.paymentProvider || 'none',
          paymentSandboxMode: data?.paymentSandboxMode !== false,
          paymentPublicKey: data?.paymentPublicKey || '',
          paymentSecretKey: data?.paymentSecretKey || '',
          shippingFlatFee: Number(data?.shippingFlatFee ?? 50),
          freeShippingThreshold: Number(data?.freeShippingThreshold ?? 500),
          shippingMainCitiesMinDays: Number(data?.shippingMainCitiesMinDays ?? 1),
          shippingMainCitiesMaxDays: Number(data?.shippingMainCitiesMaxDays ?? 3),
          shippingOtherCitiesMinDays: Number(data?.shippingOtherCitiesMinDays ?? 3),
          shippingOtherCitiesMaxDays: Number(data?.shippingOtherCitiesMaxDays ?? 7),
          returnWindowDays: Number(data?.returnWindowDays ?? 14),
          shippingPolicyText: data?.shippingPolicyText || '',
          returnsPolicyText: data?.returnsPolicyText || '',
          privacyPolicyText: data?.privacyPolicyText || '',
          notificationOrderCreatedTemplate: data?.notificationOrderCreatedTemplate || '',
          notificationOrderShippedTemplate: data?.notificationOrderShippedTemplate || '',
          notificationOrderDeliveredTemplate: data?.notificationOrderDeliveredTemplate || '',
          googleAnalyticsId: data?.googleAnalyticsId || '',
          metaPixelId: data?.metaPixelId || '',
          tagManagerId: data?.tagManagerId || '',
          mediaProvider: data?.mediaProvider || 'local',
          mediaBaseUrl: data?.mediaBaseUrl || '',
          mediaApiKey: data?.mediaApiKey || ''
        })
        // keep an initial snapshot for dirty-check
        try { initialFormRef.current = JSON.parse(JSON.stringify({
          storeName: data?.storeName || '',
          storeTagline: data?.storeTagline || '',
          logoText: data?.logoText || '',
          logoIcon: data?.logoIcon || '',
          logoImageUrl: data?.logoImageUrl || '',
          logoBackgroundColor: data?.logoBackgroundColor || '#ffffff',
          invoiceLogoAutoMask: data?.invoiceLogoAutoMask !== false,
          contactPhone: data?.contactPhone || '',
          contactEmail: data?.contactEmail || '',
          contactWhatsapp: data?.contactWhatsapp || '',
          contactInstagram: data?.contactInstagram || '',
          contactAddress: data?.contactAddress || '',
          businessHours: data?.businessHours || '',
          seoDescription: data?.seoDescription || '',
          seoKeywords: data?.seoKeywords || '',
          maintenanceMode: Boolean(data?.maintenanceMode),
          maintenanceMessage: data?.maintenanceMessage || '',
          announcementEnabled: Boolean(data?.announcementEnabled),
          announcementText: data?.announcementText || '',
          announcementLink: data?.announcementLink || '',
          currencyCode: data?.currencyCode || 'SAR',
          currencySymbol: data?.currencySymbol || 'ر.س',
          taxRatePercent: Number(data?.taxRatePercent ?? 15),
          businessLegalName: data?.businessLegalName || 'مؤسسة عطور الإمبراطورية',
          vatRegistrationNumber: data?.vatRegistrationNumber || '',
          commercialRegistrationNumber: data?.commercialRegistrationNumber || '',
          paymentEnabled: Boolean(data?.paymentEnabled),
          codEnabled: Boolean(data?.codEnabled),
          paymentProvider: data?.paymentProvider || 'none',
          paymentSandboxMode: data?.paymentSandboxMode !== false,
          paymentPublicKey: data?.paymentPublicKey || '',
          paymentSecretKey: data?.paymentSecretKey || '',
          shippingFlatFee: Number(data?.shippingFlatFee ?? 50),
          freeShippingThreshold: Number(data?.freeShippingThreshold ?? 500),
          shippingMainCitiesMinDays: Number(data?.shippingMainCitiesMinDays ?? 1),
          shippingMainCitiesMaxDays: Number(data?.shippingMainCitiesMaxDays ?? 3),
          shippingOtherCitiesMinDays: Number(data?.shippingOtherCitiesMinDays ?? 3),
          shippingOtherCitiesMaxDays: Number(data?.shippingOtherCitiesMaxDays ?? 7),
          returnWindowDays: Number(data?.returnWindowDays ?? 14),
          shippingPolicyText: data?.shippingPolicyText || '',
          returnsPolicyText: data?.returnsPolicyText || '',
          privacyPolicyText: data?.privacyPolicyText || '',
          notificationOrderCreatedTemplate: data?.notificationOrderCreatedTemplate || '',
          notificationOrderShippedTemplate: data?.notificationOrderShippedTemplate || '',
          notificationOrderDeliveredTemplate: data?.notificationOrderDeliveredTemplate || '',
          googleAnalyticsId: data?.googleAnalyticsId || '',
          metaPixelId: data?.metaPixelId || '',
          tagManagerId: data?.tagManagerId || '',
          mediaProvider: data?.mediaProvider || 'local',
          mediaBaseUrl: data?.mediaBaseUrl || '',
          mediaApiKey: data?.mediaApiKey || '',
          primaryColor: data?.primaryColor || '#b8860b',
          buttonShape: data?.buttonShape || 'rounded'
        })) } catch (e) { initialFormRef.current = null }
      } catch (e) {
        console.error(e)
      } finally {
        setPageLoading(false)
      }
    }
    load()
  }, [isAdmin, canManageSettings])

  // Enhance inputs: create floating labels by moving label text into container dataset
  useEffect(() => {
    try {
      const root = document.querySelector('.admin-settings-page .add-form')
      if (!root) return
      const labels = Array.from(root.querySelectorAll('label'))
      labels.forEach((label) => {
        const next = label.nextElementSibling
        if (!next || !next.classList.contains('input-with-icon')) return
        const text = label.textContent.trim()
        // set data-label for CSS pseudo-element
        next.dataset.label = text
        // mark label visually hidden but keep accessible
        label.classList.add('sr-only')
        // attach aria-label to the real control
        const control = next.querySelector('input,textarea,select')
        if (control) {
          control.setAttribute('aria-label', text)
          // reflect current value state
          if (String(control.value || '').trim()) next.classList.add('has-value')
          const handler = () => {
            if (String(control.value || '').trim()) next.classList.add('has-value')
            else next.classList.remove('has-value')
          }
          control.addEventListener('input', handler)
        }
      })
    } catch (e) {
      // noop
    }
  }, [pageLoading])

  const onChange = (e) => {
    const { name, value } = e.target
    if (
      name === 'maintenanceMode' ||
      name === 'announcementEnabled' ||
      name === 'paymentEnabled' ||
      name === 'codEnabled' ||
      name === 'paymentSandboxMode' ||
      name === 'invoiceLogoAutoMask'
    ) {
      setForm((prev) => ({ ...prev, [name]: value === 'true' }))
      return
    }

    if (
      name === 'taxRatePercent' ||
      name === 'shippingFlatFee' ||
      name === 'freeShippingThreshold' ||
      name === 'shippingMainCitiesMinDays' ||
      name === 'shippingMainCitiesMaxDays' ||
      name === 'shippingOtherCitiesMinDays' ||
      name === 'shippingOtherCitiesMaxDays' ||
      name === 'returnWindowDays'
    ) {
      setForm((prev) => ({ ...prev, [name]: Number(value) }))
      return
    }

    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const onLogoFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      showToast('الملف المختار ليس صورة', 'error')
      return
    }

    // Upload selected image to backend and store returned URL (avoid storing base64 data URIs)
    ;(async () => {
      try {
        setSaving(true)
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch('/admin/media/upload', { method: 'POST', body: fd })
        if (!res.ok) {
          showToast('فشل رفع الصورة', 'error')
          return
        }
        const body = await res.json()
        if (body && body.url) {
          setForm((prev) => ({ ...prev, logoImageUrl: String(body.url) }))
          showToast('تم رفع الصورة')
        }
      } catch (err) {
        console.error(err)
        showToast('خطأ أثناء رفع الصورة', 'error')
      } finally {
        setSaving(false)
      }
    })()
  }

  const onSave = async (e) => {
    e.preventDefault()

    if (form.shippingMainCitiesMinDays > form.shippingMainCitiesMaxDays) {
      showToast('مدة الشحن للمدن الرئيسية غير صحيحة (من أكبر من إلى)', 'error')
      return
    }

    if (form.shippingOtherCitiesMinDays > form.shippingOtherCitiesMaxDays) {
      showToast('مدة الشحن للمناطق الأخرى غير صحيحة (من أكبر من إلى)', 'error')
      return
    }

    if (!form.paymentEnabled && !form.codEnabled) {
      showToast('يجب تفعيل طريقة دفع واحدة على الأقل', 'error')
      return
    }

    if (form.announcementEnabled && !String(form.announcementText || '').trim()) {
      showToast('فعّلت شريط الإعلان لكن نص الإعلان فارغ', 'error')
      return
    }

    if (form.paymentEnabled && paymentConfigState.level !== 'success') {
      showToast('لا يمكن الحفظ: أكمل إعدادات الدفع الإلكتروني أولاً (المزوّد + المفاتيح).', 'error')
      return
    }

    try {
      setSaving(true)

      // If logoImageUrl is a data URI (copied/pasted), convert and upload it so we don't store base64
      if (typeof form.logoImageUrl === 'string' && form.logoImageUrl.startsWith('data:image/')) {
        try {
          const res = await (async () => {
            // convert dataURI to blob
            const dataUrl = form.logoImageUrl
            const parts = dataUrl.split(',')
            const mime = parts[0].match(/:(.*?);/)[1]
            const bstr = atob(parts[1])
            let n = bstr.length
            const u8arr = new Uint8Array(n)
            while (n--) u8arr[n] = bstr.charCodeAt(n)
            const blob = new Blob([u8arr], { type: mime })
            const fd = new FormData()
            fd.append('file', blob, 'upload.png')
            const r = await fetch('/admin/media/upload', { method: 'POST', body: fd })
            return r
          })()

          if (!res.ok) {
            showToast('فشل رفع صورة الشعار المحوّلة', 'error')
          } else {
            const body = await res.json()
            if (body && body.url) {
              form.logoImageUrl = String(body.url)
              setForm((prev) => ({ ...prev, logoImageUrl: String(body.url) }))
            }
          }
        } catch (err) {
          console.error(err)
          showToast('خطأ أثناء رفع صورة الشعار المحوّلة', 'error')
        }
      }

      await updateStoreSettings(form)
      showToast('تم حفظ إعدادات المتجر بنجاح')
      setSaveMessage('تم حفظ الإعدادات بنجاح')
      setTimeout(() => setSaveMessage(null), 3000)
      // update snapshot so changes are considered saved
      try { initialFormRef.current = JSON.parse(JSON.stringify(form)) } catch { initialFormRef.current = null }
    } catch (e2) {
      console.error(e2)
      showToast('تعذر حفظ الإعدادات', 'error')
    } finally {
      setSaving(false)
    }
  }

  // warn on unload / navigation when form is dirty
  useEffect(() => {
    const beforeUnload = (e) => {
      try {
        if (!initialFormRef.current) return
        if (JSON.stringify(form) === JSON.stringify(initialFormRef.current)) return
        e.preventDefault()
        e.returnValue = 'لديك تغييرات غير محفوظة'
        return 'لديك تغييرات غير محفوظة'
      } catch { }
    }

    const clickHandler = (e) => {
      try {
        if (!initialFormRef.current) return
        if (JSON.stringify(form) === JSON.stringify(initialFormRef.current)) return
        const a = e.target.closest && e.target.closest('a')
        if (!a) return
        const href = a.getAttribute('href')
        if (!href) return
        // ignore hash/mailto/tel/external
        if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return
        if (href.startsWith('http') && new URL(href, location.href).origin !== location.origin) return
        const leave = confirm('لديك تغييرات غير محفوظة')
        if (!leave) {
          e.preventDefault()
          e.stopPropagation()
        }
      } catch { }
    }

    window.addEventListener('beforeunload', beforeUnload)
    document.addEventListener('click', clickHandler, true)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      document.removeEventListener('click', clickHandler, true)
    }
  }, [form])

  // track scroll to add subtle shadow to sticky save bar
  useEffect(() => {
    const onScroll = () => {
      try {
        setSaveBarScrolled(window.scrollY > 12)
      } catch { }
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const paymentConfigState = useMemo(() => {
    if (!form.paymentEnabled) {
      return {
        level: 'neutral',
        title: 'الدفع الإلكتروني غير مفعّل',
        message: 'لن يتم استخدام مفاتيح الدفع طالما الدفع الإلكتروني غير مفعّل.'
      }
    }

    if (form.paymentProvider === 'none') {
      return {
        level: 'warning',
        title: 'مزود الدفع غير محدد',
        message: 'فعّلت الدفع الإلكتروني لكن مزود الدفع ما زال بدون اختيار.'
      }
    }

    if (!String(form.paymentPublicKey || '').trim() || !String(form.paymentSecretKey || '').trim()) {
      return {
        level: 'danger',
        title: 'مفاتيح الدفع ناقصة',
        message: 'يجب إدخال المفتاح العام والمفتاح السري قبل الاعتماد على الدفع الإلكتروني.'
      }
    }

    return {
      level: 'success',
      title: 'إعدادات الدفع مكتملة',
      message: form.paymentSandboxMode ? 'الوضع الحالي: اختبار Sandbox' : 'الوضع الحالي: إنتاج Live'
    }
  }, [form.paymentEnabled, form.paymentProvider, form.paymentPublicKey, form.paymentSecretKey, form.paymentSandboxMode])

  const isPaymentConfigBlockingSave = form.paymentEnabled && paymentConfigState.level !== 'success'

  if (loading || pageLoading) return <div className="loading">جاري التحميل...</div>
  if (!isAdmin || !canManageSettings) return null

  return (
    <main className="admin-products-page admin-settings-page">
      {toast && (
        <div className={`toast toast-${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'} aria-live={toast.type === 'error' ? 'assertive' : 'polite'} aria-atomic="true">
          {toast.message}
        </div>
      )}

      <div className="admin-header">
        <div>
          <h1>إعدادات المتجر</h1>
          <p>تعديل الاسم، الشعار، ووسائل التواصل</p>
        </div>
        <div className="header-actions">
          <Link href="/admin/dashboard"><Button variant="secondary" className="admin-back-btn">العودة للوحة التحكم</Button></Link>
        </div>
      </div>

      <div className="add-modal">
        <form className="add-form admin-settings-form" onSubmit={onSave} aria-busy={saving}>
          {/* Section 1: Store Identity */}
          <div className="admin-card">
            <div className="admin-section-head">
              <span className="admin-section-icon" aria-hidden="true">🏪</span>
              <h3>هوية المتجر</h3>
            </div>
            <label htmlFor="storeName">اسم الموقع</label>
            <div className="input-with-icon">
              <span className="icon" aria-hidden="true">👑</span>
              <input id="storeName" name="storeName" placeholder="اسم الموقع" value={form.storeName} onChange={onChange} required />
            </div>

            <label htmlFor="storeTagline">وصف قصير للمتجر</label>
            <input id="storeTagline" name="storeTagline" placeholder="وصف تسويقي قصير يظهر في الواجهة" value={form.storeTagline} onChange={onChange} />

            <label htmlFor="logoText">نص الشعار في الهيدر</label>
            <input id="logoText" name="logoText" placeholder="النص الظاهر بجانب الشعار" value={form.logoText} onChange={onChange} required />

            <label htmlFor="logoIcon">شعار الموقع (رمز/إيموجي)</label>
            <input id="logoIcon" name="logoIcon" placeholder="مثال: ✨" value={form.logoIcon} onChange={onChange} />

            <label htmlFor="logoImageUrl">رابط صورة الشعار (اختياري)</label>
            <div className="input-with-icon">
              <span className="icon" aria-hidden="true">🖼️</span>
              <input id="logoImageUrl" name="logoImageUrl" placeholder="https://example.com/logo.png" value={form.logoImageUrl} onChange={onChange} />
            </div>

            <label htmlFor="logoFile">أو ارفع صورة شعار</label>
            <input id="logoFile" type="file" accept="image/*" onChange={onLogoFileChange} />

            {form.logoImageUrl && (
              <div className="admin-logo-preview-wrap">
                <div className="admin-logo-preview-bg" style={{ backgroundColor: form.logoBackgroundColor || 'transparent' }}>
                  {isDataImage(form.logoImageUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.logoImageUrl} alt="معاينة الشعار" className="admin-logo-preview-large" loading="lazy" decoding="async" />
                  ) : (
                    <Image src={form.logoImageUrl} alt="معاينة الشعار" className="admin-logo-preview-large" width={120} height={120} unoptimized />
                  )}
                </div>
                <div>
                  <button type="button" className="btn btn-secondary admin-logo-remove-btn" onClick={() => setForm((prev) => ({ ...prev, logoImageUrl: '' }))}>
                    حذف صورة الشعار
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Appearance */}
          <Accordion title="🎨 المظهر">
            <label htmlFor="logoBackgroundColor">لون خلفية الشعار</label>
            <div className="input-with-icon">
              <span className="icon" aria-hidden="true">🎨</span>
              <input id="logoBackgroundColor" name="logoBackgroundColor" type="color" value={form.logoBackgroundColor} onChange={onChange} aria-label="اختر لون خلفية الشعار" />
            </div>

            <label htmlFor="primaryColor">اللون الرئيسي للموقع</label>
            <div className="input-with-icon">
              <span className="icon" aria-hidden="true">🎯</span>
              <input id="primaryColor" name="primaryColor" type="color" value={form.primaryColor} onChange={onChange} aria-label="اختر اللون الرئيسي" />
            </div>

            <label htmlFor="buttonShape">شكل الأزرار</label>
            <select id="buttonShape" name="buttonShape" value={form.buttonShape} onChange={onChange}>
              <option value="rounded">مستدير (افتراضي)</option>
              <option value="pill">حبة (Pill)</option>
              <option value="square">مربع</option>
            </select>

            {/* Live mini header preview */}
            <div className="admin-header-preview">
              <div className="preview-header" role="img" aria-label="معاينة الهيدر">
                <div className="preview-logo" style={{ backgroundColor: form.logoBackgroundColor || 'transparent' }}>
                  {form.logoImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.logoImageUrl} alt="شعار المعاينة" className="preview-logo-image" loading="lazy" decoding="async" />
                  ) : (
                    <span className="preview-logo-fallback">{form.logoIcon || '✨'}</span>
                  )}
                </div>
                <div className="preview-site-info">
                  <div className="preview-site-name">{form.logoText || form.storeName || 'عطور الإمبراطورية'}</div>
                  <div className="preview-site-tagline">{form.storeTagline || 'وجهتك الأولى للعطور الفاخرة'}</div>
                </div>
              </div>
            </div>
          </Accordion>

          <Accordion title="إعدادات SEO">
            <label htmlFor="seoDescription">الوصف الافتراضي للموقع</label>
            <textarea
              id="seoDescription"
              name="seoDescription"
              placeholder="وصف يظهر في نتائج محركات البحث"
              value={form.seoDescription}
              onChange={onChange}
              rows={3}
            />

            <label htmlFor="seoKeywords">الكلمات المفتاحية (مفصولة بفاصلة)</label>
            <textarea
              id="seoKeywords"
              name="seoKeywords"
              placeholder="عطور, عطور فاخرة, عود, بخور"
              value={form.seoKeywords}
              onChange={onChange}
              rows={2}
            />
          </Accordion>

          <h3>تشغيل المتجر</h3>
          <label htmlFor="maintenanceMode">وضع الصيانة</label>
          <select id="maintenanceMode" name="maintenanceMode" value={String(form.maintenanceMode)} onChange={onChange}>
            <option value="false">غير مفعّل</option>
            <option value="true">مفعّل</option>
          </select>

          <label htmlFor="maintenanceMessage">رسالة الصيانة</label>
          <textarea
            id="maintenanceMessage"
            name="maintenanceMessage"
            placeholder="رسالة تظهر للزوار أثناء الصيانة"
            value={form.maintenanceMessage}
            onChange={onChange}
            rows={2}
          />

          <Accordion title="الإعلانات العامة">
            <label htmlFor="announcementEnabled">تفعيل شريط الإعلان</label>
            <select id="announcementEnabled" name="announcementEnabled" value={String(form.announcementEnabled)} onChange={onChange}>
              <option value="false">غير مفعّل</option>
              <option value="true">مفعّل</option>
            </select>

            <label htmlFor="announcementText">نص الإعلان</label>
            <input
              id="announcementText"
              name="announcementText"
              placeholder="مثال: خصم 20% حتى نهاية الأسبوع"
              value={form.announcementText}
              onChange={onChange}
            />

            <label htmlFor="announcementLink">رابط الإعلان (اختياري)</label>
            <input
              id="announcementLink"
              name="announcementLink"
              placeholder="/shop?discount=true"
              value={form.announcementLink}
              onChange={onChange}
            />
          </Accordion>

          <Accordion title="💰 التجارة والفوترة">
            <label htmlFor="currencyCode">رمز العملة</label>
            <input
              id="currencyCode"
              name="currencyCode"
              placeholder="SAR"
              value={form.currencyCode}
              onChange={onChange}
            />

            <label htmlFor="currencySymbol">رمز عرض العملة</label>
            <input
              id="currencySymbol"
              name="currencySymbol"
              placeholder="ر.س"
              value={form.currencySymbol}
              onChange={onChange}
            />

            <label htmlFor="taxRatePercent">نسبة الضريبة الافتراضية (%)</label>
            <input
              id="taxRatePercent"
              name="taxRatePercent"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={form.taxRatePercent}
              onChange={onChange}
            />

            <label htmlFor="businessLegalName">الاسم القانوني للمنشأة (للفاتورة)</label>
            <input
              id="businessLegalName"
              name="businessLegalName"
              placeholder="مثال: مؤسسة عطور الإمبراطورية"
              value={form.businessLegalName}
              onChange={onChange}
            />

            <label htmlFor="vatRegistrationNumber">الرقم الضريبي (VAT)</label>
            <input
              id="vatRegistrationNumber"
              name="vatRegistrationNumber"
              placeholder="310XXXXXXXXXXXX"
              value={form.vatRegistrationNumber}
              onChange={onChange}
              dir="ltr"
            />

            <label htmlFor="commercialRegistrationNumber">رقم السجل التجاري (CR)</label>
            <input
              id="commercialRegistrationNumber"
              name="commercialRegistrationNumber"
              placeholder="1010XXXXXX"
              value={form.commercialRegistrationNumber}
              onChange={onChange}
              dir="ltr"
            />
          </Accordion>

          <Accordion title="💳 الدفع">
            <label htmlFor="paymentEnabled">تفعيل الدفع الإلكتروني</label>
            <select id="paymentEnabled" name="paymentEnabled" value={String(form.paymentEnabled)} onChange={onChange}>
              <option value="false">غير مفعّل</option>
              <option value="true">مفعّل</option>
            </select>

            <label htmlFor="codEnabled">تفعيل الدفع عند الاستلام</label>
            <select id="codEnabled" name="codEnabled" value={String(form.codEnabled)} onChange={onChange}>
              <option value="false">غير مفعّل</option>
              <option value="true">مفعّل</option>
            </select>

            <label htmlFor="paymentProvider">مزود الدفع</label>
            <select id="paymentProvider" name="paymentProvider" value={form.paymentProvider} onChange={onChange}>
              <option value="none">بدون مزود</option>
              <option value="moyasar">Moyasar</option>
              <option value="stripe">Stripe</option>
              <option value="tap">Tap</option>
              <option value="custom">Custom</option>
            </select>

            <label htmlFor="paymentSandboxMode">وضع الاختبار (Sandbox)</label>
            <select id="paymentSandboxMode" name="paymentSandboxMode" value={String(form.paymentSandboxMode)} onChange={onChange}>
              <option value="true">مفعّل</option>
              <option value="false">غير مفعّل</option>
            </select>

            <div className="admin-settings-key-field">
              <input
                name="paymentPublicKey"
                type={showPaymentPublicKey ? 'text' : 'password'}
                placeholder="Public Key"
                value={form.paymentPublicKey}
                onChange={onChange}
                autoComplete="off"
              />
              <button type="button" className="btn-action btn-view" onClick={() => setShowPaymentPublicKey((prev) => !prev)}>
                {showPaymentPublicKey ? 'إخفاء' : 'إظهار'}
              </button>
            </div>
            <div className="admin-settings-key-field">
              <input
                name="paymentSecretKey"
                type={showPaymentSecretKey ? 'text' : 'password'}
                placeholder="Secret Key"
                value={form.paymentSecretKey}
                onChange={onChange}
                autoComplete="off"
              />
              <button type="button" className="btn-action btn-view" onClick={() => setShowPaymentSecretKey((prev) => !prev)}>
                {showPaymentSecretKey ? 'إخفاء' : 'إظهار'}
              </button>
            </div>

            <div className={`admin-settings-payment-state ${paymentConfigState.level}`} role="status" aria-live="polite">
              <strong>{paymentConfigState.title}</strong>
              <span>{paymentConfigState.message}</span>
            </div>

            {/* Only show keys when payment enabled */}
            {form.paymentEnabled && (
              <>
                <div className="admin-settings-key-field">
                  <input
                    name="paymentPublicKey"
                    type={showPaymentPublicKey ? 'text' : 'password'}
                    placeholder="Public Key"
                    value={form.paymentPublicKey}
                    onChange={onChange}
                    autoComplete="off"
                  />
                  <button type="button" className="btn-action btn-view" onClick={() => setShowPaymentPublicKey((prev) => !prev)}>
                    {showPaymentPublicKey ? 'إخفاء' : 'إظهار'}
                  </button>
                </div>
                <div className="admin-settings-key-field">
                  <input
                    name="paymentSecretKey"
                    type={showPaymentSecretKey ? 'text' : 'password'}
                    placeholder="Secret Key"
                    value={form.paymentSecretKey}
                    onChange={onChange}
                    autoComplete="off"
                  />
                  <button type="button" className="btn-action btn-view" onClick={() => setShowPaymentSecretKey((prev) => !prev)}>
                    {showPaymentSecretKey ? 'إخفاء' : 'إظهار'}
                  </button>
                </div>
              </>
            )}
          </Accordion>

          <Accordion title="🚚 الشحن">
            <label htmlFor="shippingFlatFee">رسوم الشحن الثابتة</label>
            <input id="shippingFlatFee" name="shippingFlatFee" type="number" min="0" step="0.01" value={form.shippingFlatFee} onChange={onChange} />

            <label htmlFor="freeShippingThreshold">حد الشحن المجاني</label>
            <input id="freeShippingThreshold" name="freeShippingThreshold" type="number" min="0" step="0.01" value={form.freeShippingThreshold} onChange={onChange} />

            <label htmlFor="shippingMainCitiesMinDays">مدة التوصيل (المدن الرئيسية) من</label>
            <input id="shippingMainCitiesMinDays" name="shippingMainCitiesMinDays" type="number" min="0" max="60" value={form.shippingMainCitiesMinDays} onChange={onChange} />

            <label htmlFor="shippingMainCitiesMaxDays">مدة التوصيل (المدن الرئيسية) إلى</label>
            <input id="shippingMainCitiesMaxDays" name="shippingMainCitiesMaxDays" type="number" min="0" max="90" value={form.shippingMainCitiesMaxDays} onChange={onChange} />

            <label htmlFor="shippingOtherCitiesMinDays">مدة التوصيل (المناطق الأخرى) من</label>
            <input id="shippingOtherCitiesMinDays" name="shippingOtherCitiesMinDays" type="number" min="0" max="90" value={form.shippingOtherCitiesMinDays} onChange={onChange} />

            <label htmlFor="shippingOtherCitiesMaxDays">مدة التوصيل (المناطق الأخرى) إلى</label>
            <input id="shippingOtherCitiesMaxDays" name="shippingOtherCitiesMaxDays" type="number" min="0" max="120" value={form.shippingOtherCitiesMaxDays} onChange={onChange} />

            <label htmlFor="returnWindowDays">مدة الاسترجاع (بالأيام)</label>
            <input id="returnWindowDays" name="returnWindowDays" type="number" min="0" max="365" value={form.returnWindowDays} onChange={onChange} />
          </Accordion>

          <Accordion title="📢 الإعلانات">
            <label htmlFor="announcementEnabled">تفعيل شريط الإعلان</label>
            <select id="announcementEnabled" name="announcementEnabled" value={String(form.announcementEnabled)} onChange={onChange}>
              <option value="false">غير مفعّل</option>
              <option value="true">مفعّل</option>
            </select>

            <label htmlFor="announcementText">نص الإعلان</label>
            <input
              id="announcementText"
              name="announcementText"
              placeholder="مثال: خصم 20% حتى نهاية الأسبوع"
              value={form.announcementText}
              onChange={onChange}
            />

            <label htmlFor="announcementLink">رابط الإعلان (اختياري)</label>
            <input
              id="announcementLink"
              name="announcementLink"
              placeholder="/shop?discount=true"
              value={form.announcementLink}
              onChange={onChange}
            />

            {/* Live mini announcement preview */}
            <div className="announcement-preview" aria-hidden={!form.announcementEnabled} style={{ marginTop: 8 }}>
              {form.announcementEnabled ? (
                <div className="announcement-bar-preview">{form.announcementText || 'نص الإعلان سيظهر هنا عند كتابته'}</div>
              ) : (
                <div className="muted">شريط الإعلان غير مفعّل</div>
              )}
            </div>
          </Accordion>

          <Accordion title="نصوص السياسات">
            <label htmlFor="shippingPolicyText">نص سياسة الشحن (اختياري)</label>
            <textarea id="shippingPolicyText" name="shippingPolicyText" rows={4} value={form.shippingPolicyText} onChange={onChange} />

            <label htmlFor="returnsPolicyText">نص سياسة الاسترجاع (اختياري)</label>
            <textarea id="returnsPolicyText" name="returnsPolicyText" rows={4} value={form.returnsPolicyText} onChange={onChange} />

            <label htmlFor="privacyPolicyText">نص سياسة الخصوصية (اختياري)</label>
            <textarea id="privacyPolicyText" name="privacyPolicyText" rows={4} value={form.privacyPolicyText} onChange={onChange} />
          </Accordion>

          <Accordion title="قوالب الإشعارات">
            <input name="notificationOrderCreatedTemplate" placeholder="قالب إشعار إنشاء الطلب" value={form.notificationOrderCreatedTemplate} onChange={onChange} />
            <input name="notificationOrderShippedTemplate" placeholder="قالب إشعار شحن الطلب" value={form.notificationOrderShippedTemplate} onChange={onChange} />
            <input name="notificationOrderDeliveredTemplate" placeholder="قالب إشعار تسليم الطلب" value={form.notificationOrderDeliveredTemplate} onChange={onChange} />
          </Accordion>

          <Accordion title="📈 التحليلات">
            <input name="googleAnalyticsId" placeholder="Google Analytics ID (G-XXXX)" value={form.googleAnalyticsId} onChange={onChange} />
            <input name="metaPixelId" placeholder="Meta Pixel ID" value={form.metaPixelId} onChange={onChange} />
            <input name="tagManagerId" placeholder="Google Tag Manager ID (GTM-XXXX)" value={form.tagManagerId} onChange={onChange} />
            <small className="muted">يجب وضع الأكواد بدون مسافات</small>
          </Accordion>

          <Accordion title="🗂 الوسائط">
            <label htmlFor="mediaProvider">مزود التخزين</label>
            <select id="mediaProvider" name="mediaProvider" value={form.mediaProvider} onChange={onChange}>
              <option value="local">Local</option>
              <option value="cloudinary">Cloudinary</option>
              <option value="s3">Amazon S3</option>
              <option value="other">Other</option>
            </select>

            {/* show extra fields only for non-local providers */}
            {form.mediaProvider !== 'local' ? (
              <>
                <input name="mediaBaseUrl" placeholder="Base URL للوسائط" value={form.mediaBaseUrl} onChange={onChange} />
                <input name="mediaApiKey" placeholder="API Key للوسائط" value={form.mediaApiKey} onChange={onChange} />
              </>
            ) : (
              <div className="muted">الوسائط مخزنة محلياً — لا حاجة لإعدادات إضافية</div>
            )}
          </Accordion>

          <div className={`admin-settings-save-row ${saveBarScrolled ? 'scrolled' : ''}`}>
            {saveMessage && (
              <div className="admin-save-message" role="status">{saveMessage}</div>
            )}
            <Button variant="primary" type="submit" disabled={saving || isPaymentConfigBlockingSave} ariaLabel={saving ? 'جاري الحفظ' : 'حفظ الإعدادات'}>
              {saving ? (
                <>
                  جاري الحفظ...
                  <span className="btn-spinner" aria-hidden="true" />
                </>
              ) : (
                'حفظ الإعدادات'
              )}
            </Button>
            {isPaymentConfigBlockingSave && (
              <small className="admin-settings-save-hint">أكمل إعدادات الدفع الإلكتروني حتى يتم تفعيل الحفظ.</small>
            )}
          </div>
        </form>
      </div>
    </main>
  )
}
