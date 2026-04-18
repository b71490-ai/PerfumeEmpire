"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Button from '@/components/Button'
import { useAdmin } from '@/context/AdminContext'
import { fetchCoupons, createCoupon, updateCoupon, deleteCoupon } from '@/lib/api'
import { toEnglishDigits } from '@/lib/intl'

const TYPE_OPTIONS = [
  { value: 'percent', label: 'نسبة مئوية %' },
  { value: 'fixed', label: 'مبلغ ثابت' },
  { value: 'free_shipping', label: 'شحن مجاني' }
]

const typeLabel = (value) => {
  if (value === 'percent') return 'نسبة %'
  if (value === 'fixed') return 'مبلغ ثابت'
  if (value === 'free_shipping') return 'شحن مجاني'
  return value || '-'
}

export default function AdminCouponsPage() {
  const { isAdmin, loading, canManageCoupons } = useAdmin()
  const router = useRouter()

  const [coupons, setCoupons] = useState([])
  const [pageLoading, setPageLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingCode, setDeletingCode] = useState('')
  const [search, setSearch] = useState('')
  const [editingCode, setEditingCode] = useState('')
  const [toast, setToast] = useState(null)
  const [form, setForm] = useState({
    code: '',
    title: '',
    type: 'percent',
    amount: 10,
    isActive: true
  })

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    if (loading) return
    if (!isAdmin) {
      router.push('/admin/login')
      return
    }
    if (!canManageCoupons) {
      router.push('/admin/dashboard')
    }
  }, [loading, isAdmin, canManageCoupons, router])

  const loadCoupons = useCallback(async () => {
    try {
      setPageLoading(true)
      const data = await fetchCoupons()
      setCoupons(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error(e)
      showToast('تعذر تحميل الكوبونات', 'error')
    } finally {
      setPageLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAdmin && canManageCoupons) {
      loadCoupons()
    }
  }, [isAdmin, canManageCoupons, loadCoupons])

  const normalizedSearch = toEnglishDigits(String(search || '').trim().toLowerCase())
  const filteredCoupons = useMemo(() => {
    if (!normalizedSearch) return coupons
    return coupons.filter((coupon) => {
      const code = toEnglishDigits(String(coupon.id || '')).toLowerCase()
      const title = toEnglishDigits(String(coupon.title || '')).toLowerCase()
      const type = String(coupon.type || '').toLowerCase()
      return code.includes(normalizedSearch) || title.includes(normalizedSearch) || type.includes(normalizedSearch)
    })
  }, [coupons, normalizedSearch])

  const resetForm = () => {
    setEditingCode('')
    setForm({
      code: '',
      title: '',
      type: 'percent',
      amount: 10,
      isActive: true
    })
  }

  const startEdit = (coupon) => {
    setEditingCode(String(coupon.id || ''))
    setForm({
      code: String(coupon.id || ''),
      title: String(coupon.title || ''),
      type: String(coupon.type || 'fixed'),
      amount: Number(coupon.amount || 0),
      isActive: Boolean(coupon.isActive)
    })
  }

  const onTypeChange = (nextType) => {
    setForm((prev) => ({
      ...prev,
      type: nextType,
      amount: nextType === 'free_shipping' ? 0 : prev.amount
    }))
  }

  const submitLabel = saving ? 'جاري الحفظ...' : editingCode ? 'حفظ التعديل' : 'إضافة كوبون'

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (saving) return

    const code = String(form.code || '').trim().toUpperCase()
    if (!editingCode && !code) {
      showToast('يرجى إدخال كود الكوبون', 'error')
      return
    }

    const amount = form.type === 'free_shipping' ? 0 : Number(form.amount || 0)
    if (form.type === 'percent' && (amount <= 0 || amount > 100)) {
      showToast('نسبة الخصم يجب أن تكون بين 0 و 100', 'error')
      return
    }
    if (form.type === 'fixed' && amount <= 0) {
      showToast('قيمة الخصم يجب أن تكون أكبر من صفر', 'error')
      return
    }

    const payload = {
      code,
      title: String(form.title || '').trim(),
      type: form.type,
      amount,
      isActive: Boolean(form.isActive)
    }

    try {
      setSaving(true)
      if (editingCode) {
        await updateCoupon(editingCode, payload)
        showToast('تم تحديث الكوبون')
      } else {
        await createCoupon(payload)
        showToast('تمت إضافة الكوبون')
      }
      resetForm()
      await loadCoupons()
    } catch (e) {
      console.error(e)
      const message = e?.response?.data?.message || 'تعذر حفظ بيانات الكوبون'
      showToast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (code) => {
    if (!code || deletingCode) return
    if (!confirm(`هل تريد حذف الكوبون ${code}؟`)) return

    try {
      setDeletingCode(code)
      await deleteCoupon(code)
      setCoupons((prev) => prev.filter((item) => String(item.id) !== String(code)))
      if (editingCode === code) resetForm()
      showToast('تم حذف الكوبون')
    } catch (e) {
      console.error(e)
      const message = e?.response?.data?.message || 'تعذر حذف الكوبون'
      showToast(message, 'error')
    } finally {
      setDeletingCode('')
    }
  }

  if (loading || pageLoading) return <div className="loading">جاري التحميل...</div>
  if (!isAdmin || !canManageCoupons) return null

  return (
    <main className="admin-orders-page admin-coupons-page" aria-busy={saving || Boolean(deletingCode)}>
      {toast && (
        <div className={`toast toast-${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'} aria-live={toast.type === 'error' ? 'assertive' : 'polite'} aria-atomic="true">
          {toast.message}
        </div>
      )}

      <div className="admin-header">
        <div>
          <h1>إدارة الكوبونات</h1>
          <p>إضافة وتعديل أكواد الخصم المتاحة للعملاء</p>
        </div>
        <div className="header-actions">
          <Link href="/admin/dashboard"><Button variant="secondary" className="admin-back-btn">العودة للوحة التحكم</Button></Link>
        </div>
      </div>

      <div className="orders-table-container admin-space-bottom-16">
        <h3 className="admin-section-title">{editingCode ? `تعديل: ${editingCode}` : 'إضافة كوبون جديد'}</h3>
        <form className="admin-coupons-form" onSubmit={handleSubmit}>
          <input
            className="admin-select"
            placeholder="كود الكوبون (مثال: RAMADAN25)"
            value={form.code}
            onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
            disabled={Boolean(editingCode)}
            required={!editingCode}
          />

          <input
            className="admin-select"
            placeholder="عنوان الكوبون"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
          />

          <select className="admin-select" value={form.type} onChange={(e) => onTypeChange(e.target.value)}>
            {TYPE_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>

          <input
            className="admin-select"
            type="number"
            min={form.type === 'percent' ? 1 : 0}
            max={form.type === 'percent' ? 100 : undefined}
            step="0.01"
            value={form.type === 'free_shipping' ? 0 : form.amount}
            onChange={(e) => setForm((prev) => ({ ...prev, amount: Number(e.target.value || 0) }))}
            disabled={form.type === 'free_shipping'}
          />

          <label className="admin-coupon-toggle">
            <input
              type="checkbox"
              checked={Boolean(form.isActive)}
              onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
            />
            مفعل
          </label>

          <div className="admin-coupons-form-actions">
            <Button variant="primary" type="submit" disabled={saving}>{submitLabel}</Button>
            {editingCode && (
              <Button variant="secondary" type="button" onClick={resetForm}>إلغاء التعديل</Button>
            )}
          </div>
        </form>
      </div>

      <div className="orders-table-container">
        <div className="admin-orders-toolbar admin-space-bottom-12">
          <input
            className="admin-select"
            placeholder="بحث بالكود أو العنوان"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="summary-badges">
            <span className="badge">الإجمالي: {coupons.length}</span>
            <span className="badge">النتيجة: {filteredCoupons.length}</span>
          </div>
        </div>

        <table className="orders-table">
          <thead>
            <tr>
              <th>الكود</th>
              <th>العنوان</th>
              <th>النوع</th>
              <th>القيمة</th>
              <th>الحالة</th>
              <th>آخر تحديث</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filteredCoupons.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '20px' }}>لا توجد كوبونات</td>
              </tr>
            ) : (
              filteredCoupons.map((coupon) => {
                const code = String(coupon.id || '')
                const amount = Number(coupon.amount || 0)
                const formattedAmount = coupon.type === 'percent' ? `${amount}%` : coupon.type === 'free_shipping' ? 'شحن مجاني' : `${amount.toFixed(2)} ر.س`
                return (
                  <tr key={code}>
                    <td><strong>{code}</strong></td>
                    <td>{coupon.title || '-'}</td>
                    <td>{typeLabel(coupon.type)}</td>
                    <td>{formattedAmount}</td>
                    <td>{coupon.isActive ? 'مفعل' : 'معطل'}</td>
                    <td>{coupon.updatedAt ? new Date(coupon.updatedAt).toLocaleString('ar-SA') : '-'}</td>
                    <td>
                      <div className="actions-group">
                        <button type="button" className="btn-action btn-view" onClick={() => startEdit(coupon)}>تعديل</button>
                        <button
                          type="button"
                          className="btn-action btn-delete"
                          onClick={() => handleDelete(code)}
                          disabled={deletingCode === code}
                        >
                          {deletingCode === code ? '...' : 'حذف'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
