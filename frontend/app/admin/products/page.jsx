"use client"

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAdmin } from '@/context/AdminContext'
import Link from 'next/link'
import Image from 'next/image'
import Button from '@/components/Button'
import QuickView from '@/components/QuickView'
import { fetchPerfumes as apiFetchPerfumes, deletePerfume, createPerfume, updatePerfume, fetchStoreSettings } from '@/lib/api'
import { formatDecimal, getUserLocale, toEnglishDigits } from '@/lib/intl'

export default function AdminProducts() {
  const { isAdmin, loading, canManageProducts, canDeleteProducts } = useAdmin()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [perfumes, setPerfumes] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', brand: '', price: '', imageUrl: '', discount: 0, category: 'men', stock: 0 })
  const [editing, setEditing] = useState(null)
  const [toast, setToast] = useState(null)
  const [currencySymbol, setCurrencySymbol] = useState('ر.س')
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [viewMode, setViewMode] = useState('table')
  const locale = getUserLocale('ar-SA')
  const formatAmount = (value) => formatDecimal(value, { locale, minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const formatInteger = (value) => formatDecimal(value, { locale, minimumFractionDigits: 0, maximumFractionDigits: 0 })
  const [quickViewPerfume, setQuickViewPerfume] = useState(null)

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
    if (!canManageProducts) {
      router.push('/admin/dashboard')
    }
  }, [isAdmin, loading, canManageProducts, router])

  useEffect(() => { loadPerfumes() }, [])

  // Derived filtered list based on search and filters
  const filteredPerfumes = perfumes.filter((p) => {
    if (!p) return false
    const q = (searchQuery || '').toString().trim().toLowerCase()
    if (q) {
      const matchesName = (p.name || '').toString().toLowerCase().includes(q)
      const matchesBrand = (p.brand || '').toString().toLowerCase().includes(q)
      if (!matchesName && !matchesBrand) return false
    }
    if (categoryFilter && categoryFilter !== 'all' && String(p.category) !== String(categoryFilter)) return false
    const min = priceMin === '' ? null : parseFloat(priceMin)
    const max = priceMax === '' ? null : parseFloat(priceMax)
    const price = parseFloat(p.price || 0)
    if (min !== null && !isNaN(min) && price < min) return false
    if (max !== null && !isNaN(max) && price > max) return false
    if (lowStockOnly) {
      const threshold = 5
      if ((p.stock ?? 0) >= threshold) return false
    }
    return true
  })

  useEffect(() => {
    const editId = searchParams.get('editId')
    if (!editId || perfumes.length === 0) return

    const target = perfumes.find((p) => String(p.id) === String(editId))
    if (target) startEdit(target)
  }, [searchParams, perfumes])

  const loadPerfumes = async () => {
    try {
      const [data, settings] = await Promise.all([apiFetchPerfumes(), fetchStoreSettings()])
      setPerfumes(data)
      if (settings) {
        setCurrencySymbol(settings.currencySymbol || 'ر.س')
      }
    } catch (error) {
      console.error('Error fetching perfumes:', error)
    } finally {
      setLoadingProducts(false)
    }
  }

  const handleDelete = async (id, name) => {
    // open confirmation modal instead of native confirm
    if (!canDeleteProducts) {
      showToast('لا تملك صلاحية حذف المنتجات', 'error')
      return
    }
    setDeleteTarget({ id, name })
  }

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [undoData, setUndoData] = useState(null)

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    // capture the item so we can offer undo
    const deletedItem = perfumes.find(p => String(p.id) === String(deleteTarget.id))
    try {
      await deletePerfume(deleteTarget.id)
      showToast('تم حذف المنتج بنجاح')
      setDeleteTarget(null)
      loadPerfumes()

      // show undo snackbar for 8s
      const timeoutId = setTimeout(() => setUndoData(null), 8000)
      setUndoData({ item: deletedItem, timeoutId })
    } catch (error) {
      console.error('Error deleting perfume:', error)
      showToast('حدث خطأ أثناء حذف المنتج', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const handleUndo = async () => {
    if (!undoData || !undoData.item) return
    try {
      const payload = { ...undoData.item }
      // remove id so backend will create a new record
      delete payload.id
      await createPerfume(payload)
      if (undoData.timeoutId) clearTimeout(undoData.timeoutId)
      setUndoData(null)
      showToast('تم استعادة المنتج')
      loadPerfumes()
    } catch (err) {
      console.error('Undo failed', err)
      showToast('فشل استعادة المنتج', 'error')
    }
  }

  const handleAddSubmit = async (e) => {
    e.preventDefault()
    try {
      const payload = { ...form, price: parseFloat(form.price), discount: parseInt(form.discount || 0, 10), stock: parseInt(form.stock || 0, 10) }
      await createPerfume(payload)
      setShowAdd(false)
      setForm({ name: '', brand: '', price: '', imageUrl: '', discount: 0, category: 'men', stock: 0 })
      loadPerfumes()
      showToast('تم إضافة المنتج')
    } catch (err) {
      console.error(err)
      showToast('فشل إضافة المنتج', 'error')
    }
  }

  const handleQuickAddToCart = (perfume) => {
    // placeholder behaviour: show toast and return true to allow quickview to close
    showToast('أضيف المنتج إلى السلة')
    return true
  }

  const startEdit = (item) => {
    setEditing({ ...item })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    try {
      const payload = { name: editing.name, brand: editing.brand, price: parseFloat(editing.price), imageUrl: editing.imageUrl, discount: parseInt(editing.discount || 0, 10), category: editing.category, stock: parseInt(editing.stock || 0, 10) }
      await updatePerfume(editing.id, payload)
      setEditing(null)
      loadPerfumes()
      showToast('تم تحديث المنتج')
    } catch (err) {
      console.error(err)
      showToast('فشل تحديث المنتج', 'error')
    }
  }

  if (loading || !isAdmin || !canManageProducts) {
    return <div className="loading">جاري التحميل...</div>
  }

  return (
    <main className="admin-products-page container">
      {toast && (
        <div className={`toast toast-${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'} aria-live={toast.type === 'error' ? 'assertive' : 'polite'} aria-atomic="true">
          {toast.message}
        </div>
      )}

      {undoData && undoData.item && (
        <div className="undo-toast" role="status">
          <div className="undo-message">تم حذف &quot;{undoData.item.name}&quot;</div>
          <button className="btn-action btn-undo" onClick={handleUndo}>تراجع</button>
        </div>
      )}

      <div className="admin-header">
        <div>
          <h1>إدارة المنتجات</h1>
          <p>عرض، إضافة، وتحديث جميع المنتجات</p>
        </div>
        <div className="header-actions">
          <Button variant="primary" onClick={() => setShowAdd(true)}>إضافة منتج جديد</Button>
          <Link href="/admin/dashboard">
            <Button variant="secondary" className="admin-back-btn">العودة للوحة التحكم</Button>
          </Link>
        </div>
      </div>

      {/* Products stats bar (above table) */}
      {perfumes && perfumes.length > 0 && (
        (() => {
          const totalProducts = perfumes.length
          const lowStockThreshold = 5
          const lowStockCount = perfumes.filter(p => (p.stock ?? 0) < lowStockThreshold).length
          const totalInventoryValue = perfumes.reduce((s, p) => s + ((p.price || 0) * (p.stock || 0)), 0)
          const avgPrice = totalProducts ? perfumes.reduce((s, p) => s + (p.price || 0), 0) / totalProducts : 0
          return (
            <div className="orders-stats-grid products-stats-grid" aria-hidden={false}>
              <div className="stat-card">
                <div className="stat-title">عدد المنتجات</div>
                <div className="stat-value">{formatInteger(totalProducts)}</div>
              </div>

              <div className="stat-card">
                <div className="stat-title">منخفض المخزون (&lt; {lowStockThreshold})</div>
                <div className="stat-value">{formatInteger(lowStockCount)}</div>
              </div>

              <div className="stat-card">
                <div className="stat-title">إجمالي قيمة المخزون</div>
                <div className="stat-value">
                  <span className="currency">
                    <span className="currency-amount">{formatAmount(totalInventoryValue)}</span>
                    <span className="currency-symbol">{currencySymbol}</span>
                  </span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-title">متوسط السعر</div>
                <div className="stat-value">
                  <span className="currency">
                    <span className="currency-amount">{formatAmount(avgPrice)}</span>
                    <span className="currency-symbol">{currencySymbol}</span>
                  </span>
                </div>
              </div>
            </div>
          )
        })()
      )}

      {showAdd && (
        <div className="add-modal">
          <form onSubmit={handleAddSubmit} className="add-form">
            <h3>إضافة منتج جديد</h3>
            <input placeholder="الاسم" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            <input placeholder="العلامة التجارية" value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} required />
            <input placeholder="رابط الصورة" value={form.imageUrl} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))} />
            <input type="number" min="0" step="0.01" inputMode="decimal" placeholder="السعر" value={form.price} onChange={e => setForm(f => ({ ...f, price: toEnglishDigits(e.target.value) }))} required />
            <input type="number" min="0" max="99" step="1" inputMode="numeric" placeholder="الخصم (%)" value={form.discount} onChange={e => setForm(f => ({ ...f, discount: toEnglishDigits(e.target.value) }))} />
            <input type="number" min="0" step="1" inputMode="numeric" placeholder="المخزون" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: toEnglishDigits(e.target.value) }))} />
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              <option value="men">عطور رجالي</option>
              <option value="women">عطور نسائي</option>
              <option value="incense">بخور وعود</option>
              <option value="cosmetics">أدوات تجميل</option>
            </select>
            <div className="admin-form-actions-row">
              <Button variant="primary" type="submit">حفظ</Button>
              <Button variant="secondary" type="button" onClick={() => setShowAdd(false)}>إلغاء</Button>
            </div>
          </form>
        </div>
      )}

      {loadingProducts ? (
        <div className="loading">جاري تحميل المنتجات...</div>
      ) : perfumes.length === 0 ? (
        <div className="empty-state">
          <h2>لا توجد منتجات</h2>
          <p>ابدأ بإضافة منتج جديد</p>
        </div>
      ) : (
        <>
          <div className="products-table-filters-row">
            <div className="products-filters-left">
              <input type="search" placeholder="ابحث باسم المنتج أو العلامة" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="filter-control search-input" />
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="filter-control">
                <option value="all">كل الفئات</option>
                <option value="men">عطور رجالي</option>
                <option value="women">عطور نسائي</option>
                <option value="incense">بخور وعود</option>
                <option value="cosmetics">أدوات تجميل</option>
              </select>
              <input type="number" placeholder="سعر أدنى" className="filter-control price-input" value={priceMin} onChange={e => setPriceMin(e.target.value)} />
              <input type="number" placeholder="سعر أقصى" className="filter-control price-input" value={priceMax} onChange={e => setPriceMax(e.target.value)} />
              <button type="button" className={`btn-action btn-outline ${lowStockOnly ? 'active' : ''}`} onClick={() => setLowStockOnly(s => !s)}>المنتجات منخفضة المخزون</button>
              <button type="button" className="btn-action btn-secondary" onClick={() => { setSearchQuery(''); setCategoryFilter('all'); setPriceMin(''); setPriceMax(''); setLowStockOnly(false) }}>مسح الفلاتر</button>
            </div>
            <div className="products-filters-right">
              <div className="view-toggle" role="tablist" aria-label="تبديل العرض">
                <button type="button" role="tab" aria-selected={viewMode === 'table'} className={`btn-action btn-outline ${viewMode === 'table' ? 'active' : ''}`} onClick={() => setViewMode('table')}>جدول</button>
                <button type="button" role="tab" aria-selected={viewMode === 'grid'} className={`btn-action btn-outline ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}>بطاقات</button>
              </div>
            </div>
          </div>

          {viewMode === 'table' ? (
            <div className="products-table-container desktop-products-table">
              <table className="products-table">
              <thead>
                <tr>
                  <th>الصورة</th>
                  <th>اسم المنتج</th>
                  <th>الفئة</th>
                  <th>السعر</th>
                  <th>الخصم</th>
                  <th>المخزون</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredPerfumes.map((perfume) => (
                  <tr key={perfume.id}>
                    <td>
                      <Image src={perfume.imageUrl} alt={perfume.name} className="product-thumbnail" width={56} height={56} unoptimized />
                    </td>
                    <td><strong>{perfume.name}</strong></td>
                    <td><span className="category-badge">{perfume.category}</span></td>
                    <td className="currency-cell">
                      <span className="currency">
                        <span className="currency-amount">{formatAmount(perfume.price || 0)}</span>
                        <span className="currency-symbol">{currencySymbol}</span>
                      </span>
                    </td>
                    <td>{perfume.discount > 0 ? <span className="discount-badge">{formatInteger(perfume.discount)}%</span> : <span className="no-discount">-</span>}</td>
                    <td>
                      {(() => {
                        const s = Number(perfume.stock ?? 0)
                        let cls = 'stock-badge'
                        let label = formatInteger(s)
                        if (s >= 20) { cls += ' stock-healthy'; label = '20+' }
                        else if (s >= 10) { cls += ' stock-warning' }
                        else if (s >= 5) { cls += ' stock-low' }
                        else { cls += ' stock-danger' }
                        return (
                          <span className={cls} title={`المخزون: ${s}`}>
                            {s < 5 ? '⚠ ' : ''}{label}
                          </span>
                        )
                      })()}
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button onClick={() => startEdit(perfume)} className="btn-action btn-edit" title="تعديل">تعديل</button>
                        {canDeleteProducts && (
                          <button onClick={() => handleDelete(perfume.id, perfume.name)} className="btn-action btn-delete" title="حذف">حذف</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          ) : (
            <div className="admin-products-grid">
              {filteredPerfumes.map((perfume) => (
                <article key={`g-${perfume.id}`} className="admin-product-card">
                  <div className="perfume-image">
                    <Image src={perfume.imageUrl} alt={perfume.name} className="product-thumbnail" width={220} height={220} unoptimized />
                  </div>
                  <div className="perfume-content">
                    <h2 className="shop-product-title">{perfume.name}</h2>
                    <div className="shop-category-line">{perfume.brand || '-'}</div>
                    {(() => {
                      const originalPrice = Number(perfume.price || 0)
                      const hasDiscount = Number(perfume.discount || 0) > 0
                      const newPrice = hasDiscount ? (originalPrice * (1 - Number(perfume.discount) / 100)) : originalPrice
                      return (
                        <div className="price-main">
                          {hasDiscount && (
                            <div className="old-price">
                              <span className="currency-amount">{formatAmount(originalPrice)}</span>
                              <span className="currency-symbol lighter">{currencySymbol}</span>
                            </div>
                          )}

                          <div className="price-primary new-price">
                            <span className="currency-amount">{formatAmount(newPrice)}</span>
                            <span className="currency-symbol lighter">{currencySymbol}</span>
                          </div>

                          {hasDiscount && <span className="discount-badge">{formatInteger(perfume.discount)}%</span>}
                        </div>
                      )
                    })()}
                    <div className="stock-info">
                      {(() => {
                        const s = Number(perfume.stock ?? 0)
                        if (s <= 0) return <span className="stock-status stock-out">نفذ</span>
                        if (s < 5) return <span className="stock-status stock-low">منخفض</span>
                        return <span className="stock-status stock-available">متوفر</span>
                      })()}
                      <div className="stock-remaining">{formatInteger(perfume.stock ?? 0)} قطعة</div>
                    </div>

                    <div className="admin-product-actions" style={{marginTop:12}}>
                      <button onClick={() => setQuickViewPerfume(perfume)} className="btn-action btn-outline btn-quickview" title="عرض سريع">عرض سريع</button>
                      <button onClick={() => startEdit(perfume)} className="btn-action btn-edit" title="تعديل">تعديل</button>
                      {canDeleteProducts && (
                        <button onClick={() => handleDelete(perfume.id, perfume.name)} className="btn-action btn-delete" title="حذف">حذف</button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

            <div className="mobile-orders-cards admin-products-mobile-cards">
            {filteredPerfumes.map((perfume) => (
              <article key={`m-${perfume.id}`} className="mobile-order-card">
                <header className="mobile-order-head">
                  <strong>{perfume.name}</strong>
                  <span className="category-badge">{perfume.category}</span>
                </header>

                <div className="mobile-order-row">
                  <span>الصورة</span>
                  <Image src={perfume.imageUrl} alt={perfume.name} className="product-thumbnail admin-product-mobile-thumbnail" width={52} height={52} unoptimized />
                </div>
                <div className="mobile-order-row">
                  <span>العلامة</span>
                  <strong>{perfume.brand || '-'}</strong>
                </div>
                <div className="mobile-order-row">
                  <span>السعر</span>
                  <strong>
                    <span className="currency">
                      <span className="currency-amount">{formatAmount(perfume.price || 0)}</span>
                      <span className="currency-symbol">{currencySymbol}</span>
                    </span>
                  </strong>
                </div>
                <div className="mobile-order-row">
                  <span>الخصم</span>
                  <strong>{perfume.discount > 0 ? `${formatInteger(perfume.discount)}%` : '-'}</strong>
                </div>
                <div className="mobile-order-row">
                  <span>المخزون</span>
                  <strong>
                    {(() => {
                      const s = Number(perfume.stock ?? 0)
                      if (s >= 20) return <span className="stock-badge stock-healthy">20+</span>
                      if (s >= 10) return <span className="stock-badge stock-warning">{formatInteger(s)}</span>
                      if (s >= 5) return <span className="stock-badge stock-low">{formatInteger(s)}</span>
                      return <span className="stock-badge stock-danger">⚠ {formatInteger(s)}</span>
                    })()}
                  </strong>
                </div>

                <div className="action-buttons admin-product-mobile-actions">
                  <button onClick={() => startEdit(perfume)} className="btn-action btn-edit" title="تعديل">تعديل</button>
                  {canDeleteProducts && (
                    <button onClick={() => handleDelete(perfume.id, perfume.name)} className="btn-action btn-delete" title="حذف">حذف</button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
      {editing && (
        <div className="edit-modal">
          <form onSubmit={handleEditSubmit} className="add-form">
            <h3>تعديل المنتج</h3>
            <input placeholder="الاسم" value={editing.name} onChange={e => setEditing({...editing, name: e.target.value})} required />
            <input placeholder="العلامة التجارية" value={editing.brand} onChange={e => setEditing({...editing, brand: e.target.value})} required />
            <input placeholder="رابط الصورة" value={editing.imageUrl} onChange={e => setEditing({...editing, imageUrl: e.target.value})} />
            <input type="number" min="0" step="0.01" inputMode="decimal" placeholder="السعر" value={editing.price} onChange={e => setEditing({...editing, price: toEnglishDigits(e.target.value)})} required />
            <input type="number" min="0" max="99" step="1" inputMode="numeric" placeholder="الخصم (%)" value={editing.discount} onChange={e => setEditing({...editing, discount: toEnglishDigits(e.target.value)})} />
            <input type="number" min="0" step="1" inputMode="numeric" placeholder="المخزون" value={editing.stock ?? 0} onChange={e => setEditing({...editing, stock: toEnglishDigits(e.target.value)})} />
            <select value={editing.category} onChange={e => setEditing({...editing, category: e.target.value})}>
              <option value="men">عطور رجالي</option>
              <option value="women">عطور نسائي</option>
              <option value="incense">بخور وعود</option>
              <option value="cosmetics">أدوات تجميل</option>
            </select>
            <div className="admin-form-actions-row">
              <Button variant="primary" type="submit">حفظ التغييرات</Button>
              <Button variant="secondary" type="button" onClick={() => setEditing(null)}>إلغاء</Button>
            </div>
          </form>
        </div>
      )}
      {quickViewPerfume && (
        <QuickView perfume={quickViewPerfume} onClose={() => setQuickViewPerfume(null)} onAddToCart={handleQuickAddToCart} currencySymbol={currencySymbol} />
      )}
      {deleteTarget && (
        <div className="confirm-modal" role="dialog" aria-modal="true">
          <div className="confirm-panel">
            <header className="confirm-header">
              <div className="confirm-icon">⚠️</div>
              <div>
                <h3>تأكيد الحذف</h3>
                <p className="confirm-sub">هل أنت متأكد من حذف المنتج التالي؟ هذا الإجراء لا يمكن التراجع عنه.</p>
              </div>
            </header>

            <div className="confirm-body">
              <strong className="confirm-product-name">{deleteTarget.name}</strong>
            </div>

            <div className="confirm-actions">
              <button className="btn-action btn-outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>إلغاء</button>
              <button className="btn-action btn-delete" onClick={confirmDelete} disabled={deleting}>{deleting ? 'جارٍ الحذف...' : 'حذف نهائي'}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
