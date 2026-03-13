'use client'

import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export default function MapPicker({ initial, onSelect, onClose }) {
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const containerRef = useRef(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!containerRef.current) return
    // create map
    mapRef.current = L.map(containerRef.current, { center: initial || [24.7136, 46.6753], zoom: 12 })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapRef.current)

    if (initial && initial[0] && initial[1]) {
      markerRef.current = L.marker(initial).addTo(mapRef.current)
    }

    const onMapClick = (e) => {
      const latlng = e.latlng
      if (markerRef.current) {
        markerRef.current.setLatLng(latlng)
      } else {
        markerRef.current = L.marker(latlng).addTo(mapRef.current)
      }
    }

    mapRef.current.on('click', onMapClick)
    setReady(true)
    return () => {
      try { mapRef.current.off('click', onMapClick); mapRef.current.remove() } catch (e) {}
    }
  }, [])

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
