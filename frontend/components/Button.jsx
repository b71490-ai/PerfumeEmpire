'use client'

import React from 'react'

export default function Button({ children, variant = 'primary', className = '', onClick, type = 'button', disabled = false, ariaLabel }) {
  const cls = `btn btn-${variant} ${className}`.trim()
  return (
    <button type={type} className={cls} onClick={onClick} disabled={disabled} aria-label={ariaLabel}>
      {children}
    </button>
  )
}
