import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server-client';
import { createSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { validatePassword } from '@/lib/auth/provisioning';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const password = validatePassword(body.password);
    const { supabase, applyAuthCookies } = createSupabaseServerClient(req);
    const { data: sessionData, error: userError } = await supabase.auth.getUser();
    if (userError || !sessionData.user) {
      return applyAuthCookies(NextResponse.json({ error: 'Sesi tidak ditemukan.' }, { status: 401 }));
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      return applyAuthCookies(NextResponse.json({ error: error.message || 'Password gagal diperbarui.' }, { status: 400 }));
    }

    const admin = createSupabaseAdminClient();
    const { error: profileError } = await admin
      .from('profiles')
      .update({ must_change_password: false, updated_at: new Date().toISOString() })
      .eq('id', sessionData.user.id);
    if (profileError) throw new Error(profileError.message || 'Status password profil gagal diperbarui.');

    return applyAuthCookies(NextResponse.json({ success: true }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Password gagal diperbarui.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
