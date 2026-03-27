'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { fetchPerfumes, getPerfumeById, deletePerfume, fetchPerfumeReviews, createPerfumeReview, fetchStoreSettings } from '@/lib/api'
import { useCart } from '@/context/CartContext'
import { useAdmin } from '@/context/AdminContext'
import { BLUR_DATA_URL, isOptimizableImageSrc, resolveImageSrc } from '@/lib/imagePlaceholders'
import { trackAddToCart, trackAddToWishlist, trackRemoveFromWishlist, trackViewItem } from '@/lib/analytics'
import { formatDate, getUserLocale } from '@/lib/intl'

export default function ProductDetailsClient({ productId }) {
  const router = useRouter()
  const { isAdmin } = useAdmin()
  const [perfume, setPerfume] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedQuantity, setSelectedQuantity] = useState(1)
  const [toast, setToast] = useState(null)
  const [reviews, setReviews] = useState([])
  const [similarProducts, setSimilarProducts] = useState([])
  const [reviewForm, setReviewForm] = useState({ customerName: '', rating: 5, comment: '' })
  const [submittingReview, setSubmittingReview] = useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [currencySymbol, setCurrencySymbol] = useState('ر.س')
  const [currencyCode, setCurrencyCode] = useState('SAR')
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(500)
  const [showBottomBuyBar, setShowBottomBuyBar] = useState(false)
  const lastTrackedProductIdRef = useRef(null)
  const locale = getUserLocale('ar-SA')

  const { addToCart, toggleWishlist, isInWishlist, maintenanceMode, maintenanceMessage } = useCart()

  useEffect(() => {
    const loadPerfume = async () => {
      try {
        const [data, reviewData, settingsData, productsData] = await Promise.all([
          getPerfumeById(productId),
          fetchPerfumeReviews(productId),
          fetchStoreSettings(),
          fetchPerfumes()
        ])
        setPerfume(data)
        setReviews(reviewData || [])
        const allProducts = Array.isArray(productsData) ? productsData : []
        const related = allProducts
          .filter((item) => item && String(item.id) !== String(productId))
          .sort((a, b) => {
            const sameCategoryA = a.category === data?.category ? 1 : 0
            const sameCategoryB = b.category === data?.category ? 1 : 0
            if (sameCategoryA !== sameCategoryB) return sameCategoryB - sameCategoryA
            return Number(b.purchasedCount || 0) - Number(a.purchasedCount || 0)
          })
          .slice(0, 4)
        setSimilarProducts(related)
        if (settingsData) {
          setCurrencySymbol(settingsData.currencySymbol || 'ر.س')
          setCurrencyCode(settingsData.currencyCode || 'SAR')
          setFreeShippingThreshold(Number(settingsData.freeShippingThreshold ?? 500))
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    loadPerfume()
  }, [productId])

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    if (!perfume?.id) return
    if (lastTrackedProductIdRef.current === perfume.id) return

    trackViewItem({ item: perfume, currency: currencyCode })
    lastTrackedProductIdRef.current = perfume.id
  }, [perfume, currencyCode])

  useEffect(() => {
    const onScroll = () => {
      setShowBottomBuyBar(window.scrollY > 460)
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleDelete = async () => {
    if (confirm(`هل أنت متأكد من حذف "${perfume.name}"؟`)) {
      try {
        await deletePerfume(perfume.id)
        showToast('تم حذف المنتج بنجاح')
        setTimeout(() => router.push('/shop'), 1500)
      } catch {
        showToast('حدث خطأ أثناء حذف المنتج', 'error')
      }
    }
  }

  const handleAddToCart = () => {
    if (maintenanceMode) {
      showToast(maintenanceMessage || 'المتجر تحت الصيانة حالياً', 'error')
      return
    }

    if ((perfume.stock ?? 0) <= 0) {
      showToast('هذا المنتج غير متوفر حالياً', 'error')
      return
    }

    if (selectedQuantity > (perfume.stock ?? 0)) {
      showToast(`الكمية المتوفرة فقط: ${perfume.stock}`, 'error')
      return
    }

    let addedCount = 0
    for (let i = 0; i < selectedQuantity; i++) {
      const added = addToCart(perfume)
      if (!added) break
      addedCount += 1
    }

    if (addedCount <= 0) {
      showToast('لا يمكن إضافة كمية إضافية من هذا المنتج', 'error')
      return
    }

    trackAddToCart({
      item: perfume,
      quantity: addedCount,
      currency: currencyCode
    })
    if (addedCount < selectedQuantity) {
      showToast(`تمت إضافة ${addedCount} فقط من ${perfume.name} بسبب حد المخزون`, 'error')
      return
    }

    showToast(`تمت إضافة ${selectedQuantity} من ${perfume.name} إلى السلة`)
  }

  const handleToggleWishlist = () => {
    const wasInWishlist = isInWishlist(perfume.id)
    toggleWishlist(perfume)
    if (wasInWishlist) {
      trackRemoveFromWishlist({ item: perfume, currency: currencyCode })
    } else {
      trackAddToWishlist({ item: perfume, currency: currencyCode })
    }
    showToast(
      wasInWishlist
        ? 'تم حذف المنتج من المفضلة'
        : 'تمت إضافة المنتج إلى المفضلة'
    )
  }

  const handleReviewSubmit = async (e) => {
    e.preventDefault()
    try {
      setSubmittingReview(true)
      const created = await createPerfumeReview(productId, {
        customerName: reviewForm.customerName,
        rating: Number(reviewForm.rating),
        comment: reviewForm.comment
      })
      setReviews((prev) => [created, ...prev])
      setReviewForm({ customerName: '', rating: 5, comment: '' })
      showToast('تم إرسال تقييمك بنجاح')
    } catch {
      showToast('تعذر إرسال التقييم', 'error')
    } finally {
      setSubmittingReview(false)
    }
  }

  if (loading) {
    return (
      <div className="product-details-loading">
        <div className="loading-spinner">⏳</div>
        <p>جاري التحميل...</p>
      </div>
    )
  }

  if (error || !perfume) {
    return (
      <div className="error-page">
        <div className="error-icon">❌</div>
        <h2>عذراً، لم نتمكن من العثور على المنتج</h2>
        <p role="alert">{error}</p>
        <Link href="/shop" className="btn-modern btn-primary-modern">
          العودة للمتجر
        </Link>
      </div>
    )
  }

  const finalPrice = perfume.discount > 0
    ? perfume.price - (perfume.price * perfume.discount / 100)
    : perfume.price

  const gallerySources = (() => {
    const candidates = [
      perfume.imageUrl,
      perfume.image,
      ...(Array.isArray(perfume.images) ? perfume.images : []),
      ...(Array.isArray(perfume.imageUrls) ? perfume.imageUrls : []),
      ...(Array.isArray(perfume.galleryImages) ? perfume.galleryImages : []),
      ...(Array.isArray(perfume.gallery) ? perfume.gallery : [])
    ]
    const unique = [...new Set(candidates.map((item) => String(item || '').trim()).filter(Boolean))]
    return unique.length > 0 ? unique : ['']
  })()
  const selectedImageSrc = resolveImageSrc(gallerySources[selectedImageIndex] || perfume.imageUrl)

  const categoryNames = {
    men: 'عطور رجالي',
    women: 'عطور نسائي',
    incense: 'بخور وعود',
    cosmetics: 'أدوات تجميل'
  }

  const categoryDescriptions = {
    men: 'تركيبة رجالية أنيقة مناسبة للاستخدام اليومي والمناسبات.',
    women: 'تركيبة نسائية فاخرة بنفحات مميزة وثبات جميل.',
    incense: 'رائحة شرقية غنية مستوحاة من البخور والعود الأصيل.',
    cosmetics: 'منتج مختار ضمن قسم العناية والتجميل الفاخر.'
  }

  return (
    <main className="product-details-page">
      {toast && (
        <div className={`toast toast-${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'} aria-live={toast.type === 'error' ? 'assertive' : 'polite'} aria-atomic="true">
          <span>{toast.message}</span>
        </div>
      )}

      <div className="product-header">
        <button onClick={() => router.back()} className="btn-back">
          <svg className="svg-icon" width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span>رجوع</span>
        </button>

        <div className="product-header-actions">
          {isAdmin && (
            <>
              <Link href={`/edit/${perfume.id}`} className="btn-admin-edit">
                <span>✏️</span>
                <span>تعديل</span>
              </Link>
              <button onClick={handleDelete} className="btn-admin-delete">
                <span>🗑️</span>
                <span>حذف</span>
              </button>
            </>
          )}
          <Link href="/shop" className="btn-home">
            المتجر
          </Link>
        </div>
      </div>

      <div className="product-details-container">
        <div className="product-image-section">
          <div className="product-image-wrapper">
            <Image
              src={selectedImageSrc}
              alt={perfume.name}
              className="product-main-image"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              priority
              unoptimized={!isOptimizableImageSrc(selectedImageSrc)}
              placeholder="blur"
              blurDataURL={BLUR_DATA_URL}
            />
            {perfume.discount > 0 && (
              <div className="discount-badge-large">
                <div className="discount-percentage">{perfume.discount}%</div>
                <div className="discount-text">تخفيض 🔥</div>
              </div>
            )}
            <button
              onClick={handleToggleWishlist}
              className={`wishlist-btn-floating ${isInWishlist(perfume.id) ? 'active' : ''}`}
            >
              {isInWishlist(perfume.id) ? '❤️' : '🤍'}
            </button>
          </div>

          {gallerySources.length > 1 && (
            <div className="product-gallery" aria-label="معرض صور المنتج">
              {gallerySources.map((src, index) => {
                const resolved = resolveImageSrc(src)
                return (
                  <button
                    key={`${resolved}-${index}`}
                    type="button"
                    className={`product-gallery-thumb ${selectedImageIndex === index ? 'active' : ''}`}
                    onClick={() => setSelectedImageIndex(index)}
                    aria-label={`عرض الصورة رقم ${index + 1}`}
                  >
                    <Image
                      src={resolved}
                      alt={`${perfume.name} - ${index + 1}`}
                      width={96}
                      height={96}
                      unoptimized={!isOptimizableImageSrc(resolved)}
                      className="product-gallery-thumb-image"
                    />
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="product-info-section">
          <div className="product-category-badge">
            {categoryNames[perfume.category]}
          </div>

          <h1 className="product-title">{perfume.name}</h1>

          <div className="product-brand">
            <span className="brand-icon">✨</span>
            <span>{perfume.brand}</span>
          </div>

          <div className="product-rating">
            {perfume.reviewsCount > 0 ? (
              <span className="rating-text">⭐ {Number(perfume.averageRating || 0).toFixed(1)} / 5 ({perfume.reviewsCount} تقييم)</span>
            ) : (
              <span className="rating-text">لا توجد تقييمات منشورة لهذا المنتج حالياً</span>
            )}
          </div>

          <div className="product-price-section">
            {perfume.discount > 0 ? (
              <>
                <div className="price-with-discount">
                  <span className="current-price">{finalPrice.toFixed(2)} {currencySymbol}</span>
                  <span className="original-price">{perfume.price.toFixed(2)} {currencySymbol}</span>
                </div>
                <div className="savings-badge">
                  وفّر {(perfume.price - finalPrice).toFixed(2)} {currencySymbol}
                </div>
              </>
            ) : (
              <span className="current-price">{perfume.price.toFixed(2)} {currencySymbol}</span>
            )}
          </div>

          <div className="product-description">
            <h2>وصف المنتج</h2>
            <p>
              {perfume.name} من علامة {perfume.brand} ضمن فئة {categoryNames[perfume.category] || 'منتجات المتجر'}.
              {' '}
              {categoryDescriptions[perfume.category] || 'تركيبة مختارة بعناية لتناسب ذوقك.'}
            </p>
            <p>
              رائحة مصممة لتمنحك حضوراً لافتاً وثباتاً يدوم لساعات طويلة، مع توازن احترافي بين المكونات العليا والقلب والقاعدة.
            </p>
          </div>

          <div className="product-features">
            <div className="feature-item">
              <span className="feature-icon">✅</span>
              <span>منتج أصلي 100%</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">🚚</span>
              <span>توصيل مجاني للطلبات فوق {freeShippingThreshold} {currencySymbol}</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">↩️</span>
              <span>إمكانية الإرجاع خلال 14 يوم</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">🎁</span>
              <span>تغليف فاخر مجاني</span>
            </div>
          </div>

          <div className="quantity-section">
            <label>الكمية:</label>
            <div className="quantity-controls">
              <button
                onClick={() => setSelectedQuantity(Math.max(1, selectedQuantity - 1))}
                className="quantity-btn"
                disabled={(perfume.stock ?? 0) <= 0}
              >
                -
              </button>
              <span className="quantity-display">{selectedQuantity}</span>
              <button
                onClick={() => setSelectedQuantity(selectedQuantity + 1)}
                className="quantity-btn"
                disabled={(perfume.stock ?? 0) <= 0 || selectedQuantity >= (perfume.stock ?? 0)}
              >
                +
              </button>
            </div>
          </div>

          <div className="product-actions">
            <button onClick={handleAddToCart} className="btn-add-to-cart btn-buy-primary-large" disabled={maintenanceMode || (perfume.stock ?? 0) <= 0}>
              <span>🛒</span>
              <span>{maintenanceMode ? 'المتجر تحت الصيانة' : ((perfume.stock ?? 0) > 0 ? 'اشتر الآن' : 'غير متوفر')}</span>
            </button>
            <button onClick={handleToggleWishlist} className="btn-wishlist-action">
              <span>{isInWishlist(perfume.id) ? '❤️' : '🤍'}</span>
            </button>
          </div>

          <div className="extra-info">
            <div className="info-item">
              <strong>الفئة:</strong>
              <span>{categoryNames[perfume.category]}</span>
            </div>
            <div className="info-item">
              <strong>العلامة التجارية:</strong>
              <span>{perfume.brand}</span>
            </div>
            <div className="info-item">
              <strong>متوفر:</strong>
              <span className="in-stock">
                {(perfume.stock ?? 0) > 0 ? `✅ متاح (${perfume.stock})` : '❌ غير متوفر حالياً'}
              </span>
            </div>
          </div>

          <div className="product-description product-reviews-section">
            <h2>أضف تقييمك</h2>
            <form onSubmit={handleReviewSubmit}>
              <div className="form-group review-form-group">
                <label htmlFor="review-customer-name" className="review-field-label">الاسم</label>
                <input
                  id="review-customer-name"
                  placeholder="اسمك"
                  value={reviewForm.customerName}
                  onChange={(e) => setReviewForm((prev) => ({ ...prev, customerName: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group review-form-group">
                <label htmlFor="review-rating" className="review-field-label">التقييم</label>
                <select
                  id="review-rating"
                  value={reviewForm.rating}
                  onChange={(e) => setReviewForm((prev) => ({ ...prev, rating: e.target.value }))}
                >
                  <option value={5}>5 نجوم</option>
                  <option value={4}>4 نجوم</option>
                  <option value={3}>3 نجوم</option>
                  <option value={2}>2 نجوم</option>
                  <option value={1}>1 نجمة</option>
                </select>
              </div>
              <div className="form-group review-form-group">
                <label htmlFor="review-comment" className="review-field-label">التعليق</label>
                <textarea
                  id="review-comment"
                  rows={3}
                  placeholder="اكتب رأيك"
                  value={reviewForm.comment}
                  onChange={(e) => setReviewForm((prev) => ({ ...prev, comment: e.target.value }))}
                />
              </div>
              <button className="btn-add-to-cart" type="submit" disabled={submittingReview}>
                {submittingReview ? 'جاري الإرسال...' : 'إرسال التقييم'}
              </button>
            </form>
          </div>

          <div className="product-description product-reviews-section">
            <h2>تقييمات العملاء</h2>
            {reviews.length === 0 ? (
              <p>لا توجد تقييمات بعد.</p>
            ) : (
              reviews.map((review) => (
                <div key={review.id} className="review-item">
                  <div className="review-headline-row">
                    <strong>{review.customerName}</strong>
                    <span className="review-verified">شراء موثق</span>
                  </div>
                  <div className="review-stars">{'⭐'.repeat(Number(review.rating || 0))}</div>
                  {review.comment && <p>{review.comment}</p>}
                  <small className="review-date">{formatDate(review.createdAt, { locale })}</small>
                </div>
              ))
            )}
          </div>

          {similarProducts.length > 0 && (
            <div className="product-description product-reviews-section similar-products-section">
              <h2>منتجات مشابهة</h2>
              <div className="similar-products-grid">
                {similarProducts.map((item) => {
                  const itemPrice = Number(item.discount || 0) > 0
                    ? Number(item.price || 0) * (1 - Number(item.discount || 0) / 100)
                    : Number(item.price || 0)
                  const itemImage = resolveImageSrc(item.imageUrl)

                  return (
                    <article key={item.id} className="similar-product-card">
                      <button
                        type="button"
                        className="similar-product-image-btn"
                        onClick={() => router.push(`/shop/product/${item.id}`)}
                        aria-label={`عرض تفاصيل ${item.name}`}
                      >
                        <Image
                          src={itemImage}
                          alt={item.name}
                          width={260}
                          height={180}
                          className="similar-product-image"
                          unoptimized={!isOptimizableImageSrc(itemImage)}
                        />
                      </button>
                      <h3>{item.name}</h3>
                      <p>{item.brand}</p>
                      <div className="similar-product-price">{itemPrice.toFixed(2)} {currencySymbol}</div>
                      <div className="similar-product-actions">
                        <Link href={`/shop/product/${item.id}`} className="similar-link">تفاصيل</Link>
                        <button type="button" onClick={() => addToCart(item)} className="similar-add-btn">أضف للسلة</button>
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {showBottomBuyBar && (
        <div className="floating-buy-bar" role="region" aria-label="شراء سريع">
          <div className="floating-buy-bar__meta">
            <strong className="floating-buy-bar__name">{perfume.name}</strong>
            <span className="floating-buy-bar__price">{finalPrice.toFixed(2)} {currencySymbol}</span>
          </div>
          <button
            type="button"
            onClick={handleAddToCart}
            className="floating-buy-bar__btn"
            disabled={maintenanceMode || (perfume.stock ?? 0) <= 0}
          >
            {maintenanceMode ? 'المتجر تحت الصيانة' : ((perfume.stock ?? 0) > 0 ? 'اشتر الآن' : 'غير متوفر')}
          </button>
        </div>
      )}
    </main>
  )
}
