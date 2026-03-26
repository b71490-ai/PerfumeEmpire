'use client'

import { useEffect, useRef, useState } from 'react'

export default function MapPicker({ initial, onSelect, onClose }) {
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const containerRef = useRef(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return

    // inject leaflet CSS from CDN if not present
    const cssHref = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    if (!document.querySelector(`link[href="${cssHref}"]`)) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = cssHref
      document.head.appendChild(link)
    }

    let mounted = true
    import('leaflet').then((L) => {
      if (!mounted) return
      mapRef.current = L.map(containerRef.current, { center: initial || [24.7136, 46.6753], zoom: 12 })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(mapRef.current)

      if (initial && initial[0] && initial[1]) {
        markerRef.current = L.marker(initial, { draggable: true }).addTo(mapRef.current)
        markerRef.current.on('dragend', () => {})
      }

      const onMapClick = (e) => {
        const latlng = e.latlng
        if (markerRef.current) {
          markerRef.current.setLatLng(latlng)
        } else {
          markerRef.current = L.marker(latlng, { draggable: true }).addTo(mapRef.current)
          markerRef.current.on('dragend', () => {})
        }
      }

      // ensure map tiles render correctly inside modal
      setTimeout(() => { try { mapRef.current.invalidateSize(); } catch (e) {} }, 200)

      mapRef.current.on('click', onMapClick)
      setReady(true)

      return () => {
        try { mapRef.current.off('click', onMapClick); mapRef.current.remove() } catch (e) {}
      }
    }).catch(() => {})

    return () => { mounted = false }
  }, [initial])

  const handleConfirm = () => {
    if (!markerRef.current) return
    const { lat, lng } = markerRef.current.getLatLng()
    onSelect && onSelect({ lat, lng })
  }

  return (
    <div className="mappicker-modal" style={{position:'fixed',inset:0,display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}}>
      <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.5)'}} onClick={() => onClose && onClose()} />
      <div style={{width:'90%',maxWidth:900,background:'#fff',borderRadius:8,overflow:'hidden',boxShadow:'0 10px 30px rgba(0,0,0,0.3)'}}>
        <div style={{height:480}} ref={containerRef} />
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',padding:12}}>
          <button className="btn btn-secondary" onClick={() => onClose && onClose()}>إلغاء</button>
          <button className="btn btn-primary" onClick={handleConfirm} disabled={!ready}>تأكيد الموقع</button>
        </div>
      </div>
    </div>
  )
}
