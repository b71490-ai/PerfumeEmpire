import React from 'react'

export default function SkeletonGrid({ columns = 3, rows = 2 }) {
  const items = Array.from({ length: columns * rows })
  return (
    <div className="container skeleton-loading-shell" aria-busy="true">
      <div className="header-section skeleton-loading-header">
        <div className="skeleton-loader-orb" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <h1 aria-hidden>جاري تحميل المنتجات...</h1>
        <p aria-hidden>نجهز لك أفضل العروض الآن</p>
      </div>
      <div className="perfumes-grid" aria-busy="true" role="status">
        {items.map((_, i) => (
          <div key={i} className="perfume-card skeleton" aria-hidden>
            <div className="skeleton-image" />
            <div className="skeleton-badge" />
            <div className="skeleton-text" />
            <div className="skeleton-text short" />
            <div className="skeleton-text short" />
            <div className="skeleton-cta" />
          </div>
        ))}
      </div>
    </div>
  )
}
