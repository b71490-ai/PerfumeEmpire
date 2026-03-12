'use client'

import { useState, useId, useRef, useEffect } from 'react'

export default function Accordion({ title, children, className = '', id: idProp }) {
  const [open, setOpen] = useState(false)
  const generatedId = useId()
  const id = idProp || generatedId
  const headerRef = useRef(null)

  // keyboard: space/enter toggle when header focused
  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const onKey = (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    el.addEventListener('keydown', onKey)
    return () => el.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className={`accordion ${className}`.trim()}>
      <div
        className="accordion-header"
        role="button"
        tabIndex={0}
        aria-controls={`accordion-panel-${id}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        ref={headerRef}
      >
        <div className="accordion-title">{title}</div>
        <div className="accordion-toggle" aria-hidden="true">{open ? '−' : '+'}</div>
      </div>

      <div
        id={`accordion-panel-${id}`}
        className={`accordion-panel ${open ? 'open' : ''}`}
        hidden={!open}
      >
        {children}
      </div>
    </div>
  )
}
