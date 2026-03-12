"use client"

export default function Toast({ toast, onClose }) {
  if (!toast?.message) return null

  return (
    <div className={`toast ${toast.type || ''}`} role="status" aria-live="polite">
      <span>{toast.message}</span>
      <button type="button" className="toast-close" aria-label="إغلاق الإشعار" onClick={onClose}>×</button>
    </div>
  )
}
