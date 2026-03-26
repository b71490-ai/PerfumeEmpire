'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useCart } from '@/context/CartContext'
import FreeShippingProgress from '@/components/FreeShippingProgress'
import ThemeToggle from '@/components/ThemeToggle'
import { useAdmin } from '@/context/AdminContext'
import { fetchStoreSettings } from '@/lib/api'

export default function Header() {
  const { getCartCount, getCartTotal } = useCart()
  const { isAdmin } = useAdmin()
  const cartCount = getCartCount()
  const pathname = usePathname()
  const isDataImage = (value) => typeof value === 'string' && value.startsWith('data:image/')
  const [settings, setSettings] = useState({
    logoIcon: '✨',
    logoText: 'عطور الإمبراطورية',
    logoImageUrl: '',
    logoBackgroundColor: '#ffffff',
    freeShippingThreshold: 500,
    currencySymbol: 'ر.س'
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
            logoBackgroundColor: data.logoBackgroundColor || '#ffffff',
            freeShippingThreshold: Number(data.freeShippingThreshold ?? 500),
            currencySymbol: data.currencySymbol || 'ر.س'
          })
        }
      } catch {
        // keep defaults
      }
    })()
  }, [])

  const isHomePage = pathname === '/'

  return (
    <header className={"main-header" + (isHomePage ? ' is-home' : '')}>
      <div className="header-container">
        <div className="header-brand">
          <Link href="/" className="header-logo">
            <span className="site-small-logo-wrap animated-logo" style={{ backgroundColor: settings.logoBackgroundColor || 'transparent', borderRadius: 8, display: 'inline-flex', padding: 6 }}>
              <span className="animated-logo-inner" aria-hidden="true">
                  {settings.logoImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={settings.logoImageUrl} alt="" className="site-small-logo spin" loading="lazy" decoding="async" />
                ) : (
                  <span className="site-small-logo-fallback spin">{settings.logoIcon}</span>
                )}
              </span>
            </span>
            <h1 className="header-title">{settings.logoText || 'عطور النخبة'}</h1>
          </Link>
          <div className="header-actions">
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
              <span className="cart-badge">{cartCount}</span>
            )}
          </Link>
          
          {isAdmin && (
            <Link href="/admin/dashboard" className="nav-item admin-btn">
              <span>🎛️</span>
              <span>لوحة التحكم</span>
            </Link>
          )}
        </nav>
        {pathname && pathname.startsWith('/shop') && (
          <div className="header-free-shipping">
            <FreeShippingProgress subtotal={getCartTotal()} threshold={settings.freeShippingThreshold} currency={settings.currencySymbol} />
          </div>
        )}
      </div>
    </header>
  )
}
