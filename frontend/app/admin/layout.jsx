"use client"

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useAdmin } from '@/context/AdminContext'
import Button from '@/components/Button'
import { DashboardIcon, ProductsIcon, OrdersIcon, UsersIcon, SettingsIcon, CouponsIcon } from '@/components/icons'
import { fetchStoreSettings } from '@/lib/api'

export default function AdminLayout({ children }) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return typeof window !== 'undefined' && localStorage.getItem('adminSidebarCollapsed') === '1'
    } catch (e) {
      return false
    }
  })

  function toggleCollapsed() {
    try {
      const next = !collapsed
      setCollapsed(next)
      localStorage.setItem('adminSidebarCollapsed', next ? '1' : '0')
    } catch (e) {
      setCollapsed((s) => !s)
    }
  }
  const { isAdmin, loading, authFetch, logout, canViewDashboard, canManageProducts, canViewOrders, canManageUsers, canManageSettings, canManageCoupons } = useAdmin()
  const { username } = useAdmin()
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const isDataImage = (value) => typeof value === 'string' && value.startsWith('data:image/')
  const [stats, setStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [branding, setBranding] = useState({ logoText: 'عطور الإمبراطورية', logoIcon: 'ع', logoImageUrl: '' })
  const isLoginPage = pathname === '/admin/login'

  const navItems = [
    { href: '/admin/dashboard', label: 'لوحة التحكم', visible: canViewDashboard },
    { href: '/admin/products', label: 'المنتجات', visible: canManageProducts },
    { href: '/admin/orders', label: 'الطلبات', visible: canViewOrders },
    { href: '/admin/coupons', label: 'الكوبونات', visible: canManageCoupons },
    { href: '/admin/users', label: 'المستخدمون', visible: canManageUsers },
    { href: '/admin/settings', label: 'الإعدادات', visible: canManageSettings }
  ].filter((item) => item.visible)

  const iconFor = (href) => {
    if (href.includes('/dashboard')) return DashboardIcon
    if (href.includes('/products')) return ProductsIcon
    if (href.includes('/orders')) return OrdersIcon
    if (href.includes('/coupons')) return CouponsIcon
    if (href.includes('/users')) return UsersIcon
    if (href.includes('/settings')) return SettingsIcon
    return DashboardIcon
  }

  useEffect(() => {
    ;(async () => {
      try {
        const data = await fetchStoreSettings()
        if (data) {
          setBranding({
            logoText: data.logoText || data.storeName || 'عطور الإمبراطورية',
            logoIcon: data.logoIcon || 'ع',
            logoImageUrl: data.logoImageUrl || ''
          })
        }
      } catch {
        // keep defaults
      }
    })()
  }, [])

  useEffect(() => {
    let mounted = true
    const loadStats = async () => {
      if (!isAdmin || isLoginPage || !canViewDashboard) return
      try {
        setStatsLoading(true)
        const res = await authFetch('/admin/stats')
        if (!mounted) return
        if (res.status === 200) setStats(res.data)
      } catch (e) {
        // ignore
      } finally {
        if (mounted) setStatsLoading(false)
      }
    }
    loadStats()
    return () => { mounted = false }
  }, [isAdmin, authFetch, isLoginPage, canViewDashboard])

  if (isLoginPage) {
    return <>{children}</>
  }

  return (
    <div className={`admin-root ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'drawer-open' : ''}`}>
      <aside className="admin-sidebar" role="navigation">
        <div className="admin-inner-scroll">
        <div className="admin-brand-wrap">
          <div className="admin-logo-row">
            {/* stacked logo: small animated mark above name */}
            <div className="admin-logo-stack">
              <span className="admin-logo-mark admin-logo-mark--stack" aria-hidden="true">{branding.logoIcon}</span>
              <div className="admin-logo">{branding.logoText}</div>
            </div>
            <button type="button" className="admin-collapse-btn" onClick={toggleCollapsed} aria-label={collapsed ? 'توسيع الشريط الجانبي' : 'طي الشريط الجانبي'}>
              {collapsed ? '⯈' : '⯆'}
            </button>
          </div>
          <p className="admin-brand-subtitle">لوحة الإدارة</p>
        </div>
        <nav className="admin-nav" aria-label="Admin Navigation">
          <ul>
            {navItems.map((item) => {
              const active = pathname === item.href || pathname?.startsWith(`${item.href}/`)
              return (
                <li key={item.href}>
                  <Link href={item.href} className={active ? 'active' : ''} data-label={item.label}>
                    <span className="nav-icon" aria-hidden="true">
                      {React.createElement(iconFor(item.href), { className: 'svg-icon' })}
                    </span>
                    <span className="nav-label">{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
        <div className="admin-sidebar-footer">
          <div className="admin-account">
            <div className="admin-avatar" aria-hidden="true">
              {branding.logoImageUrl ? (
                <Image src={branding.logoImageUrl} alt={branding.logoText} width={52} height={52} />
              ) : ((username && username[0]) || 'A')}
            </div>
            <div className="admin-account-info">
              <div className="admin-account-name">{username || 'المسؤول'}</div>
              <div className="admin-account-role">Admin</div>
            </div>
          </div>
          <Button variant="secondary" className="admin-logout-btn" onClick={logout} ariaLabel="تسجيل الخروج">
            تسجيل الخروج
          </Button>
        </div>
        </div>
      </aside>
      {/* overlay for drawer on mobile */}
      <div className="admin-drawer-overlay" onClick={() => setMobileOpen(false)} />
      {/* mobile toggle button */}
      <button className="admin-mobile-toggle" onClick={() => setMobileOpen((s) => !s)} aria-label="فتح القائمة">
        ☰
      </button>
      <main className="admin-main">
        {loading ? (
          <div className="admin-loading" role="status" aria-live="polite">
            <div className="loading-spinner" aria-hidden="true"></div>
            <p className="loading-text">جاري التحقق من جلسة المسؤول…</p>

            <div className="loading-stats" aria-hidden={!isAdmin}>
              <div className="stat-card">
                <div className={`stat-value ${statsLoading || !stats ? 'skeleton' : ''}`}>
                  {!statsLoading && stats ? stats.perfumes : ''}
                </div>
                <div className="stat-label">المنتجات</div>
              </div>
              <div className="stat-card">
                <div className={`stat-value ${statsLoading || !stats ? 'skeleton' : ''}`}>
                  {!statsLoading && stats ? stats.orders : ''}
                </div>
                <div className="stat-label">الطلبات</div>
              </div>
              <div className="stat-card">
                <div className={`stat-value ${statsLoading || !stats ? 'skeleton' : ''}`}>
                  {!statsLoading && stats ? stats.users : ''}
                </div>
                <div className="stat-label">المستخدمون</div>
              </div>
            </div>
          </div>
        ) : (
          isAdmin ? children : (
            <div className="admin-auth-required">
              <h2>يتطلب الوصول صلاحيات مسؤول</h2>
              <p>سجّل الدخول بحساب الإدارة للمتابعة.</p>
              <Link href="/admin/login" className="btn btn-primary">تسجيل دخول المسؤول</Link>
            </div>
          )
        )}
      </main>
    </div>
  )
}
