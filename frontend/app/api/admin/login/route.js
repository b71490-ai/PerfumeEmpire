import { NextResponse } from 'next/server';

const BACKEND = process.env.BACKEND_URL || 'http://localhost:5100';

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

    const redirectTo = body.from || '/admin/dashboard';
    const url = new URL(redirectTo, req.url);
    const response = NextResponse.redirect(url);

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
