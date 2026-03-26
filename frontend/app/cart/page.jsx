'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useCart } from '@/context/CartContext'
import { fetchPerfumes } from '@/lib/api'
import { fetchStoreSettings } from '@/lib/api'
import { BLUR_DATA_URL, isOptimizableImageSrc, resolveImageSrc } from '@/lib/imagePlaceholders'
import { trackBeginCheckout, trackRemoveFromCart, trackViewCart, trackAddToCart } from '@/lib/analytics'
import { getServerApiUrl } from '@/lib/serverApi'
import PaymentLogos from '@/components/PaymentLogos'
import FreeShippingProgress from '@/components/FreeShippingProgress'

export default function Cart() {
  const router = useRouter()
  const { cart, updateQuantity, removeFromCart, clearCart, importCartItems, getCartTotal, maintenanceMode, maintenanceMessage, addToCart } = useCart()
  const [toast, setToast] = useState(null)
  const lastTrackedCartSignatureRef = useRef('')
  const shareResetTimerRef = useRef(null)
  const [isSharing, setIsSharing] = useState(false)
  const [shareSucceeded, setShareSucceeded] = useState(false)
  const [commerce, setCommerce] = useState({
    currencyCode: 'SAR',
    currencySymbol: 'ر.س',
    taxRatePercent: 15,
    shippingFlatFee: 50,
    freeShippingThreshold: 500,
    paymentEnabled: false,
    codEnabled: true
  })

  const [recommended, setRecommended] = useState([])
  const [couponCode, setCouponCode] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await fetchPerfumes()
        if (cancelled || !Array.isArray(data)) return
        const cartIds = new Set((cart || []).map(i => Number(i.id)))
        const picks = (data || []).filter(p => !cartIds.has(Number(p.id))).slice(0, 6)
        setRecommended(picks)
      } catch (e) {
        // ignore
      }
    })()

    return () => { cancelled = true }
  }, [cart])

  useEffect(() => {
    ;(async () => {
      try {
        const data = await fetchStoreSettings()
        if (!data) return
        setCommerce({
          currencySymbol: data.currencySymbol || 'ر.س',
          taxRatePercent: Number(data.taxRatePercent ?? 15),
          shippingFlatFee: Number(data.shippingFlatFee ?? 50),
          freeShippingThreshold: Number(data.freeShippingThreshold ?? 500),
          paymentEnabled: Boolean(data.paymentEnabled),
          codEnabled: data.codEnabled !== false
        })
      } catch {
        // keep defaults
      }
    })()
  }, [])

  useEffect(() => {
    const encodedSharedCart = new URLSearchParams(window.location.search).get('share')
    if (!encodedSharedCart) return

    let isCancelled = false

    const decodeAndImportCart = async () => {
      try {
        const decoded = JSON.parse(atob(encodedSharedCart))
        const items = Array.isArray(decoded?.items) ? decoded.items : []
        if (!items.length) {
          showToast('الرابط لا يحتوي منتجات قابلة للإضافة')
        } else {
          const result = await importCartItems(items)
          if (result && Number.isFinite(Number(result.importedCount)) && result.importedCount > 0) {
            showToast(`تم استيراد ${result.importedCount} منتج من الرابط`)
          } else {
            showToast('الرابط لا يحتوي منتجات قابلة للإضافة')
          }
        }
      } catch {
        if (!isCancelled) {
          showToast('تعذر قراءة رابط مشاركة السلة')
        }
      } finally {
        if (!isCancelled) {
          window.history.replaceState({}, '', '/cart')
        }
      }
    }

    decodeAndImportCart()

    return () => {
      isCancelled = true
    }
  }, [importCartItems])

  const showToast = (message) => {
    setToast(message)
    setTimeout(() => setToast(null), 3000)
  }

  const handleKeyboardActivate = (event, callback) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      callback()
    }
  }

  const handleCheckout = () => {
    if (maintenanceMode) {
      showToast(maintenanceMessage || 'المتجر تحت الصيانة حالياً')
      return
    }

    const subtotal = getCartTotal()
    const shipping = subtotal >= Number(commerce.freeShippingThreshold || 0) ? 0 : Number(commerce.shippingFlatFee || 0)
    const taxableAmount = subtotal + shipping
    const vatAmount = taxableAmount * (Number(commerce.taxRatePercent || 0) / 100)
    const finalTotal = taxableAmount + vatAmount

    trackBeginCheckout({
      items: cart,
      currency: commerce.currencyCode || 'SAR',
      value: finalTotal
    })
    router.push('/checkout')
  }

  const handleClearCart = () => {
    if (confirm('هل أنت متأكد من مسح جميع المنتجات من السلة؟')) {
      cart.forEach((item) => {
        trackRemoveFromCart({
          item,
          quantity: Number(item.quantity || 1),
          currency: commerce.currencyCode || 'SAR'
        })
      })
      clearCart()
      showToast('تم مسح السلة بنجاح')
    }
  }

  const handleShareCart = async () => {
    if (isSharing) return

    if (!cart.length) {
      showToast('السلة فارغة، لا يوجد شيء للمشاركة')
      return
    }

    const payload = {
      items: cart.map((item) => ({ id: item.id, quantity: Number(item.quantity || 1) }))
    }

    const encoded = btoa(JSON.stringify(payload))
    const shareUrl = `${window.location.origin}/cart?share=${encodeURIComponent(encoded)}`

    setIsSharing(true)

    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({
          title: 'مشاركة سلة التسوق',
          text: 'هذه السلة المقترحة من متجر عطور الإمبراطورية',
          url: shareUrl
        })
        showToast('تمت مشاركة السلة بنجاح')
      } else {
        await navigator.clipboard.writeText(shareUrl)
        showToast('تم نسخ رابط مشاركة السلة')
      }

      setShareSucceeded(true)
      if (shareResetTimerRef.current) {
        clearTimeout(shareResetTimerRef.current)
      }
      shareResetTimerRef.current = setTimeout(() => {
        setShareSucceeded(false)
        shareResetTimerRef.current = null
      }, 2200)
    } catch {
      showToast('تعذر النسخ التلقائي. انسخ الرابط من شريط العنوان بعد فتحه.')
      window.open(shareUrl, '_blank', 'noopener,noreferrer')
    } finally {
      setIsSharing(false)
    }
  }

  const handleShareCartWhatsApp = () => {
    if (isSharing) return

    if (!cart.length) {
      showToast('السلة فارغة، لا يوجد شيء للمشاركة')
      return
    }

    const payload = {
      items: cart.map((item) => ({ id: item.id, quantity: Number(item.quantity || 1) }))
    }

    const encoded = btoa(JSON.stringify(payload))
    const shareUrl = `${window.location.origin}/cart?share=${encodeURIComponent(encoded)}`
    const message = `هذه السلة المقترحة من متجر عطور الإمبراطورية:\n${shareUrl}`
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`

    window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
  }

  useEffect(() => {
    return () => {
      if (shareResetTimerRef.current) {
        clearTimeout(shareResetTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!cart.length) return

    const subtotalValue = getCartTotal()
    const shippingValue = subtotalValue >= Number(commerce.freeShippingThreshold || 0) ? 0 : Number(commerce.shippingFlatFee || 0)
    const vatValue = (subtotalValue + shippingValue) * (Number(commerce.taxRatePercent || 0) / 100)
    const totalValue = subtotalValue + shippingValue + vatValue
    const signature = `${commerce.currencyCode}|${cart.map((item) => `${item.id}:${item.quantity}`).join(',')}|${totalValue.toFixed(2)}`

    if (lastTrackedCartSignatureRef.current === signature) return

    trackViewCart({
      items: cart,
      currency: commerce.currencyCode || 'SAR',
      value: totalValue
    })
    lastTrackedCartSignatureRef.current = signature
  }, [cart, commerce.currencyCode, commerce.freeShippingThreshold, commerce.shippingFlatFee, commerce.taxRatePercent, getCartTotal])

  const handleDecreaseQuantity = (item) => {
    if (maintenanceMode) {
      showToast(maintenanceMessage || 'المتجر تحت الصيانة حالياً')
      return
    }

    if (Number(item.quantity || 0) <= 1) {
      trackRemoveFromCart({ item, quantity: 1, currency: commerce.currencyCode || 'SAR' })
    }
    updateQuantity(item.id, item.quantity - 1)
  }

  const handleIncreaseQuantity = (item) => {
    if (maintenanceMode) {
      showToast(maintenanceMessage || 'المتجر تحت الصيانة حالياً')
      return
    }

    updateQuantity(item.id, item.quantity + 1)
  }

  const handleRemoveItem = (item) => {
    trackRemoveFromCart({
      item,
      quantity: Number(item.quantity || 1),
      currency: commerce.currencyCode || 'SAR'
    })
    removeFromCart(item.id)
  }

  // Simple client-side coupon validation (replace with API call for production)
  const validateCoupon = (code) => {
    const key = String(code || '').trim().toUpperCase()
    if (!key) return null

    // examples: percent, fixed, free_shipping
    const coupons = {
      'WELCOME10': { id: 'WELCOME10', type: 'percent', amount: 10, title: 'خصم 10% للترحيب' },
      'SAR50': { id: 'SAR50', type: 'fixed', amount: 50, title: 'خصم 50 ر.س' },
      'SHIPFREE': { id: 'SHIPFREE', type: 'free_shipping', amount: 0, title: 'شحن مجاني' }
    }

    return coupons[key] || null
  }

  const applyCoupon = async () => {
    const code = String(couponCode || '').trim()
    if (!code) {
      showToast('الرجاء إدخال كود الخصم')
      return
    }

    try {
      const res = await fetch(getServerApiUrl('/coupons/validate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, subtotal })
      })

      if (!res.ok) {
        showToast('تعذر التحقق من كود الخصم')
        return
      }

      const data = await res.json()
      if (!data || data.valid !== true) {
        showToast(data?.message || 'كود الخصم غير صالح')
        return
      }

      // server returns coupon details
      setAppliedCoupon(data.coupon)
      showToast(`تم تطبيق: ${data.coupon.title}`)
    } catch (err) {
      // fallback to client validation if server is unreachable
      const found = validateCoupon(code)
      if (!found) {
        showToast('كود الخصم غير صالح')
        return
      }
      setAppliedCoupon(found)
      showToast(`تم تطبيق: ${found.title}`)
    }
  }

  const removeCoupon = () => {
    setAppliedCoupon(null)
    setCouponCode('')
    showToast('تم إزالة كود الخصم')
  }

  if (cart.length === 0) {
    return (
      <main className="cart-page">
        <div className="cart-header">
        <button onClick={() => router.back()} className="btn-back">
          <svg className="svg-icon" width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span>رجوع</span>
        </button>
          <h1>🛒 سلة التسوق</h1>
          <Link href="/shop" className="btn-home">المتجر</Link>
        </div>

        <div className="empty-cart">
          <div className="empty-icon">🛒</div>
          <h2>سلة التسوق فارغة</h2>
          <p>لم تقم بإضافة أي منتجات بعد</p>
          <Link href="/shop" className="btn-modern btn-primary-modern">
            <span>🛍️ تصفح المنتجات</span>
          </Link>
        </div>
        
        <section className="upsell-section">
          <h2>قد يعجبك أيضاً</h2>
          <div className="upsell-list">
            {recommended.length === 0 && (
              <p className="muted">تحميل توصيات...</p>
            )}

            {recommended.map((p) => {
              const price = p.discount > 0 ? (p.price - (p.price * p.discount / 100)) : p.price
              return (
                <div key={p.id} className="perfume-card upsell-card">
                  <div className="perfume-image" onClick={() => router.push(`/shop/product/${p.id}`)} role="button" tabIndex={0}>
                    <Image
                      src={resolveImageSrc(p.imageUrl)}
                      alt={p.name}
                      width={220}
                      height={220}
                      sizes="(max-width: 768px) 100px, 220px"
                      loading="lazy"
                      unoptimized={!isOptimizableImageSrc(resolveImageSrc(p.imageUrl))}
                    />
                  </div>
                  <div className="perfume-content">
                    <div className="brand">{p.brand}</div>
                    <h3 className="shop-product-title">{p.name}</h3>
                    <div className="price-main">
                      <div className="price-primary">{price.toFixed(2)} {commerce.currencySymbol}</div>
                    </div>
                    <div className="upsell-actions">
                      <button
                        className="btn-add-quick"
                        onClick={() => {
                          const ok = addToCart(p)
                          if (ok) {
                            trackAddToCart({ item: p, quantity: 1, currency: commerce.currencyCode || 'SAR' })
                            showToast(`تمت إضافة ${p.name} إلى السلة`)
                          } else {
                            showToast('تعذر إضافة المنتج حالياً')
                          }
                        }}
                      >أضف</button>
                      <Link href={`/shop/product/${p.id}`} className="link-details">تفاصيل</Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </main>
    )
  }

  const vatRate = Number(commerce.taxRatePercent || 0) / 100
  const subtotal = getCartTotal()
  const shipping = subtotal >= Number(commerce.freeShippingThreshold || 0) ? 0 : Number(commerce.shippingFlatFee || 0)

  // coupon-adjusted amounts
  let discountAmount = 0
  let shippingAfterCoupon = shipping
  if (appliedCoupon) {
    if (appliedCoupon.type === 'percent') {
      discountAmount = subtotal * (Number(appliedCoupon.amount || 0) / 100)
    } else if (appliedCoupon.type === 'fixed') {
      discountAmount = Number(appliedCoupon.amount || 0)
      if (discountAmount > subtotal) discountAmount = subtotal
    } else if (appliedCoupon.type === 'free_shipping') {
      shippingAfterCoupon = 0
      discountAmount = 0
    }
  }

  const discountedSubtotal = Math.max(0, subtotal - discountAmount)
  const taxableAmount = discountedSubtotal + shippingAfterCoupon
  const vatAmount = taxableAmount * vatRate
  const finalTotal = taxableAmount + vatAmount

  return (
    <main className="cart-page">
      {toast && (
        <div className="toast toast-success" role="status" aria-live="polite" aria-atomic="true">
          <span>{toast}</span>
        </div>
      )}

      <div className="cart-header">
        <button onClick={() => router.back()} className="btn-back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span>رجوع</span>
        </button>
        <h1>🛒 سلة التسوق ({cart.length} منتج)</h1>
        <Link href="/shop" className="btn-home">المتجر</Link>
      </div>

      <div className="cart-container">
        <div className="cart-items">
          <div className="cart-items-header">
            <h2>المنتجات في السلة</h2>
            <button onClick={handleClearCart} className="btn-clear-cart">
              🗑️ مسح الكل
            </button>
          </div>

          {cart.map((item) => {
            const safeImageSrc = resolveImageSrc(item.imageUrl)
            const itemPrice = item.discount > 0
              ? item.price - (item.price * item.discount / 100)
              : item.price
            const itemTotal = itemPrice * item.quantity

            return (
              <div key={item.id} className="cart-item">
                <div
                  className="cart-item-image"
                  onClick={() => router.push(`/shop/product/${item.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => handleKeyboardActivate(event, () => router.push(`/shop/product/${item.id}`))}
                  aria-label={`عرض تفاصيل ${item.name}`}
                >
                  <Image
                    src={safeImageSrc}
                    alt={item.name}
                    width={220}
                    height={220}
                    sizes="(max-width: 768px) 100px, 220px"
                    loading="lazy"
                    unoptimized={!isOptimizableImageSrc(safeImageSrc)}
                    placeholder="blur"
                    blurDataURL={BLUR_DATA_URL}
                  />
                  {item.discount > 0 && (
                    <div className="cart-item-discount">-{item.discount}%</div>
                  )}
                </div>

                <div className="cart-item-details">
                  <h3 
                    className="cart-item-name"
                    onClick={() => router.push(`/shop/product/${item.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => handleKeyboardActivate(event, () => router.push(`/shop/product/${item.id}`))}
                  >
                    {item.name}
                  </h3>
                  <p className="cart-item-brand">{item.brand}</p>
                  
                  <div className="cart-item-price-info">
                    {item.discount > 0 ? (
                      <>
                        <span className="cart-item-price">{itemPrice.toFixed(2)} {commerce.currencySymbol}</span>
                        <span className="cart-item-original-price">{item.price.toFixed(2)} {commerce.currencySymbol}</span>
                      </>
                    ) : (
                      <span className="cart-item-price">{item.price.toFixed(2)} {commerce.currencySymbol}</span>
                    )}
                  </div>

                  <div className="cart-item-actions">
                    <div className="quantity-controls-cart">
                      <button
                        onClick={() => handleDecreaseQuantity(item)}
                        className="quantity-btn-cart"
                        disabled={maintenanceMode}
                      >
                        -
                      </button>
                      <span className="quantity-display-cart">{item.quantity}</span>
                      <button
                        onClick={() => handleIncreaseQuantity(item)}
                        className="quantity-btn-cart"
                        disabled={maintenanceMode}
                      >
                        +
                      </button>
                    </div>

                    <button
                      onClick={() => handleRemoveItem(item)}
                      className="btn-remove-item"
                      title="حذف من السلة"
                    >
                      🗑️ حذف
                    </button>
                  </div>
                </div>

                <div className="cart-item-total">
                  <span className="item-total-label">الإجمالي:</span>
                  <span className="item-total-price">{itemTotal.toFixed(2)} {commerce.currencySymbol}</span>
                </div>
              </div>
            )
          })}
        </div>

        <div className="cart-summary">
          <h2 className="summary-title">ملخص الطلب</h2>
          
          <div className="summary-row">
            <span>المجموع الفرعي:</span>
            <span>{subtotal.toFixed(2)} {commerce.currencySymbol}</span>
          </div>

          <div className="coupon-block">
            {!appliedCoupon ? (
              <div className="coupon-input-row">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="أدخل كود الخصم"
                  aria-label="كود الخصم"
                />
                <button onClick={applyCoupon} className="btn-apply-coupon">تطبيق</button>
              </div>
            ) : (
              <div className="applied-coupon">
                <strong>{appliedCoupon.id}</strong>
                <span className="coupon-title">{appliedCoupon.title}</span>
                <button onClick={removeCoupon} className="btn-remove-coupon">إزالة</button>
              </div>
            )}
          </div>

          <div className="summary-row">
            <span>الشحن:</span>
            <span className={shippingAfterCoupon === 0 ? 'free-shipping' : ''}>
              {shippingAfterCoupon === 0 ? 'مجاني 🎉' : `${shippingAfterCoupon} ${commerce.currencySymbol}`}
            </span>
          </div>

          {subtotal < Number(commerce.freeShippingThreshold || 0) && shippingAfterCoupon > 0 && (
            <FreeShippingProgress subtotal={subtotal} threshold={Number(commerce.freeShippingThreshold || 0)} currency={commerce.currencySymbol} />
          )}

          {appliedCoupon && discountAmount > 0 && (
            <div className="summary-row discount-row">
              <span>خصم ({appliedCoupon.id}):</span>
              <span>-{discountAmount.toFixed(2)} {commerce.currencySymbol}</span>
            </div>
          )}

          <div className="summary-row vat-row" role="note" aria-label="ضريبة القيمة المضافة">
            <span className="vat-label">ضريبة القيمة المضافة ({Number(commerce.taxRatePercent || 0).toFixed(2)}%):</span>
            <span className="vat-value">{vatAmount.toFixed(2)} {commerce.currencySymbol}</span>
          </div>

          <div className="summary-divider"></div>

          <div className="summary-row summary-total">
            <span>الإجمالي النهائي (شامل الضريبة):</span>
            <span>{finalTotal.toFixed(2)} {commerce.currencySymbol}</span>
          </div>

          <button onClick={handleCheckout} className="btn-checkout" disabled={maintenanceMode}>
            <span>✅ إتمام الطلب</span>
          </button>

          <div className="payment-guarantees" role="contentinfo" aria-label="ضمانات الشراء">
            <div className="pg-item">
                <svg className="svg-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="M12 17a2 2 0 100-4 2 2 0 000 4z" fill="currentColor"/><path d="M17 8h-1V6a4 4 0 00-8 0v2H7a1 1 0 00-1 1v9a1 1 0 001 1h10a1 1 0 001-1V9a1 1 0 00-1-1zM9 6a3 3 0 016 0v2H9V6z" fill="currentColor"/></svg>
              <span>دفع آمن ومشفر</span>
            </div>

            <div className="pg-item">
              <svg className="svg-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="M21 15v4a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M7 11l5-5 5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span>استرجاع خلال 7 أيام</span>
            </div>

            <div className="pg-item">
              <svg className="svg-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="M22 16.92V21a1 1 0 01-1.11 1A19 19 0 013 5.11 1 1 0 014 4h4.09a1 1 0 01.95.68l.72 2.43a1 1 0 01-.24 1l-1.3 1.3a12 12 0 005.6 5.6l1.3-1.3a1 1 0 011-.24l2.43.72a1 1 0 01.68.95z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span>دعم 24/7</span>
            </div>

            <div className="pg-links">
              <a href="/policies/shipping-returns">سياسة الاسترجاع</a>
              <span className="dot">•</span>
              <a href="/policies/privacy">أمان البيانات</a>
            </div>
          </div>

          <div className="cart-share-actions">
            <button
              onClick={handleShareCart}
              className={`btn-share-cart btn-share-copy${shareSucceeded ? ' success' : ''}`}
              type="button"
              disabled={isSharing}
            >
              {isSharing ? '⏳ جاري المشاركة...' : shareSucceeded ? '✅ تم بنجاح' : '🔗 نسخ/مشاركة السلة'}
            </button>

            <button
              onClick={handleShareCartWhatsApp}
              className="btn-share-cart btn-share-whatsapp"
              type="button"
              disabled={isSharing}
            >
              📲 مشاركة عبر واتساب
            </button>
          </div>

          {maintenanceMode && (
            <p className="error" role="alert">{maintenanceMessage || 'المتجر تحت الصيانة حالياً'} — يمكن حذف المنتجات فقط مؤقتاً.</p>
          )}

          <Link href="/shop" className="btn-continue-shopping btn-continue-link">
            ← متابعة التسوق
          </Link>

          <div className="payment-methods">
            <p className="payment-title">طرق الدفع المتاحة:</p>
            <div className="payment-icons">
              {commerce.paymentEnabled ? <PaymentLogos /> : <span>طرق الدفع غير مفعّلة</span>}
            </div>
          </div>
        </div>
      </div>

      <section className="upsell-section">
        <h2>قد يعجبك أيضاً</h2>
        <div className="upsell-list">
          {recommended.length === 0 && (
            <p className="muted">تحميل توصيات...</p>
          )}

          {recommended.map((p) => {
            const price = p.discount > 0 ? (p.price - (p.price * p.discount / 100)) : p.price
            return (
              <div key={p.id} className="perfume-card upsell-card">
                <div className="perfume-image" onClick={() => router.push(`/shop/product/${p.id}`)} role="button" tabIndex={0}>
                  <Image
                    src={resolveImageSrc(p.imageUrl)}
                    alt={p.name}
                    width={220}
                    height={220}
                    sizes="(max-width: 768px) 100px, 220px"
                    loading="lazy"
                    unoptimized={!isOptimizableImageSrc(resolveImageSrc(p.imageUrl))}
                  />
                </div>
                <div className="perfume-content">
                  <div className="brand">{p.brand}</div>
                  <h3 className="shop-product-title">{p.name}</h3>
                  <div className="price-main">
                    <div className="price-primary">{price.toFixed(2)} {commerce.currencySymbol}</div>
                  </div>
                  <div className="upsell-actions">
                    <button
                      className="btn-add-quick"
                      onClick={() => {
                        const ok = addToCart(p)
                        if (ok) {
                          trackAddToCart({ item: p, quantity: 1, currency: commerce.currencyCode || 'SAR' })
                          showToast(`تمت إضافة ${p.name} إلى السلة`)
                        } else {
                          showToast('تعذر إضافة المنتج حالياً')
                        }
                      }}
                    >أضف</button>
                    <Link href={`/shop/product/${p.id}`} className="link-details">تفاصيل</Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </main>
  )
}
