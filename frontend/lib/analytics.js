const normalizeNumber = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

const resolveUnitPrice = (item) => {
  const price = normalizeNumber(item?.price)
  const discountPercent = normalizeNumber(item?.discount)
  if (discountPercent > 0) {
    return price - (price * discountPercent / 100)
  }
  return price
}

const mapItem = (item) => ({
  item_id: String(item?.id ?? item?.perfumeId ?? ''),
  item_name: String(item?.name ?? ''),
  item_brand: String(item?.brand ?? ''),
  item_category: String(item?.category ?? ''),
  price: Number(resolveUnitPrice(item).toFixed(2)),
  quantity: normalizeNumber(item?.quantity || 1),
  discount: normalizeNumber(item?.discount || 0)
})

const mapContentIds = (items) => items.map((item) => String(item?.id ?? item?.perfumeId ?? '')).filter(Boolean)

const emitDataLayer = (eventName, payload) => {
  if (typeof window === 'undefined') return
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({ event: eventName, ...payload })
}

const emitGa = (eventName, payload) => {
  if (typeof window === 'undefined') return
  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, payload)
  }
}

const emitPixel = (eventName, payload) => {
  if (typeof window === 'undefined') return
  if (typeof window.fbq !== 'function') return
  window.fbq('track', eventName, payload)
}

const emitPixelCustom = (eventName, payload) => {
  if (typeof window === 'undefined') return
  if (typeof window.fbq !== 'function') return
  window.fbq('trackCustom', eventName, payload)
}

export function trackAddToCart({ item, quantity = 1, currency = 'SAR' }) {
  const trackedItem = mapItem({ ...item, quantity })
  const value = Number((trackedItem.price * trackedItem.quantity).toFixed(2))

  emitDataLayer('add_to_cart', {
    ecommerce: {
      currency,
      value,
      items: [trackedItem]
    }
  })

  emitGa('add_to_cart', {
    currency,
    value,
    items: [trackedItem]
  })

  emitPixel('AddToCart', {
    currency,
    value,
    content_type: 'product',
    content_ids: [trackedItem.item_id]
  })
}

export function trackAddToWishlist({ item, currency = 'SAR' }) {
  if (!item) return

  const trackedItem = mapItem({ ...item, quantity: 1 })
  const value = Number(trackedItem.price.toFixed(2))

  emitDataLayer('add_to_wishlist', {
    ecommerce: {
      currency,
      value,
      items: [trackedItem]
    }
  })

  emitGa('add_to_wishlist', {
    currency,
    value,
    items: [trackedItem]
  })

  emitPixel('AddToWishlist', {
    currency,
    value,
    content_type: 'product',
    content_ids: [trackedItem.item_id]
  })
}

export function trackRemoveFromWishlist({ item, currency = 'SAR' }) {
  if (!item) return

  const trackedItem = mapItem({ ...item, quantity: 1 })
  const value = Number(trackedItem.price.toFixed(2))

  emitDataLayer('remove_from_wishlist', {
    ecommerce: {
      currency,
      value,
      items: [trackedItem]
    }
  })

  emitGa('remove_from_wishlist', {
    currency,
    value,
    items: [trackedItem]
  })

  emitPixelCustom('RemoveFromWishlist', {
    currency,
    value,
    content_type: 'product',
    content_ids: [trackedItem.item_id]
  })
}

export function trackRemoveFromCart({ item, quantity = 1, currency = 'SAR' }) {
  if (!item) return
  const trackedItem = mapItem({ ...item, quantity })
  const value = Number((trackedItem.price * trackedItem.quantity).toFixed(2))

  emitDataLayer('remove_from_cart', {
    ecommerce: {
      currency,
      value,
      items: [trackedItem]
    }
  })

  emitGa('remove_from_cart', {
    currency,
    value,
    items: [trackedItem]
  })

  emitPixel('RemoveFromCart', {
    currency,
    value,
    content_type: 'product',
    content_ids: [trackedItem.item_id]
  })
}

export function trackViewItem({ item, currency = 'SAR' }) {
  if (!item) return
  const trackedItem = mapItem({ ...item, quantity: 1 })
  const value = Number(trackedItem.price.toFixed(2))

  emitDataLayer('view_item', {
    ecommerce: {
      currency,
      value,
      items: [trackedItem]
    }
  })

  emitGa('view_item', {
    currency,
    value,
    items: [trackedItem]
  })

  emitPixel('ViewContent', {
    currency,
    value,
    content_type: 'product',
    content_ids: [trackedItem.item_id]
  })
}

export function trackViewItemList({ items = [], currency = 'SAR', itemListName = 'shop' }) {
  const trackedItems = items.map((item) => ({
    ...mapItem({ ...item, quantity: 1 }),
    item_list_name: itemListName
  }))

  emitDataLayer('view_item_list', {
    ecommerce: {
      item_list_name: itemListName,
      items: trackedItems
    }
  })

  emitGa('view_item_list', {
    item_list_name: itemListName,
    currency,
    items: trackedItems
  })

  emitPixel('ViewContent', {
    currency,
    content_type: 'product_group',
    content_ids: mapContentIds(items)
  })
}

