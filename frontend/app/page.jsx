'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { fetchPerfumes, fetchStoreSettings } from '@/lib/api'
import Hero from '@/components/Hero'
import { BLUR_DATA_URL, isOptimizableImageSrc, resolveImageSrc } from '@/lib/imagePlaceholders'
import { trackLandingInteraction, trackSelectPromotion, trackViewPromotion } from '@/lib/analytics'

const FEATURED_SORT_STORAGE_KEY = 'home_featured_sort'
const VALID_FEATURED_SORTS = ['discount', 'newest', 'price-low']

const normalizeFeaturedSort = (value) => (VALID_FEATURED_SORTS.includes(value) ? value : 'discount')

export default function Home() {
  const isDataImage = (value) => typeof value === 'string' && value.startsWith('data:image/')
  const [storeInfo, setStoreInfo] = useState({
    storeName: 'عطور الإمبراطورية',
    storeTagline: 'وجهتك الأولى للعطور الفاخرة والأصلية',
    logoIcon: '✨',
    logoText: 'عطور الإمبراطورية',
    logoImageUrl: '',
    logoBackgroundColor: '#ffffff',
    currencySymbol: 'ر.س',
    freeShippingThreshold: 500
  })
  const [featuredProducts, setFeaturedProducts] = useState([])
  const [featuredSort, setFeaturedSort] = useState('discount')
  const [isFeaturedSortReady, setIsFeaturedSortReady] = useState(false)

  useEffect(() => {
    try {
      const urlSort = new URLSearchParams(window.location.search).get('featuredSort')
      if (urlSort && VALID_FEATURED_SORTS.includes(urlSort)) {
        setFeaturedSort(urlSort)
        setIsFeaturedSortReady(true)
        return
      }

      const savedSort = localStorage.getItem(FEATURED_SORT_STORAGE_KEY)
      if (savedSort && VALID_FEATURED_SORTS.includes(savedSort)) {
        setFeaturedSort(savedSort)
      }
      setIsFeaturedSortReady(true)
    } catch {
      // keep default featured sort
      setIsFeaturedSortReady(true)
    }
  }, [])

  useEffect(() => {
    try {
      const normalized = normalizeFeaturedSort(featuredSort)
      localStorage.setItem(FEATURED_SORT_STORAGE_KEY, normalized)

      const currentUrl = new URL(window.location.href)
      if (normalized === 'discount') {
        currentUrl.searchParams.delete('featuredSort')
      } else {
        currentUrl.searchParams.set('featuredSort', normalized)
      }

      window.history.replaceState({}, '', `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`)
    } catch {
      // ignore storage write issues
    }
  }, [featuredSort])

  useEffect(() => {
    if (!isFeaturedSortReady) return

    trackLandingInteraction({
      action: 'featured_sort_changed',
      label: featuredSort,
      section: 'featured_products'
    })
  }, [featuredSort, isFeaturedSortReady])

  useEffect(() => {
    ;(async () => {
      try {
        const [data, perfumes] = await Promise.all([fetchStoreSettings(), fetchPerfumes()])
        if (data) {
          setStoreInfo({
            storeName: data.storeName || 'عطور الإمبراطورية',
            storeTagline: data.storeTagline || 'وجهتك الأولى للعطور الفاخرة والأصلية',
            logoIcon: data.logoIcon || '✨',
            logoText: data.logoText || data.storeName || 'عطور الإمبراطورية',
            logoImageUrl: data.logoImageUrl || '',
            logoBackgroundColor: data.logoBackgroundColor || '#ffffff',
            currencySymbol: data.currencySymbol || 'ر.س',
            freeShippingThreshold: Number(data.freeShippingThreshold ?? 500)
          })
        }

        if (Array.isArray(perfumes)) {
          const sortedFeatured = [...perfumes]
            .filter((item) => item && item.id && Number(item.stock ?? 0) > 0)
            .sort((a, b) => Number(b.discount || 0) - Number(a.discount || 0))
            .slice(0, 4)

          setFeaturedProducts(sortedFeatured)
        }
      } catch {
        // keep defaults
      }
    })()
  }, [])

  const sortedFeaturedProducts = useMemo(() => {
    const products = [...featuredProducts]

    switch (featuredSort) {
      case 'newest':
        return products.sort((a, b) => Number(b.id || 0) - Number(a.id || 0))
      case 'price-low':
        return products.sort((a, b) => {
          const priceA = Number(a.discount || 0) > 0
            ? Number(a.price || 0) * (1 - Number(a.discount || 0) / 100)
            : Number(a.price || 0)
          const priceB = Number(b.discount || 0) > 0
            ? Number(b.price || 0) * (1 - Number(b.discount || 0) / 100)
            : Number(b.price || 0)
          return priceA - priceB
        })
      case 'discount':
      default:
        return products.sort((a, b) => Number(b.discount || 0) - Number(a.discount || 0))
    }
  }, [featuredProducts, featuredSort])

  const trackLandingClick = (action, label, section) => {
    trackLandingInteraction({ action, label, section })
  }

  const categories = [
    {
      id: 'men',
      title: 'عطور رجالي',
      icon: '👔',
      description: 'تشكيلة فاخرة من العطور الرجالية العالمية',
      tone: 'tone-men',
      image: 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=500',
      count: '30+ منتج'
    },
    {
      id: 'women',
      title: 'عطور نسائي',
      icon: '💐',
      description: 'أرقى العطور النسائية الفاخرة',
      tone: 'tone-women',
      image: 'https://images.unsplash.com/photo-1595425970377-c9703cf48b6d?w=500',
      count: '40+ منتج'
    },
    {
      id: 'incense',
      title: 'بخور وعود',
      icon: '🪔',
      description: 'بخور وعود أصلي من أجود الأنواع',
      tone: 'tone-incense',
      image: 'https://images.unsplash.com/photo-1594035910387-fea47794261f?w=500',
      count: '20+ منتج'
    },
    {
      id: 'cosmetics',
      title: 'أدوات تجميل',
      icon: '✨',
      description: 'منتجات تجميل وعناية فاخرة',
      tone: 'tone-cosmetics',
      image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=500',
      count: '25+ منتج'
    }
  ]

  const testimonials = [
    {
      name: 'سارة أحمد',
      rating: 5,
      text: 'تجربة رائعة! العطور أصلية والتوصيل سريع جداً. أنصح الجميع بالتسوق من هنا',
      avatar: '👩'
    },
    {
      name: 'محمد علي',
      rating: 5,
      text: 'أفضل موقع للعطور الفاخرة. الأسعار ممتازة والجودة عالية',
      avatar: '👨'
    },
    {
      name: 'نورة خالد',
      rating: 5,
      text: 'خدمة عملاء ممتازة ومنتجات أصلية 100%. سأكرر الشراء بالتأكيد',
      avatar: '👩‍💼'
    }
  ]

  const offers = useMemo(() => ([
    {
      id: 'women_50_off',
      title: 'خصم 50%',
      description: 'على جميع العطور النسائية',
      icon: '🎉',
      href: '/shop?category=women'
    },
    {
      id: 'incense_bundle_offer',
      title: 'اشتر 2 واحصل على 1',
      description: 'على منتجات البخور والعود',
      icon: '🎁',
      href: '/shop?category=incense'
    },
    {
      id: 'free_shipping_offer',
      title: 'شحن مجاني',
      description: `للطلبات فوق ${storeInfo.freeShippingThreshold} ${storeInfo.currencySymbol}`,
      icon: '🚚',
      href: '/shop'
    }
  ]), [storeInfo.freeShippingThreshold, storeInfo.currencySymbol])

  useEffect(() => {
    offers.forEach((offer, index) => {
      trackViewPromotion({
        promotionId: offer.id,
        promotionName: offer.title,
        creativeName: 'home_offers',
        creativeSlot: `offer_${index + 1}`
      })
    })
  }, [offers])

  return (
    <main className="landing-page">
      {/* Hero Section */}
      <Hero storeInfo={storeInfo} />

      {/* Special Offers */}
      <section className="offers-section">
        <div className="offers-container">
          {offers.map((offer, index) => (
            <Link
              key={offer.id}
              href={offer.href}
              className={`offer-card home-delay-${index + 1}`}
              onClick={() => trackSelectPromotion({
                promotionId: offer.id,
                promotionName: offer.title,
                creativeName: 'home_offers',
                creativeSlot: `offer_${index + 1}`
              })}
            >
              <div className={`offer-icon offer-tone-${index + 1}`}>{offer.icon}</div>
              <h3 className="offer-title">{offer.title}</h3>
              <p className="offer-description">{offer.description}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Categories Section */}
      <section className="categories-section-enhanced">
        <div className="section-header-enhanced">
          <span className="section-badge">✨ اكتشف</span>
          <h2 className="section-title-enhanced">تسوق حسب الفئة</h2>
          <p className="section-description-enhanced">اختر من بين مجموعتنا المتنوعة من المنتجات الفاخرة</p>
        </div>
        
        <div className="categories-grid-enhanced">
          {categories.map((category, index) => (
            <Link
              key={category.id}
              href={`/shop?category=${category.id}`}
              className={`category-card-enhanced home-delay-${index + 1}`}
              onClick={() => trackLandingClick('category_click', category.id, 'categories')}
            >
              <div className="category-image-container">
                <Image
                  src={category.image}
                  alt={category.title}
                  className="category-img"
                  width={500}
                  height={320}
                  sizes="(max-width: 768px) 100vw, 50vw"
                  placeholder="blur"
                  blurDataURL={BLUR_DATA_URL}
                />
                <div className={`category-gradient-overlay ${category.tone}`}></div>
              </div>
              <div className="category-content-enhanced">
                <div className="category-header-flex">
                  <div className="category-icon-enhanced">{category.icon}</div>
                  <span className="category-count">{category.count}</span>
                </div>
                <h3 className="category-title-enhanced">{category.title}</h3>
                <p className="category-description-enhanced">{category.description}</p>
                <div className="category-action">
                  <span>تصفح الآن</span>
                  <svg className="svg-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section-enhanced">
        <div className="features-container">
          <div className="feature-card-enhanced">
            <div className="feature-icon-wrapper">
              <div className="feature-icon-enhanced">🚚</div>
            </div>
            <h3 className="feature-title">توصيل سريع ومجاني</h3>
            <p className="feature-description">توصيل مجاني للطلبات فوق {storeInfo.freeShippingThreshold} {storeInfo.currencySymbol} في جميع أنحاء المملكة</p>
          </div>
          <div className="feature-card-enhanced">
            <div className="feature-icon-wrapper">
              <div className="feature-icon-enhanced">✅</div>
            </div>
            <h3 className="feature-title">ضمان الأصالة</h3>
            <p className="feature-description">جميع منتجاتنا أصلية 100% مع ضمان استرجاع المال</p>
          </div>
          <div className="feature-card-enhanced">
            <div className="feature-icon-wrapper">
              <div className="feature-icon-enhanced">💳</div>
            </div>
            <h3 className="feature-title">دفع آمن ومرن</h3>
            <p className="feature-description">طرق دفع متعددة وآمنة بضمان حماية بياناتك</p>
          </div>
          <div className="feature-card-enhanced">
            <div className="feature-icon-wrapper">
              <div className="feature-icon-enhanced">💬</div>
            </div>
            <h3 className="feature-title">دعم فني 24/7</h3>
            <p className="feature-description">فريق دعم متاح على مدار الساعة لخدمتك</p>
          </div>
        </div>
      </section>

      {featuredProducts.length > 0 && (
        <section className="categories-section-enhanced">
          <div className="section-header-enhanced">
            <span className="section-badge">🔥 الأكثر طلباً</span>
            <h2 className="section-title-enhanced">منتجات مميزة الآن</h2>
            <p className="section-description-enhanced">منتجات مختارة مباشرة من المتجر مع أفضل العروض الحالية</p>
          </div>

          <div className="categories-tabs" role="tablist" aria-label="ترتيب المنتجات المميزة">
            <button
              type="button"
              className={`category-tab ${featuredSort === 'discount' ? 'active' : ''}`}
              onClick={() => setFeaturedSort('discount')}
              aria-pressed={featuredSort === 'discount'}
            >
              <span className="cat-icon">🔥</span>
              <span>الأكثر خصماً</span>
            </button>
            <button
              type="button"
              className={`category-tab ${featuredSort === 'newest' ? 'active' : ''}`}
              onClick={() => setFeaturedSort('newest')}
              aria-pressed={featuredSort === 'newest'}
            >
              <span className="cat-icon">🆕</span>
              <span>الأحدث</span>
            </button>
            <button
              type="button"
              className={`category-tab ${featuredSort === 'price-low' ? 'active' : ''}`}
              onClick={() => setFeaturedSort('price-low')}
              aria-pressed={featuredSort === 'price-low'}
            >
              <span className="cat-icon">💸</span>
              <span>الأرخص</span>
            </button>
          </div>

          <div className="perfumes-grid">
            {sortedFeaturedProducts.map((product, index) => {
              const finalPrice = Number(product.discount || 0) > 0
                ? Number(product.price || 0) * (1 - Number(product.discount || 0) / 100)
                : Number(product.price || 0)

              const safeImageSrc = resolveImageSrc(product.imageUrl)

              return (
                <div key={product.id} className={`perfume-card home-delay-${(index % 8) + 1}`}>
                  <Link
                      href={`/shop/product/${product.id}`}
                    className="perfume-image"
                    aria-label={`عرض ${product.name}`}
                    onClick={() => trackLandingClick('featured_product_click', String(product.id), 'featured_products')}
                  >
                    <Image
                      src={safeImageSrc}
                      alt={product.name || product.brand}
                      width={500}
                      height={320}
                      sizes="(max-width: 768px) 100vw, 33vw"
                      placeholder="blur"
                      blurDataURL={BLUR_DATA_URL}
                      unoptimized={!isOptimizableImageSrc(safeImageSrc)}
                    />
                    {Number(product.discount || 0) > 0 && (
                      <div className="discount-badge">-{Number(product.discount || 0)}%</div>
                    )}
                    {/* product badges: new / top-seller */}
                    {product.isNew && (
                      <div className="badge badge--ribbon">جديد</div>
                    )}
                    {product.isTopSeller && (
                      <div className="badge badge--circle">🔥</div>
                    )}
                  </Link>
                  <div className="perfume-content">
                    <h3 className="shop-clickable-title">{product.name}</h3>
                    <p className="brand">{product.brand}</p>
                    {/* rating row */}
                    <div className="rating-row">
                      <div className="stars" aria-hidden="true">
                        {[0,1,2,3,4].map((i) => {
                          const rating = Math.round(Number(product.averageRating || product.rating || 0))
                          return (
                            <span key={i} className={`star ${i < rating ? 'filled' : ''}`}>★</span>
                          )
                        })}
                      </div>
                      <div className="review-count">{Number(product.reviewsCount || 0) > 0 ? `${product.reviewsCount} تقييم` : 'لا تقييمات'}</div>
                    </div>

                    <div className="price-section">
                      {Number(product.discount || 0) > 0 ? (
                        <div className="price-row">
                          <div className="price-group">
                            <span className="original-price">{Number(product.price || 0).toFixed(2)} {storeInfo.currencySymbol}</span>
                            <span className="discounted-price">{finalPrice.toFixed(2)} {storeInfo.currencySymbol}</span>
                          </div>
                          <span className="badge sale-badge">عرض</span>
                        </div>
                      ) : (
                        <div className="price-row">
                          <span className="price">{Number(product.price || 0).toFixed(2)} {storeInfo.currencySymbol}</span>
                          <span className="badge">مميز</span>
                        </div>
                      )}
                    </div>
                    <Link
                      href={`/shop/product/${product.id}`}
                      className="btn btn-primary"
                      aria-label={`انتقل إلى ${product.name}`}
                      onClick={() => trackLandingClick('featured_product_click', String(product.id), 'featured_products')}
                    >
                      عرض المنتج
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section className="offers-section">
        <div className="section-header-enhanced">
          <span className="section-badge">⚡ خدمات سريعة</span>
          <h2 className="section-title-enhanced">اختصارات مهمة</h2>
          <p className="section-description-enhanced">نفّذ أكثر المهام استخداماً مباشرة من الصفحة الترحيبية</p>
        </div>
        <div className="offers-container">
          <Link
            href="/track-order"
            className="offer-card home-delay-1"
            aria-label="تتبع الطلب"
            onClick={() => trackLandingInteraction({ action: 'quick_service_click', label: 'track_order', section: 'quick_services' })}
          >
            <div className="offer-icon offer-tone-1">📦</div>
            <h3 className="offer-title">تتبع الطلب</h3>
            <p className="offer-description">أدخل رقم الطلب والهاتف لمعرفة آخر حالة فوراً</p>
          </Link>
          <Link
            href="/my-orders"
            className="offer-card home-delay-2"
            aria-label="عرض طلباتي"
            onClick={() => trackLandingInteraction({ action: 'quick_service_click', label: 'my_orders', section: 'quick_services' })}
          >
            <div className="offer-icon offer-tone-2">🧾</div>
            <h3 className="offer-title">طلباتي</h3>
            <p className="offer-description">شاهد جميع طلباتك السابقة وحالة الدفع والتسليم</p>
          </Link>
          <Link
            href="/contact"
            className="offer-card home-delay-3"
            aria-label="التواصل مع الدعم"
            onClick={() => trackLandingInteraction({ action: 'quick_service_click', label: 'contact_support', section: 'quick_services' })}
          >
            <div className="offer-icon offer-tone-3">💬</div>
            <h3 className="offer-title">الدعم والتواصل</h3>
            <p className="offer-description">تواصل سريع عبر الرسائل أو الهاتف أو البريد الإلكتروني</p>
          </Link>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="testimonials-section">
        <div className="section-header-enhanced">
          <span className="section-badge">💎 آراء العملاء</span>
          <h2 className="section-title-enhanced">ماذا يقول عملاؤنا</h2>
          <p className="section-description-enhanced">آلاف العملاء السعداء حول العالم</p>
        </div>
        <div className="testimonials-grid">
          {testimonials.map((testimonial, index) => (
            <div key={index} className={`testimonial-card home-delay-${index + 1}`}>
              <div className="testimonial-header">
                <div className="testimonial-avatar">{testimonial.avatar}</div>
                <div className="testimonial-info">
                  <h4 className="testimonial-name">{testimonial.name}</h4>
                  <div className="testimonial-rating">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <span key={i} className="star">⭐</span>
                    ))}
                  </div>
                </div>
              </div>
              <p className="testimonial-text">&ldquo;{testimonial.text}&rdquo;</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section-enhanced">
        <div className="cta-content-enhanced">
          <div className="cta-icon-large">🎁</div>
          <h2 className="cta-title-enhanced">جاهز لتجربة فاخرة؟</h2>
          <p className="cta-description-enhanced">
            انضم إلى آلاف العملاء المميزين واستمتع بأرقى العطور والهدايا الفاخرة
          </p>
          <div className="cta-buttons-group">
            <Link
              href="/shop"
              className="btn-cta-enhanced btn-cta-primary"
              onClick={() => trackLandingClick('cta_click', 'start_shopping_now', 'bottom_cta')}
            >
              <span>ابدأ التسوق الآن</span>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M7 3L13 10L7 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </Link>
            <Link
              href="/shop?category=incense"
              className="btn-cta-enhanced btn-cta-outline"
              onClick={() => trackLandingClick('cta_click', 'special_offers', 'bottom_cta')}
            >
              استكشف العروض الخاصة
            </Link>
          </div>
        </div>
      </section>

      {/* Footer Info */}
      <div className="footer-info">
        <div className="footer-content">
          <div className="footer-logo">
            {storeInfo.logoText}
          </div>
          <p className="footer-text">{storeInfo.storeTagline || 'وجهتك الأولى للعطور الفاخرة والأصلية'}</p>
          <div className="footer-links">
            <Link href="/policies/shipping-returns">سياسة الشحن والاسترجاع</Link>
            <Link href="/contact">التواصل والدعم</Link>
            <Link href="/track-order">تتبع الطلب</Link>
          </div>
        </div>
      </div>
    </main>
  )
}
