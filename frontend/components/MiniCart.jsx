"use client"

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useCart } from '@/context/CartContext'

export default function MiniCart() {
  const { cart, getCartCount, getCartTotal, removeFromCart, removeWithUndo, lastRemoved, undoLastRemove, isSyncing, savedRecently } = useCart()
  const [open, setOpen] = useState(false)

  const toggle = () => setOpen(!open)

  return (
    <div className="mini-cart" style={{ position: 'relative' }}>
      <button type="button" onClick={(e) => { e.stopPropagation(); toggle(); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }} className="nav-item cart-link" aria-expanded={open} aria-label="Mini cart">
        <span>🛒</span>
        <span>السلة</span>
        {isSyncing && (
          <span className="cart-sync-spinner" aria-hidden="true" title="جاري الحفظ" style={{display:'inline-block', marginLeft:8, width:14, height:14}}>
            <svg viewBox="0 0 50 50" width="14" height="14" aria-hidden="true" focusable="false">
              <path fill="currentColor" d="M25 5a20 20 0 1 0 20 20" opacity="0.25"></path>
              <path fill="currentColor" d="M25 5a20 20 0 0 1 0 6"></path>
              <animateTransform attributeType="xml" attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="1s" repeatCount="indefinite" />
            </svg>
          </span>
        )}
        {savedRecently && !isSyncing && (
          <span className="cart-saved" aria-hidden="true" title="محفوظ" style={{color:'#16a34a', marginLeft:8}}>✓ محفوظ</span>
        )}
        {getCartCount() > 0 && <span className="cart-badge">{getCartCount()}</span>}
      </button>

      {open && (
        <div className="dropdown-menu" style={{ right: 0, left: 'auto', width: 320 }}>
          <div style={{ padding: 12 }}>
            <h4 className="menu-item" style={{ fontWeight:800 }}>ملخّص السلة</h4>
            {cart.length === 0 ? (
              <div style={{ padding: 12 }} className="menu-item">السلة فارغة</div>
            ) : (
              <div>
                {cart.slice(0,3).map((item, idx) => (
                  <div key={item.id ?? `${item.perfumeId ?? 'item'}-${idx}`} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0' }}>
                    <div style={{ width: 56, height:56, borderRadius:8, overflow:'hidden' }}>
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.imageUrl} alt={item.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      ) : null}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:800 }}>{item.name}</div>
                      <div style={{ fontSize:12, color:'#6b7280' }}>{item.quantity} × {Number(item.price || 0).toFixed(2)}</div>
                    </div>
                    <button
                      type="button"
                      className="menu-item delete"
                      aria-label={`إزالة ${item.name}`}
                      onClick={() => {
                        if (typeof removeWithUndo === 'function') {
                          removeWithUndo(item.id)
                        } else {
                          removeFromCart(item.id)
                        }
                      }}
                    >إزالة</button>
                  </div>
                ))}

                {cart.length > 3 && <div style={{ padding: '8px 0', color:'#6b7280' }}>و{cart.length - 3} منتجات أخرى</div>}

                <div style={{ display:'flex', gap:8, marginTop:12 }}>
                  <Link href="/cart" className="menu-item" style={{ flex:1, textAlign:'center' }}>عرض السلة</Link>
                  <Link href="/checkout" className="menu-item" style={{ flex:1, textAlign:'center' }}>الدفع</Link>
                </div>
                <div style={{ marginTop:12, textAlign:'right', fontWeight:800 }}>المجموع: {getCartTotal().toFixed(2)}</div>
              </div>
            )}
            {lastRemoved && lastRemoved.item && (
              <div style={{ paddingTop: 8, borderTop: '1px solid #eee', marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 13 }}>تم حذف {lastRemoved.item.name}</div>
                  <div>
                    <button type="button" className="menu-item" onClick={() => { if (typeof undoLastRemove === 'function') undoLastRemove() }}>تراجع</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
