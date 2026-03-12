"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Button from '@/components/Button'
import { useAdmin } from '@/context/AdminContext'
import { fetchAdminUsers, updateAdminUser, createAdminUser, resetAdminUserPassword, deleteAdminUser } from '@/lib/api'
import { formatDecimal, getUserLocale, toEnglishDigits } from '@/lib/intl'

const ROLE_OPTIONS = [
  { value: 'Admin', label: 'مدير كامل الصلاحيات' },
  { value: 'Manager', label: 'مدير تشغيل' },
  { value: 'Editor', label: 'محرر محتوى' },
  { value: 'Support', label: 'دعم العملاء' },
]

const ROLE_CAPABILITIES = [
  { role: 'Admin', dashboard: true, users: true, productsManage: true, productsDelete: true, ordersView: true, ordersManage: true, ordersExport: true, settings: true },
  { role: 'Manager', dashboard: true, users: false, productsManage: true, productsDelete: true, ordersView: true, ordersManage: true, ordersExport: true, settings: true },
  { role: 'Editor', dashboard: true, users: false, productsManage: true, productsDelete: false, ordersView: false, ordersManage: false, ordersExport: false, settings: false },
  { role: 'Support', dashboard: true, users: false, productsManage: false, productsDelete: false, ordersView: true, ordersManage: true, ordersExport: false, settings: false },
]

const capabilityMark = (enabled) => (enabled ? '✓' : '—')

