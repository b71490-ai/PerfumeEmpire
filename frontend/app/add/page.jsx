"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AddRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/admin/products')
  }, [router])

  return <div className="loading">جاري التحويل لإدارة المنتجات...</div>
}
