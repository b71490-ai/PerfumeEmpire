"use client"

import React from 'react'
import { useTheme } from './ThemeProvider'

export default function ThemeToggle() {
  const ctx = useTheme()
  if (!ctx) return null

  const { theme, toggle } = ctx
  // Theme toggle removed per request — render nothing to keep imports safe.
  return null
}
