"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import { showAutoHideToast, clearToastTimer, TOAST_AUTO_HIDE_MS } from '@/lib/toast'

export function useToast() {
  const toastTimerRef = useRef(null)
  const [toast, setToast] = useState({ type: '', message: '' })

  const showToast = useCallback((type, message, duration = TOAST_AUTO_HIDE_MS) => {
    showAutoHideToast(setToast, toastTimerRef, type, message, duration)
  }, [])

  const closeToast = useCallback(() => {
    clearToastTimer(toastTimerRef)
    setToast({ type: '', message: '' })
  }, [])

  useEffect(() => {
    return () => {
      clearToastTimer(toastTimerRef)
    }
  }, [])

  return {
    toast,
    showToast,
    closeToast,
  }
}
