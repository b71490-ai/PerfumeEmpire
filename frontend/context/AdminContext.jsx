"use client"

import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import api, { setAuthToken } from '../utils/axiosInstance'

const AdminContext = createContext()

export function useAdmin() {
  return useContext(AdminContext)
}

export function AdminProvider({ children }) {
  const [isAdmin, setIsAdmin] = useState(false)
  const [role, setRole] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState(null) // in-memory access token
  const router = useRouter()
  const pathname = usePathname()
  const refreshing = useRef(false)

  const normalizeRole = (value) => {
    if (typeof value !== 'string') return ''
    const trimmed = value.trim()
    if (!trimmed) return ''

    if (trimmed.toLowerCase() === 'admin') return 'Admin'
    if (trimmed.toLowerCase() === 'manager') return 'Manager'
    if (trimmed.toLowerCase() === 'editor') return 'Editor'
    if (trimmed.toLowerCase() === 'support') return 'Support'
    return trimmed
  }

  const isStaffRole = (value) => ['Admin', 'Manager', 'Editor', 'Support'].includes(normalizeRole(value))

  const hasAnyRole = useCallback((roles = []) => {
    return roles.includes(role)
  }, [role])

  useEffect(() => {
    if (!pathname?.startsWith('/admin')) {
      setLoading(false)
      return
    }

    let mounted = true
    const init = async () => {
      try {
        const res = await api.post('/auth/refresh')
        if (!mounted) return
        if (res.status === 200 && res.data?.token) {
          setToken(res.data.token)
          setAuthToken(res.data.token)
          try {
            const me = await api.get('/auth/me')
            const normalizedRole = normalizeRole(me.data?.role)
            const staff = isStaffRole(normalizedRole)
            setIsAdmin(staff)
            setRole(normalizedRole)
            setUsername(me.data?.username || '')
            if (!staff) {
              setToken(null)
              setAuthToken(null)
              setRole('')
              setUsername('')
            }
          } catch {
            setIsAdmin(false)
            setToken(null)
            setAuthToken(null)
            setRole('')
            setUsername('')
          }
        } else {
          setIsAdmin(false)
          setRole('')
          setUsername('')
        }
      } catch (e) {
        setIsAdmin(false)
        setRole('')
        setUsername('')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    init()
    return () => { mounted = false }
  }, [pathname])

  const login = async (usernameValue, password) => {
    const normalizedUsername = String(usernameValue || '').trim()
    if (!normalizedUsername) return false

    try {
      const res = await api.post('/auth/login', { username: normalizedUsername, password })
      if (res.status !== 200) return false
      const data = res.data
      if (data?.token) {
        setToken(data.token)
        setAuthToken(data.token)
        const normalizedRole = normalizeRole(data?.role)
        const staff = isStaffRole(normalizedRole)
        setIsAdmin(staff)
        setRole(normalizedRole)
        setUsername(data?.username || normalizedUsername)
        if (!staff) {
          setToken(null)
          setAuthToken(null)
          setRole('')
          setUsername('')
          return false
        }

        return true
      }
    } catch (err) {
      console.error('login error', err)
    }
    return false
  }

  const logout = () => {
    ;(async () => {
      try {
        await api.post('/auth/logout-cookie')
      } catch (e) {
        // ignore
      }
      setIsAdmin(false)
      setToken(null)
      setRole('')
      setUsername('')
      setAuthToken(null)
      router.push('/shop')
    })()
  }

  const refreshToken = useCallback(async () => {
    if (refreshing.current) return null
    refreshing.current = true
    try {
      const res = await api.post('/auth/refresh')
      if (res.status !== 200) return null
      const data = res.data
      if (data?.token) {
        setToken(data.token)
        setAuthToken(data.token)
        try {
          const me = await api.get('/auth/me')
          const normalizedRole = normalizeRole(me.data?.role)
          if (isStaffRole(normalizedRole)) {
            setIsAdmin(true)
            setRole(normalizedRole)
            setUsername(me.data?.username || '')
            return data.token
          }
        } catch {
          // handled below
        }
        setIsAdmin(false)
        setToken(null)
        setRole('')
        setUsername('')
        setAuthToken(null)
      }
    } catch (e) {
      // no active session; keep silent
    } finally {
      refreshing.current = false
    }
    return null
  }, [])

  const authFetch = useCallback(async (url, opts = {}) => {
    // ensure we call the api instance with path relative to /api
    let path = url
    if (typeof path === 'string' && path.startsWith('/api')) path = path.slice(4)

    const config = {
      ...opts,
      url: path,
      username,
    }
    if (token) {
      config.headers = {
        ...(config.headers || {}),
        Authorization: `Bearer ${token}`,
      }
    }
    return api.request(config)
  }, [token])

  const value = {
    isAdmin,
    role,
    username,
    hasAnyRole,
    canViewDashboard: hasAnyRole(['Admin', 'Manager', 'Editor', 'Support']),
    canManageProducts: hasAnyRole(['Admin', 'Manager', 'Editor']),
    canDeleteProducts: hasAnyRole(['Admin', 'Manager']),
    canViewOrders: hasAnyRole(['Admin', 'Manager', 'Support']),
    canManageOrders: hasAnyRole(['Admin', 'Manager', 'Support']),
    canExportOrders: hasAnyRole(['Admin', 'Manager']),
    canManageUsers: hasAnyRole(['Admin']),
    canManageSettings: hasAnyRole(['Admin', 'Manager']),
    loading,
    login,
    logout,
    token,
    authFetch,
    refreshToken
  }

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  )
}
