export const BLUR_DATA_URL =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxMCIgdmlld0JveD0iMCAwIDE2IDEwIj48cmVjdCB3aWR0aD0iMTYiIGhlaWdodD0iMTAiIGZpbGw9IiNlZWYyZmYiLz48L3N2Zz4='

const OPTIMIZABLE_HOSTS = new Set([
  'images.unsplash.com',
  'localhost',
  '127.0.0.1'
])

const BROKEN_UNSPLASH_REPLACEMENTS = [
  {
    match: 'photo-1588405748880-12d1d2a59bd9',
    replacement: 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=400'
  },
  {
    match: 'photo-1590736969955-71cc94901144',
    replacement: 'https://images.unsplash.com/photo-1595425970377-c9703cf48b6d?w=400'
  },
  {
    match: 'photo-1594035910-23a2e4bc4a54',
    replacement: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400'
  },
  {
    match: 'photo-1602874801267-26bef3738e02',
    replacement: 'https://images.unsplash.com/photo-1594035910387-fea47794261f?w=400'
  },
  {
    match: 'photo-1610294472251-88919e95f08c',
    replacement: 'https://images.unsplash.com/photo-1594035910387-fea47794261f?w=400'
  }
]

export function resolveImageSrc(src) {
  if (!src || typeof src !== 'string') return src

  for (const rule of BROKEN_UNSPLASH_REPLACEMENTS) {
    if (src.includes(rule.match)) {
      return rule.replacement
    }
  }

  try {
    const url = new URL(src)
    if (url.hostname.includes('images.unsplash.com')) {
      if (!url.searchParams.has('auto')) url.searchParams.set('auto', 'format')
      if (!url.searchParams.has('fm')) url.searchParams.set('fm', 'webp')
      if (!url.searchParams.has('q')) url.searchParams.set('q', '75')
      return url.toString()
    }
  } catch (e) {
    // ignore invalid url parsing
  }

  return src
}

export function isOptimizableImageSrc(src) {
  if (!src || typeof src !== 'string') return false
  if (src.startsWith('data:')) return false
  if (src.startsWith('/')) return true

  try {
    const url = new URL(src)
    if (!['http:', 'https:'].includes(url.protocol)) return false
    return OPTIMIZABLE_HOSTS.has(url.hostname)
  } catch {
    return false
  }
}
