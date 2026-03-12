'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useCart } from '@/context/CartContext'
import { fetchStoreSettings } from '@/lib/api'
import { BLUR_DATA_URL, isOptimizableImageSrc, resolveImageSrc } from '@/lib/imagePlaceholders'
import { trackAddToCart, trackRemoveFromWishlist, trackSelectItem } from '@/lib/analytics'

export default function Wishlist() {
  const router = useRouter()
  const { wishlist, toggleWishlist, addToCart, maintenanceMode, maintenanceMessage } = useCart()
  const [toast, setToast] = useState(null)
  const [currencySymbol, setCurrencySymbol] = useState('ر.س')
  const [currencyCode, setCurrencyCode] = useState('SAR')

  useEffect(() => {
    ;(async () => {
      try {
        const settings = await fetchStoreSettings()
        if (settings) {
          setCurrencySymbol(settings.currencySymbol || 'ر.س')
          setCurrencyCode(settings.currencyCode || 'SAR')
        }
      } catch {
        // keep default
      }
    })()
  }, [])

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

  const handleRemove = (product) => {
    toggleWishlist(product)
    trackRemoveFromWishlist({ item: product, currency: currencyCode })
    showToast('تم حذف المنتج من المفضلة')
  }

  const handleAddToCart = (product) => {
    if (maintenanceMode) {
      showToast(maintenanceMessage || 'المتجر تحت الصيانة حالياً')
      return
    }

    const added = addToCart(product)
    if (!added) {
      showToast('لا يمكن إضافة المنتج حالياً')
      return
    }

    trackAddToCart({ item: product, quantity: 1, currency: currencyCode })
    showToast(`تمت إضافة ${product.name} إلى السلة`)
  }

  const handleAddAllToCart = () => {
    if (maintenanceMode) {
      showToast(maintenanceMessage || 'المتجر تحت الصيانة حالياً')
      return
    }

    let addedCount = 0
    wishlist.forEach(product => {
      const added = addToCart(product)
      if (!added) return
      addedCount += 1
      trackAddToCart({ item: product, quantity: 1, currency: currencyCode })
    })

    if (addedCount <= 0) {
      showToast('لم يتم إضافة أي منتج (تحقق من التوفر أو الصيانة)')
      return
    }

    showToast(`تمت إضافة ${addedCount} منتج إلى السلة`)
  }

  const openProductDetails = (product) => {
    trackSelectItem({
      item: product,
      currency: currencyCode,
      itemListName: 'wishlist'
    })
    router.push(`/shop/product/${product.id}`)
  }

  if (wishlist.length === 0) {
    return (
      <main className="wishlist-page">
        <div className="wishlist-header">
          <button onClick={() => router.back()} className="btn-back">
            <svg className="svg-icon" width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span>رجوع</span>
          </button>
          <h1>❤️ المفضلة</h1>
          <Link href="/shop" className="btn-home">المتجر</Link>
        </div>

        <div className="empty-wishlist">
          <div className="empty-icon">❤️</div>
          <h2>قائمة المفضلة فارغة</h2>
          <p>لم تقم بإضافة أي منتجات إلى المفضلة بعد</p>
          <Link href="/shop" className="btn-modern btn-primary-modern">
            <span>🛍️ اكتشف المنتجات</span>
          </Link>
        </div>
      </main>
    )
  }

  const categoryNames = {
    men: 'عطور رجالي',
    women: 'عطور نسائي',
    incense: 'بخور وعود',
    cosmetics: 'أدوات تجميل'
  }

  return (
    <main className="wishlist-page">
      {toast && (
        <div className="toast toast-success" role="status" aria-live="polite" aria-atomic="true">
          <span>{toast}</span>
        </div>
      )}

        <div className="wishlist-header">
        <button onClick={() => router.back()} className="btn-back">
          <svg className="svg-icon" width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span>رجوع</span>
        </button>
        <h1>❤️ المفضلة ({wishlist.length} منتج)</h1>
        <Link href="/shop" className="btn-home">المتجر</Link>
      </div>

      <div className="wishlist-actions-bar">
        <button onClick={handleAddAllToCart} className="btn-add-all" disabled={maintenanceMode}>
          🛒 إضافة الكل للسلة
        </button>
      </div>

      <div className="wishlist-grid">
        {wishlist.map((product, index) => {
          const safeImageSrc = resolveImageSrc(product.imageUrl)
          const finalPrice = product.discount > 0
            ? product.price - (product.price * product.discount / 100)
            : product.price
          const delayClass = `wishlist-card-delay-${(index % 8) + 1}`

          return (
            <div 
              key={product.id} 
              className={`wishlist-card ${delayClass}`}
            >
              <div
                className="wishlist-card-image"
                onClick={() => openProductDetails(product)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => handleKeyboardActivate(event, () => openProductDetails(product))}
                aria-label={`عرض تفاصيل ${product.name}`}
              >
                <Image
                  src={safeImageSrc}
                  alt={product.name}
                  width={520}
                  height={360}
                  sizes="(max-width: 768px) 100vw, 33vw"
                  unoptimized={!isOptimizableImageSrc(safeImageSrc)}
                  placeholder="blur"
                  blurDataURL={BLUR_DATA_URL}
                />
                {product.discount > 0 && (
                  <div className="wishlist-discount-badge">
                    <span>🔥</span>
                    <span>-{product.discount}%</span>
                  </div>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemove(product)
                  }}
                  className="wishlist-remove-btn"
                  title="حذف من المفضلة"
                >
                  ✕
                </button>
              </div>

              <div className="wishlist-card-content">
                <div className="wishlist-category-badge">
                  {categoryNames[product.category]}
                </div>

                <h3 
                  className="wishlist-product-name"
                  onClick={() => openProductDetails(product)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => handleKeyboardActivate(event, () => openProductDetails(product))}
                >
                  {product.name}
                </h3>

                <p className="wishlist-product-brand">
                  <span>✨</span>
                  {product.brand}
                </p>

                <div className="wishlist-price-section">
                  {product.discount > 0 ? (
                    <div className="wishlist-price-with-discount">
                      <span className="wishlist-current-price">{finalPrice.toFixed(2)} {currencySymbol}</span>
                      <span className="wishlist-original-price">{product.price.toFixed(2)} {currencySymbol}</span>
                    </div>
                  ) : (
                    <span className="wishlist-current-price">{product.price.toFixed(2)} {currencySymbol}</span>
                  )}
                </div>

                <div className="wishlist-card-actions">
                  <button
                    onClick={() => handleAddToCart(product)}
                    className="btn-wishlist-add-cart"
                    disabled={maintenanceMode}
                  >
                    <span>🛒</span>
                    <span>{maintenanceMode ? 'المتجر تحت الصيانة' : 'أضف للسلة'}</span>
                  </button>
                  <button
                    onClick={() => openProductDetails(product)}
                    className="btn-wishlist-view"
                  >
                    👁️ عرض
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </main>
  )
}
