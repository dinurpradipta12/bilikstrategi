import { NextRequest, NextResponse } from 'next/server';
import { clearClickUpSessionCookies } from '@/lib/auth/clickup-session';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const response = NextResponse.redirect(new URL('/login', req.url));

  // Clear all session cookies
  clearClickUpSessionCookies(response, req);

  return response;
}
