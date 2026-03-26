"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCart } from '@/context/CartContext'
import { createOrder } from '@/lib/api'
import { fetchStoreSettings } from '@/lib/api'
import { trackAddPaymentInfo, trackPurchase } from '@/lib/analytics'
import { digitsOnly, formatDecimal, formatMoney, getUserLocale, toEnglishDigits } from '@/lib/intl'
import dynamic from 'next/dynamic'

const MapPicker = dynamic(() => import('@/components/MapPicker'), {
  ssr: false,
  loading: () => null,
})

export default function CheckoutPage() {
  const CHECKOUT_DRAFT_KEY = 'checkoutFormDraftV1'
  const router = useRouter()
  const { cart, getCartTotal, clearCart, maintenanceMode, maintenanceMessage } = useCart()
  const [form, setForm] = useState({ name: '', email: '', phone: '', city: '', street: '', address: '', deliveryNotes: '', latitude: null, longitude: null, deliveryMethod: 'delivery', paymentMethod: '' })
  const [mapOpen, setMapOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [support, setSupport] = useState({
    contactPhone: '+966500000000',
    contactEmail: 'info@perfume-empire.local',
    contactWhatsapp: '+966500000000'
  })
  const [commerce, setCommerce] = useState({
    currencyCode: 'SAR',
    currencySymbol: 'ر.س',
    taxRatePercent: 15,
    shippingFlatFee: 50,
    freeShippingThreshold: 500,
    paymentEnabled: false,
    codEnabled: true,
    paymentProvider: 'none',
    paymentPublicKey: '',
    paymentSecretKey: ''
  })

  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem(CHECKOUT_DRAFT_KEY)
      if (savedDraft) {
        const parsedDraft = JSON.parse(savedDraft)
        setForm((prev) => ({
          ...prev,
          name: parsedDraft?.name || prev.name,
          email: parsedDraft?.email || prev.email,
          phone: parsedDraft?.phone || prev.phone,
          city: parsedDraft?.city || prev.city,
          street: parsedDraft?.street || prev.street,
          address: parsedDraft?.address || prev.address,
          deliveryNotes: parsedDraft?.deliveryNotes || prev.deliveryNotes,
          deliveryMethod: parsedDraft?.deliveryMethod || prev.deliveryMethod,
          paymentMethod: parsedDraft?.paymentMethod || prev.paymentMethod,
        }))
      }
    } catch {
      // ignore invalid local draft
    }

    ;(async () => {
      try {
        const data = await fetchStoreSettings()
        if (data) {
          setSupport({
            contactPhone: data.contactPhone || '+966500000000',
            contactEmail: data.contactEmail || 'info@perfume-empire.local',
            contactWhatsapp: data.contactWhatsapp || data.contactPhone || '+966500000000'
          })

          setCommerce({
            currencyCode: data.currencyCode || 'SAR',
            currencySymbol: data.currencySymbol || 'ر.س',
            taxRatePercent: Number(data.taxRatePercent ?? 15),
            shippingFlatFee: Number(data.shippingFlatFee ?? 50),
            freeShippingThreshold: Number(data.freeShippingThreshold ?? 500),
            paymentEnabled: Boolean(data.paymentEnabled),
            codEnabled: data.codEnabled !== false,
            paymentProvider: String(data.paymentProvider || 'none').toLowerCase(),
            paymentPublicKey: String(data.paymentPublicKey || ''),
            paymentSecretKey: String(data.paymentSecretKey || '')
          })
        }
      } catch {
        // keep defaults
      }
    })()
  }, [])

  const onlineMethodAvailable = Boolean(
    commerce.paymentEnabled
    && String(commerce.paymentProvider || '').toLowerCase() !== 'none'
    && String(commerce.paymentPublicKey || '').trim()
    && String(commerce.paymentSecretKey || '').trim()
  )
  const codMethodAvailable = Boolean(commerce.codEnabled)
  const hasPaymentMethod = onlineMethodAvailable || codMethodAvailable
  const locale = getUserLocale('ar-SA')
  const formatAmount = (value) => formatMoney(value, commerce.currencySymbol, { locale })

  useEffect(() => {
    setForm((prev) => {
      const availableMethods = []
      if (onlineMethodAvailable) availableMethods.push('online')
      if (codMethodAvailable) availableMethods.push('cash_on_delivery')

      if (availableMethods.length === 0) {
        if (!prev.paymentMethod) return prev
        return { ...prev, paymentMethod: '' }
      }

      if (availableMethods.includes(prev.paymentMethod)) return prev
      return { ...prev, paymentMethod: availableMethods[0] }
    })
  }, [onlineMethodAvailable, codMethodAvailable])

  useEffect(() => {
    try {
      localStorage.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify(form))
    } catch {
      // ignore storage issues
    }
  }, [form])

  const paymentMethodLabel = (method) => {
    if (method === 'online') return 'دفع إلكتروني'
    if (method === 'cash_on_delivery') return 'دفع عند الاستلام'
    return '-'
  }

  const deliveryMethodLabel = (method) => {
    if (method === 'pickup') return 'استلام من الفرع'
    return 'توصيل للعنوان'
  }

  const handleChange = (e) => {
    if (maintenanceMode) return
    if (error) setError(null)
    const nextValue = e.target.name === 'phone' ? toEnglishDigits(e.target.value) : e.target.value
    setForm(prev => ({ ...prev, [e.target.name]: nextValue }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading) {
      // prevent double submit
      return
    }

    if (maintenanceMode) {
      setError(maintenanceMessage || 'المتجر تحت الصيانة حالياً')
      return
    }

    if (!hasPaymentMethod) {
      setError('لا توجد طريقة دفع مفعّلة حالياً. يرجى التواصل مع إدارة المتجر.')
      return
    }

    const normalizedName = String(form.name || '').trim()
    const normalizedEmail = String(form.email || '').trim()
    const normalizedPhone = digitsOnly(form.phone || '').trim()
    const normalizedAddress = String(form.address || '').trim()
    const normalizedCity = String(form.city || '').trim()
    const normalizedStreet = String(form.street || '').trim()
    const selectedPaymentMethod = String(form.paymentMethod || '').trim()

    if (!normalizedName || !normalizedEmail || !normalizedPhone || !normalizedAddress) {
      setError('يرجى تعبئة اسم العميل، الإيميل، الهاتف، والعنوان الأساسي قبل إتمام الطلب.')
      return
    }

    // basic email and phone sanity checks
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    const phoneOk = /^[0-9]{6,15}$/.test(normalizedPhone)
    if (!emailOk) {
      setError('الرجاء إدخال بريد إلكتروني صالح')
      return
    }
    if (!phoneOk) {
      setError('الرجاء إدخال رقم هاتف صالح (أرقام فقط، 6-15 خانة)')
      return
    }

    const methodAllowed = (selectedPaymentMethod === 'online' && onlineMethodAvailable)
      || (selectedPaymentMethod === 'cash_on_delivery' && codMethodAvailable)

    if (!selectedPaymentMethod || !methodAllowed) {
      setError('يرجى اختيار طريقة دفع صحيحة قبل إتمام الطلب.')
      return
    }

    setLoading(true)
    setError(null)

    const items = cart.map(i => ({ perfumeId: i.id, name: i.name, price: i.price, quantity: i.quantity }))
    const addressParts = []
    if (normalizedStreet) addressParts.push(normalizedStreet)
    if (normalizedCity) addressParts.push(normalizedCity)
    if (normalizedAddress) addressParts.push(normalizedAddress)
    const fullAddress = `[delivery:${form.deliveryMethod}] ${addressParts.join(', ')}`

    const order = {
      customerName: normalizedName,
      email: normalizedEmail,
      phone: normalizedPhone,
      address: fullAddress,
      deliveryNotes: String(form.deliveryNotes || '').trim(),
      latitude: form.latitude || null,
      longitude: form.longitude || null,
      paymentMethod: selectedPaymentMethod,
      total: finalTotal,
      items
    }

    try {
      const paymentType = selectedPaymentMethod
      trackAddPaymentInfo({
        items: cart,
        currency: commerce.currencyCode || 'SAR',
        value: finalTotal,
        paymentType
      })

      const created = await createOrder(order)
      trackPurchase({
        orderId: created?.id,
        items: cart,
        currency: commerce.currencyCode || 'SAR',
        value: finalTotal
      })
      try {
        localStorage.removeItem(CHECKOUT_DRAFT_KEY)
      } catch {
        // ignore storage issues
      }
      clearCart()
      const resultMethod = created?.paymentMethod || selectedPaymentMethod
      router.push(`/checkout/success?orderId=${created?.id || ''}&paymentMethod=${encodeURIComponent(resultMethod)}`)
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'تعذر إكمال الطلب')
    } finally {
      setLoading(false)
    }
  }

  const reverseGeocode = async (lat, lng) => {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
      if (!res.ok) return null
      const data = await res.json()
      return data
    } catch {
      return null
    }
  }

  const handleMapSelect = async ({ lat, lng }) => {
    setForm(prev => ({ ...prev, latitude: lat, longitude: lng }))
    setMapOpen(false)
    const geo = await reverseGeocode(lat, lng)
    if (!geo) return

    // populate address parts when available but keep fields editable
    const addr = geo.address || {}
    const city = addr.city || addr.town || addr.village || addr.county || ''
    const road = addr.road || ''
    const house = addr.house_number || ''
    const display = geo.display_name || ''

    setForm(prev => ({
      ...prev,
      city: prev.city || city,
      street: prev.street || [road, house].filter(Boolean).join(' ').trim() || prev.street,
      address: prev.address || display || prev.address
    }))
  }

  if (cart.length === 0) {
    return (
      <main className="checkout-page-modern">
        <div className="checkout-wrapper checkout-empty-wrapper">
          <div className="checkout-card-modern checkout-empty-card">
            <h2>سلة التسوق فارغة</h2>
            <p>أضف منتجات إلى السلة أولاً ثم أكمل الطلب.</p>
            <div className="checkout-empty-actions">
              <Link href="/shop" className="btn btn-primary">الذهاب إلى المتجر</Link>
              <Link href="/policies/shipping-returns" className="btn btn-secondary">سياسة الشحن والاسترجاع</Link>
            </div>
          </div>
        </div>
      </main>
    )
  }

  const vatRate = Number(commerce.taxRatePercent || 0) / 100
  const subtotal = getCartTotal()
  const shipping = subtotal >= Number(commerce.freeShippingThreshold || 0) ? 0 : Number(commerce.shippingFlatFee || 0)
  const taxableAmount = subtotal + shipping
  const vatAmount = taxableAmount * vatRate
  const finalTotal = taxableAmount + vatAmount
  const itemsCount = cart.reduce((count, item) => count + item.quantity, 0)
  const fieldsCompleted = Boolean(
    String(form.name || '').trim()
    && String(form.email || '').trim()
    && digitsOnly(form.phone || '').trim()
    && String(form.address || '').trim()
  )
  const submitDisabled = loading || !hasPaymentMethod || !fieldsCompleted

  return (
    <main className="checkout-page-modern">
      <div className="checkout-wrapper">
        <div className="checkout-header-modern">
          <Link href="/cart" className="btn btn-secondary">العودة للسلة</Link>
          <h1>إتمام الطلب</h1>
        </div>

        {error && <p className="error" role="alert">{error}</p>}

        <div className="checkout-grid-modern">
          <form onSubmit={handleSubmit} className="checkout-form-modern" aria-busy={loading}>
            <h2>بيانات العميل</h2>

            <div className="form-group">
              <label>الاسم</label>
              <input name="name" value={form.name} onChange={handleChange} required disabled={maintenanceMode || loading} />
            </div>

            <div className="form-group">
              <label>الإيميل</label>
              <input name="email" type="email" value={form.email} onChange={handleChange} required disabled={maintenanceMode || loading} />
            </div>

            <div className="form-group">
              <label>الهاتف</label>
              <input name="phone" value={form.phone} onChange={handleChange} required disabled={maintenanceMode || loading} />
            </div>

            <div className="form-group">
              <label>المدينة</label>
              <input name="city" value={form.city} onChange={handleChange} placeholder="المدينة" list="city-list" disabled={maintenanceMode || loading} />
              <datalist id="city-list">
                <option value="الرياض" />
                <option value="جدة" />
                <option value="الدمام" />
                <option value="مكة المكرمة" />
                <option value="المدينة المنورة" />
                <option value="الطائف" />
                <option value="ابها" />
                <option value="الخبر" />
              </datalist>
            </div>

            <div className="form-group">
              <label>الشارع</label>
              <input name="street" value={form.street} onChange={handleChange} placeholder="اسم الشارع و رقم المبنى" disabled={maintenanceMode || loading} />
            </div>

            <div className="form-group">
              <label>العنوان (مزيد من التفاصيل)</label>
              <textarea name="address" value={form.address} onChange={handleChange} required rows={3} disabled={maintenanceMode || loading} />
            </div>

            <div className="form-group">
              <label>ملاحظات التوصيل (اختياري)</label>
              <textarea name="deliveryNotes" value={form.deliveryNotes} onChange={handleChange} rows={2} placeholder="مثل: اترك الطرد عند الاستقبال" disabled={maintenanceMode || loading} />
            </div>

            <div className="form-group">
              <button type="button" className="btn btn-secondary" onClick={() => setMapOpen(true)}>اختر الموقع من الخريطة</button>
              {form.latitude && form.longitude && (
                <div>
                  <div className="map-coords">موقع محدد: {form.latitude.toFixed(6)}, {form.longitude.toFixed(6)}</div>
                  <div style={{marginTop:6}}>
                    <label>العنوان المستخرج (قابل للتعديل)</label>
                    <textarea name="address" value={form.address} onChange={handleChange} rows={2} />
                  </div>
                </div>
              )}
            </div>

            <div className="form-group">
              <label>طريقة التوصيل</label>
              <div className="checkout-choice-grid" role="radiogroup" aria-label="طريقة التوصيل">
                <label className={`checkout-choice-card ${form.deliveryMethod === 'delivery' ? 'is-active' : ''}`}>
                  <input
                    type="radio"
                    name="deliveryMethod"
                    value="delivery"
                    checked={form.deliveryMethod === 'delivery'}
                    onChange={handleChange}
                    disabled={maintenanceMode || loading}
                  />
                  <span className="checkout-choice-title">توصيل للعنوان</span>
                  <span className="checkout-choice-desc">يوصل الطلب إلى عنوانك المسجل</span>
                </label>

                <label className={`checkout-choice-card ${form.deliveryMethod === 'pickup' ? 'is-active' : ''}`}>
                  <input
                    type="radio"
                    name="deliveryMethod"
                    value="pickup"
                    checked={form.deliveryMethod === 'pickup'}
                    onChange={handleChange}
                    disabled={maintenanceMode || loading}
                  />
                  <span className="checkout-choice-title">استلام من الفرع</span>
                  <span className="checkout-choice-desc">استلم طلبك بنفسك من الفرع</span>
                </label>
              </div>
            </div>

            <div className="form-group">
              <label>طريقة الدفع</label>
              <div className="checkout-choice-grid" role="radiogroup" aria-label="طريقة الدفع">
                <label className={`checkout-choice-card ${form.paymentMethod === 'cash_on_delivery' ? 'is-active' : ''} ${!codMethodAvailable ? 'is-disabled' : ''}`}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="cash_on_delivery"
                    checked={form.paymentMethod === 'cash_on_delivery'}
                    onChange={handleChange}
                    disabled={maintenanceMode || loading || !codMethodAvailable}
                  />
                  <span className="checkout-choice-title">دفع عند الاستلام</span>
                  <span className="checkout-choice-desc">ادفع نقدًا عند استلام الطلب</span>
                  {!codMethodAvailable && <span className="checkout-choice-note">غير متاح حاليًا</span>}
                </label>

                <label className={`checkout-choice-card ${form.paymentMethod === 'online' ? 'is-active' : ''} ${!onlineMethodAvailable ? 'is-disabled' : ''}`}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="online"
                    checked={form.paymentMethod === 'online'}
                    onChange={handleChange}
                    disabled={maintenanceMode || loading || !onlineMethodAvailable}
                  />
                  <span className="checkout-choice-title">دفع إلكتروني</span>
                  <span className="checkout-choice-desc">بطاقة / Apple Pay / مزود الدفع</span>
                  {!onlineMethodAvailable && <span className="checkout-choice-note">غير متاح حاليًا</span>}
                </label>
              </div>
              {!hasPaymentMethod && (
                <p className="checkout-helper-error" role="alert">لا توجد طريقة دفع مفعّلة حالياً.</p>
              )}
            </div>

            {maintenanceMode ? (
              <a className="btn-checkout-modern" href="/contact">
                تواصل مع الدعم
              </a>
            ) : (
              <button className="btn-checkout-modern" type="submit" disabled={submitDisabled} aria-disabled={submitDisabled}>
                {loading ? 'جاري الطلب...' : 'أكمل الطلب'}
              </button>
            )}

            {!fieldsCompleted && (
              <p className="checkout-helper-note">أكمل بيانات العميل لتفعيل زر إتمام الطلب.</p>
            )}
          </form>

          {mapOpen && (
            <MapPicker
              initial={form.latitude && form.longitude ? [form.latitude, form.longitude] : undefined}
              onSelect={(coords) => handleMapSelect({ lat: coords.lat, lng: coords.lng })}
              onClose={() => setMapOpen(false)}
            />
          )}

          <aside className="checkout-sidebar-modern">
            <div className="checkout-card-modern">
              <h3>منتجاتك</h3>
              <div className="checkout-items-list">
                {cart.map((item) => (
                  <div className="checkout-item-row" key={item.id}>
                    <div className="checkout-item-main">
                      <strong>{item.name}</strong>
                      <span>الكمية: {item.quantity}</span>
                    </div>
                    <strong>{formatAmount(item.price * item.quantity)}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="checkout-card-modern">
              <h3>ملخص الطلب</h3>
              <div className="summary-row-modern">
                <span>عدد المنتجات</span>
                <strong>{itemsCount}</strong>
              </div>
              <div className="summary-row-modern">
                <span>المجموع الفرعي</span>
                <strong>{formatAmount(subtotal)}</strong>
              </div>
              <div className="summary-row-modern">
                <span>الشحن</span>
                <strong>{shipping === 0 ? 'مجاني' : formatAmount(shipping)}</strong>
              </div>
              <div className="summary-row-modern">
                <span>ضريبة القيمة المضافة ({formatDecimal(commerce.taxRatePercent || 0, { locale })}%)</span>
                <strong>{formatAmount(vatAmount)}</strong>
              </div>
              <div className="summary-divider-modern"></div>
              <div className="summary-row-modern">
                <span>طريقة التوصيل</span>
                <strong>{deliveryMethodLabel(form.deliveryMethod)}</strong>
              </div>
              <div className="summary-row-modern">
                <span>طريقة الدفع</span>
                <strong>{paymentMethodLabel(form.paymentMethod)}</strong>
              </div>
              <div className="summary-divider-modern"></div>
              <div className="summary-row-modern total">
                <span>الإجمالي النهائي (شامل الضريبة)</span>
                <strong>{formatAmount(finalTotal)}</strong>
              </div>
            </div>

            <div className="checkout-card-modern">
              <h3>مساعدة سريعة</h3>
              <div className="support-actions-modern">
                <a className="btn btn-secondary" href={`tel:${digitsOnly(support.contactPhone)}`}>اتصال</a>
                <a className="btn btn-secondary" href={`https://wa.me/${digitsOnly(support.contactWhatsapp)}`} target="_blank" rel="noreferrer">واتساب</a>
                <a className="btn btn-secondary" href={`mailto:${support.contactEmail}`}>إيميل</a>
              </div>
              <p className="checkout-payment-methods-note">
                طرق الدفع: {onlineMethodAvailable ? 'دفع إلكتروني' : ''}{onlineMethodAvailable && codMethodAvailable ? ' + ' : ''}{codMethodAvailable ? 'دفع عند الاستلام' : ''}
              </p>
              {hasPaymentMethod && (
                <p className="checkout-payment-methods-note">الطريقة المختارة: {paymentMethodLabel(form.paymentMethod)}</p>
              )}
              {!hasPaymentMethod && (
                <p className="error" role="alert">لا توجد طريقة دفع مفعّلة حالياً.</p>
              )}
              {maintenanceMode && (
                <p className="error" role="alert">{maintenanceMessage || 'المتجر تحت الصيانة حالياً'}</p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
