import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server-client';
import { createSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { getAppIdentityForAuthUser, toCurrentUserPayload } from '@/lib/auth/server-workspace-context';
import { normalizeUsername, validatePassword } from '@/lib/auth/provisioning';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function loginError() {
  return NextResponse.json({ error: 'Username atau password salah.' }, { status: 401 });
}

async function resolveEmail(identifier: string) {
  const normalized = identifier.trim().toLowerCase();
  if (normalized.includes('@')) return normalized;

  const username = normalizeUsername(normalized);
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('profiles')
    .select('email,status')
    .ilike('username', username)
    .limit(1)
    .maybeSingle();

  if (error || !data || data.status === 'inactive') return '';
  return String(data.email || '').trim().toLowerCase();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const identifier = String(body.identifier || body.username || body.email || '').trim();
    const password = validatePassword(body.password);
    if (!identifier) return loginError();

    const email = await resolveEmail(identifier);
    if (!email) return loginError();

    const { supabase, applyAuthCookies } = createSupabaseServerClient(req);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return applyAuthCookies(loginError());

    const context = await getAppIdentityForAuthUser(data.user);
    if (!context.isActive) {
      await supabase.auth.signOut();
      return applyAuthCookies(NextResponse.json({ error: 'Akun ini tidak aktif. Hubungi admin workspace.' }, { status: 403 }));
    }

    const response = NextResponse.json({
      success: true,
      user: toCurrentUserPayload(context),
      redirect_to: context.identity.mustChangePassword ? '/change-password' : '/dashboard',
    });
    return applyAuthCookies(response);
  } catch {
    return loginError();
  }
}
