import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server-client';

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|favicon.png|manifest.json|apple-touch-icon.png|icon-192.png|icon-512.png|login|setup|change-password|.*\\.(?:png|jpg|jpeg|webp|svg|ico|woff2?)$).*)',
  ],
};

export async function proxy(req: NextRequest) {
  const { supabase, applyAuthCookies } = createSupabaseServerClient(req);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return applyAuthCookies(NextResponse.redirect(new URL('/login', req.url)));
  }

  // Keep project detail links usable on deployments that serve the shared
  // projects page for dynamic paths.
  const match = req.nextUrl.pathname.match(/^\/projects\/([^/]+)\/?$/);
  if (match) {
    const url = req.nextUrl.clone();
    url.pathname = '/projects';
    url.searchParams.set('projectId', match[1]);
    return applyAuthCookies(NextResponse.rewrite(url));
  }

  return applyAuthCookies(NextResponse.next());
}
