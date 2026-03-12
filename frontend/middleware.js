import { NextResponse } from 'next/server'

/**
 * Protect /admin/* routes server-side.
 * Allows Next internals and public assets, permits /admin/login,
 * and redirects unauthenticated requests to the login page.
 */
export function middleware(request) {
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
    const authHeader = request.headers.get('authorization')
    const hasToken = Boolean(tokenCookie) || Boolean(authHeader)

    if (!hasToken) {
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
