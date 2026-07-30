import { NextRequest, NextResponse } from 'next/server';

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/projects/:path*',
    '/tasks/:path*',
    '/my-tasks/:path*',
    '/clients/:path*',
    '/team/:path*',
    '/calendar/:path*',
    '/timeline/:path*',
    '/chat/:path*',
    '/notifications/:path*',
    '/activity-logs/:path*',
    '/settings/:path*',
  ],
};

export function middleware(req: NextRequest) {
  const loggedIn = req.cookies.get('clickup_logged_in')?.value;

  if (!loggedIn) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}
