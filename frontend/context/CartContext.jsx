'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { fetchPerfumes, fetchStoreSettings } from '@/lib/api'

const CartContext = createContext()
const RUNTIME_SYNC_MIN_INTERVAL_MS = 5000

export function CartProvider({ children }) {
  const [cart, setCart] = useState([])
  const [wishlist, setWishlist] = useState([])
  const [storageHydrated, setStorageHydrated] = useState(false)
  const mountedRef = useRef(true)
  const syncInFlightRef = useRef(null)
  const lastRuntimeSyncAtRef = useRef(0)
  const cartStorageRef = useRef(null)
  const wishlistStorageRef = useRef(null)
  const [storeRuntime, setStoreRuntime] = useState({
    maintenanceMode: false,
    maintenanceMessage: 'المتجر تحت صيانة مؤقتة، سنعود قريباً.'
  })

  const syncStoreRuntime = useCallback((force = false) => {
    if (syncInFlightRef.current) {
      return syncInFlightRef.current
    }

    const now = Date.now()
    if (!force && now - lastRuntimeSyncAtRef.current < RUNTIME_SYNC_MIN_INTERVAL_MS) {
      return Promise.resolve()
    }

    const syncPromise = (async () => {
      try {
        const settings = await fetchStoreSettings()
        if (!mountedRef.current || !settings) return

        setStoreRuntime((prev) => {
          const next = {
            maintenanceMode: Boolean(settings.maintenanceMode),
            maintenanceMessage: settings.maintenanceMessage || 'المتجر تحت صيانة مؤقتة، سنعود قريباً.'
          }

          if (prev.maintenanceMode === next.maintenanceMode && prev.maintenanceMessage === next.maintenanceMessage) {
            return prev
          }

          return next
        })
      } catch {
        // keep existing runtime settings
      } finally {
        lastRuntimeSyncAtRef.current = Date.now()
        syncInFlightRef.current = null
      }
    })()

    syncInFlightRef.current = syncPromise
    return syncPromise
  }, [])

  const parseStoredArray = (value) => {
    if (!value) return []
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // تحميل السلة والمفضلة من localStorage عند البداية
  useEffect(() => {
    const loadAndSyncSavedItems = async () => {
      try {
        await syncStoreRuntime(true)

        const savedCart = localStorage.getItem('cart')
        const savedWishlist = localStorage.getItem('wishlist')

        let parsedCart = []
        let parsedWishlist = []

        if (savedCart) {
          parsedCart = JSON.parse(savedCart)
          setCart(parsedCart)
          cartStorageRef.current = savedCart
        }

        if (savedWishlist) {
          parsedWishlist = JSON.parse(savedWishlist)
          setWishlist(parsedWishlist)
          wishlistStorageRef.current = savedWishlist
        }
        if (parsedCart.length === 0 && parsedWishlist.length === 0) {
          return
        }

        try {
          const latestPerfumes = await fetchPerfumes()
          const latestById = new Map(latestPerfumes.map(item => [item.id, item]))

          if (parsedCart.length > 0) {
            const syncedCart = parsedCart.map(item => {
              const latest = latestById.get(item.id)
              if (!latest) return item

              return {
                ...item,
                name: latest.name,
                brand: latest.brand,
                price: latest.price,
                imageUrl: latest.imageUrl,
                discount: latest.discount,
                category: latest.category
              }
            })

            setCart(syncedCart)
            const serializedCart = JSON.stringify(syncedCart)
            localStorage.setItem('cart', serializedCart)
            cartStorageRef.current = serializedCart
          }

          if (parsedWishlist.length > 0) {
            const syncedWishlist = parsedWishlist.map(item => {
              const latest = latestById.get(item.id)
              if (!latest) return item

              return {
                ...item,
                name: latest.name,
                brand: latest.brand,
                price: latest.price,
                imageUrl: latest.imageUrl,
                discount: latest.discount,
                category: latest.category
              }
            })

            setWishlist(syncedWishlist)
            const serializedWishlist = JSON.stringify(syncedWishlist)
            localStorage.setItem('wishlist', serializedWishlist)
            wishlistStorageRef.current = serializedWishlist
          }
        } catch {
          // keep saved local data if API is unavailable
        }
      } catch {
        localStorage.removeItem('cart')
        localStorage.removeItem('wishlist')
        cartStorageRef.current = null
        wishlistStorageRef.current = null
      } finally {
        if (mountedRef.current) {
          setStorageHydrated(true)
        }
      }
    }

    loadAndSyncSavedItems()
  }, [syncStoreRuntime])

  useEffect(() => {
    const intervalId = setInterval(() => {
      syncStoreRuntime()
    }, 60000)

    return () => clearInterval(intervalId)
  }, [syncStoreRuntime])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncStoreRuntime(true)
      }
    }

    const handleFocus = () => {
      syncStoreRuntime(true)
    }

    const handleOnline = () => {
      syncStoreRuntime(true)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('online', handleOnline)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('online', handleOnline)
    }
  }, [syncStoreRuntime])

  useEffect(() => {
    const handleStorage = (event) => {
      if (!mountedRef.current) return

      if (event.key === 'cart') {
        if (event.newValue === cartStorageRef.current) return

        const nextCart = parseStoredArray(event.newValue)
        setCart(nextCart)
        cartStorageRef.current = event.newValue || null
        return
      }

      if (event.key === 'wishlist') {
        if (event.newValue === wishlistStorageRef.current) return

        const nextWishlist = parseStoredArray(event.newValue)
        setWishlist(nextWishlist)
        wishlistStorageRef.current = event.newValue || null
        return
      }

      if (event.key === null) {
        setCart([])
        setWishlist([])
        cartStorageRef.current = null
        wishlistStorageRef.current = null
        syncStoreRuntime(true)
      }
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [syncStoreRuntime])

  // حفظ السلة في localStorage عند التغيير
  useEffect(() => {
    if (!storageHydrated) return

    if (cart.length > 0) {
      const serializedCart = JSON.stringify(cart)
      localStorage.setItem('cart', serializedCart)
      cartStorageRef.current = serializedCart
      return
    }

    localStorage.removeItem('cart')
    cartStorageRef.current = null
  }, [cart, storageHydrated])

  // حفظ المفضلة في localStorage عند التغيير
  useEffect(() => {
    if (!storageHydrated) return

    if (wishlist.length > 0) {
      const serializedWishlist = JSON.stringify(wishlist)
      localStorage.setItem('wishlist', serializedWishlist)
      wishlistStorageRef.current = serializedWishlist
      return
    }

    localStorage.removeItem('wishlist')
    wishlistStorageRef.current = null
  }, [wishlist, storageHydrated])

  // إضافة منتج للسلة
  const addToCart = (product) => {
    if (storeRuntime.maintenanceMode) {
      return false
    }

    let itemAdded = false

    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === product.id)
      const availableStock = Number(product.stock ?? 0)

      if (availableStock <= 0) {
        return prevCart
      }
      
      if (existingItem) {
        if (existingItem.quantity >= availableStock) {
          return prevCart
        }

        itemAdded = true

        return prevCart.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }

      itemAdded = true
      
      return [...prevCart, { ...product, quantity: 1 }]
    })

    return itemAdded
  }

  // تحديث كمية المنتج
  const updateQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(productId)
      return
    }

    const itemInCart = cart.find(item => item.id === productId)
    if (itemInCart) {
      const availableStock = Number(itemInCart.stock ?? 0)
      if (availableStock > 0 && quantity > availableStock) {
        quantity = availableStock
      }
    }
    
    setCart(prevCart =>
      prevCart.map(item =>
        item.id === productId ? { ...item, quantity } : item
      )
    )
  }

  // حذف منتج من السلة
  const removeFromCart = (productId) => {
    setCart(prevCart => prevCart.filter(item => item.id !== productId))
  }

  // مسح السلة بالكامل
  const clearCart = () => {
    setCart([])
  }

  const importCartItems = useCallback(async (items = []) => {
    if (!Array.isArray(items) || items.length === 0) {
      setCart([])
      return { importedCount: 0, skippedCount: 0 }
    }

    try {
      const latestPerfumes = await fetchPerfumes()
      const latestById = new Map(latestPerfumes.map(item => [item.id, item]))
      const quantityById = new Map()

      for (const rawItem of items) {
        const id = Number(rawItem?.id)
        const requestedQuantity = Number(rawItem?.quantity ?? 0)

        if (!Number.isFinite(id) || !Number.isFinite(requestedQuantity) || requestedQuantity <= 0) {
          continue
        }

        quantityById.set(id, (quantityById.get(id) || 0) + Math.floor(requestedQuantity))
      }

      const importedCart = []
      quantityById.forEach((requestedQuantity, id) => {
        const latest = latestById.get(id)
        if (!latest) return

        const stock = Number(latest.stock ?? 0)
        if (stock <= 0) return

        const quantity = Math.max(1, Math.min(requestedQuantity, stock))
        importedCart.push({ ...latest, quantity })
      })

      setCart(importedCart)

      return {
        importedCount: importedCart.length,
        skippedCount: Math.max(0, quantityById.size - importedCart.length)
      }
    } catch {
      return {
        importedCount: 0,
        skippedCount: Array.isArray(items) ? items.length : 0
      }
    }
  }, [])

  // احسب إجمالي السلة
  const getCartTotal = () => {
    return cart.reduce((total, item) => {
      const price = item.discount > 0 
        ? item.price - (item.price * item.discount / 100)
        : item.price
      return total + (price * item.quantity)
    }, 0)
  }

  // احسب عدد المنتجات في السلة
  const getCartCount = () => {
    return cart.reduce((count, item) => count + item.quantity, 0)
  }

  // إضافة/حذف من المفضلة
  const toggleWishlist = (product) => {
    setWishlist(prevWishlist => {
      const exists = prevWishlist.find(item => item.id === product.id)
      
      if (exists) {
        return prevWishlist.filter(item => item.id !== product.id)
      }
      
      return [...prevWishlist, product]
    })
  }

  // تحقق إذا كان المنتج في المفضلة
  const isInWishlist = (productId) => {
    return wishlist.some(item => item.id === productId)
  }

  const value = {
    cart,
    wishlist,
    maintenanceMode: storeRuntime.maintenanceMode,
    maintenanceMessage: storeRuntime.maintenanceMessage,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    importCartItems,
    getCartTotal,
    getCartCount,
    toggleWishlist,
    isInWishlist
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart must be used within CartProvider')
  }
  return context
}
