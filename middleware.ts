import { NextRequest, NextResponse } from 'next/server';

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - public PWA assets (manifest and app icons)
     * - login (auth page)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|favicon.png|manifest.json|apple-touch-icon.png|icon-192.png|icon-512.png|login).*)',
  ],
};

export function middleware(req: NextRequest) {
  const loggedIn = req.cookies.get('clickup_logged_in')?.value;
  const token = req.cookies.get('clickup_access_token')?.value;

  if (!loggedIn && !token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Cloudflare Pages can intermittently omit the dynamic Edge Function for
  // runtime-created project ids. Keep the public URL, but serve the static
  // projects page and let it render the requested detail by query string.
  const projectDetailMatch = req.nextUrl.pathname.match(/^\/projects\/([^/]+)\/?$/);
  if (projectDetailMatch) {
    const url = req.nextUrl.clone();
    url.pathname = '/projects';
    url.searchParams.set('projectId', projectDetailMatch[1]);
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}
