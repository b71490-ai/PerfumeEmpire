"use client"

export default function TrustBadges() {
  return (
    <div className="hero-trust-bar" role="contentinfo" aria-label="ثقة المتجر">
      <div className="hero-trust-bar__inner">
        <div className="trust-item"><span>🔒</span><span>✔ دفع آمن</span></div>
        <div className="trust-item"><span>↩️</span><span>✔ ضمان الاسترجاع</span></div>
        <div className="trust-item"><span>🚚</span><span>✔ شحن سريع</span></div>
      </div>
    </div>
  )
}
