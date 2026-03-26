import { NextResponse } from 'next/server';

const BACKEND = process.env.BACKEND_URL || 'http://localhost:5000';

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

    // set the JWT token cookie (for frontend/admin UI)
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    // forward backend Set-Cookie (e.g. refresh token) to the client when present
    try {
      const setCookieHeader = resp.headers.get('set-cookie');
      if (setCookieHeader) {
        // there may be multiple cookies concatenated with comma; split conservatively
        const cookies = setCookieHeader.split(/,(?=[^ ;]+=)/g);
        for (const cookieStr of cookies) {
          const parts = cookieStr.split(';').map(p => p.trim());
          const [nameValue, ...attrs] = parts;
          const eq = nameValue.indexOf('=');
          if (eq === -1) continue;
          const name = nameValue.substring(0, eq);
          const value = nameValue.substring(eq + 1);

          const options = { path: '/', httpOnly: false, secure: process.env.NODE_ENV === 'production' };
          for (const a of attrs) {
            const lower = a.toLowerCase();
            if (lower === 'httponly') options.httpOnly = true;
            else if (lower === 'secure') options.secure = true;
            else if (lower.startsWith('samesite=')) options.sameSite = a.split('=')[1].toLowerCase();
            else if (lower.startsWith('path=')) options.path = a.split('=')[1];
            else if (lower.startsWith('max-age=')) options.maxAge = parseInt(a.split('=')[1], 10);
          }

          // NextResponse.cookies.set will accept boolean httpOnly and sameSite as string
          response.cookies.set(name, value, options);
        }
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
