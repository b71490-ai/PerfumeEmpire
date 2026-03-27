'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

const OFFERS_PAGE_HREF = '/shop?view=offers'
const COUNTDOWN_DURATION_MS = 24 * 60 * 60 * 1000

const ADS_ITEMS = [
  {
    icon: '🔥',
    title: 'خصم 30% على منتجات العناية اليوم فقط',
    subtitle: 'تشكيلة مختارة من أفخم المنتجات بأسعار استثنائية لفترة محدودة.',
    href: OFFERS_PAGE_HREF,
    badge: 'HOT',
    image: 'https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=max&fm=webp&w=1280&q=65'
  },
  {
    icon: '🚚',
    title: 'شحن مجاني للطلبات فوق 150 ريال',
    subtitle: 'اطلب الآن واستمتع بتوصيل سريع ومجاني على الطلبات المؤهلة.',
    href: OFFERS_PAGE_HREF,
    badge: 'عرض',
    image: 'https://images.unsplash.com/photo-1615634260167-c8cdede054de?auto=format&fit=max&fm=webp&w=1280&q=65'
  },
  {
    icon: '⭐',
    title: 'منتجات مختارة بتقييم 5 نجوم',
    subtitle: 'عطور ومجموعات نخبوية نالت ثقة العملاء بأعلى تقييمات.',
    href: OFFERS_PAGE_HREF,
    badge: 'جديد',
    image: 'https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=max&fm=webp&w=1280&q=65'
  }
]

const TRUST_ITEMS = [
  { icon: '🚀', label: 'شحن سريع' },
  { icon: '🔒', label: 'دفع آمن' },
  { icon: '↩️', label: 'استرجاع سهل' },
  { icon: '🎧', label: 'دعم 24/7' }
]

