import { NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const jwtKey = process.env.JWT_KEY || ''
const jwtIssuer = process.env.JWT_ISSUER || undefined
const jwtAudience = process.env.JWT_AUDIENCE || undefined

function extractRole(payload) {
  const directRole = payload?.role
  const claimRole = payload?.['http://schemas.microsoft.com/ws/2008/06/identity/claims/role']
  return String(directRole || claimRole || '').trim().toLowerCase()
}

async function validateAdminToken(token) {
  if (!token || !jwtKey) return false

  const options = { algorithms: ['HS256'] }
  if (jwtIssuer) options.issuer = jwtIssuer
  if (jwtAudience) options.audience = jwtAudience

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(jwtKey), options)
    const role = extractRole(payload)
    return role === 'admin' || role === 'manager' || role === 'editor' || role === 'support'
  } catch {
    return false
  }
}

/**
 * Protect /admin/* routes server-side.
 * Allows Next internals and public assets, permits /admin/login,
 * and redirects unauthenticated requests to the login page.
 */
export async function middleware(request) {
  const { pathname } = request.nextUrl

  // Allow Next internals and public assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/public') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/admin')) {
    // allow the login page and its assets
    if (pathname === '/admin/login' || pathname.startsWith('/admin/login/')) {
      return NextResponse.next()
    }

    const tokenCookie = request.cookies.get('token')?.value
    const hasValidToken = await validateAdminToken(tokenCookie)

    if (!hasValidToken) {
      const url = request.nextUrl.clone()
      url.pathname = '/admin/login'
      url.searchParams.set('from', pathname)
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
