export function buildTrackingUrl({ orderId, phone = '' }) {
  if (!orderId || typeof window === 'undefined') return ''

  const query = new URLSearchParams({ orderId: String(orderId) })
  const normalizedPhone = String(phone || '').replace(/[^\d]/g, '').trim()
  if (normalizedPhone) {
    query.set('phone', normalizedPhone)
  }

  return `${window.location.origin}/track-order?${query.toString()}`
}

export async function copyTextToClipboard(text) {
  if (!text || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    return false
  }

  await navigator.clipboard.writeText(text)
  return true
}

export async function shareOrCopyTrackingUrl({ orderId, phone = '', title, text = 'رابط تتبع الطلب' }) {
  const trackUrl = buildTrackingUrl({ orderId, phone })
  if (!trackUrl || typeof navigator === 'undefined') return false

  if (typeof navigator.share === 'function') {
    await navigator.share({ title, text, url: trackUrl })
    return true
  }

  return copyTextToClipboard(trackUrl)
}