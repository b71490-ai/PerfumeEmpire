'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useCart } from '@/context/CartContext'
import ThemeToggle from '@/components/ThemeToggle'
import { useAdmin } from '@/context/AdminContext'
import { fetchStoreSettings } from '@/lib/api'

export default function Header() {
  const { getCartCount } = useCart()
  const { isAdmin } = useAdmin()
  const pathname = usePathname()
  const cartCount = getCartCount()
  const [cartBadgeBump, setCartBadgeBump] = useState(false)
  const [isScrollHidden, setIsScrollHidden] = useState(false)
  const isDataImage = (value) => typeof value === 'string' && value.startsWith('data:image/')
  const [settings, setSettings] = useState({
    logoIcon: '✨',
    logoText: 'عطور الإمبراطورية',
    logoImageUrl: '',
    logoBackgroundColor: '#ffffff'
  })

  useEffect(() => {
    ;(async () => {
      try {
        const data = await fetchStoreSettings()
        if (data) {
          setSettings({
            logoIcon: data.logoIcon || '✨',
            logoText: data.logoText || data.storeName || 'عطور الإمبراطورية',
            logoImageUrl: data.logoImageUrl || '',
            logoBackgroundColor: data.logoBackgroundColor || '#ffffff'
          })
        }
      } catch {
        // keep defaults
      }
    })()
  }, [])

  useEffect(() => {
    if (cartCount < 0) {
      return undefined
    }

    setCartBadgeBump(true)
    const timer = setTimeout(() => setCartBadgeBump(false), 360)
    return () => clearTimeout(timer)
  }, [cartCount])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const isShopRoute = String(pathname || '').startsWith('/shop')
    if (!isShopRoute) {
      setIsScrollHidden(false)
      return undefined
    }
    setIsScrollHidden(false)
    return undefined
  }, [pathname])

  return (
    <header className={`main-header${isScrollHidden ? ' is-scroll-hidden' : ''}`}>
      <div className="header-container">
        <div className="header-brand">
          <Link href="/" className="header-logo">
            <span className="site-small-logo-wrap animated-logo" style={{ backgroundColor: settings.logoBackgroundColor || 'transparent', borderRadius: 8, display: 'inline-flex', padding: 6 }}>
              <span className="animated-logo-inner" aria-hidden="true">
                  {settings.logoImageUrl ? (
                  <Image
                    src={settings.logoImageUrl}
                    alt=""
                    className="site-small-logo spin"
                    width={52}
                    height={52}
                    sizes="52px"
                    loading="lazy"
                    unoptimized={isDataImage(settings.logoImageUrl)}
                  />
                ) : (
                  <span className="site-small-logo-fallback spin">{settings.logoIcon}</span>
                )}
              </span>
            </span>
            <h1 className="header-title">{settings.logoText || 'عطور النخبة'}</h1>
          </Link>
          <div className="header-actions">
            <Link href="/my-orders" className="header-user-icon" aria-label="حسابي">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.9" />
                <path d="M4 20C4.8 16.7 7.7 14.5 12 14.5C16.3 14.5 19.2 16.7 20 20" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
              </svg>
            </Link>
            <ThemeToggle />
          </div>
        </div>
        <nav className="header-nav">
          <Link href="/shop" className="nav-item">
            <span>🛍️</span>
            <span>المتجر</span>
          </Link>
          
          <Link href="/contact" className="nav-item minor">
            <span>📞</span>
            <span>اتصل بنا</span>
          </Link>

          <Link href="/track-order" className="nav-item">
            <span>📦</span>
            <span>تتبع الطلب</span>
          </Link>

          <Link href="/my-orders" className="nav-item">
            <span>🧾</span>
            <span>طلباتي</span>
          </Link>

          <Link href="/policies/shipping-returns" className="nav-item minor">
            <span>📜</span>
            <span>سياسة الشحن</span>
          </Link>

          <Link href="/policies/privacy" className="nav-item minor">
            <span>🔒</span>
            <span>الخصوصية</span>
          </Link>
          
          <Link href="/wishlist" className="nav-item minor">
            <span>❤️</span>
            <span>المفضلة</span>
          </Link>
          
          <Link href="/cart" className="nav-item cart-link">
            <span>🛒</span>
            <span>السلة</span>
            {cartCount > 0 && (
              <span className={`cart-badge${cartBadgeBump ? ' is-bump' : ''}`}>{cartCount}</span>
            )}
          </Link>
          
          {isAdmin && (
            <Link href="/admin/dashboard" className="nav-item admin-btn">
              <span>🎛️</span>
              <span>لوحة التحكم</span>
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
