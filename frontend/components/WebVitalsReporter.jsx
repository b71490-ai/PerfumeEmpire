'use client'

import { useReportWebVitals } from 'next/web-vitals'

const IMPORTANT_METRICS = new Set(['LCP', 'CLS', 'INP', 'FCP', 'TTFB'])

export default function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    if (!IMPORTANT_METRICS.has(metric.name)) return

    if (process.env.NODE_ENV !== 'production') {
      console.log('[WebVitals]', metric.name, metric.value)
    }

    if (typeof window !== 'undefined') {
      window.__perfumeVitals = window.__perfumeVitals || []
      window.__perfumeVitals.push({
        name: metric.name,
        value: metric.value,
        id: metric.id,
        rating: metric.rating,
        ts: Date.now()
      })

      if (window.__perfumeVitals.length > 30) {
        window.__perfumeVitals.shift()
      }
    }
  })

  return null
}
