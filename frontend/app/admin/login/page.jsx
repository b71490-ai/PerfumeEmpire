"use client"

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function AdminLogin() {
  const search = useSearchParams()
  const from = search?.get('from') || '/admin/dashboard'
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, from }),
      })

      if (res.redirected) {
        // server-side route set cookie and redirected
        router.push(res.url)
        return
      }

      if (res.ok) {
        router.push(from)
        return
      }

      const data = await res.json().catch(() => ({}))
      setError(data.error || 'خطأ في تسجيل الدخول')
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="admin-login-page">
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <h1>تسجيل دخول الإدارة</h1>
            <p>لوحة تحكم متجر عطور الإمبراطورية</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form" aria-label="Admin login form" aria-busy={loading}>
            <div className="form-group">
              <label htmlFor="username">اسم المستخدم</label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value)
                  setError('')
                }}
                placeholder="أدخل اسم المستخدم"
                autoComplete="username"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">كلمة المرور</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError('')
                }}
                placeholder="أدخل كلمة المرور"
                autoComplete="current-password"
                required
              />
            </div>

            <div role="status" aria-live="polite">
              {error && (
                <div className="error-message">
                  ⚠️ {error}
                </div>
              )}
            </div>

            <button type="submit" className="btn-login" disabled={loading} aria-disabled={loading}>
              <span>{loading ? 'جاري التسجيل...' : 'تسجيل الدخول'}</span>
            </button>
          </form>

          <div className="login-footer">
            <Link href="/shop" className="back-link">
              ← العودة للمتجر
            </Link>
          </div>

          <div className="hint-box">
            <p>استخدم بيانات إدارة مخصصة وآمنة، وتجنب مشاركة حسابات الإدارة.</p>
          </div>
        </div>
      </div>
    </main>
  )
}
