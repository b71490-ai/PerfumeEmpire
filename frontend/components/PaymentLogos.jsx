/* eslint-disable @next/next/no-img-element */
"use client"

export default function PaymentLogos({ className = '' }) {
  return (
    <div className={`payment-logos ${className}`.trim()} role="group" aria-label="طرق الدفع المدعومة">
      <span className="visually-hidden">طرق الدفع المتاحة: Visa, Mada, Apple Pay, STC Pay</span>
      <img src="https://cdn.simpleicons.org/visa/000000" alt="Visa" className="payment-logo" loading="lazy" decoding="async" />
      <img src="https://upload.wikimedia.org/wikipedia/commons/b/bb/Mada_logo.svg" alt="Mada" className="payment-logo" loading="lazy" decoding="async" />
      <img src="https://upload.wikimedia.org/wikipedia/commons/b/b0/Apple_Pay_logo.svg" alt="Apple Pay" className="payment-logo" loading="lazy" decoding="async" />
      <img src="/images/payments/stc-pay.svg" alt="STC Pay" className="payment-logo" loading="lazy" decoding="async" />
    </div>
  )
}
