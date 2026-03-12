"use client"

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'

export default function EditRedirectPage() {
  const router = useRouter()
  const params = useParams()

  useEffect(() => {
    router.replace(`/admin/products?editId=${params.id}`)
  }, [router, params.id])

  return <div className="loading">جاري التحويل لتعديل المنتج...</div>
}
