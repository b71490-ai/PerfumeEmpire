"use client"
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

export default function CheckoutProgress() {
  const pathname = usePathname() || ''
  const [active, setActive] = useState(2)

  useEffect(() => {
    if (pathname.startsWith('/checkout/success')) {
      setActive(4)
      return
    }

    // check local draft for payment selection to bump to payment step
    try {
      const draft = JSON.parse(localStorage.getItem('checkoutFormDraftV1') || '{}')
      if (draft && draft.paymentMethod) {
        setActive(3)
        return
      }
    } catch (e) {
      // ignore
    }

    // default: on checkout pages show Shipping as active
    if (pathname.startsWith('/checkout')) setActive(2)
  }, [pathname])

  const steps = [
    { id: 1, icon: '🛒', label: 'السلة', href: '/cart' },
    { id: 2, icon: '📦', label: 'الشحن' },
    { id: 3, icon: '💳', label: 'الدفع' },
    { id: 4, icon: '✅', label: 'التأكيد' }
  ]

  return (
    <nav className="checkout-progress" aria-label="خطوات إتمام الطلب">
      <ol className="checkout-steps">
        {steps.map((s) => {
          const stateClass = s.id === active ? 'is-active' : s.id < active ? 'is-complete' : ''
          return (
            <li key={s.id} className={`checkout-step ${stateClass}`} aria-current={s.id === active ? 'step' : undefined}>
              {s.href ? (
                <a href={s.href} className="step-link" aria-label={s.label}>
                  <span className="step-icon" aria-hidden="true">{s.icon}</span>
                  <span className="step-label">{s.label}</span>
                </a>
              ) : (
                <div className="step-item" aria-label={s.label}>
                  <span className="step-icon" aria-hidden="true">{s.icon}</span>
                  <span className="step-label">{s.label}</span>
                </div>
              )}
              {s.id < steps.length && <span className="step-sep" aria-hidden="true">›</span>}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
