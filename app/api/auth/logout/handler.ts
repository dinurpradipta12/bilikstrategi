import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server-client';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const response = NextResponse.redirect(new URL('/login', req.url));
  const { supabase, applyAuthCookies } = createSupabaseServerClient(req);

  await supabase.auth.signOut().catch(() => null);

  return applyAuthCookies(response);
}
