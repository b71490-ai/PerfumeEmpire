const API_BASE_URL = String(
  process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === 'development'
    ? 'http://localhost:5000'
    : 'https://perfume-backend-wlk8.onrender.com')
).replace(/\/+$/, '')

export function getServerApiUrl(path = '') {
  const normalizedPath = String(path || '')
  const suffix = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`
  return `${API_BASE_URL}/api${suffix}`
}
