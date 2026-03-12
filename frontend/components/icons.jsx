import React from 'react'

function mergeClassName(props) {
  const { className } = props || {}
  return ['svg-icon', className].filter(Boolean).join(' ')
}

export function DashboardIcon(props) {
  return (
    <svg className={mergeClassName(props)} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <rect x="13" y="3" width="8" height="8" rx="1" />
      <rect x="3" y="13" width="8" height="8" rx="1" />
      <rect x="13" y="13" width="8" height="8" rx="1" />
    </svg>
  )
}

export function ProductsIcon(props) {
  return (
    <svg className={mergeClassName(props)} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M7 9.5l5 3 5-3" />
    </svg>
  )
}

export function OrdersIcon(props) {
  return (
    <svg className={mergeClassName(props)} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 7h18" />
      <path d="M3 12h18" />
      <path d="M3 17h18" />
    </svg>
  )
}

export function UsersIcon(props) {
  return (
    <svg className={mergeClassName(props)} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3z" />
      <path d="M6 11c1.66 0 3-1.34 3-3S7.66 5 6 5 3 6.34 3 8s1.34 3 3 3z" />
      <path d="M2 20c0-2.21 3.58-4 8-4s8 1.79 8 4" />
    </svg>
  )
}

export function SettingsIcon(props) {
  return (
    <svg className={mergeClassName(props)} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06A2 2 0 0 1 2.1 17.9l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09c.66 0 1.23-.43 1.51-1a1.65 1.65 0 0 0-.33-1.82L4.3 4.7A2 2 0 0 1 7.13 1.87l.06.06c.5.5 1.14.72 1.82.33.44-.25 1-.4 1.51-.4H12c.51 0 1.07.15 1.51.4.68.39 1.32.17 1.82-.33l.06-.06A2 2 0 0 1 20.13 4.3l-.06.06c-.5.5-.72 1.14-.33 1.82.25.44.4 1 .4 1.51V9c0 .51-.15 1.07-.4 1.51-.39.68-.17 1.32.33 1.82l.06.06A2 2 0 0 1 19.4 15z" />
    </svg>
  )
}

export default null
