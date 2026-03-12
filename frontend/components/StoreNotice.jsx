'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { fetchStoreSettings } from '@/lib/api'

export default function StoreNotice() {
  const pathname = usePathname()
  const [settings, setSettings] = useState({
    maintenanceMode: false,
    maintenanceMessage: '',
    announcementEnabled: false,
    announcementText: '',
    announcementLink: ''
  })

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const data = await fetchStoreSettings()
        if (!mounted || !data) return
        setSettings({
          maintenanceMode: Boolean(data.maintenanceMode),
          maintenanceMessage: data.maintenanceMessage || 'المتجر تحت صيانة مؤقتة، سنعود قريباً.',
          announcementEnabled: Boolean(data.announcementEnabled),
          announcementText: data.announcementText || '',
          announcementLink: data.announcementLink || ''
        })
      } catch {
        // silent fallback
      }
    })()

    return () => { mounted = false }
  }, [])

  if (pathname?.startsWith('/admin')) return null

  return (
    <>
      {settings.announcementEnabled && settings.announcementText && (
        <div className="store-announcement" role="status" aria-live="polite">
          {settings.announcementLink ? (
            <Link href={settings.announcementLink}>{settings.announcementText}</Link>
          ) : (
            <span>{settings.announcementText}</span>
          )}
        </div>
      )}

      {settings.maintenanceMode && (
        <div className="store-maintenance" role="alert">
          <strong>تنبيه صيانة:</strong>{' '}
          <span>{settings.maintenanceMessage}</span>
        </div>
      )}
    </>
  )
}
