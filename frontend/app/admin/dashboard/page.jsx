"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAdmin } from '@/context/AdminContext'
import Link from 'next/link'
import { fetchStoreSettings } from '@/lib/api'
import { formatDateTime, formatDecimal, formatTime, getUserLocale } from '@/lib/intl'
import TaxFilter from '@/components/TaxFilter'

export default function AdminDashboard() {
  const { isAdmin, loading, authFetch, canViewDashboard, canManageUsers } = useAdmin()
  const router = useRouter()
  const [stats, setStats] = useState({
    products: 0,
    orders: 0,
    users: 0,
    netRevenue: 0,
    grossRevenue: 0,
    orderStatus: {
      pending: 0,
      processing: 0,
      shipped: 0,
      completed: 0,
      cancelled: 0
    },
    periods: {
      todayOrders: 0,
      monthOrders: 0,
      todayRevenue: 0,
      monthRevenue: 0
    },
    alerts: {
      lowStockCount: 0,
      lowStock: [],
      pendingPayments: 0,
      refundedPayments: 0
    },
    performance: {
      averageOrderValue: 0,
      completionRate: 0,
      cancellationRate: 0
    }
  })
  const [lastUpdated, setLastUpdated] = useState(null)
  const [lighthouse, setLighthouse] = useState({
    overall: null,
    pages: {},
    latestFetchTime: null
  })
  const toISODate = (d) => d.toISOString().slice(0, 10)
  const nowLocal = new Date()
  const firstOfMonth = new Date(nowLocal.getFullYear(), nowLocal.getMonth(), 1)
  const [startDate, setStartDate] = useState(toISODate(firstOfMonth))
  const [endDate, setEndDate] = useState(toISODate(nowLocal))
  const [statusFilter, setStatusFilter] = useState('all')
  const [taxTotal, setTaxTotal] = useState(0)
  const [taxLoading, setTaxLoading] = useState(false)
  const [currencySymbol, setCurrencySymbol] = useState('ر.س')
  const locale = getUserLocale('ar-SA')
  const formatInteger = (value) => formatDecimal(value, { locale, minimumFractionDigits: 0, maximumFractionDigits: 0 })
  const formatFixed2 = (value) => formatDecimal(value, { locale, minimumFractionDigits: 2, maximumFractionDigits: 2 })

  useEffect(() => {
    if (loading) return
    if (!isAdmin) {
      router.push('/admin/login')
      return
    }
    if (!canViewDashboard) {
      router.push('/admin')
    }
  }, [isAdmin, loading, canViewDashboard, router])

  useEffect(() => {
    ;(async () => {
      try {
        const settings = await fetchStoreSettings()
        if (settings) {
          setCurrencySymbol(settings.currencySymbol || 'ر.س')
        }
      } catch {
        // keep default
      }
    })()
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        if (!isAdmin || !canViewDashboard) return
        const res = await authFetch('/admin/stats')
        if (res.status === 200 && res.data) {
          setStats({
            products: res.data.perfumes ?? 0,
            orders: res.data.orders ?? 0,
            users: res.data.users ?? 0,
            netRevenue: res.data.netRevenue ?? 0,
            grossRevenue: res.data.grossRevenue ?? 0,
            orderStatus: {
              pending: res.data.orderStatus?.pending ?? 0,
              processing: res.data.orderStatus?.processing ?? 0,
              shipped: res.data.orderStatus?.shipped ?? 0,
              completed: res.data.orderStatus?.completed ?? 0,
              cancelled: res.data.orderStatus?.cancelled ?? 0
            },
            periods: {
              todayOrders: res.data.periods?.todayOrders ?? 0,
              monthOrders: res.data.periods?.monthOrders ?? 0,
              todayRevenue: res.data.periods?.todayRevenue ?? 0,
              monthRevenue: res.data.periods?.monthRevenue ?? 0
            },
            alerts: {
              lowStockCount: res.data.alerts?.lowStockCount ?? 0,
              lowStock: res.data.alerts?.lowStock ?? [],
              pendingPayments: res.data.alerts?.pendingPayments ?? 0,
              refundedPayments: res.data.alerts?.refundedPayments ?? 0
            },
            performance: {
              averageOrderValue: res.data.performance?.averageOrderValue ?? 0,
              completionRate: res.data.performance?.completionRate ?? 0,
              cancellationRate: res.data.performance?.cancellationRate ?? 0
            }
          })
          setLastUpdated(new Date())
        }
      } catch (err) { console.error('Error fetching stats:', err) }
    })()
  }, [isAdmin, canViewDashboard, authFetch])

  const fetchTax = async () => {
    try {
      if (!isAdmin || !canViewDashboard) return
      setTaxLoading(true)
      let url = '/admin/stats/tax'
      const params = new URLSearchParams()
      if (startDate) params.set('start', new Date(startDate).toISOString())
      if (endDate) params.set('end', new Date(endDate).toISOString())
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)

      const full = url + '?' + params.toString()
      const result = await authFetch(full)
      if (result.status === 200 && result.data) {
        setTaxTotal(result.data.tax ?? 0)
      }
    } catch (err) {
      console.error('Error fetching tax:', err)
    } finally {
      setTaxLoading(false)
    }
  }

  useEffect(() => {
    // fetch initial month totals on mount
    if (isAdmin && canViewDashboard) fetchTax()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, canViewDashboard])

  useEffect(() => {
    ;(async () => {
      try {
        if (!isAdmin || !canViewDashboard) return
        const res = await fetch('/api/performance/lighthouse', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        setLighthouse({
          overall: data.overall || null,
          pages: data.pages || {},
          latestFetchTime: data.latestFetchTime || null
        })
      } catch (err) {
        console.error('Error fetching lighthouse summary:', err)
      }
    })()
  }, [isAdmin, canViewDashboard])

  if (loading) {
    return <div className="loading">جاري التحميل...</div>
  }

  if (!isAdmin) {
    return null
  }

  if (!canViewDashboard) {
    return null
  }

  return (
    <main className="admin-dashboard">
      <div className="admin-container">
      <div className="admin-header">
        <div>
          <h1>لوحة التحكم</h1>
          <p>نظرة شاملة على أداء المتجر وإدارة المحتوى</p>
          {lastUpdated && <small>آخر تحديث: {formatTime(lastUpdated, { locale })}</small>}
        </div>
      </div>

      <section className="stats-grid">
        <div className="stat-card stat-card-pro">
          <span className="stat-title">المنتجات</span>
          <strong className="stat-number">{formatInteger(stats.products)}</strong>
          <p>عدد المنتجات المتاحة في المتجر</p>
        </div>

        <div className="stat-card stat-card-pro">
          <span className="stat-title">الطلبات</span>
          <strong className="stat-number">{formatInteger(stats.orders)}</strong>
          <p>إجمالي الطلبات المسجلة</p>
        </div>

        {canManageUsers && (
          <div className="stat-card stat-card-pro">
            <span className="stat-title">المستخدمون</span>
            <strong className="stat-number">{formatInteger(stats.users)}</strong>
            <p>عدد المستخدمين المسجلين</p>
          </div>
        )}

        <div className="stat-card stat-card-pro">
          <span className="stat-title">صافي المبيعات</span>
          <strong className="stat-number">{formatFixed2(stats.netRevenue || 0)} {currencySymbol}</strong>
          <p>وفق إعدادات عملة المتجر</p>
        </div>

        <div className="stat-card stat-card-pro">
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8}}>
            <span className="stat-title">الضريبة المتلقاة</span>
          </div>
          <div style={{marginTop:8}}>
            <TaxFilter initialStart={startDate} initialEnd={endDate} initialStatuses={[statusFilter]} onApply={async ({ start, end, statuses }) => {
              // map statuses array back to dashboard's single status filter where appropriate
              try {
                setTaxLoading(true)
                setStartDate(start ? new Date(start).toISOString().slice(0,10) : '')
                setEndDate(end ? new Date(end).toISOString().slice(0,10) : '')
                const status = (statuses && statuses.length === 1) ? statuses[0] : (statuses && statuses.length === 0 ? 'all' : 'all')
                setStatusFilter(status)
                let url = '/admin/stats/tax'
                const params = new URLSearchParams()
                if (start) params.set('start', start)
                if (end) params.set('end', end)
                if (statuses && statuses.length === 1) params.set('status', statuses[0])
                const full = url + '?' + params.toString()
                const result = await authFetch(full)
                if (result.status === 200 && result.data) {
                  setTaxTotal(result.data.tax ?? 0)
                }
              } catch (err) { console.error('Error fetching tax (filter):', err) }
              finally { setTaxLoading(false) }
            }} />
          </div>
          <div style={{marginTop:12}}>
            <strong className="stat-number">{formatFixed2(taxTotal || 0)} {currencySymbol}</strong>
            <p>مجموع ضريبة الـ VAT ضمن الفلتر المحدد</p>
          </div>
        </div>

        <Link href="/admin/orders?status=Pending" className="stat-card stat-card-pro stat-link-card">
          <span className="stat-title">طلبات قيد التجهيز</span>
          <strong className="stat-number">{formatInteger(stats.orderStatus.pending)}</strong>
          <p>تحتاج متابعة الفريق</p>
        </Link>

        <Link href="/admin/orders?status=Completed" className="stat-card stat-card-pro stat-link-card">
          <span className="stat-title">طلبات مكتملة</span>
          <strong className="stat-number">{formatInteger(stats.orderStatus.completed)}</strong>
          <p>طلبات تم توصيلها بنجاح</p>
        </Link>

        <Link href="/admin/orders?status=Processing" className="stat-card stat-card-pro stat-link-card">
          <span className="stat-title">قيد المعالجة</span>
          <strong className="stat-number">{formatInteger(stats.orderStatus.processing)}</strong>
          <p>طلبات داخل التشغيل</p>
        </Link>

        <Link href="/admin/orders?status=Shipped" className="stat-card stat-card-pro stat-link-card">
          <span className="stat-title">قيد الشحن</span>
          <strong className="stat-number">{formatInteger(stats.orderStatus.shipped)}</strong>
          <p>طلبات في الطريق</p>
        </Link>

        <Link href="/admin/orders?status=Cancelled" className="stat-card stat-card-pro stat-link-card">
          <span className="stat-title">طلبات ملغاة</span>
          <strong className="stat-number">{formatInteger(stats.orderStatus.cancelled)}</strong>
          <p>تحتاج تحليل السبب</p>
        </Link>

        <div className="stat-card stat-card-pro">
          <span className="stat-title">طلبات اليوم</span>
          <strong className="stat-number">{formatInteger(stats.periods.todayOrders)}</strong>
          <p>حركة يومية مباشرة</p>
        </div>

        <div className="stat-card stat-card-pro">
          <span className="stat-title">طلبات الشهر</span>
          <strong className="stat-number">{formatInteger(stats.periods.monthOrders)}</strong>
          <p>إجمالي الطلبات الشهرية</p>
        </div>

        <div className="stat-card stat-card-pro">
          <span className="stat-title">متوسط قيمة الطلب</span>
          <strong className="stat-number">{formatFixed2(stats.performance.averageOrderValue || 0)} {currencySymbol}</strong>
          <p>لكل طلب غير ملغي</p>
        </div>

        <div className="stat-card stat-card-pro">
          <span className="stat-title">نسبة الإلغاء</span>
          <strong className="stat-number">{formatFixed2(stats.performance.cancellationRate || 0)}%</strong>
          <p>من إجمالي الطلبات</p>
        </div>

        <div className="stat-card stat-card-pro">
          <span className="stat-title">نسبة الإكمال</span>
          <strong className="stat-number">{formatFixed2(stats.performance.completionRate || 0)}%</strong>
          <p>طلبات مكتملة بنجاح</p>
        </div>

        <div className="stat-card stat-card-pro">
          <span className="stat-title">منتجات منخفضة المخزون</span>
          <strong className="stat-number">{formatInteger(stats.alerts.lowStockCount)}</strong>
          <p>منتجات تحتاج إعادة تزويد</p>
        </div>

        <Link href="/admin/orders" className="stat-card stat-card-pro stat-link-card">
          <span className="stat-title">دفعات معلّقة</span>
          <strong className="stat-number">{formatInteger(stats.alerts.pendingPayments)}</strong>
          <p>طلبات بانتظار تأكيد الدفع</p>
        </Link>

        <div className="stat-card stat-card-pro">
          <span className="stat-title">Lighthouse Performance</span>
          <strong className="stat-number">{lighthouse.overall?.performance ?? '-'}{lighthouse.overall ? '%' : ''}</strong>
          <p>متوسط الصفحات الرئيسية</p>
        </div>

        <div className="stat-card stat-card-pro">
          <span className="stat-title">Lighthouse Accessibility</span>
          <strong className="stat-number">{lighthouse.overall?.accessibility ?? '-'}{lighthouse.overall ? '%' : ''}</strong>
          <p>جودة الوصول</p>
        </div>

        <div className="stat-card stat-card-pro">
          <span className="stat-title">Lighthouse SEO</span>
          <strong className="stat-number">{lighthouse.overall?.seo ?? '-'}{lighthouse.overall ? '%' : ''}</strong>
          <p>جاهزية محركات البحث</p>
        </div>
      </section>

      {lighthouse.overall && (
        <section className="quick-actions">
          <h2>ملخص Lighthouse حسب الصفحة</h2>
          {lighthouse.latestFetchTime && (
            <p>آخر تقرير: {formatDateTime(lighthouse.latestFetchTime, { locale })}</p>
          )}
          <div className="actions-grid">
            {Object.entries(lighthouse.pages).map(([page, value]) => (
              <div key={page} className="action-card">
                <h3>{page}</h3>
                <p>Performance: {formatInteger(value.categories.performance)}%</p>
                <p>Accessibility: {formatInteger(value.categories.accessibility)}%</p>
                <p>Best Practices: {formatInteger(value.categories.bestPractices)}%</p>
                <p>SEO: {formatInteger(value.categories.seo)}%</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {stats.alerts.lowStock?.length > 0 && (
        <section className="quick-actions">
          <h2>تنبيهات المخزون</h2>
          <div className="actions-grid">
            {stats.alerts.lowStock.map((item) => (
              <Link key={item.id} href="/admin/products" className="action-card">
                <h3>{item.name}</h3>
                <p>المتوفر حالياً: {formatInteger(item.stock)}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="quick-actions">
        <h2>الإجراءات السريعة</h2>
        <div className="actions-grid">
          <Link href="/admin/products" className="action-card">
            <h3>إدارة المنتجات</h3>
            <p>إضافة، تعديل، وحذف المنتجات</p>
          </Link>

          <Link href="/admin/orders" className="action-card">
            <h3>إدارة الطلبات</h3>
            <p>متابعة الطلبات وتحديث الحالة</p>
          </Link>

          <Link href="/shop" className="action-card">
            <h3>عرض المتجر</h3>
            <p>مشاهدة المتجر كعميل</p>
          </Link>
        </div>
      </section>
      </div>
    </main>
  )
}
