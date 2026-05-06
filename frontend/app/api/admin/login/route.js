import { NextResponse } from 'next/server';

const BACKEND = (process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === 'development'
  ? 'http://localhost:5000'
  : 'https://perfume-backend-wlk8.onrender.com')).replace(/\/+$/, '');

export async function POST(req) {
  try {
    const body = await req.json();
    const resp = await fetch(`${BACKEND}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: body.username, password: body.password }),
    });

    const data = await resp.json().catch(() => null);
    if (!resp.ok) {
      const err = (data && (data.message || data.error)) || 'Authentication failed';
      return NextResponse.json({ error: err }, { status: resp.status });
    }

    const token = data?.token || data?.accessToken || data?.tokenString || data?.access_token;
    if (!token) {
      return NextResponse.json({ error: 'No token returned from backend' }, { status: 500 });
    }

    const redirectTo = typeof body.from === 'string' && body.from.startsWith('/admin')
      ? body.from
      : '/admin/dashboard';
    const response = NextResponse.json({ ok: true, redirectTo });

    // set the JWT token cookie (for frontend/admin UI)
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    // Forward backend Set-Cookie headers as-is to avoid brittle manual parsing.
    try {
      const setCookieHeaders = typeof resp.headers.getSetCookie === 'function'
        ? resp.headers.getSetCookie()
        : [];

      if (setCookieHeaders.length === 0) {
        const rawSetCookie = resp.headers.get('set-cookie');
        if (rawSetCookie) {
          response.headers.append('set-cookie', rawSetCookie);
        }
      }

      for (const cookieHeader of setCookieHeaders) {
        response.headers.append('set-cookie', cookieHeader);
      }
    } catch (ex) {
      // don't block login if cookie forwarding fails
      console.error('Failed to forward Set-Cookie from backend:', ex);
    }

    return response;
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
