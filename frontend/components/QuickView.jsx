"use client"

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

export default function QuickView({ perfume, onClose, onAddToCart, currencySymbol = 'ر.س' }) {
  const modalRef = useRef(null)
  const closeButtonRef = useRef(null)
  const closeTimerRef = useRef(null)
  const previousFocusedElementRef = useRef(null)
  const closeDurationRef = useRef(170)
  const [isClosing, setIsClosing] = useState(false)

  const requestClose = useCallback(() => {
    if (closeTimerRef.current) return
    setIsClosing(true)

    const closeDelay = closeDurationRef.current
    if (closeDelay === 0) {
      onClose()
      return
    }

    closeTimerRef.current = setTimeout(() => {
      onClose()
      closeTimerRef.current = null
    }, closeDelay)
  }, [onClose])

  useEffect(() => {
    previousFocusedElementRef.current = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    closeDurationRef.current = reducedMotionQuery.matches ? 0 : 170

    const handleReducedMotionChange = (event) => {
      closeDurationRef.current = event.matches ? 0 : 170
    }

    reducedMotionQuery.addEventListener('change', handleReducedMotionChange)

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        requestClose()
      }

      if (event.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )

        if (!focusableElements.length) return

        const firstElement = focusableElements[0]
        const lastElement = focusableElements[focusableElements.length - 1]

        if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault()
          lastElement.focus()
        } else if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault()
          firstElement.focus()
        }
      }
    }

    closeButtonRef.current?.focus()
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
      reducedMotionQuery.removeEventListener('change', handleReducedMotionChange)
      document.removeEventListener('keydown', handleEscape)

      if (
        previousFocusedElementRef.current &&
        typeof previousFocusedElementRef.current.focus === 'function'
      ) {
        previousFocusedElementRef.current.focus()
      }
    }
  }, [requestClose])

  useEffect(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    setIsClosing(false)
  }, [perfume?.id])

  if (!perfume) return null

  const originalPrice = Number(perfume.price || 0)
  const discountedPrice = perfume.discount > 0
    ? originalPrice * (1 - perfume.discount / 100)
    : originalPrice

  return (
    <div
      className={`quickview-overlay${isClosing ? ' closing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="quickview-title"
      onClick={requestClose}
    >
      <div className={`quickview-modal${isClosing ? ' closing' : ''}`} ref={modalRef} onClick={(event) => event.stopPropagation()} dir="rtl">
        <button className="quickview-close" ref={closeButtonRef} onClick={requestClose} aria-label="إغلاق">×</button>
        <div className={`quickview-grid ${!perfume.imageUrl ? 'no-image' : ''}`}>
          <div className="quickview-image">
            {perfume.imageUrl && (
              <Image
                src={perfume.imageUrl}
                alt={perfume.name}
                width={500}
                height={380}
                className="quickview-image-media"
              />
            )}
          </div>
          <div className="quickview-body">
            <h2 id="quickview-title">{perfume.name}</h2>
            <p className="brand">{perfume.brand}</p>
            {perfume.discount > 0 ? (
              <p className="price">
                <span className="discounted-price">{discountedPrice.toFixed(2)} {currencySymbol}</span>
                <span className="original-price">{originalPrice.toFixed(2)} {currencySymbol}</span>
              </p>
            ) : (
              <p className="price">{originalPrice.toFixed(2)} {currencySymbol}</p>
            )}
            <p className="quickview-desc">اكتشف نفحات متوازنة ومركبات مختارة بعناية لتدوم رائحتها معك طوال اليوم.</p>
            <div className="quickview-actions">
              <button
                className="quickview-btn quickview-btn-primary"
                disabled={isClosing}
                onClick={() => {
                  const added = onAddToCart(perfume)
                  if (added) requestClose()
                }}
              >
                🛒 أضف إلى السلة
              </button>
              <Link className="quickview-btn quickview-btn-secondary" href={`/shop/product/${perfume.id}`}>
                عرض الصفحة الكاملة
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