export function trackSelectItem({ item, currency = 'SAR', itemListName = 'shop' }) {
  if (!item) return

  const trackedItem = {
    ...mapItem({ ...item, quantity: 1 }),
    item_list_name: itemListName
  }
  const value = Number(trackedItem.price.toFixed(2))

  emitDataLayer('select_item', {
    ecommerce: {
      item_list_name: itemListName,
      items: [trackedItem]
    }
  })

  emitGa('select_item', {
    currency,
    item_list_name: itemListName,
    items: [trackedItem]
  })

  emitPixel('ViewContent', {
    currency,
    value,
    content_type: 'product',
    content_ids: [trackedItem.item_id]
  })
}

export function trackBeginCheckout({ items = [], currency = 'SAR', value = 0 }) {
  const trackedItems = items.map(mapItem)

  emitDataLayer('begin_checkout', {
    ecommerce: {
      currency,
      value: Number(normalizeNumber(value).toFixed(2)),
      items: trackedItems
    }
  })

  emitGa('begin_checkout', {
    currency,
    value: Number(normalizeNumber(value).toFixed(2)),
    items: trackedItems
  })

  emitPixel('InitiateCheckout', {
    currency,
    value: Number(normalizeNumber(value).toFixed(2)),
    content_type: 'product',
    content_ids: mapContentIds(items)
  })
}

export function trackViewCart({ items = [], currency = 'SAR', value = 0 }) {
  const trackedItems = items.map(mapItem)

  emitDataLayer('view_cart', {
    ecommerce: {
      currency,
      value: Number(normalizeNumber(value).toFixed(2)),
      items: trackedItems
    }
  })

  emitGa('view_cart', {
    currency,
    value: Number(normalizeNumber(value).toFixed(2)),
    items: trackedItems
  })

  emitPixel('ViewCart', {
    currency,
    value: Number(normalizeNumber(value).toFixed(2)),
    content_type: 'product',
    content_ids: mapContentIds(items)
  })
}

export function trackAddPaymentInfo({ items = [], currency = 'SAR', value = 0, paymentType = 'cash_on_delivery' }) {
  const trackedItems = items.map(mapItem)

  emitDataLayer('add_payment_info', {
    ecommerce: {
      currency,
      value: Number(normalizeNumber(value).toFixed(2)),
      payment_type: paymentType,
      items: trackedItems
    }
  })

  emitGa('add_payment_info', {
    currency,
    value: Number(normalizeNumber(value).toFixed(2)),
    payment_type: paymentType,
    items: trackedItems
  })

  emitPixel('AddPaymentInfo', {
    currency,
    value: Number(normalizeNumber(value).toFixed(2)),
    content_type: 'product',
    content_ids: mapContentIds(items)
  })
}

export function trackPurchase({ orderId, items = [], currency = 'SAR', value = 0 }) {
  const trackedItems = items.map(mapItem)

  emitDataLayer('purchase', {
    ecommerce: {
      transaction_id: String(orderId || ''),
      currency,
      value: Number(normalizeNumber(value).toFixed(2)),
      items: trackedItems
    }
  })

  emitGa('purchase', {
    transaction_id: String(orderId || ''),
    currency,
    value: Number(normalizeNumber(value).toFixed(2)),
    items: trackedItems
  })

  emitPixel('Purchase', {
    currency,
    value: Number(normalizeNumber(value).toFixed(2)),
    content_type: 'product',
    content_ids: mapContentIds(items)
  })
}

export function trackSearch({ searchTerm = '', items = [], currency = 'SAR' }) {
  const term = String(searchTerm || '').trim()
  if (!term) return

  const trackedItems = items.map((item) => ({
    ...mapItem({ ...item, quantity: 1 }),
    item_list_name: 'search_results'
  }))

  emitDataLayer('search', {
    ecommerce: {
      search_term: term,
      items: trackedItems
    }
  })

  emitGa('search', {
    search_term: term,
    currency,
    items: trackedItems
  })

  emitPixel('Search', {
    search_string: term,
    currency,
    content_ids: mapContentIds(items)
  })
}

export function trackLandingInteraction({ action = '', label = '', section = '' }) {
  const safeAction = String(action || '').trim()
  if (!safeAction) return

  const payload = {
    action: safeAction,
    label: String(label || '').trim(),
    section: String(section || '').trim()
  }

  emitDataLayer('landing_interaction', payload)
  emitGa('landing_interaction', payload)
  emitPixelCustom('LandingInteraction', payload)
}

export function trackViewPromotion({ promotionId = '', promotionName = '', creativeName = 'home_offers', creativeSlot = '' }) {
  const id = String(promotionId || '').trim()
  const name = String(promotionName || '').trim()
  if (!id || !name) return

  const promotion = {
    promotion_id: id,
    promotion_name: name,
    creative_name: String(creativeName || 'home_offers'),
    creative_slot: String(creativeSlot || '')
  }

  emitDataLayer('view_promotion', {
    ecommerce: {
      promotions: [promotion]
    }
  })

  emitGa('view_promotion', {
    promotions: [promotion]
  })

  emitPixelCustom('ViewPromotion', promotion)
}

export function trackSelectPromotion({ promotionId = '', promotionName = '', creativeName = 'home_offers', creativeSlot = '' }) {
  const id = String(promotionId || '').trim()
  const name = String(promotionName || '').trim()
  if (!id || !name) return

  const promotion = {
    promotion_id: id,
    promotion_name: name,
    creative_name: String(creativeName || 'home_offers'),
    creative_slot: String(creativeSlot || '')
  }

  emitDataLayer('select_promotion', {
    ecommerce: {
      promotions: [promotion]
    }
  })

  emitGa('select_promotion', {
    promotions: [promotion]
  })

  emitPixelCustom('SelectPromotion', promotion)
}
