"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminDashboard() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/admin/dashboard')
  }, [router])

  return (
    <div className="admin-page-redirect">جاري تحويلك إلى لوحة التحكم…</div>
  )
}