export default function AdsBar() {
  const [activeIndex, setActiveIndex] = useState(0)
  const [nextIndex, setNextIndex] = useState(0)
  const [isSliding, setIsSliding] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [offerEndsAt, setOfferEndsAt] = useState(() => Date.now() + COUNTDOWN_DURATION_MS)
  const [remainingMs, setRemainingMs] = useState(COUNTDOWN_DURATION_MS)

  useEffect(() => {
    if (isPaused || isSliding) {
      return undefined
    }

    const timer = setInterval(() => {
      const targetIndex = (activeIndex + 1) % ADS_ITEMS.length
      setNextIndex(targetIndex)
      setIsSliding(true)
    }, 4000)

    return () => clearInterval(timer)
  }, [activeIndex, isPaused, isSliding])

  useEffect(() => {
    if (!isSliding) {
      return undefined
    }

    const slideTimer = setTimeout(() => {
      setActiveIndex(nextIndex)
      setIsSliding(false)
    }, 420)

    return () => clearTimeout(slideTimer)
  }, [isSliding, nextIndex])

  useEffect(() => {
    const timer = setInterval(() => {
      const diff = Math.max(0, offerEndsAt - Date.now())
      setRemainingMs(diff)

      if (diff === 0) {
        setOfferEndsAt(Date.now() + COUNTDOWN_DURATION_MS)
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [offerEndsAt])

  const activeAd = ADS_ITEMS[activeIndex]
  const incomingAd = ADS_ITEMS[nextIndex]
  const discountMatch = activeAd.title.match(/(خصم\s*\d+%)/)
  const discountText = discountMatch ? discountMatch[1] : ''
  const titleWithoutDiscount = discountText ? activeAd.title.replace(discountText, '').trim() : activeAd.title
  const badgeTone = String(activeAd.badge || '').toLowerCase().includes('hot') ? 'hot' : 'gold'
  const totalSeconds = Math.floor(remainingMs / 1000)
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0')
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0')
  const seconds = String(totalSeconds % 60).padStart(2, '0')

  return (
    <section
      className="ads-bar"
      role="region"
      aria-label="إعلانات المتجر"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
      onTouchCancel={() => setIsPaused(false)}
    >
      <div className="ads-bar-inner" aria-live="polite">
        <div className="ads-media" aria-hidden="true">
          <span
            className="ads-image-slide"
            style={{
              backgroundImage: `url(${activeAd.image})`,
              transform: isSliding ? 'scale(1.03)' : 'scale(1)',
              opacity: isSliding ? 0 : 1
            }}
          />
          <span
            className="ads-image-slide"
            style={{
              backgroundImage: `url(${incomingAd.image})`,
              transform: isSliding ? 'scale(1)' : 'scale(1.03)',
              opacity: isSliding ? 1 : 0
            }}
          />
          <span className="ads-overlay" />
        </div>

        <span className={`ads-badge ads-badge--${badgeTone}`}>{activeAd.badge}</span>

        <div className="ads-content" key={activeIndex}>
          <h2 className="ads-title">
            <span className="ads-icon" aria-hidden="true">{activeAd.icon}</span>
            <span className="ads-title-copy">
              {discountText ? (
                <>
                  <span className="ads-discount-highlight">{discountText}</span>
                  <span className="ads-title-rest">{titleWithoutDiscount}</span>
                </>
              ) : (
                <span className="ads-title-rest">{activeAd.title}</span>
              )}
            </span>
          </h2>
          <p className="ads-subtitle">{activeAd.subtitle}</p>
          <p className="ads-countdown">⏳ العرض ينتهي خلال 24 ساعة • {hours}:{minutes}:{seconds}</p>

          <Link href={activeAd.href} className="ads-cta" aria-label="الانتقال إلى صفحة العروض">
            تسوق الآن →
          </Link>
        </div>
      </div>

      <div className="ads-features-wrap" aria-label="مزايا المتجر">
        <div className="ads-features-track">
          {TRUST_ITEMS.map((item) => (
            <span className="ads-feature-item" key={item.label}>
              <span className="ads-feature-icon" aria-hidden="true">{item.icon}</span>
              <span className="ads-feature-label">{item.label}</span>
            </span>
          ))}
          {TRUST_ITEMS.map((item) => (
            <span className="ads-feature-item ads-feature-item-copy" key={`${item.label}-copy`} aria-hidden="true">
              <span className="ads-feature-icon">{item.icon}</span>
              <span className="ads-feature-label">{item.label}</span>
            </span>
          ))}
        </div>
      </div>

      <style jsx>{`
        .ads-bar {
          min-height: 260px;
          padding: 10px;
          display: block;
          position: relative;
        }

        .ads-bar-inner {
          position: relative;
          width: 100%;
          max-width: 1200px;
          min-height: 260px;
          border-radius: 18px;
          overflow: hidden;
          border: 1px solid rgba(236, 205, 125, 0.28);
          box-shadow: 0 0 0 1px rgba(236, 205, 125, 0.14), 0 18px 40px rgba(6, 42, 24, 0.32);
          animation: bannerIn 640ms ease both;
        }

        .ads-media {
          position: absolute;
          inset: 0;
          overflow: hidden;
        }

        .ads-image-slide {
          position: absolute;
          inset: 0;
          background-size: contain;
          background-position: center;
          background-repeat: no-repeat;
          background-color: rgba(12, 20, 18, 0.66);
          filter: brightness(0.74) saturate(0.9);
          transition: transform 520ms ease-in-out, opacity 520ms ease-in-out;
          will-change: transform, opacity;
        }

        .ads-overlay {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(90deg, rgba(8, 12, 14, 0.52) 0%, rgba(8, 16, 14, 0.38) 34%, rgba(9, 22, 18, 0.16) 64%, rgba(9, 22, 18, 0.03) 100%),
            radial-gradient(120% 80% at 88% 35%, rgba(255, 240, 200, 0.1) 0%, rgba(255, 240, 200, 0) 62%);
        }

        .ads-content {
          position: relative;
          z-index: 2;
          color: #ffffff;
          min-height: 260px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 14px;
          padding: 26px 24px;
        }

        .ads-content > * {
          opacity: 0;
          transform: translateX(18px);
          animation: adTextIn 480ms ease-out forwards;
        }

        .ads-content > *:nth-child(1) { animation-delay: 40ms; }
        .ads-content > *:nth-child(2) { animation-delay: 100ms; }
        .ads-content > *:nth-child(3) { animation-delay: 150ms; }
        .ads-content > *:nth-child(4) { animation-delay: 200ms; }
        .ads-content > *:nth-child(5) { animation-delay: 250ms; }

        .ads-icon {
          font-size: 1.12rem;
          line-height: 1;
          flex-shrink: 0;
        }

        .ads-title {
          margin: 0;
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-size: clamp(1.05rem, 1.7vw, 1.38rem);
          font-weight: 900;
          letter-spacing: 0.1px;
          color: #ffffff;
          line-height: 1.28;
          text-wrap: balance;
        }

        .ads-title-copy {
          display: inline-flex;
          align-items: baseline;
          flex-wrap: wrap;
          gap: 10px;
          row-gap: 6px;
          line-height: 1.22;
        }

        .ads-discount-highlight {
          font-size: clamp(2.1rem, 4.2vw, 3.4rem);
          font-weight: 900;
          color: #ffffff;
          line-height: 1;
          text-shadow: 0 3px 14px rgba(0, 0, 0, 0.34);
          letter-spacing: 0.2px;
        }

        .ads-title-rest {
          font-size: clamp(1rem, 1.8vw, 1.45rem);
          font-weight: 800;
          color: #ffffff;
          text-shadow: 0 2px 10px rgba(0, 0, 0, 0.22);
        }

        .ads-badge {
          position: absolute;
          top: 12px;
          right: 12px;
          z-index: 3;
          width: fit-content;
          font-size: 0.68rem;
          font-weight: 900;
          color: #ffffff;
          background: linear-gradient(135deg, #efdcaa 0%, #d4a441 100%);
          border: 1px solid rgba(255, 245, 212, 0.68);
          border-radius: 999px;
          padding: 5px 10px;
          line-height: 1.2;
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.22);
          letter-spacing: 0.2px;
          text-transform: uppercase;
        }

        .ads-badge--hot {
          color: #fff7f7;
          background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);
          border-color: rgba(255, 197, 197, 0.62);
        }

        .ads-badge--gold {
          color: #2b1800;
          background: linear-gradient(135deg, #f5dfae 0%, #d6a33f 100%);
          border-color: rgba(255, 236, 190, 0.78);
        }

        .ads-subtitle {
          margin: 0;
          max-width: 640px;
          font-size: clamp(0.9rem, 1.1vw, 1.08rem);
          color: rgba(255, 255, 255, 0.94);
          font-weight: 600;
          line-height: 1.65;
        }

        .ads-countdown {
          margin: 0;
          width: fit-content;
          padding: 7px 12px;
          border-radius: 999px;
          font-size: 0.88rem;
          font-weight: 800;
          background: rgba(6, 22, 16, 0.45);
          border: 1px solid rgba(255, 255, 255, 0.24);
          color: #ffffff;
          line-height: 1.35;
        }

        .ads-cta {
          width: fit-content;
          text-decoration: none;
          background: linear-gradient(135deg, #ffcf66 0%, #f59e0b 52%, #ea580c 100%);
          color: #2b1700;
          border-radius: 999px;
          padding: 13px 24px;
          font-size: 1.05rem;
          font-weight: 900;
          border: 1px solid rgba(255, 236, 196, 0.75);
          box-shadow: 0 10px 24px rgba(234, 88, 12, 0.28), 0 2px 0 rgba(255, 255, 255, 0.25) inset;
          transition: transform 180ms ease-in-out, filter 180ms ease-in-out, box-shadow 180ms ease-in-out;
        }

        .ads-cta:hover,
        .ads-cta:focus-visible {
          transform: translateY(-3px) scale(1.045);
          filter: brightness(1.06) saturate(1.04);
          box-shadow: 0 16px 34px rgba(234, 88, 12, 0.34), 0 2px 0 rgba(255, 255, 255, 0.3) inset;
        }

        .ads-features-wrap {
          max-width: 1200px;
          margin-top: 10px;
          border-radius: 999px;
          border: 1px solid rgba(236, 205, 125, 0.25);
          background: linear-gradient(120deg, rgba(11, 27, 22, 0.54), rgba(17, 35, 30, 0.42));
          overflow: hidden;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          box-shadow: 0 10px 24px rgba(4, 18, 13, 0.22);
        }

        .ads-features-track {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          padding: 10px 18px;
          flex-wrap: wrap;
        }

        .ads-feature-item {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #f2fff7;
          font-size: 0.86rem;
          font-weight: 700;
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.16);
          white-space: nowrap;
        }

        .ads-feature-icon {
          font-size: 1.02rem;
          line-height: 1;
        }

        .ads-feature-item-copy {
          display: none;
        }

        @keyframes bannerIn {
          0% {
            opacity: 0;
            transform: scale(0.96);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes adTextIn {
          0% {
            opacity: 0;
            transform: translateX(18px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @media (max-width: 768px) {
          .ads-bar {
            min-height: 220px;
            padding: 8px;
          }

          .ads-bar-inner {
            min-height: 220px;
            border-radius: 14px;
          }

          .ads-content {
            min-height: 220px;
            padding: 20px 16px;
            gap: 10px;
          }

          .ads-title {
            font-size: 0.96rem;
          }

          .ads-discount-highlight {
            font-size: clamp(1.55rem, 6.4vw, 2.3rem);
          }

          .ads-title-rest {
            font-size: 0.94rem;
          }

          .ads-subtitle {
            font-size: 0.84rem;
            max-width: 100%;
          }

          .ads-countdown {
            font-size: 0.78rem;
            padding: 6px 10px;
          }

          .ads-cta {
            padding: 11px 18px;
            font-size: 0.92rem;
          }

          .ads-features-track {
            justify-content: flex-start;
            flex-wrap: nowrap;
            width: max-content;
            min-width: 100%;
            gap: 12px;
            animation: featuresScroll 16s linear infinite;
          }

          .ads-feature-item {
            font-size: 0.78rem;
            padding: 5px 8px;
          }

          .ads-feature-icon {
            font-size: 0.92rem;
          }

          .ads-feature-item-copy {
            display: inline-flex;
          }
        }

        @media (max-width: 520px) {
          .ads-badge {
            top: 10px;
            right: 10px;
            font-size: 0.62rem;
            padding: 4px 8px;
          }
        }

        @keyframes featuresScroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </section>
  )
}