export default function AdminUsersPage() {
  const { isAdmin, loading, canManageUsers } = useAdmin()
  const router = useRouter()
  const [users, setUsers] = useState([])
  const [pageLoading, setPageLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ username: '', role: 'Admin' })
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [resettingId, setResettingId] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'Admin' })
  const [resetPasswordForm, setResetPasswordForm] = useState({ userId: null, password: '' })
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [toast, setToast] = useState(null)
  const locale = getUserLocale('ar-SA')
  const formatInteger = (value) => formatDecimal(value, { locale, minimumFractionDigits: 0, maximumFractionDigits: 0 })

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
    if (!canManageUsers) {
      router.push('/admin/dashboard')
    }
  }, [loading, isAdmin, canManageUsers, router])

  const loadUsers = useCallback(async () => {
    if (!isAdmin || !canManageUsers) return

    setPageLoading(true)
    setLoadError('')
    try {
      const data = await fetchAdminUsers()
      setUsers(data || [])
    } catch (e) {
      console.error(e)
      setLoadError('تعذر تحميل قائمة المستخدمين حالياً. حاول مرة أخرى.')
    } finally {
      setPageLoading(false)
    }
  }, [isAdmin, canManageUsers])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const normalizedSearchTerm = toEnglishDigits(searchTerm).trim().toLowerCase()
  const filteredUsers = useMemo(() => {
    if (!normalizedSearchTerm) return users
    return users.filter((user) => {
      const username = toEnglishDigits(String(user.username || '')).toLowerCase()
      const identifier = toEnglishDigits(String(user.id || ''))
      const role = String(user.role || '').toLowerCase()
      return username.includes(normalizedSearchTerm) || identifier.includes(normalizedSearchTerm) || role.includes(normalizedSearchTerm)
    })
  }, [users, normalizedSearchTerm])

  const trimmedNewUsername = newUser.username.trim()
  const trimmedNewPassword = newUser.password.trim()
  const canCreateUser = trimmedNewUsername.length >= 3 && trimmedNewPassword.length >= 8 && !creating

  if (loading || pageLoading) return <div className="loading">جاري التحميل...</div>
  if (!isAdmin || !canManageUsers) return null

  const startEdit = (user) => {
    setEditingId(user.id)
    setEditForm({ username: user.username, role: user.role || 'Admin' })
    setResetPasswordForm({ userId: null, password: '' })
    setShowResetPassword(false)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm({ username: '', role: 'Admin' })
  }

  const saveEdit = async () => {
    if (!editingId || !editForm.username.trim()) return
    try {
      setSaving(true)
      const updated = await updateAdminUser(editingId, {
        username: editForm.username.trim(),
        role: editForm.role
      })
      setUsers((prev) => prev.map((u) => (u.id === editingId ? updated : u)))
      cancelEdit()
      showToast('تم تحديث المستخدم')
    } catch (e) {
      console.error(e)
      showToast('تعذر حفظ التعديل، تحقق من عدم تكرار اسم المستخدم.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()
    if (!canCreateUser) return

    try {
      setCreating(true)
      const created = await createAdminUser({ username: trimmedNewUsername, password: trimmedNewPassword, role: newUser.role })
      setUsers((prev) => [created, ...prev])
      setNewUser({ username: '', password: '', role: 'Admin' })
      setShowNewPassword(false)
      showToast('تم إنشاء المستخدم')
    } catch (e) {
      console.error(e)
      showToast('تعذر إنشاء المستخدم. تأكد أن الاسم غير مستخدم مسبقاً وكلمة المرور قوية.', 'error')
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteUser = async (user) => {
    if (deletingId) return
    if (!confirm(`هل تريد حذف المستخدم ${user.username}؟`)) return

    try {
      setDeletingId(user.id)
      await deleteAdminUser(user.id)
      setUsers((prev) => prev.filter((u) => u.id !== user.id))
      showToast('تم حذف المستخدم')
    } catch (e) {
      console.error(e)
      showToast('تعذر حذف المستخدم (قد يكون آخر أدمن)', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  const handleResetPassword = async (userId) => {
    if (!resetPasswordForm.password.trim() || resetPasswordForm.password.trim().length < 8) {
      showToast('كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل', 'error')
      return
    }
    try {
      setResettingId(userId)
      await resetAdminUserPassword(userId, { password: resetPasswordForm.password.trim() })
      setResetPasswordForm({ userId: null, password: '' })
      setShowResetPassword(false)
      showToast('تم تحديث كلمة المرور')
    } catch (e) {
      console.error(e)
      showToast('تعذر تحديث كلمة المرور', 'error')
    } finally {
      setResettingId(null)
    }
  }

  return (
    <main className="admin-orders-page admin-users-page" aria-busy={saving || creating || Boolean(deletingId) || Boolean(resettingId)}>
      {toast && (
        <div className={`toast toast-${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'} aria-live={toast.type === 'error' ? 'assertive' : 'polite'} aria-atomic="true">
          {toast.message}
        </div>
      )}

      <div className="admin-header">
        <div>
          <h1>المستخدمون</h1>
          <p>قائمة مستخدمي النظام وصلاحياتهم</p>
        </div>
        <div className="header-actions">
          <Link href="/admin/dashboard"><Button variant="secondary" className="admin-back-btn">العودة للوحة التحكم</Button></Link>
        </div>
      </div>

      <div className="orders-table-container admin-space-bottom-16">
        <h3 className="admin-section-title">إضافة مستخدم جديد</h3>
        <form className="admin-users-create-form" onSubmit={handleCreateUser} aria-busy={creating}>
          <input
            className="admin-select"
            placeholder="اسم المستخدم"
            value={newUser.username}
            onChange={(e) => setNewUser((prev) => ({ ...prev, username: e.target.value }))}
            minLength={3}
            autoComplete="username"
            required
          />
          <div className="admin-users-password-wrap">
            <input
              className="admin-select"
              type={showNewPassword ? 'text' : 'password'}
              placeholder="كلمة المرور"
              value={newUser.password}
              onChange={(e) => setNewUser((prev) => ({ ...prev, password: e.target.value }))}
              minLength={8}
              autoComplete="new-password"
              required
            />
            <button type="button" className="btn-action btn-view" onClick={() => setShowNewPassword((prev) => !prev)}>
              {showNewPassword ? 'إخفاء' : 'إظهار'}
            </button>
          </div>
          <select
            className="admin-select"
            value={newUser.role}
            onChange={(e) => setNewUser((prev) => ({ ...prev, role: e.target.value }))}
          >
            {ROLE_OPTIONS.map((role) => (
              <option key={role.value} value={role.value}>{role.label}</option>
            ))}
          </select>
          <Button variant="primary" type="submit" disabled={!canCreateUser || creating}>{creating ? 'جاري الإضافة...' : 'إضافة'}</Button>
        </form>
        <small className="admin-users-help-text">اسم المستخدم 3 أحرف على الأقل، وكلمة المرور 8 أحرف على الأقل، مع تحديد صلاحية المستخدم.</small>
      </div>

      <div className="orders-table-container admin-space-bottom-16">
        <h3 className="admin-section-title">مصفوفة الصلاحيات</h3>
        <small className="admin-users-help-text">توضيح سريع لما يستطيع كل دور الوصول إليه أو تنفيذه داخل لوحة الإدارة.</small>
        <div className="admin-space-bottom-12" />
        <table className="orders-table admin-role-matrix-table">
          <thead>
            <tr>
              <th>الدور</th>
              <th>لوحة التحكم</th>
              <th>إدارة المستخدمين</th>
              <th>إدارة المنتجات</th>
              <th>حذف منتج</th>
              <th>عرض الطلبات</th>
              <th>إدارة الطلبات</th>
              <th>تصدير الطلبات</th>
              <th>إعدادات المتجر</th>
            </tr>
          </thead>
          <tbody>
            {ROLE_CAPABILITIES.map((item) => (
              <tr key={item.role}>
                <td>{ROLE_OPTIONS.find((role) => role.value === item.role)?.label || item.role}</td>
                <td>{capabilityMark(item.dashboard)}</td>
                <td>{capabilityMark(item.users)}</td>
                <td>{capabilityMark(item.productsManage)}</td>
                <td>{capabilityMark(item.productsDelete)}</td>
                <td>{capabilityMark(item.ordersView)}</td>
                <td>{capabilityMark(item.ordersManage)}</td>
                <td>{capabilityMark(item.ordersExport)}</td>
                <td>{capabilityMark(item.settings)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mobile-orders-cards admin-role-matrix-mobile">
          {ROLE_CAPABILITIES.map((item) => (
            <article key={`cap-${item.role}`} className="mobile-order-card">
              <header className="mobile-order-head">
                <strong>{ROLE_OPTIONS.find((role) => role.value === item.role)?.label || item.role}</strong>
                <span>{item.role}</span>
              </header>
              <div className="mobile-order-row"><span>لوحة التحكم</span><strong>{capabilityMark(item.dashboard)}</strong></div>
              <div className="mobile-order-row"><span>إدارة المستخدمين</span><strong>{capabilityMark(item.users)}</strong></div>
              <div className="mobile-order-row"><span>إدارة المنتجات</span><strong>{capabilityMark(item.productsManage)}</strong></div>
              <div className="mobile-order-row"><span>حذف منتج</span><strong>{capabilityMark(item.productsDelete)}</strong></div>
              <div className="mobile-order-row"><span>عرض الطلبات</span><strong>{capabilityMark(item.ordersView)}</strong></div>
              <div className="mobile-order-row"><span>إدارة الطلبات</span><strong>{capabilityMark(item.ordersManage)}</strong></div>
              <div className="mobile-order-row"><span>تصدير الطلبات</span><strong>{capabilityMark(item.ordersExport)}</strong></div>
              <div className="mobile-order-row"><span>إعدادات المتجر</span><strong>{capabilityMark(item.settings)}</strong></div>
            </article>
          ))}
        </div>
      </div>

      <div className="orders-controls admin-space-bottom-12">
        <label htmlFor="users-search">بحث:</label>
        <input
          id="users-search"
          className="admin-select"
          placeholder="ابحث بالاسم أو المعرف أو الدور"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <span className="admin-users-count">{formatInteger(filteredUsers.length)} / {formatInteger(users.length)}</span>
      </div>

      {loadError && (
        <div className="admin-auth-required admin-space-bottom-16" role="alert">
          <h2>تعذر تحميل البيانات</h2>
          <p>{loadError}</p>
          <Button variant="secondary" onClick={loadUsers}>إعادة المحاولة</Button>
        </div>
      )}

      <div className="orders-table-container">
        <table className="orders-table">
          <thead>
            <tr>
              <th>المعرف</th>
              <th>اسم المستخدم</th>
              <th>الدور</th>
              <th>الأمان</th>
              <th>حذف</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr><td colSpan={5}>{users.length === 0 ? 'لا يوجد مستخدمون.' : 'لا توجد نتائج مطابقة للبحث.'}</td></tr>
            ) : filteredUsers.map((u) => (
              <tr key={u.id}>
                <td>#{toEnglishDigits(u.id)}</td>
                <td>
                  {editingId === u.id ? (
                    <input
                      className="admin-select"
                      value={editForm.username}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, username: e.target.value }))}
                      minLength={3}
                    />
                  ) : u.username}
                </td>
                <td>
                  {editingId === u.id ? (
                    <div className="action-buttons">
                      <select
                        className="admin-select"
                        value={editForm.role}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, role: e.target.value }))}
                      >
                        {ROLE_OPTIONS.map((role) => (
                          <option key={role.value} value={role.value}>{role.label}</option>
                        ))}
                      </select>
                      <button className="btn-action btn-edit" onClick={saveEdit} disabled={saving}>
                        {saving ? 'حفظ...' : 'حفظ'}
                      </button>
                      <button className="btn-action btn-delete" onClick={cancelEdit} disabled={saving}>إلغاء</button>
                    </div>
                  ) : (
                    <div className="action-buttons">
                      <span>{ROLE_OPTIONS.find((role) => role.value === u.role)?.label || u.role}</span>
                      <button className="btn-action btn-view" onClick={() => startEdit(u)}>تعديل الاسم</button>
                    </div>
                  )}
                </td>
                <td>
                  {resetPasswordForm.userId === u.id ? (
                    <div className="action-buttons">
                      <input
                        className="admin-select"
                        type={showResetPassword ? 'text' : 'password'}
                        placeholder="كلمة مرور جديدة"
                        value={resetPasswordForm.password}
                        onChange={(e) => setResetPasswordForm({ userId: u.id, password: e.target.value })}
                        minLength={8}
                      />
                      <button className="btn-action btn-view" onClick={() => setShowResetPassword((prev) => !prev)}>{showResetPassword ? 'إخفاء' : 'إظهار'}</button>
                      <button className="btn-action btn-edit" onClick={() => handleResetPassword(u.id)} disabled={resettingId === u.id}>{resettingId === u.id ? '...' : 'تأكيد'}</button>
                      <button className="btn-action btn-delete" onClick={() => { setResetPasswordForm({ userId: null, password: '' }); setShowResetPassword(false) }} disabled={resettingId === u.id}>إلغاء</button>
                    </div>
                  ) : (
                    <button className="btn-action btn-view" onClick={() => setResetPasswordForm({ userId: u.id, password: '' })}>
                      تغيير كلمة المرور
                    </button>
                  )}
                </td>
                <td>
                  <button className="btn-action btn-delete" onClick={() => handleDeleteUser(u)} disabled={deletingId === u.id}>
                    {deletingId === u.id ? '...' : 'حذف'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mobile-orders-cards admin-users-mobile-cards">
          {filteredUsers.map((u) => (
            <article key={`m-${u.id}`} className="mobile-order-card">
              <header className="mobile-order-head">
                <strong>#{u.id}</strong>
                <span>{u.role}</span>
              </header>
              <div className="mobile-order-row">
                <span>اسم المستخدم</span>
                <strong>{u.username}</strong>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  )
}
