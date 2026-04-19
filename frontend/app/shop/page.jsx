"use client"

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { fetchPerfumes, deletePerfume, fetchStoreSettings, searchPerfumesByImage } from '@/lib/api'
import SkeletonGrid from '@/components/SkeletonGrid'
import { useCart } from '@/context/CartContext'
import { useAdmin } from '@/context/AdminContext'
import { BLUR_DATA_URL, isOptimizableImageSrc, resolveImageSrc } from '@/lib/imagePlaceholders'
import { trackAddToCart, trackAddToWishlist, trackRemoveFromWishlist, trackSearch, trackSelectItem, trackViewItemList } from '@/lib/analytics'

const QuickView = dynamic(() => import('@/components/QuickView'), {
  ssr: false,
})

export default function Shop() {
  const router = useRouter()
  const [perfumes, setPerfumes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [imageQuery, setImageQuery] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [imageSearchLoading, setImageSearchLoading] = useState(false)
  const imageSearchAbortRef = useRef(null)
  const [toast, setToast] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [openMenu, setOpenMenu] = useState(null)
  const [activeCategory, setActiveCategory] = useState('all')
  const [sortBy, setSortBy] = useState('default')
  const [activeQuickFilter, setActiveQuickFilter] = useState('')
  const [minPriceFilter, setMinPriceFilter] = useState('')
  const [maxPriceFilter, setMaxPriceFilter] = useState('')
  const [minRatingFilter, setMinRatingFilter] = useState('0')
  const [brandFilter, setBrandFilter] = useState('all')
  const [sizeFilter, setSizeFilter] = useState('all')
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isShopChromeHidden, setIsShopChromeHidden] = useState(false)
  const [currencySymbol, setCurrencySymbol] = useState('ر.س')
  const [currencyCode, setCurrencyCode] = useState('SAR')
  const [addingToCartId, setAddingToCartId] = useState(null)
  const trackedListSignatureRef = useRef('')
  const trackedSearchSignatureRef = useRef('')
  const deferredSearchTerm = useDeferredValue(searchTerm)
  const hasHydratedFiltersRef = useRef(false)
  const normalizedSearchTerm = (deferredSearchTerm || '').toString().trim().toLowerCase()

  // small toast helper used across this page
  const showToast = (message, type = 'info') => {
    try {
      setToast({ message, type })
      setTimeout(() => setToast(null), 3000)
    } catch (e) {
      // ignore if component unmounted
    }
  }

  const categories = [
    { id: 'all', name: 'الكل', icon: '🛍️' },
    { id: 'men', name: 'رجالي', icon: '👨' },
    { id: 'women', name: 'نسائي', icon: '👩' },
    { id: 'incense', name: 'بخور', icon: '🕯️' },
    { id: 'cosmetics', name: 'مستحضرات', icon: '💄' }
  ]

  const categoryNameById = categories.reduce((acc, c) => { acc[c.id] = c.name; return acc }, {})

  const availableBrands = useMemo(() => {
    const brands = [...new Set(perfumes.map((p) => String(p?.brand || '').trim()).filter(Boolean))]
    return brands.sort((a, b) => a.localeCompare(b, 'ar'))
  }, [perfumes])

  const filteredPerfumes = useMemo(() => {
    return perfumes.filter(p => {
      if (!p) return false
      if (activeCategory && activeCategory !== 'all' && p.category !== activeCategory) return false

      const basePrice = Number(p?.price || 0)
      const minPrice = Number(minPriceFilter || 0)
      const maxPrice = Number(maxPriceFilter || 0)
      if (minPriceFilter !== '' && basePrice < minPrice) return false
      if (maxPriceFilter !== '' && basePrice > maxPrice) return false

      const ratingValue = Number((p.averageRating ?? p.rating) ?? 0)
      const minRating = Number(minRatingFilter || 0)
      if (minRating > 0 && ratingValue < minRating) return false

      if (brandFilter !== 'all' && String(p.brand || '').trim() !== brandFilter) return false

      if (sizeFilter !== 'all') {
        const productSizes = Array.isArray(p.sizes) && p.sizes.length > 0
          ? p.sizes.map((item) => String(item || '').toLowerCase())
          : ['50ml', '100ml']
        if (!productSizes.includes(sizeFilter.toLowerCase())) return false
      }

      // quick filters
      const tags = (p.tags || []).map(t => String(t || '').toLowerCase())
      const badgeText = String(p.badge || '').toLowerCase()
      if (activeQuickFilter === 'best-seller') {
        if (!((p.purchasedCount ?? 0) > 0)) return false
      }
      if (activeQuickFilter === 'limited') {
        if (!(p.isLimitedEdition || tags.includes('limited') || badgeText.includes('limited') || badgeText.includes('إصدار محدود'))) return false
      }
      if (activeQuickFilter === 'curated') {
        if (!(p.isExclusive || tags.includes('curated') || badgeText.includes('curated') || badgeText.includes('حصري') || badgeText.includes('مختارات'))) return false
      }
      // 'new' will be handled by sorting (no filter)
      if (!normalizedSearchTerm) return true
      const hay = `${p.name || ''} ${p.brand || ''} ${p.description || ''}`.toLowerCase()
      return hay.includes(normalizedSearchTerm)
    })
  }, [perfumes, activeCategory, normalizedSearchTerm, activeQuickFilter, minPriceFilter, maxPriceFilter, minRatingFilter, brandFilter, sizeFilter])

  const sortedPerfumes = useMemo(() => {
    const arr = [...filteredPerfumes]
    // apply quick-filter driven sorts first
    if (activeQuickFilter === 'best-seller') {
      arr.sort((a,b) => (b.purchasedCount||0) - (a.purchasedCount||0))
      return arr
    }
    if (activeQuickFilter === 'new') {
      arr.sort((a,b) => (b.id||0) - (a.id||0))
      return arr
    }

    if (sortBy === 'best-seller') arr.sort((a,b) => (b.purchasedCount||0) - (a.purchasedCount||0))
    else if (sortBy === 'price-low' || sortBy === 'cheapest') arr.sort((a,b) => (a.price||0) - (b.price||0))
    else if (sortBy === 'price-high') arr.sort((a,b) => (b.price||0) - (a.price||0))
    else if (sortBy === 'rating-high') arr.sort((a,b) => Number((b.averageRating ?? b.rating) ?? 0) - Number((a.averageRating ?? a.rating) ?? 0))
    else if (sortBy === 'name') arr.sort((a,b) => (a.name||'').localeCompare(b.name||''))
    else if (sortBy === 'discount') arr.sort((a,b) => (b.discount||0) - (a.discount||0))
    return arr
  }, [filteredPerfumes, sortBy, activeQuickFilter])

  const newestIdThreshold = useMemo(() => {
    const maxId = perfumes.reduce((max, p) => Math.max(max, Number(p?.id || 0)), 0)
    return Math.max(0, maxId - 15)
  }, [perfumes])
  
  const { addToCart, toggleWishlist, isInWishlist, maintenanceMode, maintenanceMessage } = useCart()
  const [socialProofMessage, setSocialProofMessage] = useState('')
  const [showFirstOrderPopup, setShowFirstOrderPopup] = useState(false)
  const { isAdmin } = useAdmin()

  useEffect(() => {
    const loadPerfumes = async () => {
      try {
        const [data, settings] = await Promise.all([fetchPerfumes(), fetchStoreSettings()])
        setPerfumes(data)
        if (settings) {
          setCurrencySymbol(settings.currencySymbol || 'ر.س')
          setCurrencyCode(settings.currencyCode || 'SAR')
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadPerfumes()

    // hydrate filters from URL on mount
    try {
      const params = new URLSearchParams(window.location.search)
      const category = params.get('category')
      const q = params.get('q')
      const sort = params.get('sort')

      if (category) setActiveCategory(category)
      if (q) setSearchTerm(q)
      if (sort) setSortBy(sort)
    } catch (err) {
      // ignore URL parse errors
    }
  }, [])

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 1024) {
        setIsFilterOpen(false)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    let lastY = window.scrollY || 0
    let hidden = false

    const applyHidden = (next) => {
      if (hidden === next) return
      hidden = next
      setIsShopChromeHidden(next)
    }

    const onScroll = () => {
      const isMobile = window.matchMedia('(max-width: 992px)').matches
      if (!isMobile) {
        applyHidden(false)
        lastY = window.scrollY || 0
        return
      }

      if (isFilterOpen) {
        applyHidden(false)
        lastY = window.scrollY || 0
        return
      }

      const currentY = window.scrollY || 0
      if (currentY < 36) {
        applyHidden(false)
        lastY = currentY
        return
      }

      const delta = currentY - lastY
      if (delta > 2 && currentY > 96) {
        applyHidden(true)
      } else if (delta < -2) {
        applyHidden(false)
      }

      lastY = currentY
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    onScroll()

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [isFilterOpen])

  useEffect(() => {
    try {
      const dismissed = window.localStorage.getItem('first-order-popup-dismissed')
      if (!dismissed) {
        const timer = setTimeout(() => setShowFirstOrderPopup(true), 1400)
        return () => clearTimeout(timer)
      }
    } catch (err) {
      // ignore localStorage access issues
    }
    return undefined
  }, [])

  useEffect(() => {
    if (!perfumes.length) return undefined

    const timeouts = []
    const showMessage = () => {
      const inStockLow = perfumes.filter((p) => Number(p?.stock ?? 0) > 0 && Number(p?.stock ?? 0) <= 3)
      const purchasedRecently = perfumes.filter((p) => Number(p?.purchasedCount ?? 0) > 0)

      let message = ''
      if (purchasedRecently.length > 0 && Math.random() > 0.35) {
        const pick = purchasedRecently[Math.floor(Math.random() * purchasedRecently.length)]
        message = `شخص اشترى قبل قليل: ${pick.name}`
      } else if (inStockLow.length > 0) {
        const pick = inStockLow[Math.floor(Math.random() * inStockLow.length)]
        message = `باقي ${pick.stock} قطع فقط من ${pick.name}`
      } else {
        const pick = perfumes[Math.floor(Math.random() * perfumes.length)]
        message = `شخص اشترى قبل قليل: ${pick.name}`
      }

      setSocialProofMessage(message)
      const hideTimer = setTimeout(() => setSocialProofMessage(''), 4200)
      timeouts.push(hideTimer)
    }

    showMessage()
    const interval = setInterval(showMessage, 9000)

    return () => {
      clearInterval(interval)
      timeouts.forEach((timer) => clearTimeout(timer))
    }
  }, [perfumes])

  const dismissFirstOrderPopup = () => {
    setShowFirstOrderPopup(false)
    try {
      window.localStorage.setItem('first-order-popup-dismissed', '1')
    } catch (err) {
      // ignore localStorage access issues
    }
  }

  const handleImageSelect = (file) => {
    if (!file) {
      setImageQuery(null)
      setImagePreview(null)
      return
    }
    setImageQuery(file)
    const reader = new FileReader()
    reader.onload = (e) => setImagePreview(e.target.result)
    reader.readAsDataURL(file)
  }

  const cancelImageSearch = () => {
    try {
      if (imageSearchAbortRef.current) {
        imageSearchAbortRef.current.abort()
      }
    } catch (e) {}
    setImageSearchLoading(false)
  }

  const submitImageSearch = async (fileParam) => {
    const fileToSend = fileParam || imageQuery
    if (!fileToSend) return
    // if file was passed directly, update preview/query
    if (fileParam) handleImageSelect(fileParam)
    setImageSearchLoading(true)
    // create abort controller for this request
    try { imageSearchAbortRef.current = new AbortController(); } catch (e) { imageSearchAbortRef.current = null }
    try {
      // reject unsupported mobile HEIC/HEIF uploads (ImageSharp may not decode these)
      const fname = (fileToSend.name || '').toLowerCase()
      const ftype = (fileToSend.type || '').toLowerCase()
      if (ftype.includes('heic') || fname.endsWith('.heic') || fname.endsWith('.heif')) {
        setToast({ message: 'نوع الصورة غير مدعوم حالياً — استخدم JPG أو PNG', type: 'error' })
        setImageSearchLoading(false)
        return
      }
      // client-side validation: size/type
      const MaxBytes = 5 * 1024 * 1024
      if (fileToSend.size > MaxBytes) {
        setToast({ message: 'حجم الصورة كبير جداً — الحد الأقصى 5MB', type: 'error' })
        setImageSearchLoading(false)
        return
      }
      const mime = (fileToSend.type || '').toLowerCase()
      if (!mime.startsWith('image/') || !(mime.includes('jpeg') || mime.includes('png') || mime.includes('webp'))) {
        setToast({ message: 'نوع الصورة غير مدعوم — استخدم JPG أو PNG أو WEBP', type: 'error' })
        setImageSearchLoading(false)
        return
      }

      const fd = new FormData()
      fd.append('image', fileToSend)
      const results = await searchPerfumesByImage(fd, { signal: imageSearchAbortRef.current?.signal })
      if (Array.isArray(results)) {
        setPerfumes(results)
        setActiveCategory('all')
        setSearchTerm('')
        setToast({ message: 'تمت عملية البحث بالصور (نسخة تجريبية)', type: 'success' })
        setTimeout(() => setToast(null), 3000)
      }
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || 'فشل البحث بالصور'
      setToast({ message: detail, type: 'error' })
      setTimeout(() => setToast(null), 4000)
    } finally {
      setImageSearchLoading(false)
      imageSearchAbortRef.current = null
    }
  }

  useEffect(() => {
    if (!sortedPerfumes.length) return
    const signature = `${activeCategory}|${normalizedSearchTerm}|${sortBy}|${sortedPerfumes.map((p) => p.id).join(',')}`
    if (trackedListSignatureRef.current === signature) return

    trackViewItemList({
      items: sortedPerfumes,
      currency: currencyCode,
      itemListName: activeCategory === 'all' ? 'shop_all' : `shop_${activeCategory}`
    })
    trackedListSignatureRef.current = signature
  }, [sortedPerfumes, currencyCode, activeCategory, normalizedSearchTerm, sortBy])

  useEffect(() => {
    if (!normalizedSearchTerm) return
    const signature = `${normalizedSearchTerm}|${sortedPerfumes.map((p) => p.id).join(',')}`
    if (trackedSearchSignatureRef.current === signature) return

    trackSearch({
      searchTerm: normalizedSearchTerm,
      items: sortedPerfumes,
      currency: currencyCode
    })
    trackedSearchSignatureRef.current = signature
  }, [normalizedSearchTerm, sortedPerfumes, currencyCode])

  const handleAddToCart = (perfume) => {
    if (addingToCartId === perfume.id) return false
    setAddingToCartId(perfume.id)

    if (maintenanceMode) {
      showToast(maintenanceMessage || 'المتجر تحت الصيانة حالياً', 'error')
      setAddingToCartId(null)
      return false
    }

    if ((perfume.stock ?? 0) <= 0) {
      showToast('هذا المنتج غير متوفر حالياً', 'error')
      setAddingToCartId(null)
      return false
    }

    const added = addToCart(perfume)
    if (!added) {
      showToast('لا يمكن إضافة المنتج حالياً', 'error')
      setTimeout(() => setAddingToCartId((current) => (current === perfume.id ? null : current)), 450)
      return false
    }

    trackAddToCart({ item: perfume, quantity: 1, currency: currencyCode })
    showToast(`تمت إضافة ${perfume.name} إلى السلة`)
    setTimeout(() => setAddingToCartId((current) => (current === perfume.id ? null : current)), 450)
    return true
  }

  const [quickView, setQuickView] = useState(null)

  const openProductDetails = (perfume) => {
    const itemListName = activeCategory === 'all' ? 'shop_all' : `shop_${activeCategory}`
    trackSelectItem({
      item: perfume,
      currency: currencyCode,
      itemListName
    })
    setQuickView(perfume)
  }

  const handleToggleWishlist = (perfume) => {
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
        : 'تمت إضافة المنتج للمفضلة'
    )
  }

  const handleResetFilters = () => {
    setSearchTerm('')
    setActiveCategory('all')
    setSortBy('default')
    setActiveQuickFilter('')
    setMinPriceFilter('')
    setMaxPriceFilter('')
    setMinRatingFilter('0')
    setBrandFilter('all')
    setSizeFilter('all')
    setIsFilterOpen(false)
  }

  const handleCategorySelect = (categoryId, event) => {
    setActiveCategory(categoryId)

    const tabElement = event?.currentTarget
    if (tabElement && typeof tabElement.scrollIntoView === 'function') {
      tabElement.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      })
    }
  }

  if (loading) {
    return <SkeletonGrid columns={3} rows={2} />
  }

  if (error) return <main className="container"><p className="error" role="alert">❌ خطأ: {error}</p></main>

  return (
    <main className={`container shop-page--shein${isShopChromeHidden ? ' shop-chrome-hidden' : ''}`}>
      {quickView && (
        <QuickView perfume={quickView} currencySymbol={currencySymbol} onClose={() => setQuickView(null)} onAddToCart={handleAddToCart} />
      )}
      {socialProofMessage && (
        <div className="shop-social-proof" role="status" aria-live="polite">
          <span className="shop-social-proof-dot" aria-hidden>●</span>
          <span>{socialProofMessage}</span>
        </div>
      )}
      {toast && (
        <div className={`toast ${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'} aria-live={toast.type === 'error' ? 'assertive' : 'polite'} aria-atomic="true">
          {toast.message}
        </div>
      )}
      {showFirstOrderPopup && (
        <div className="first-order-popup-overlay" role="dialog" aria-modal="true" aria-label="خصم أول طلب">
          <div className="first-order-popup-card">
            <button type="button" className="first-order-popup-close" onClick={dismissFirstOrderPopup} aria-label="إغلاق">✕</button>
            <div className="first-order-popup-badge">خصم ترحيبي</div>
            <h3>خصم 15% على أول طلب</h3>
            <p>استخدم الكود FIRST15 عند إتمام الطلب واحصل على خصم فوري.</p>
            <div className="first-order-popup-actions">
              <button type="button" className="first-order-popup-secondary" onClick={dismissFirstOrderPopup}>لاحقاً</button>
              <Link href="/shop" className="first-order-popup-primary" onClick={dismissFirstOrderPopup}>احصل على الخصم</Link>
            </div>
          </div>
        </div>
      )}
      
      <div className="shop-top-promo" role="status" aria-live="polite">
        <span className="shop-top-promo__item trust-word-white">⚡ عروض يومية متجددة</span>
        <span className="shop-top-promo__item trust-word-white">🚚 شحن سريع داخل المملكة</span>
        <span className="shop-top-promo__item trust-word-white">💎 منتجات أصلية 100%</span>
      </div>

      <div className="header-section shop-hero-head">
        <h1>متجر العطور</h1>
        <p className="shop-hero-subtitle">اكتشف أحدث العطور والعروض الحصرية بأسلوب تسوق سريع</p>
        <div className="header-actions">
          <Link href="/" className="btn btn-secondary">🏠 الصفحة الرئيسية</Link>
        </div>
      </div>

      <div className="search-container shop-toolbar">
        <div className="search-box shop-searchbox" style={{position:'relative'}}>
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="ابحث عن عطر أو ماركة..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-btn" onClick={() => setSearchTerm('')}>✕</button>
          )}
          {/* camera upload inside search field */}
          <label className="camera-btn" title="ابحث بصورة">
            <input type="file" accept="image/*" style={{display:'none'}} onChange={(e) => submitImageSearch(e.target.files[0])} disabled={imageSearchLoading} />
            {imageSearchLoading ? (
              <span className="camera-spinner" aria-hidden>⏳</span>
            ) : (
              <span aria-hidden>📷</span>
            )}
          </label>
          {imageSearchLoading && (
            <button type="button" className="btn btn-secondary camera-cancel" onClick={cancelImageSearch}>إلغاء</button>
          )}
          {imagePreview && (
            <div className="image-preview" title="معاينة الصورة">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreview} alt="preview" />
            </div>
          )}
          <div className="search-note">بحث بالصور — تجريبي</div>
        </div>
        <div className="sort-controls">
          <label>ترتيب حسب:</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="sort-select">
            <option value="default">الافتراضي</option>
            <option value="best-seller">الأكثر مبيعاً</option>
            <option value="cheapest">الأرخص</option>
            <option value="rating-high">الأعلى تقييماً</option>
            <option value="price-low">السعر: من الأقل للأعلى</option>
            <option value="price-high">السعر: من الأعلى للأقل</option>
            <option value="name">الاسم: أ - ي</option>
            <option value="discount">الأكثر خصماً</option>
          </select>
        </div>
        <button
          className="btn btn-secondary shop-filter-toggle"
          type="button"
          onClick={() => setIsFilterOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={isFilterOpen}
          aria-controls="shop-mobile-filters"
        >
          ⚙️ الفلتر
        </button>
        {(searchTerm.trim() || activeCategory !== 'all' || sortBy !== 'default' || activeQuickFilter || minPriceFilter !== '' || maxPriceFilter !== '' || minRatingFilter !== '0' || brandFilter !== 'all' || sizeFilter !== 'all') && (
          <button className="btn btn-secondary" onClick={handleResetFilters} type="button">
            إعادة ضبط الفلاتر
          </button>
        )}
        <div className="results-count shop-results-pill">
          {sortedPerfumes.length} منتج
        </div>
      </div>

      {isFilterOpen && (
        <button
          type="button"
          className="shop-filter-backdrop"
          aria-label="إغلاق الفلتر"
          onClick={() => setIsFilterOpen(false)}
        />
      )}

      <div className="shop-content-layout">
        <aside
          id="shop-mobile-filters"
          className={`shop-side-filters ${isFilterOpen ? 'is-open' : ''}`}
          aria-label="فلترة المنتجات"
          aria-hidden={isFilterOpen ? 'false' : 'true'}
        >
          <div className="shop-side-filters__inner">
            <div className="shop-side-filters__header">
              <h3>فلترة احترافية</h3>
              <button type="button" className="shop-side-filters__close" onClick={() => setIsFilterOpen(false)} aria-label="إغلاق الفلتر">✕</button>
            </div>

            <div className="filter-group">
              <label htmlFor="filter-min-price">السعر من</label>
              <input
                id="filter-min-price"
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="0"
                value={minPriceFilter}
                onChange={(event) => setMinPriceFilter(event.target.value)}
              />
            </div>

            <div className="filter-group">
              <label htmlFor="filter-max-price">السعر إلى</label>
              <input
                id="filter-max-price"
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="1000"
                value={maxPriceFilter}
                onChange={(event) => setMaxPriceFilter(event.target.value)}
              />
            </div>

            <div className="filter-group">
              <label htmlFor="filter-category">الفئة</label>
              <select
                id="filter-category"
                value={activeCategory}
                onChange={(event) => setActiveCategory(event.target.value)}
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="filter-min-rating">التقييم</label>
              <select
                id="filter-min-rating"
                value={minRatingFilter}
                onChange={(event) => setMinRatingFilter(event.target.value)}
              >
                <option value="0">الكل</option>
                <option value="4.5">4.5+ نجوم</option>
                <option value="4">4+ نجوم</option>
                <option value="3">3+ نجوم</option>
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="filter-brand">الماركة</label>
              <select
                id="filter-brand"
                value={brandFilter}
                onChange={(event) => setBrandFilter(event.target.value)}
              >
                <option value="all">كل الماركات</option>
                {availableBrands.map((brand) => (
                  <option key={brand} value={brand}>{brand}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="filter-size">الحجم</label>
              <select
                id="filter-size"
                value={sizeFilter}
                onChange={(event) => setSizeFilter(event.target.value)}
              >
                <option value="all">كل الأحجام</option>
                <option value="50ml">50ml</option>
                <option value="100ml">100ml</option>
              </select>
            </div>

            <div className="quick-filters" role="region" aria-label="تجميعات سريعة">
              <button className={`quick-filter-btn ${activeQuickFilter === 'best-seller' ? 'active' : ''}`} onClick={() => setActiveQuickFilter(activeQuickFilter === 'best-seller' ? '' : 'best-seller')}>🔥 الأكثر مبيعاً</button>
              <button className={`quick-filter-btn ${activeQuickFilter === 'new' ? 'active' : ''}`} onClick={() => setActiveQuickFilter(activeQuickFilter === 'new' ? '' : 'new')}>🆕 وصل حديثاً</button>
              <button className={`quick-filter-btn ${activeQuickFilter === 'curated' ? 'active' : ''}`} onClick={() => setActiveQuickFilter(activeQuickFilter === 'curated' ? '' : 'curated')}>👑 مختارات خاصة</button>
              <button className={`quick-filter-btn ${activeQuickFilter === 'limited' ? 'active' : ''}`} onClick={() => setActiveQuickFilter(activeQuickFilter === 'limited' ? '' : 'limited')}>💎 إصدار محدود</button>
            </div>

            <div className="shop-side-filters__footer">
              <button className="btn btn-secondary" type="button" onClick={handleResetFilters}>إعادة الضبط</button>
              <button className="btn" type="button" onClick={() => setIsFilterOpen(false)}>عرض النتائج</button>
            </div>
          </div>
        </aside>

        <section className="shop-list-area">
          <div className="categories-tabs shop-categories-tabs" aria-label="فئات المنتجات">
            {categories.map(cat => (
              <button
                key={cat.id}
                className={`category-tab shop-category-tab ${activeCategory === cat.id ? 'active' : ''}`}
                onClick={(event) => handleCategorySelect(cat.id, event)}
              >
                <span className="cat-icon">{cat.icon}</span>
                <span>{cat.name}</span>
              </button>
            ))}
          </div>

          <div className="perfumes-grid">
        {sortedPerfumes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <h3>لا توجد نتائج</h3>
            <p>جرب البحث بكلمات مختلفة</p>
          </div>
        ) : (
          sortedPerfumes.map((perfume, index) => {
            const safeImageSrc = resolveImageSrc(perfume.imageUrl)
            const discountedPrice = perfume.discount > 0 
              ? perfume.price * (1 - perfume.discount / 100) 
              : perfume.price;
            const savingsAmount = perfume.discount > 0 ? (perfume.price - discountedPrice) : 0
            const purchasedCount = Number(perfume.purchasedCount || 0)
            const isBestSeller = Number(perfume.purchasedCount || 0) >= 10
            const isNewArrival = Number(perfume.id || 0) >= newestIdThreshold
            const isLowStock = Number(perfume.stock ?? 0) > 0 && Number(perfume.stock ?? 0) <= 3
            const delayClass = `shop-card-delay-${(index % 8) + 1}`
            const sizeSummary = Array.isArray(perfume.sizes) && perfume.sizes.length > 0
              ? perfume.sizes.join(' / ')
              : '50ml / 100ml'
            const categoryLabel = categoryNameById[perfume.category] || 'منتج متنوع'
            const miniDetails = `${categoryLabel} • ${sizeSummary}`
            
            return (
            <div 
              key={perfume.id} 
              className={`perfume-card shop-product-card ${delayClass}`}
            >
              <div className="shop-card-top-badges" aria-label="مؤشرات المنتج">
                {isBestSeller && <span className="shop-card-top-badge badge-hot">🔥 الأكثر مبيعاً</span>}
                {isLowStock && <span className="shop-card-top-badge badge-stock">باقي {perfume.stock} قطع فقط</span>}
                {purchasedCount > 0 && <span className="shop-card-top-badge badge-sales">تم شراءه {purchasedCount} مرة</span>}
              </div>
              {perfume.imageUrl && (
                <div className="perfume-image" role="group" aria-label={`${perfume.name} - ${perfume.brand}`}>
                  <Image
                    src={safeImageSrc}
                    alt={perfume.name || perfume.brand}
                    width={400}
                    height={300}
                    unoptimized={!isOptimizableImageSrc(safeImageSrc)}
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="shop-perfume-image"
                    onClick={() => openProductDetails(perfume)}
                    onKeyDown={(event) => handleKeyboardActivate(event, () => openProductDetails(perfume))}
                    role="button"
                    tabIndex={0}
                    aria-label={`عرض تفاصيل ${perfume.name}`}
                    priority={index === 0}
                    loading={index === 0 ? 'eager' : 'lazy'}
                    placeholder="blur"
                    blurDataURL={BLUR_DATA_URL}
                  />
                  <button
                    type="button"
                    className="shop-quick-btn"
                    onClick={() => openProductDetails(perfume)}
                    onKeyDown={(event) => handleKeyboardActivate(event, () => openProductDetails(perfume))}
                    aria-label={`عرض سريع ${perfume.name}`}
                  >
                    عرض سريع
                  </button>
                  {(perfume.stock ?? 0) <= 0 && (
                    <span className="badge shop-soldout-badge">نفد</span>
                  )}

                  {((perfume.stock ?? 0) > 0 && (isBestSeller || isNewArrival) && Number(perfume.discount ?? 0) <= 0) && (
                    <span className="badge shop-product-badge">
                      {isBestSeller ? 'الأكثر مبيعاً' : 'جديد'}
                    </span>
                  )}

                  {/* Single badge: prefer discount, then limited edition */}
                  {(() => {
                    const badgeText = String(perfume.badge || '').toLowerCase()
                    const tags = (perfume.tags || []).map(t => String(t || '').toLowerCase())
                    const isLimited = !!(perfume.isLimitedEdition || tags.includes('limited') || badgeText.includes('limited') || badgeText.includes('إصدار محدود'))
                    if ((perfume.discount ?? 0) > 0) {
                      return (
                        <span className="badge sale-badge shop-discount-corner">
                          <span className="shop-discount-icon" aria-hidden>🏷</span>
                          <span className="shop-discount-value">خصم {perfume.discount}%</span>
                        </span>
                      )
                    }
                    if (isLimited) {
                      return <span className="badge badge--ribbon">إصدار محدود</span>
                    }
                    return null
                  })()}
                  {/* legacy image-overlay removed in favor of explicit quick-action buttons */}
                </div>
              )}
                <div className="perfume-content shop-product-content">
                  <div className="content-header">
                    <h2 
                      onClick={() => openProductDetails(perfume)}
                      className="shop-product-title"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => handleKeyboardActivate(event, () => openProductDetails(perfume))}
                    >
                      {perfume.name}
                    </h2>
                    {isAdmin && (
                      <div className="menu-wrapper">
                        <button 
                          className="menu-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleMenu(perfume.id)
                          }}
                          title="خيارات"
                        >
                          ⋮
                        </button>
                        {openMenu === perfume.id && (
                          <div className="dropdown-menu" onClick={(e) => e.stopPropagation()}>
                            <button
                              className="menu-item edit"
                              onClick={() => handleEdit(perfume.id)}
                            >
                              <span className="menu-icon">✏️</span>
                              <span>تعديل</span>
                            </button>
                            <button
                              className="menu-item delete"
                              onClick={() => handleDelete(perfume.id)}
                              disabled={deleting === perfume.id}
                            >
                              <span className="menu-icon">{deleting === perfume.id ? '⏳' : '🗑️'}</span>
                              <span>{deleting === perfume.id ? 'جاري الحذف...' : 'حذف'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <p className="shop-card-mini-details">{miniDetails}</p>

                  {/* Price hierarchy: primary large bold, old small strikethrough */}
                  <div className="price-section">
                    <div className="price-main new-layout">
                      <div className="price-primary new-price"><span className="price-value">{(discountedPrice || 0).toFixed(2)}</span> <span className="currency">{currencySymbol}</span></div>
                      {perfume.discount > 0 && (
                        <div className="price-old small-old"><span className="price-value">{perfume.price.toFixed(2)}</span> <span className="currency">{currencySymbol}</span></div>
                      )}
                    </div>
                    {savingsAmount > 0 && (
                      <div className="shop-savings-text">وفر {savingsAmount.toFixed(2)} {currencySymbol}</div>
                    )}
                  </div>

                  {/* Full-width black CTA */}
                  <button 
                    className={`btn-full-black hover-cart-cta cart-add-btn${addingToCartId === perfume.id ? ' is-loading' : ''}`}
                    onClick={() => handleAddToCart(perfume)}
                    disabled={addingToCartId === perfume.id || maintenanceMode || (perfume.stock ?? 0) <= 0}
                    aria-label={maintenanceMode ? 'المتجر تحت الصيانة' : ((perfume.stock ?? 0) > 0 ? 'أضف إلى السلة' : 'غير متوفر')}
                  >
                    {addingToCartId === perfume.id ? (
                      <>
                        <span className="btn-spinner" aria-hidden="true" />
                        <span>جاري الإضافة...</span>
                      </>
                    ) : maintenanceMode ? (
                      'المتجر تحت الصيانة'
                    ) : ((perfume.stock ?? 0) > 0 ? (
                      <>
                        <span aria-hidden="true">🛒</span>
                        <span>أضف إلى السلة</span>
                      </>
                    ) : 'غير متوفر')}
                  </button>
                </div>
            </div>
            );
          })
        )}
          </div>
        </section>
      </div>
    </main>
  )
}

// render quick view portal at end of module
export function __quickViewPlaceholder() { return null }
