'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Button from '@/components/Button'
import { useAdmin } from '@/context/AdminContext'
import { fetchOrderById, fetchOrderHistory, fetchStoreSettings } from '@/lib/api'
import { digitsOnly, formatDateTime, getUserLocale, toEnglishDigits, formatMoney } from '@/lib/intl'

export default function AdminOrderDetailsPage() {
  const { id } = useParams()
  const router = useRouter()
  const { isAdmin, loading, canViewOrders } = useAdmin()
  const [order, setOrder] = useState(null)
  const [history, setHistory] = useState([])
  const [pageLoading, setPageLoading] = useState(true)
  const [currencySymbol, setCurrencySymbol] = useState('ر.س')
  const locale = getUserLocale('ar-SA')

  useEffect(() => {
    if (loading) return
    if (!isAdmin) {
      router.push('/admin/login')
      return
    }
    if (!canViewOrders) {
      router.push('/admin/dashboard')
    }
  }, [loading, isAdmin, canViewOrders, router])

  useEffect(() => {
    const load = async () => {
      if (!isAdmin || !canViewOrders || !id) return
      try {
        const [orderData, historyData, settings] = await Promise.all([
          fetchOrderById(id),
          fetchOrderHistory(id),
          fetchStoreSettings()
        ])
        setOrder(orderData)
        setHistory(historyData || [])
        if (settings) {
          setCurrencySymbol(settings.currencySymbol || 'ر.س')
        }
      } catch (e) {
        console.error(e)
      } finally {
        setPageLoading(false)
      }
    }
    load()
  }, [isAdmin, canViewOrders, id])

  const timelineSteps = useMemo(() => {
    if (!order) return []
    const findHistoryTime = (matches) => {
      const entry = (history || []).find(h => matches.includes(h.newStatus))
      return entry ? entry.changedAt : null
    }

    const createdAt = order.createdAt || order.created_at || order.date || null
    const paidAt = findHistoryTime(['Paid']) || (order.paymentStatus === 'Paid' ? order.updatedAt || order.updated_at || null : null)
    const shippedAt = findHistoryTime(['Shipped'])
    const deliveredAt = findHistoryTime(['Completed'])

    return [
      { key: 'created', label: 'تم الإنشاء', time: createdAt },
      { key: 'paid', label: 'تم تأكيد الدفع', time: paidAt },
      { key: 'shipped', label: 'تم الشحن', time: shippedAt },
      { key: 'delivered', label: 'تم التوصيل', time: deliveredAt }
    ]
  }, [order, history])

  const exportInvoicePdf = async (order) => {
    if (!order?.id) return
    try {
      const settings = await fetchStoreSettings()
      const locale = getUserLocale('ar-SA')
      const formatAmount = (v) => formatMoney(v, settings?.currencySymbol || currencySymbol, { locale })
      const invoiceNumber = `INV-${order.id}`
      const orderDate = formatDateTime(order.createdAt, { locale })
      const qrData = `${typeof window !== 'undefined' ? window.location.origin : ''}/track-order?orderId=${order.id}&phone=${encodeURIComponent(order.phone || '')}`
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrData)}`

      const items = Array.isArray(order.items) ? order.items : []
      const invoiceRows = items.length > 0
        ? items.map((item, index) => {
            const quantity = Number(item?.quantity || 0)
            const price = Number(item?.price || 0)
            const lineTotal = price * quantity
            return `<tr>
              <td>${index + 1}</td>
              <td>${(item?.name || '-')}</td>
              <td>${quantity}</td>
              <td>${formatAmount(price)}</td>
              <td>${formatAmount(lineTotal)}</td>
            </tr>`
          }).join('')
        : '<tr><td colspan="5">لا توجد عناصر متاحة لهذه الفاتورة</td></tr>'

      const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="font-family: Arial, Helvetica, sans-serif;padding:18px;">
<h2>فاتورة الطلب #${order.id}</h2>
<div>رقم الفاتورة: ${invoiceNumber}</div>
<div>تاريخ الطلب: ${orderDate}</div>
<hr/>
<table border="0" cellpadding="6" cellspacing="0" style="width:100%;border-collapse:collapse;">
<thead><tr style="background:#f3f4f6;"><th>#</th><th>الصنف</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead>
<tbody>${invoiceRows}</tbody>
</table>
<hr/>
<div>المجموع الجزئي: ${formatAmount(order.subtotal || 0)}</div>
  <div>الخصم: ${Number(order.discount || 0) > 0 ? `- ${formatAmount(order.discount || 0)}` : formatAmount(order.discount || 0)}</div>
<div>الشحن: ${formatAmount(order.shipping || 0)}</div>
<div>الضريبة: ${formatAmount(order.vat || 0)}</div>
<h3>الإجمالي: ${formatAmount(order.total || 0)}</h3>
<div style="margin-top:12px;display:flex;gap:12px;align-items:center;"><div><img src="${qrUrl}" alt="QR" loading="lazy" decoding="async"/></div><div>امسح رمز QR لتتبع الطلب</div></div>
</body></html>`

      const printWindow = window.open('', '_blank', 'width=900,height=700')
      if (!printWindow) return
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      const blobUrl = URL.createObjectURL(blob)
      printWindow.onload = () => setTimeout(() => { printWindow.focus(); printWindow.print(); URL.revokeObjectURL(blobUrl) }, 120)
      printWindow.location.href = blobUrl
    } catch (e) {
      console.error('export invoice failed', e)
    }
  }

  const formatDate = (value) => {
    return formatDateTime(value, { locale })
  }

  const statusLabel = (status) => {
    switch (status) {
      case 'Pending': return 'قيد التجهيز'
      case 'Processing': return 'قيد المعالجة'
      case 'Shipped': return 'قيد الشحن'
      case 'Completed': return 'تم التوصيل'
      case 'Cancelled': return 'ملغى'
      default: return status || '-'
    }
  }

  const paymentStatusLabel = (status) => {
    switch (status) {
      case 'Pending': return 'بانتظار الدفع'
      case 'Paid': return 'مدفوع'
      case 'Failed': return 'فشل الدفع'
      case 'Refunded': return 'تم الاسترجاع'
      default: return status || '-'
    }
  }

  const paymentMethodLabel = (method) => {
    if (method === 'online') return 'دفع إلكتروني'
    if (method === 'cash_on_delivery') return 'دفع عند الاستلام'
    return method || '-'
  }

  const badgeClass = (status) => {
    if (status === 'Completed' || status === 'Paid') return 'order-status-badge badge-success'
    if (status === 'Cancelled' || status === 'Failed' || status === 'Refunded') return 'order-status-badge badge-danger'
    return 'order-status-badge badge-warn'
  }

  const getDeliveryMethodLabel = (address) => {
    const value = String(address || '')
    if (value.includes('[delivery:pickup]')) return 'استلام من الفرع'
    if (value.includes('[delivery:delivery]')) return 'توصيل للعنوان'
    return 'غير محدد'
  }

  const cleanAddress = (address) => String(address || '').replace(/\[delivery:(pickup|delivery)\]\s*/g, '')

  const phoneLink = (phone) => {
    const normalized = toEnglishDigits(String(phone || '')).replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '')
    return `tel:${normalized}`
  }
  const whatsappLink = (phone) => `https://wa.me/${digitsOnly(phone || '')}`

  if (loading || pageLoading) return <div className="loading">جاري التحميل...</div>
  if (!isAdmin || !canViewOrders) return null
  if (!order) {
    return (
      <main className="admin-orders-page admin-order-details-page">
        <div className="admin-header">
          <div>
            <h1>تفاصيل الطلب</h1>
            <p>لم يتم العثور على الطلب المطلوب</p>
          </div>
          <Link href="/admin/orders"><Button variant="secondary">العودة للطلبات</Button></Link>
        </div>
      </main>
    )
  }

  return (
    <main className="admin-orders-page admin-order-details-page">
      <div className="admin-header">
        <div>
          <h1>تفاصيل الطلب #{order.id}</h1>
          <p>تاريخ الإنشاء: {formatDate(order.createdAt)}</p>
        </div>
        <div className="header-actions">
          <Link href="/admin/orders"><Button variant="secondary">العودة للطلبات</Button></Link>
          <Button variant="primary" onClick={() => exportInvoicePdf(order)}>تصدير الفاتورة</Button>
        </div>
      </div>

      {/* Timeline */}
      {timelineSteps.length > 0 && (
        <div className="order-timeline" aria-hidden={false}>
          {timelineSteps.map((s, i) => (
            <span key={s.key} className="timeline-segment">
              <div className={`timeline-step ${s.time ? 'completed' : ''}`}>
                <div className="dot">{s.time ? '✓' : ''}</div>
                <div className="label">{s.label}</div>
                {s.time && <div className="time">{formatDate(s.time)}</div>}
              </div>
              {i < timelineSteps.length - 1 && (
                <div className={`timeline-connector ${timelineSteps[i].time && timelineSteps[i + 1].time ? 'completed' : ''}`} />
              )}
            </span>
          ))}
        </div>
      )}

      <div className="order-details-layout">
        <div className="order-details-main">
          <div className="stats-grid order-details-grid">
            <div className="stat-card stat-card-pro order-detail-card order-card-customer">
              <span className="stat-title">العميل</span>
              <strong className="stat-number order-detail-value">{order.customerName || '-'}</strong>
              <p className="order-detail-sub order-detail-email">{order.email || '-'}</p>
            </div>

            <div className="stat-card stat-card-pro order-detail-card order-card-phone">
              <span className="stat-title">الهاتف</span>
              <strong className="stat-number order-detail-value order-detail-phone">{toEnglishDigits(order.phone || '-')}</strong>
              <p className="order-detail-sub">{cleanAddress(order.address) || '-'}</p>
            </div>

            <div className="stat-card stat-card-pro order-detail-card order-card-status">
              <span className="stat-title">الحالة والمبلغ</span>
              <strong className="stat-number order-detail-value">{statusLabel(order.status)}</strong>
              <p className="order-detail-sub order-summary-line">{Number(order.total || 0).toFixed(2)} {currencySymbol} • {paymentMethodLabel(order.paymentMethod)} • {paymentStatusLabel(order.paymentStatus)}</p>
            </div>
          </div>

          {/* Products table */}
          <div className="orders-table-container order-details-table-section desktop-orders-table admin-space-bottom-12">
            <h3 className="order-details-table-title">المنتجات</h3>
            <table className="orders-table">
              <thead>
                <tr>
                  <th>المنتج</th>
                  <th>الكمية</th>
                  <th>السعر</th>
                  <th>الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {(order.items || []).map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.quantity}</td>
                    <td>{Number(item.price || 0).toFixed(2)} {currencySymbol}</td>
                    <td>{(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2)} {currencySymbol}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* History */}
          <div className="orders-table-container order-details-table-section desktop-orders-table">
            <h3 className="order-details-table-title">سجل تغييرات الحالة</h3>
            <table className="orders-table">
              <thead>
                <tr>
                  <th>من</th>
                  <th>إلى</th>
                  <th>بواسطة</th>
                  <th>الوقت</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={4}>لا يوجد سجل تغييرات حتى الآن.</td>
                  </tr>
                ) : history.map((h) => (
                  <tr key={h.id}>
                    <td>{statusLabel(h.oldStatus)}</td>
                    <td>{statusLabel(h.newStatus)}</td>
                    <td>{h.changedBy || '-'}</td>
                    <td>{formatDate(h.changedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile lists kept as-is for smaller viewports */}
          <div className="mobile-orders-cards admin-order-details-mobile-list admin-space-bottom-12">
            {(order.items || []).map((item) => (
              <article key={`item-m-${item.id}`} className="mobile-order-card">
                <header className="mobile-order-head">
                  <strong>{item.name}</strong>
                  <span>الكمية: {item.quantity}</span>
                </header>
                <div className="mobile-order-row">
                  <span>السعر</span>
                  <strong>{Number(item.price || 0).toFixed(2)} {currencySymbol}</strong>
                </div>
                <div className="mobile-order-row">
                  <span>الإجمالي</span>
                  <strong>{(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2)} {currencySymbol}</strong>
                </div>
              </article>
            ))}
          </div>

          <div className="mobile-orders-cards admin-order-details-mobile-list">
            {history.length === 0 ? (
              <article className="mobile-order-card">لا يوجد سجل تغييرات حتى الآن.</article>
            ) : history.map((h) => (
              <article key={`history-m-${h.id}`} className="mobile-order-card">
                <header className="mobile-order-head">
                  <strong>{statusLabel(h.oldStatus)}</strong>
                  <span>← {statusLabel(h.newStatus)}</span>
                </header>
                <div className="mobile-order-row">
                  <span>بواسطة</span>
                  <strong>{h.changedBy || '-'}</strong>
                </div>
                <div className="mobile-order-row">
                  <span>الوقت</span>
                  <strong>{formatDate(h.changedAt)}</strong>
                </div>
              </article>
            ))}
          </div>

          <div className="mobile-orders-cards admin-order-details-mobile-list">
            <article className="mobile-order-card">
              <header className="mobile-order-head">
                <strong>ملخص الحالة الحالية</strong>
                <span>#{order.id}</span>
              </header>
              <div className="mobile-order-row">
                <span>حالة الطلب</span>
                <span className={badgeClass(order.status)}>{statusLabel(order.status)}</span>
              </div>
              <div className="mobile-order-row">
                <span>طريقة الدفع</span>
                <strong>{paymentMethodLabel(order.paymentMethod)}</strong>
              </div>
              <div className="mobile-order-row">
                <span>حالة الدفع</span>
                <span className={badgeClass(order.paymentStatus)}>{paymentStatusLabel(order.paymentStatus)}</span>
              </div>
              <div className="action-buttons admin-orders-mobile-actions">
                <a className="btn-action btn-view" href={phoneLink(order.phone)}>اتصال</a>
                <a className="btn-action btn-edit" href={whatsappLink(order.phone)} target="_blank" rel="noreferrer">واتساب</a>
                <a className="btn-action btn-view" href={`mailto:${order.email || ''}`}>إيميل</a>
              </div>
            </article>
          </div>
        </div>

        <aside className="order-details-sidebar">
          <div className="header-actions">
            <Link href="/admin/orders"><Button variant="secondary">العودة للطلبات</Button></Link>
            <Button variant="primary" onClick={() => exportInvoicePdf(order)}>تصدير الفاتورة</Button>
          </div>

          <aside className="stat-card stat-card-pro order-detail-card order-card-financial">
            <span className="stat-title">ملخص الفاتورة</span>
            <div className="summary-list">
              <div className="summary-row">
                <span className="label">المجموع الجزئي</span>
                <span className="value">{formatMoney(Number(order.subtotal || 0), currencySymbol, { locale })}</span>
              </div>

              <div className="summary-row">
                <span className="label">الخصم</span>
                <span className={`value ${Number(order.discount || 0) > 0 ? 'negative' : ''}`}>{Number(order.discount || 0) > 0 ? `- ${formatMoney(Number(order.discount || 0), currencySymbol, { locale })}` : 'لا يوجد خصم'}</span>
              </div>

              <div className="summary-row">
                <span className="label">الشحن</span>
                <span className="value">{formatMoney(Number(order.shipping || 0), currencySymbol, { locale })}</span>
              </div>

              <div className="summary-row">
                <span className="label">الضريبة</span>
                <span className="value">{formatMoney(Number(order.vat || 0), currencySymbol, { locale })}</span>
              </div>

              <div className="divider" />

              <div className="total-row">
                <span>الإجمالي</span>
                <span>{formatMoney(Number(order.total || 0), currencySymbol, { locale })}</span>
              </div>
            </div>
          </aside>

          <div className="stat-card stat-card-pro order-detail-card order-card-contact">
            <span className="stat-title">طريقة التواصل</span>
            <strong className="stat-number order-detail-value">تواصل سريع</strong>
            <div className="action-buttons order-contact-actions">
              <a className="btn-action btn-view" href={phoneLink(order.phone)}>اتصال</a>
              <a className="btn-action btn-edit" href={whatsappLink(order.phone)} target="_blank" rel="noreferrer">واتساب</a>
              <a className="btn-action btn-view" href={`mailto:${order.email || ''}`}>إيميل</a>
            </div>
          </div>

          <div className="stat-card stat-card-pro order-detail-card order-card-delivery">
            <span className="stat-title">طريقة التوصيل</span>
            <strong className="stat-number order-detail-value">{getDeliveryMethodLabel(order.address)}</strong>
            <p className="order-detail-sub">حسب اختيار العميل أثناء الطلب</p>
          </div>
        </aside>
      </div>

      <div className="orders-table-container order-details-table-section desktop-orders-table admin-space-bottom-12">
        <h3 className="order-details-table-title">المنتجات</h3>
        <table className="orders-table">
          <thead>
            <tr>
              <th>المنتج</th>
              <th>الكمية</th>
              <th>السعر</th>
              <th>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {(order.items || []).map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.quantity}</td>
                <td>{Number(item.price || 0).toFixed(2)} {currencySymbol}</td>
                <td>{(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2)} {currencySymbol}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mobile-orders-cards admin-order-details-mobile-list admin-space-bottom-12">
        {(order.items || []).map((item) => (
          <article key={`item-m-${item.id}`} className="mobile-order-card">
            <header className="mobile-order-head">
              <strong>{item.name}</strong>
              <span>الكمية: {item.quantity}</span>
            </header>
            <div className="mobile-order-row">
              <span>السعر</span>
              <strong>{Number(item.price || 0).toFixed(2)} {currencySymbol}</strong>
            </div>
            <div className="mobile-order-row">
              <span>الإجمالي</span>
              <strong>{(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2)} {currencySymbol}</strong>
            </div>
          </article>
        ))}
      </div>

      <div className="orders-table-container order-details-table-section desktop-orders-table">
        <h3 className="order-details-table-title">سجل تغييرات الحالة</h3>
        <table className="orders-table">
          <thead>
            <tr>
              <th>من</th>
              <th>إلى</th>
              <th>بواسطة</th>
              <th>الوقت</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr>
                <td colSpan={4}>لا يوجد سجل تغييرات حتى الآن.</td>
              </tr>
            ) : history.map((h) => (
              <tr key={h.id}>
                <td>{statusLabel(h.oldStatus)}</td>
                <td>{statusLabel(h.newStatus)}</td>
                <td>{h.changedBy || '-'}</td>
                <td>{formatDate(h.changedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mobile-orders-cards admin-order-details-mobile-list">
        {history.length === 0 ? (
          <article className="mobile-order-card">لا يوجد سجل تغييرات حتى الآن.</article>
        ) : history.map((h) => (
          <article key={`history-m-${h.id}`} className="mobile-order-card">
            <header className="mobile-order-head">
              <strong>{statusLabel(h.oldStatus)}</strong>
              <span>← {statusLabel(h.newStatus)}</span>
            </header>
            <div className="mobile-order-row">
              <span>بواسطة</span>
              <strong>{h.changedBy || '-'}</strong>
            </div>
            <div className="mobile-order-row">
              <span>الوقت</span>
              <strong>{formatDate(h.changedAt)}</strong>
            </div>
          </article>
        ))}
      </div>

      <div className="mobile-orders-cards admin-order-details-mobile-list">
        <article className="mobile-order-card">
          <header className="mobile-order-head">
            <strong>ملخص الحالة الحالية</strong>
            <span>#{order.id}</span>
          </header>
          <div className="mobile-order-row">
            <span>حالة الطلب</span>
            <span className={badgeClass(order.status)}>{statusLabel(order.status)}</span>
          </div>
          <div className="mobile-order-row">
            <span>طريقة الدفع</span>
            <strong>{paymentMethodLabel(order.paymentMethod)}</strong>
          </div>
          <div className="mobile-order-row">
            <span>حالة الدفع</span>
            <span className={badgeClass(order.paymentStatus)}>{paymentStatusLabel(order.paymentStatus)}</span>
          </div>
          <div className="action-buttons admin-orders-mobile-actions">
            <a className="btn-action btn-view" href={phoneLink(order.phone)}>اتصال</a>
            <a className="btn-action btn-edit" href={whatsappLink(order.phone)} target="_blank" rel="noreferrer">واتساب</a>
            <a className="btn-action btn-view" href={`mailto:${order.email || ''}`}>إيميل</a>
          </div>
        </article>
      </div>
    </main>
  )
}
