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
    heroImage: storeInfo?.heroImageUrl || storeInfo?.logoImageUrl || 'https://images.unsplash.com/photo-1519985176271-adb1088fa94c?w=960&auto=format&fm=webp&q=68',
  }), [storeInfo])

  useEffect(() => {
    try { trackLandingInteraction({ action: 'hero_view', label: 'strong_hero', section: 'hero' }) } catch { }
  }, [])

  return (
    <section className="hero-strong" dir="rtl" aria-label="Hero - الفخامة">
      <div className="hero-strong__inner">
        <div className="hero-strong__content">
          <div className="hero-strong__eyebrow">مجموعة مختارة</div>
          <h1 className="hero-strong__title">
            أفضل عطور <span className="hero-strong__title-highlight">فاخرة ✨</span>
          </h1>
          <Link href="/shop" className="hero-strong__cta" onClick={() => trackLandingInteraction({ action: 'hero_cta', label: 'shop_now', section: 'hero' })}>
            تسوق الآن →
          </Link>
          
          <div className="hero-strong__trust-indicators">
            <div className="trust-indicator">✔ شحن سريع</div>
            <div className="trust-indicator">✔ دفع آمن</div>
            <div className="trust-indicator">✔ ضمان الأصالة</div>
          </div>
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
            <div className="hero-strong__img-wrap">
              <Image
                src={info.heroImage}
                alt={info.name}
                width={640}
                height={640}
                className="hero-strong__img"
                sizes="(max-width: 768px) 90vw, 360px"
                priority
                fetchPriority="high"
                quality={72}
                placeholder="blur"
                blurDataURL={BLUR_DATA_URL}
              />
            </div>
            <div className="hero-strong__glow" />
          </div>
        </div>
      </div>
    </section>
  )
}