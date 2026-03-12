"use client"

import React from 'react'

export default function FreeShippingProgress({ subtotal = 0, threshold = 0, currency = 'ر.س' }) {
  const safeSubtotal = Number(subtotal || 0)
  const safeThreshold = Number(threshold || 0)
  const remaining = Math.max(0, safeThreshold - safeSubtotal)
  const percent = safeThreshold > 0 ? Math.min(100, Math.round((safeSubtotal / safeThreshold) * 100)) : 100

  if (safeThreshold <= 0) return null

  return (
    <div className="free-shipping-progress" role="status" aria-live="polite">
      <div className="fsp-row">
        <div className="fsp-message">{remaining > 0 ? `أضف ${remaining.toFixed(2)} ${currency} للحصول على شحن مجاني` : 'مبروك! لقد حصلت على شحن مجاني 🎉'}</div>
        <div className="fsp-percent">{percent}%</div>
      </div>
      <div className="fsp-bar" aria-hidden="true">
        <div className="fsp-fill" style={{ width: `${percent}%` }}></div>
      </div>
    </div>
  )
}
