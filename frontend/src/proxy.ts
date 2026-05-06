import { NextRequest, NextResponse } from 'next/server';

type TokenPayload = {
  exp?: number;
  role?: string;
};

const decodeTokenPayload = (token: string): TokenPayload | null => {
  try {
    const [, payload] = token.split('.');
    if (!payload) {
      return null;
    }

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    return JSON.parse(atob(padded)) as TokenPayload;
  } catch {
    return null;
  }
};

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('auth_token')?.value;
  const roleCookie = request.cookies.get('auth_role')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/auth/lecturer', request.url));
  }

  const payload = decodeTokenPayload(token);
  if (!payload) {
    return NextResponse.redirect(new URL('/auth/lecturer', request.url));
  }

  if (payload.exp && payload.exp * 1000 <= Date.now()) {
    const response = NextResponse.redirect(new URL('/auth/lecturer', request.url));
    response.cookies.delete('auth_token');
    response.cookies.delete('auth_role');
    return response;
  }

  const role = payload.role ?? roleCookie;

  if (role === 'student') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (pathname.startsWith('/dashboard/admin') && role && role !== 'admin') {
    const destination = role === 'lecturer' ? '/dashboard/lecturer' : '/dashboard';
    return NextResponse.redirect(new URL(destination, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
