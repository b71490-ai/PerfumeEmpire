"use client"

import { useState } from 'react'

export default function TaxFilter({ initialStart, initialEnd, initialStatuses = ['all'], onApply }) {
  const toISO = (d) => d ? new Date(d).toISOString().slice(0,10) : ''
  const [start, setStart] = useState(initialStart ? toISO(initialStart) : '')
  const [end, setEnd] = useState(initialEnd ? toISO(initialEnd) : '')
  const [preset, setPreset] = useState('range')
  const [statuses, setStatuses] = useState(new Set(initialStatuses))
  const [busy, setBusy] = useState(false)

  const toggleStatus = (val) => {
    const s = new Set(statuses)
    if (s.has(val)) s.delete(val)
    else s.add(val)
    setStatuses(s)
  }

  const apply = async () => {
    setBusy(true)
    try {
      const payload = {
        start: start ? new Date(start).toISOString() : undefined,
        end: end ? new Date(end).toISOString() : undefined,
        statuses: Array.from(statuses).filter(x => x !== 'all')
      }
      await onApply(payload)
    } finally { setBusy(false) }
  }

  const setPresetRange = (p) => {
    setPreset(p)
    const now = new Date()
    if (p === 'today') {
      const s = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const e = new Date(s); e.setHours(23,59,59,999)
      setStart(s.toISOString().slice(0,10))
      setEnd(e.toISOString().slice(0,10))
    } else if (p === 'month') {
      const s = new Date(now.getFullYear(), now.getMonth(), 1)
      setStart(s.toISOString().slice(0,10))
      setEnd(now.toISOString().slice(0,10))
    } else if (p === 'last30') {
      const s = new Date(now); s.setDate(now.getDate() - 29)
      setStart(s.toISOString().slice(0,10))
      setEnd(now.toISOString().slice(0,10))
    } else {
      // custom/range
    }
  }

  return (
    <div className="tax-filter">
      <div className="tax-filter-presets">
        <div className="tax-presets-row">
          <button type="button" className="btn-sm" onClick={() => setPresetRange('today')}>اليوم</button>
          <button type="button" className="btn-sm" onClick={() => setPresetRange('month')}>هذا الشهر</button>
          <button type="button" className="btn-sm" onClick={() => setPresetRange('last30')}>آخر 30 يوماً</button>
          <button type="button" className="btn-sm" onClick={() => { setStart(''); setEnd(''); setPreset('range') }}>مخصص</button>
        </div>

        <div className="tax-range-row">
          <label className="tax-label">من</label>
          <input className="tax-input" type="date" value={start} onChange={(e)=>setStart(e.target.value)} />
          <label className="tax-label">إلى</label>
          <input className="tax-input" type="date" value={end} onChange={(e)=>setEnd(e.target.value)} />
        </div>
      </div>

      <div className="tax-filter-body">
        <div className="tax-filter-statuses">
          <label className="tax-status-title">حالة الطلب</label>
          <div className="tax-status-list">
            {['all','Pending','Processing','Shipped','Completed','Cancelled'].map(s => (
              <label key={s} className="tax-status-item">
                <input type="checkbox" checked={statuses.has(s)} onChange={()=>toggleStatus(s)} />
                <span className="tax-status-label">{s === 'all' ? 'الكل' : s}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="tax-filter-actions">
          <button type="button" className="btn-sm" onClick={() => { setStart(''); setEnd(''); setStatuses(new Set(['all'])) }}>مسح</button>
          <button type="button" className="btn-primary" onClick={apply} disabled={busy}>{busy ? 'جارٍ...' : 'تطبيق'}</button>
        </div>
      </div>
    </div>
  )
}
