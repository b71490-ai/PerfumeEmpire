 'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useMemo, useRef } from 'react'
import { BLUR_DATA_URL } from '@/lib/imagePlaceholders'
import { trackLandingInteraction } from '@/lib/analytics'

export default function Hero({ storeInfo }) {
  const info = useMemo(() => ({
    name: storeInfo?.storeName || 'عطور الإمبراطورية',
    tagline: storeInfo?.storeTagline || 'وجهتك الأولى للعطور الفاخرة',
    heroImage: storeInfo?.heroImageUrl || storeInfo?.logoImageUrl || 'https://images.unsplash.com/photo-1519985176271-adb1088fa94c?w=1600',
  }), [storeInfo])

  useEffect(() => {
    try { trackLandingInteraction({ action: 'hero_view', label: 'strong_hero', section: 'hero' }) } catch { }
  }, [])

  return (
    <section className="hero-strong" dir="rtl" aria-label="Hero - الفخامة">
      <div className="hero-strong__inner">
        <div className="hero-strong__content">
          <div className="hero-strong__eyebrow">مجموعة مختارة</div>
          <h1 className="hero-strong__title">الفخامة تبدأ من عطرك</h1>
          <p className="hero-strong__subtitle">Discover Your Signature Scent</p>
          <Link href="/shop" className="hero-strong__cta" onClick={() => trackLandingInteraction({ action: 'hero_cta', label: 'shop_now', section: 'hero' })}>
            تسوّق الآن
          </Link>
        </div>

        <div className="hero-strong__media" aria-hidden="false">
          <div className="hero-strong__frame" ref={frameRef => {
            if (!frameRef) return
            // expose CSS variables for parallax (mouse move)
            frameRef.dataset.parallax = 'true'
          }}
            onMouseMove={(e) => {
              try {
                const el = e.currentTarget
                const rect = el.getBoundingClientRect()
                const mx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2)
                const my = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2)
                el.style.setProperty('--mx', String(mx))
                el.style.setProperty('--my', String(my))
              } catch { }
            }}
            onMouseLeave={(e) => {
              try { e.currentTarget.style.setProperty('--mx', '0'); e.currentTarget.style.setProperty('--my', '0') } catch { }
            }}
          >
            <div className="hero-strong__img-bg animated-hero-logo-bg" style={{ backgroundColor: storeInfo?.logoBackgroundColor || 'transparent', borderRadius: 12, padding: 12 }}>
              <Image
                src={info.heroImage}
                alt={info.name}
                width={900}
                height={900}
                className="hero-strong__img"
                sizes="(max-width: 768px) 100vw, 50vw"
                priority
                placeholder="blur"
                blurDataURL={BLUR_DATA_URL}
              />
            </div>
            <div className="hero-strong__glow" />
          </div>
        </div>
      </div>
      {/* Trust bar under hero for credibility */}
      <div className="hero-trust-bar" role="contentinfo" aria-label="مزايا المتجر">
        <div className="hero-trust-bar__inner">
          <div className="trust-item">🚚 <span><span className="trust-word-white">شحن</span> سريع</span></div>
          <div className="trust-item">💳 <span>دفع آمن</span></div>
          <div className="trust-item">🔄 <span>استرجاع خلال 7 أيام</span></div>
          <div className="trust-item">🔒 <span>منتجات أصلية 100%</span></div>
        </div>
      </div>
    </section>
  )
}