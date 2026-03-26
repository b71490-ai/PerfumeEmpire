const API_BASE_URL = String(
  process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
).replace(/\/+$/, '')

export function getServerApiUrl(path = '') {
  const normalizedPath = String(path || '')
  const suffix = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`
  return `${API_BASE_URL}/api${suffix}`
}
