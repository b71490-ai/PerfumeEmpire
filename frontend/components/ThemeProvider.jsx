"use client"

import React, { createContext, useContext, useLayoutEffect, useState } from 'react'

const ThemeCtx = createContext(null)

export function useTheme() {
  return useContext(ThemeCtx)
}

export default function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light')

  useLayoutEffect(() => {
    try {
      const stored = localStorage.getItem('theme')
      if (stored === 'dark' || stored === 'light') {
        setTheme(stored)
        document.body.classList.toggle('theme-dark', stored === 'dark')
        document.body.classList.toggle('theme-light', stored === 'light')
        document.body.setAttribute('data-theme', stored)
        return
      }

      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      const initial = prefersDark ? 'dark' : 'light'
      setTheme(initial)
      document.body.classList.toggle('theme-dark', initial === 'dark')
      document.body.classList.toggle('theme-light', initial === 'light')
      document.body.setAttribute('data-theme', initial)
    } catch (e) {
      // ignore
    }
  }, [])

  useLayoutEffect(() => {
    try {
      document.body.classList.toggle('theme-dark', theme === 'dark')
      document.body.classList.toggle('theme-light', theme === 'light')
      document.body.setAttribute('data-theme', theme)
      localStorage.setItem('theme', theme)
      try {
        // persist theme to cookie so SSR can read it on next request
        document.cookie = `theme=${theme}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`
      } catch (e) {
        // ignore
      }
    } catch (e) {
      // ignore
    }
  }, [theme])

  function toggle() {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }

  function setDark() {
    setTheme('dark')
  }

  function setLight() {
    setTheme('light')
  }

  return (
    <ThemeCtx.Provider value={{ theme, toggle, setDark, setLight }}>
      {children}
    </ThemeCtx.Provider>
  )
}
