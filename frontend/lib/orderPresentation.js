export function statusLabel(status) {
  switch (status) {
    case 'Pending': return 'قيد التجهيز'
    case 'Processing': return 'قيد المعالجة'
    case 'Shipped': return 'قيد الشحن'
    case 'Completed': return 'تم التوصيل'
    case 'Cancelled': return 'ملغى'
    default: return status || '-'
  }
}

export function paymentLabel(status) {
  switch (status) {
    case 'Pending': return 'بانتظار الدفع'
    case 'Paid': return 'مدفوع'
    case 'Failed': return 'فشل الدفع'
    case 'Refunded': return 'تم الاسترجاع'
    default: return status || '-'
  }
}

export function paymentMethodLabel(method, options = {}) {
  const { showUnknownRaw = false } = options

  if (method === 'online') return 'دفع إلكتروني'
  if (method === 'cash_on_delivery') return 'دفع عند الاستلام'

  if (showUnknownRaw) {
    return method || '-'
  }

  return '-'
}

export function orderBadgeClass(status) {
  if (status === 'Completed' || status === 'Paid') return 'order-status-badge badge-success'
  if (status === 'Cancelled' || status === 'Failed' || status === 'Refunded') return 'order-status-badge badge-danger'
  return 'order-status-badge badge-warn'
}