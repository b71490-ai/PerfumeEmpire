import React from 'react'

export default function SkeletonGrid({ columns = 3, rows = 2 }) {
  const items = Array.from({ length: columns * rows })
  return (
    <div className="container">
      <div className="header-section">
        <h1 aria-hidden>✨ عطور الإمبراطورية ✨</h1>
      </div>
      <div className="perfumes-grid" aria-busy="true" role="status">
        {items.map((_, i) => (
          <div key={i} className="perfume-card skeleton" aria-hidden>
            <div className="skeleton-image" />
            <div className="skeleton-text" />
            <div className="skeleton-text short" />
            <div className="skeleton-text short" />
          </div>
        ))}
      </div>
    </div>
  )
}
