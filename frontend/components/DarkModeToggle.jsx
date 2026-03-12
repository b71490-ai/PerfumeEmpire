"use client"

import { useEffect, useState } from 'react'

export default function DarkModeToggle() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('theme')
      if (saved) {
        const dark = saved === 'dark'
        setIsDark(dark)
        document.body.classList.toggle('theme-dark', dark)
        document.body.classList.toggle('theme-light', !dark)
        return
      }

      // fallback to OS preference
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      setIsDark(prefersDark)
      document.body.classList.toggle('theme-dark', prefersDark)
      document.body.classList.toggle('theme-light', !prefersDark)
    } catch (e) {
      // ignore (e.g., SSR safety)
    }
  }, [])

  function toggle() {
    const next = !isDark
    setIsDark(next)
    try {
      document.body.classList.toggle('theme-dark', next)
      document.body.classList.toggle('theme-light', !next)
      // also set data-theme attribute as a robust fallback for CSS selectors
      document.body.setAttribute('data-theme', next ? 'dark' : 'light')
      localStorage.setItem('theme', next ? 'dark' : 'light')
      console.log('DarkModeToggle: set theme ->', next ? 'dark' : 'light')
    } catch (e) {
      // ignore
    }
  }

  return (
    <button
      type="button"
      aria-pressed={isDark}
      onClick={toggle}
      className="icon-only dark-toggle"
      title={isDark ? 'إيقاف الوضع الداكن' : 'تفعيل الوضع الداكن'}
    >
      {isDark ? '🌙' : '☀️'}
    </button>
  )
}
