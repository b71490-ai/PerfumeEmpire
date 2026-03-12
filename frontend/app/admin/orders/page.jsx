"use client"

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAdmin } from '@/context/AdminContext'
import Link from 'next/link'
import Button from '@/components/Button'
import { fetchOrders, fetchOrderById, updateOrderStatus, updateOrderPaymentStatus, exportOrdersCsv, fetchStoreSettings } from '@/lib/api'
import { digitsOnly, formatDateTime, getUserLocale, toEnglishDigits } from '@/lib/intl'
import { useMemo } from 'react'

export default function AdminOrders() {
  const { isAdmin, loading, canViewOrders, canManageOrders, canExportOrders } = useAdmin()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [orders, setOrders] = useState([])
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPeriod, setFilterPeriod] = useState('all')
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('')
  const [deliveryMethodFilter, setDeliveryMethodFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [toast, setToast] = useState(null)
  const [currencySymbol, setCurrencySymbol] = useState('ر.س')
  const locale = getUserLocale('ar-SA')
  const pageSize = 10

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const [modalOrder, setModalOrder] = useState(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [selectAllPage, setSelectAllPage] = useState(false)

  const openQuickView = async (orderId) => {
    setModalLoading(true)
    try {
      const data = await fetchOrderById(orderId)
      setModalOrder(data)
    } catch (e) { console.error(e); showToast('فشل جلب بيانات الطلب', 'error') }
    setModalLoading(false)
  }

  const closeQuickView = () => setModalOrder(null)

  const copyOrderId = async (orderId) => {
    try {
      await navigator.clipboard.writeText(String(orderId))
      showToast('تم نسخ رقم الطلب')
    } catch (e) { showToast('فشل النسخ', 'error') }
  }

  const printOrder = async (orderId) => {
    try {
      const data = await fetchOrderById(orderId)
      const html = `
          <!doctype html>
          <html dir="rtl">
            <head>
              <meta charset="utf-8">
              <title>فاتورة الطلب #${data.id}</title>
            </head>
            <body>
              <button onclick="window.close()" aria-label="إغلاق" style="position:fixed;left:12px;top:12px;width:40px;height:40px;border-radius:8px;border:none;background:#ff4d4f;color:#fff;font-size:18px;cursor:pointer;z-index:999">×</button>
              <h1>فاتورة الطلب #${data.id}</h1>
              <p>العميل: ${data.customerName || '-'}<br/>الهاتف: ${data.phone || '-'}<br/>الإجمالي: ${data.total || '-'} ${currencySymbol}</p>
              <hr/>
              <ul>${(data.items||[]).map(i=>`<li>${i.name} × ${i.quantity} — ${i.price || ''}</li>`).join('')}</ul>
              <div style="margin-top:18px;display:flex;gap:8px;">
                <button onclick="window.print()" style="padding:8px 12px;border-radius:6px;border:1px solid #ccc;background:#fff;">طباعة</button>
                <button onclick="window.close()" style="padding:8px 12px;border-radius:6px;border:1px solid #ccc;background:#fff;">إغلاق</button>
              </div>
              <script>window.onload=function(){ try{ window.print(); }catch(e){} }</script>
            </body>
          </html>`
        const w = window.open('', '_blank')
        w.document.write(html)
        w.document.close()
    } catch (e) { console.error(e); showToast('فشل إعداد الطباعة', 'error') }
  }

  useEffect(() => {
    if (loading) return
    if (!isAdmin) {
      router.push('/admin/login')
      return
    }
    if (!canViewOrders) {
      router.push('/admin/dashboard')
    }
  }, [isAdmin, loading, canViewOrders, router])

  useEffect(() => {
    const load = async () => {
      try {
        const [data, settings] = await Promise.all([fetchOrders(), fetchStoreSettings()])
        setOrders(data)
        if (settings) {
          setCurrencySymbol(settings.currencySymbol || 'ر.س')
        }
      } catch (e) { console.error(e) }
    }
    if (isAdmin && canViewOrders) load()
  }, [isAdmin, canViewOrders])

  const updateStatus = async (orderId, status) => {
    if (!canManageOrders) {
      showToast('لا تملك صلاحية تعديل حالة الطلب', 'error')
      return
    }
    try {
      const updated = await updateOrderStatus(orderId, { status })
      setOrders(o => o.map(x => x.id === updated.id ? updated : x))
      showToast('تم تحديث حالة الطلب')
    } catch (e) { console.error(e); showToast('تعذر تحديث الحالة', 'error') }
  }

  const updatePayment = async (orderId, paymentStatus) => {
    if (!canManageOrders) {
      showToast('لا تملك صلاحية تعديل حالة الدفع', 'error')
      return
    }
    try {
      const updated = await updateOrderPaymentStatus(orderId, { paymentStatus })
      setOrders(o => o.map(x => x.id === updated.id ? updated : x))
      showToast('تم تحديث حالة الدفع')
    } catch (e) { console.error(e); showToast('تعذر تحديث حالة الدفع', 'error') }
  }

  const statusOptions = [
    { value: '', label: 'الكل' },
    { value: 'Pending', label: 'قيد التجهيز' },
    { value: 'Processing', label: 'قيد التجهيز (قيد المعالجة)' },
    { value: 'Shipped', label: 'قيد الشحن' },
    { value: 'Completed', label: 'تم التوصيل' },
    { value: 'Cancelled', label: 'ملغى' }
  ]

  useEffect(() => {
    const statusFromUrl = searchParams.get('status') || ''
    const periodFromUrl = searchParams.get('period') || 'all'
    const start = searchParams.get('start') || ''
    const end = searchParams.get('end') || ''
    const payment = searchParams.get('payment') || ''
    const delivery = searchParams.get('delivery') || ''
    const q = searchParams.get('q') || ''

    setFilterStatus(statusFromUrl)
    setFilterPeriod(['all', 'today', 'month'].includes(periodFromUrl) ? periodFromUrl : 'all')
    setStartDate(start)
    setEndDate(end)
    setPaymentMethodFilter(payment)
    setDeliveryMethodFilter(delivery)
    setSearch(q)
  }, [searchParams])

  const applyFiltersToUrl = (overrides = {}) => {
    const s = overrides.status !== undefined ? overrides.status : filterStatus
    const period = overrides.period !== undefined ? overrides.period : filterPeriod
    const start = overrides.start !== undefined ? overrides.start : startDate
    const end = overrides.end !== undefined ? overrides.end : endDate
    const payment = overrides.payment !== undefined ? overrides.payment : paymentMethodFilter
    const delivery = overrides.delivery !== undefined ? overrides.delivery : deliveryMethodFilter
    const q = overrides.q !== undefined ? overrides.q : search

    const params = new URLSearchParams()
    if (s) params.set('status', s)
    if (period && period !== 'all') params.set('period', period)
    if (start) params.set('start', start)
    if (end) params.set('end', end)
    if (payment) params.set('payment', payment)
    if (delivery) params.set('delivery', delivery)
    if (q) params.set('q', q)

    const qs = params.toString()
    router.push(`/admin/orders${qs ? '?' + qs : ''}`)
  }

  const filteredOrders = orders.filter(o => {
    const matchesStatus = !filterStatus || (o.status === filterStatus)
    const createdAt = new Date(o.createdAt || o.created_at || o.date)
    const now = new Date()
    const isToday = createdAt.toDateString() === now.toDateString()
    const isThisMonth = createdAt.getFullYear() === now.getFullYear() && createdAt.getMonth() === now.getMonth()
    const matchesPeriod = filterPeriod === 'all' || (filterPeriod === 'today' && isToday) || (filterPeriod === 'month' && isThisMonth)

    // Date range filter
    let matchesDateRange = true
    if (startDate) {
      const s = new Date(startDate + 'T00:00:00')
      if (createdAt < s) matchesDateRange = false
    }
    if (endDate) {
      const e = new Date(endDate + 'T23:59:59')
      if (createdAt > e) matchesDateRange = false
    }

    // Payment method filter
    let matchesPaymentMethod = true
    if (paymentMethodFilter) {
      matchesPaymentMethod = (order.paymentMethod === paymentMethodFilter)
    }

    // Delivery method filter
    let matchesDeliveryMethod = true
    if (deliveryMethodFilter) {
      const addr = String(order.address || '')
      if (deliveryMethodFilter === 'pickup') matchesDeliveryMethod = addr.includes('[delivery:pickup]')
      else if (deliveryMethodFilter === 'delivery') matchesDeliveryMethod = addr.includes('[delivery:delivery]')
      else matchesDeliveryMethod = !addr.includes('[delivery:pickup]') && !addr.includes('[delivery:delivery]')
    }

    const qRaw = (search || '').trim()
    const q = toEnglishDigits(qRaw).toLowerCase()

    const searchableName = (o.customerName || '').toString().toLowerCase()
    const searchableEmail = (o.email || '').toString().toLowerCase()
    const searchablePhone = toEnglishDigits((o.phone || '').toString())
    const searchableId = String(o.id)

    let matchesSearch = false
    if (!q) matchesSearch = true
    else if (qRaw.includes('@')) {
      // email search
      matchesSearch = searchableEmail.includes(q)
    } else if (/^#?\d+$/.test(qRaw.replace(/\s+/g, ''))) {
      // pure digits or #id — try id exact or phone contains
      const digits = q.replace(/^#/, '')
      matchesSearch = searchableId === digits || searchableId.includes(digits) || searchablePhone.includes(digits)
    } else {
      // name token search: ensure all tokens appear in name (orderless)
      const tokens = q.split(/\s+/).filter(Boolean)
      matchesSearch = tokens.every(tok => searchableName.includes(tok) || searchableEmail.includes(tok) || searchablePhone.includes(tok) || searchableId.includes(tok))
    }

    return matchesStatus && matchesPeriod && matchesSearch && matchesDateRange && matchesPaymentMethod && matchesDeliveryMethod
  })

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize))
  const pageOrders = filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const formatDate = (iso) => {
    return formatDateTime(iso, { locale })
  }

  const numberFormatter = new Intl.NumberFormat(locale || 'ar-SA')

  const stats = useMemo(() => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    let totalOrdersToday = 0
    let ordersPreparing = 0
    let salesToday = 0
    let ordersCountForAvg = 0

    for (const o of orders) {
      const createdAt = new Date(o.createdAt || o.created_at || o.date)
      if (createdAt >= startOfToday) {
        totalOrdersToday += 1
        salesToday += Number(o.total || 0)
        ordersCountForAvg += 1
      }
      if (o.status === 'Pending' || o.status === 'Processing') ordersPreparing += 1
    }

    const avgOrderValue = ordersCountForAvg > 0 ? (salesToday / ordersCountForAvg) : 0
    return { totalOrdersToday, ordersPreparing, salesToday, avgOrderValue }
  }, [orders])

  const getDeliveryMethodLabel = (address) => {
    const value = String(address || '')
    if (value.includes('[delivery:pickup]')) return 'استلام من الفرع'
    if (value.includes('[delivery:delivery]')) return 'توصيل للعنوان'
    return 'غير محدد'
  }

  const getStatusLabel = (s) => {
    switch (s) {
      case 'Pending': return 'قيد التجهيز'
      case 'Processing': return 'قيد المعالجة'
      case 'Shipped': return 'قيد الشحن'
      case 'Completed': return 'تم التوصيل'
      case 'Cancelled': return 'ملغى'
      default: return s || '-'
    }
  }

  const getPaymentStatusLabel = (s) => {
    switch (s) {
      case 'Pending': return 'بانتظار الدفع'
      case 'Paid': return 'مدفوع'
      case 'Failed': return 'فشل الدفع'
      case 'Refunded': return 'تم الاسترجاع'
      default: return s || '-'
    }
  }

  const getPaymentMethodLabel = (method) => {
    if (method === 'online') return 'دفع إلكتروني'
    if (method === 'cash_on_delivery') return 'دفع عند الاستلام'
    return method || '-'
  }

  const badgeClass = (status) => {
    if (!status) return 'order-status-badge badge-warn'
    if (status === 'Completed') return 'order-status-badge badge-success'
    if (status === 'Cancelled' || status === 'Failed' || status === 'Refunded') return 'order-status-badge badge-danger'
    if (status === 'Processing' || status === 'Shipped') return 'order-status-badge badge-info'
    if (status === 'Pending') return 'order-status-badge badge-warn'
    return 'order-status-badge badge-warn'
  }

  const paymentBadgeClass = (paymentStatus) => {
    if (!paymentStatus) return 'order-status-badge badge-orange'
    if (paymentStatus === 'Paid') return 'order-status-badge badge-success'
    if (paymentStatus === 'Pending') return 'order-status-badge badge-orange'
    if (paymentStatus === 'Failed' || paymentStatus === 'Refunded') return 'order-status-badge badge-danger'
    return 'order-status-badge badge-warn'
  }

  const phoneLink = (phone) => {
    const normalized = toEnglishDigits(String(phone || '')).replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '')
    return `tel:${normalized}`
  }
  const whatsappLink = (phone) => `https://wa.me/${digitsOnly(phone || '')}`

  const exportCsv = () => {
    if (!canExportOrders) {
      showToast('لا تملك صلاحية تصدير الطلبات', 'error')
      return
    }
    const rows = filteredOrders.map(o => ({
      id: toEnglishDigits(o.id),
      customerName: toEnglishDigits(o.customerName),
      email: toEnglishDigits(o.email),
      phone: toEnglishDigits(o.phone),
      total: toEnglishDigits(o.total),
      status: toEnglishDigits(getStatusLabel(o.status)),
      createdAt: toEnglishDigits(formatDate(o.createdAt || o.created_at || o.date)),
      items: toEnglishDigits((o.items || []).map(i => `${i.name}x${i.quantity}`).join('; '))
    }))

    const header = Object.keys(rows[0] || {}).join(',')
    const csv = [header, ...rows.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g,'""')}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `orders_export_${new Date().toISOString()}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const toggleSelectAllPage = () => {
    const idsOnPage = pageOrders.map(o => String(o.id))
    if (selectAllPage) {
      // deselect all on page
      setSelectedIds(prev => {
        const next = new Set(prev)
        idsOnPage.forEach(id => next.delete(id))
        return next
      })
      setSelectAllPage(false)
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev)
        idsOnPage.forEach(id => next.add(id))
        return next
      })
      setSelectAllPage(true)
    }
  }

  const toggleSelectOne = (orderId, checked) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (checked) next.add(String(orderId))
      else next.delete(String(orderId))
      return next
    })
  }

  const exportSelected = () => {
    if (selectedIds.size === 0) return showToast('لم يتم تحديد أي طلب', 'error')
    const rows = orders.filter(o => selectedIds.has(String(o.id))).map(o => ({
      id: toEnglishDigits(o.id),
      customerName: toEnglishDigits(o.customerName),
      email: toEnglishDigits(o.email),
      phone: toEnglishDigits(o.phone),
      total: toEnglishDigits(o.total),
      status: toEnglishDigits(getStatusLabel(o.status)),
      createdAt: toEnglishDigits(formatDate(o.createdAt || o.created_at || o.date)),
      items: toEnglishDigits((o.items || []).map(i => `${i.name}x${i.quantity}`).join('; '))
    }))
    const header = Object.keys(rows[0] || {}).join(',')
    const csv = [header, ...rows.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g,'""')}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `orders_export_selected_${new Date().toISOString()}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const printSelected = async () => {
    if (selectedIds.size === 0) return showToast('لم يتم تحديد أي طلب', 'error')
    try {
      const ids = Array.from(selectedIds)
      const ordersData = await Promise.all(ids.map(id => fetchOrderById(id)))
      const html = `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>طباعة أوامر</title></head><body>` +
        `<button onclick="window.close()" aria-label="إغلاق" style="position:fixed;left:12px;top:12px;width:40px;height:40px;border-radius:8px;border:none;background:#ff4d4f;color:#fff;font-size:18px;cursor:pointer;z-index:999">×</button>` +
        `<div style="margin-bottom:14px;display:flex;gap:8px;">
           <button onclick="window.print()" style="padding:8px 12px;border-radius:6px;border:1px solid #ccc;background:#fff;">طباعة</button>
           <button onclick="window.close()" style="padding:8px 12px;border-radius:6px;border:1px solid #ccc;background:#fff;">إغلاق</button>
         </div>` + ordersData.map(data => `
        <section style="page-break-after: always;">
          <h1>فاتورة الطلب #${data.id}</h1>
          <p>العميل: ${data.customerName || '-'} — الهاتف: ${data.phone || '-'}</p>
          <p>الإجمالي: ${data.total || '-'} ${currencySymbol}</p>
          <ul>${(data.items||[]).map(i=>`<li>${i.name} × ${i.quantity} — ${i.price || ''}</li>`).join('')}</ul>
        </section>
      `).join('') + '</body></html>'
      const w = window.open('', '_blank')
      w.document.write(html)
      w.document.close()
      // print will be triggered by user or they can call print in new window
    } catch (e) { console.error(e); showToast('فشل طباعة الطلبات المحددة', 'error') }
  }

  const bulkChangeStatus = async (status) => {
    if (selectedIds.size === 0) return showToast('لم يتم تحديد أي طلب', 'error')
    if (!canManageOrders) return showToast('لا تملك صلاحية تعديل الحالة', 'error')
    try {
      const ids = Array.from(selectedIds)
      const updateds = []
      for (const id of ids) {
        const updated = await updateOrderStatus(id, { status })
        updateds.push(updated)
      }
      // merge updateds into orders
      setOrders(prev => prev.map(o => {
        const u = updateds.find(x => String(x.id) === String(o.id))
        return u ? u : o
      }))
      showToast('تم تحديث الحالات')
    } catch (e) { console.error(e); showToast('فشل تحديث الحالات', 'error') }
  }

  const exportCsvServer = async () => {
    if (!canExportOrders) {
      showToast('لا تملك صلاحية تصدير الطلبات', 'error')
      return
    }
    try {
      const blob = await exportOrdersCsv()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `orders_export_server_${new Date().toISOString()}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) { console.error(e); showToast('خطأ عند طلب التصدير من الخادم', 'error') }
  }

  useEffect(() => {
    setCurrentPage(1)
  }, [filterStatus, filterPeriod, search, startDate, endDate, paymentMethodFilter, deliveryMethodFilter])

  // keep selectAllPage in sync with selectedIds and current page
  useEffect(() => {
    const idsOnPage = pageOrders.map(o => String(o.id))
    if (idsOnPage.length === 0) {
      setSelectAllPage(false)
      return
    }
    const allOnPageSelected = idsOnPage.every(id => selectedIds.has(id))
    setSelectAllPage(allOnPageSelected)
  }, [pageOrders, selectedIds])

  if (loading || !isAdmin || !canViewOrders) {
    return <div className="loading">جاري التحميل...</div>
  }

  return (
    <main className="admin-orders-page">
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.message}
        </div>
      )}

      <div className="admin-header">
        <div>
          <h1>إدارة الطلبات</h1>
          <p>متابعة الطلبات وتحديث حالتها بشكل فوري</p>
        </div>
        <div className="header-actions">
          {canExportOrders && <Button variant="primary" onClick={exportCsv}>تصدير CSV</Button>}
          {canExportOrders && <Button variant="secondary" onClick={exportCsvServer}>تصدير من الخادم</Button>}
          <Link href="/admin/dashboard">
            <Button variant="secondary" className="admin-back-btn">العودة للوحة التحكم</Button>
          </Link>
        </div>
      </div>

      <div className="orders-stats-grid">
        <div className="stat-card">
          <div className="stat-title">إجمالي الطلبات اليوم</div>
          <div className="stat-value">{numberFormatter.format(stats.totalOrdersToday)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">الطلبات قيد التجهيز</div>
          <div className="stat-value">{numberFormatter.format(stats.ordersPreparing)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">المبيعات اليوم</div>
          <div className="stat-value">{numberFormatter.format(stats.salesToday)} {currencySymbol}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">متوسط قيمة الطلب</div>
          <div className="stat-value">{numberFormatter.format(Math.round(stats.avgOrderValue * 100) / 100)} {currencySymbol}</div>
        </div>
      </div>

      <div className="orders-controls">
        <label htmlFor="statusFilter">فلتر الحالة:</label>
        <select id="statusFilter" className="admin-select" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); applyFiltersToUrl({ status: e.target.value }); setCurrentPage(1); }}>
          {statusOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <label htmlFor="periodFilter">الفترة:</label>
        <select id="periodFilter" className="admin-select" value={filterPeriod} onChange={e => { setFilterPeriod(e.target.value); applyFiltersToUrl({ period: e.target.value }); setCurrentPage(1); }}>
          <option value="all">كل الفترات</option>
          <option value="today">اليوم</option>
          <option value="month">هذا الشهر</option>
        </select>
        <input
          className="admin-select"
          placeholder="بحث (رقم الطلب/الاسم/الهاتف/الإيميل)"
          value={search}
          onChange={(e) => { setSearch(e.target.value); applyFiltersToUrl({ q: e.target.value, status: filterStatus, period: filterPeriod, start: startDate, end: endDate, payment: paymentMethodFilter, delivery: deliveryMethodFilter }); }}
        />
        <label htmlFor="startDate">من تاريخ</label>
        <input id="startDate" type="date" className="admin-select" value={startDate} onChange={(e) => { setStartDate(e.target.value); applyFiltersToUrl({ start: e.target.value }); setCurrentPage(1); }} />
        <label htmlFor="endDate">إلى تاريخ</label>
        <input id="endDate" type="date" className="admin-select" value={endDate} onChange={(e) => { setEndDate(e.target.value); applyFiltersToUrl({ end: e.target.value }); setCurrentPage(1); }} />

        <label htmlFor="paymentFilter">طريقة الدفع:</label>
        <select id="paymentFilter" className="admin-select" value={paymentMethodFilter} onChange={(e) => { setPaymentMethodFilter(e.target.value); applyFiltersToUrl({ payment: e.target.value }); setCurrentPage(1); }}>
          <option value="">الكل</option>
          <option value="online">دفع إلكتروني</option>
          <option value="cash_on_delivery">دفع عند الاستلام</option>
        </select>

        <label htmlFor="deliveryFilter">طريقة التوصيل:</label>
        <select id="deliveryFilter" className="admin-select" value={deliveryMethodFilter} onChange={(e) => { setDeliveryMethodFilter(e.target.value); applyFiltersToUrl({ delivery: e.target.value }); setCurrentPage(1); }}>
          <option value="">الكل</option>
          <option value="delivery">توصيل للعنوان</option>
          <option value="pickup">استلام من الفرع</option>
          <option value="unknown">غير محدد</option>
        </select>
      </div>

      <div className="orders-table-container desktop-orders-table">
        <div className="bulk-actions-bar">
          <label className="bulk-select-all"><input type="checkbox" checked={selectAllPage} onChange={(e) => { e.stopPropagation(); toggleSelectAllPage(); }} /> تحديد الكل في الصفحة</label>
          <div className="bulk-buttons">
            <select className="admin-select" onChange={(e) => { if (e.target.value) { bulkChangeStatus(e.target.value); e.target.selectedIndex = 0; } }}>
              <option value="">تغيير الحالة الجماعي</option>
              <option value="Processing">قيد المعالجة</option>
              <option value="Shipped">قيد الشحن</option>
              <option value="Completed">تم التوصيل</option>
              <option value="Cancelled">ملغى</option>
            </select>
            <button className="btn-secondary admin-select" onClick={(e) => { e.stopPropagation(); exportSelected(); }}>تصدير المحدد</button>
            <button className="btn-secondary admin-select" onClick={(e) => { e.stopPropagation(); printSelected(); }}>طباعة المحدد</button>
          </div>
        </div>
        {modalOrder && (
          <div className="quick-view-modal" role="dialog" aria-modal="true">
            <div className="quick-view-panel">
              <button className="close-modal" onClick={closeQuickView}>×</button>
              {modalLoading ? <div>جاري التحميل...</div> : (
                <div>
                  <h2>طلب #{modalOrder.id}</h2>
                  <p>العميل: {modalOrder.customerName} — {modalOrder.phone}</p>
                  <p>المجموع: {modalOrder.total} {currencySymbol}</p>
                  <h3>العناصر</h3>
                  <ul>{(modalOrder.items||[]).map(i => <li key={i.id || i.name}>{i.name} × {i.quantity}</li>)}</ul>
                </div>
              )}
            </div>
          </div>
        )}
        <table className="orders-table">
          <thead>
              <tr>
              <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={selectAllPage} onChange={(e) => { e.stopPropagation(); toggleSelectAllPage(); }} /></th>
              <th>رقم الطلب</th>
              <th>اسم العميل</th>
              <th>عدد المنتجات</th>
              <th>المبلغ الكلي</th>
              <th>الحالة الحالية</th>
              <th>طريقة الدفع</th>
              <th>تغيير الحالة</th>
              <th>حالة الدفع</th>
              <th>تحديث الدفع</th>
              <th>التاريخ</th>
              <th>طريقة التوصيل</th>
              <th>طريقة التواصل</th>
              <th>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {pageOrders.map((order) => (
              <tr
                key={order.id}
                className="clickable-row"
                tabIndex={0}
                onClick={(e) => {
                  if (e.target && e.target.closest && e.target.closest('a,button,select,input,textarea,label')) return
                  router.push(`/admin/orders/${order.id}`)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    router.push(`/admin/orders/${order.id}`)
                  }
                }}
              >
                <td style={{ textAlign: 'center' }}>
                  <input type="checkbox" checked={selectedIds.has(String(order.id))} onChange={(e) => { e.stopPropagation(); toggleSelectOne(order.id, e.target.checked); }} />
                </td>
                <td><strong>#{order.id}</strong></td>
                <td>{order.customerName || '-'}</td>
                <td>{(order.items?.length) || 0} منتج</td>
                <td>{order.total ?? '-'} {currencySymbol}</td>
                <td><span className={badgeClass(order.status)}>{getStatusLabel(order.status)}</span></td>
                <td>{getPaymentMethodLabel(order.paymentMethod)}</td>
                <td>
                  <select className="admin-select" value={order.status || ''} onChange={(e) => updateStatus(order.id, e.target.value)} aria-label={`تغيير حالة الطلب ${order.id}`} disabled={!canManageOrders}>
                    {statusOptions.filter(s => s.value).map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </td>
                <td><span className={paymentBadgeClass(order.paymentStatus)}>{getPaymentStatusLabel(order.paymentStatus)}</span></td>
                <td>
                  <select className="admin-select" value={order.paymentStatus || 'Pending'} onChange={(e) => updatePayment(order.id, e.target.value)} aria-label={`تغيير حالة دفع الطلب ${order.id}`} disabled={!canManageOrders}>
                    <option value="Pending">بانتظار الدفع</option>
                    <option value="Paid">مدفوع</option>
                    <option value="Failed">فشل الدفع</option>
                    <option value="Refunded">تم الاسترجاع</option>
                  </select>
                </td>
                <td>{formatDate(order.createdAt || order.created_at || order.date)}</td>
                <td>{getDeliveryMethodLabel(order.address)}</td>
                <td>
                  <div className="action-buttons quick-actions">
                    <button className="btn-action btn-view" onClick={(e) => { e.stopPropagation(); window.location.href = phoneLink(order.phone); }}>اتصال</button>
                    <button className="btn-action btn-edit" onClick={(e) => { e.stopPropagation(); window.open(whatsappLink(order.phone), '_blank'); }}>واتساب</button>
                    <button className="btn-action btn-view" onClick={(e) => { e.stopPropagation(); window.location.href = `mailto:${order.email || ''}`; }}>إيميل</button>
                    <button className="btn-action btn-view" onClick={(e) => { e.stopPropagation(); openQuickView(order.id); }}>عرض سريع</button>
                    <button className="btn-action btn-view" onClick={(e) => { e.stopPropagation(); copyOrderId(order.id); }}>نسخ</button>
                    <button className="btn-action btn-edit" onClick={(e) => { e.stopPropagation(); printOrder(order.id); }}>طباعة</button>
                    {canManageOrders && (
                      <>
                        <button className="btn-action btn-edit" onClick={(e) => { e.stopPropagation(); updateStatus(order.id, 'Completed'); }}>اتمام</button>
                        <button className="btn-action btn-delete" onClick={(e) => { e.stopPropagation(); updateStatus(order.id, 'Cancelled'); }}>إلغاء</button>
                      </>
                    )}
                  </div>
                </td>
                <td>
                  <button className="btn-action btn-view" onClick={(e) => { e.stopPropagation(); router.push(`/admin/orders/${order.id}`); }}>تفاصيل</button>
                </td>
              </tr>
            ))}
            {pageOrders.length === 0 && (
              <tr>
                <td colSpan={13}>لا توجد طلبات مطابقة للفلاتر الحالية.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mobile-orders-cards admin-orders-mobile-cards">
            {pageOrders.map((order) => (
          <article key={`m-${order.id}`} className="mobile-order-card">
            <header className="mobile-order-head">
              <strong>#{order.id}</strong>
              <span>{formatDate(order.createdAt || order.created_at || order.date)}</span>
            </header>

            <div className="mobile-order-row">
              <span>العميل</span>
              <strong>{order.customerName || '-'}</strong>
            </div>
            <div className="mobile-order-row">
              <span>المنتجات</span>
              <strong>{(order.items?.length) || 0} منتج</strong>
            </div>
            <div className="mobile-order-row">
              <span>الإجمالي</span>
              <strong>{order.total ?? '-'} {currencySymbol}</strong>
            </div>
            <div className="mobile-order-row">
              <span>طريقة الدفع</span>
              <strong>{getPaymentMethodLabel(order.paymentMethod)}</strong>
            </div>
            <div className="mobile-order-row">
              <span>الحالة</span>
              <span className={badgeClass(order.status)}>{getStatusLabel(order.status)}</span>
            </div>
            <div className="mobile-order-row">
              <span>الدفع</span>
              <span className={badgeClass(order.paymentStatus)}>{getPaymentStatusLabel(order.paymentStatus)}</span>
            </div>
            <div className="mobile-order-row">
              <span>التوصيل</span>
              <strong>{getDeliveryMethodLabel(order.address)}</strong>
            </div>

            <div className="mobile-order-items">
              {(order.items || []).map((item) => `${item.name} × ${item.quantity}`).join('، ') || 'لا توجد عناصر'}
            </div>

            <div className="admin-orders-mobile-actions action-buttons">
              <a className="btn-action btn-view" href={phoneLink(order.phone)}>اتصال</a>
              <a className="btn-action btn-edit" href={whatsappLink(order.phone)} target="_blank" rel="noreferrer">واتساب</a>
              <a className="btn-action btn-view" href={`mailto:${order.email || ''}`}>إيميل</a>
              <button className="btn-action btn-view" onClick={() => router.push(`/admin/orders/${order.id}`)}>عرض</button>
            </div>

            <div className="admin-form-actions-row">
              <select className="admin-select" value={order.status || ''} onChange={(e) => updateStatus(order.id, e.target.value)} aria-label={`تغيير حالة الطلب ${order.id}`} disabled={!canManageOrders}>
                {statusOptions.filter(s => s.value).map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <select className="admin-select" value={order.paymentStatus || 'Pending'} onChange={(e) => updatePayment(order.id, e.target.value)} aria-label={`تغيير حالة دفع الطلب ${order.id}`} disabled={!canManageOrders}>
                <option value="Pending">بانتظار الدفع</option>
                <option value="Paid">مدفوع</option>
                <option value="Failed">فشل الدفع</option>
                <option value="Refunded">تم الاسترجاع</option>
              </select>
            </div>
          </article>
        ))}

        {pageOrders.length === 0 && (
          <article className="mobile-order-card">
            لا توجد طلبات مطابقة للفلاتر الحالية.
          </article>
        )}
      </div>

      <div className="orders-controls orders-controls-footer">
        <span>الصفحة {currentPage} من {totalPages}</span>
        <div className="orders-pagination-actions">
          <Button variant="secondary" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
            السابق
          </Button>
          <Button variant="secondary" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>
            التالي
          </Button>
        </div>
      </div>
    </main>
  )
}
