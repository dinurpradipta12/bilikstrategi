import { NextRequest, NextResponse } from 'next/server';
import { getServerWorkspaceContext } from '@/lib/auth/server-workspace-context';
import { createSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { normalizePageAccess } from '@/lib/auth/page-access';
import { normalizeIdentityEmail } from '@/lib/auth/app-role';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

async function manager(req: NextRequest) {
  const context = await getServerWorkspaceContext(req);
  return context.isActive && context.canManage ? context : null;
}
function denied() { return NextResponse.json({ error: 'Hanya Owner atau Admin yang dapat mengelola akses pengguna.' }, { status: 403 }); }
function failure(error: unknown) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Akses pengguna gagal disimpan.' }, { status: 503 }); }

export async function GET(req: NextRequest) {
  if (!(await manager(req))) return denied();
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from('app_user_roles').select('email,display_name,role,is_superuser,status,page_access,updated_at').order('display_name');
    if (error) throw error;
    return NextResponse.json({ roles: data || [] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return failure(error); }
}

export async function PUT(req: NextRequest) {
  const actor = await manager(req);
  if (!actor) return denied();
  try {
    const body = await req.json().catch(() => ({}));
    const email = normalizeIdentityEmail(body.email);
    if (!email) return NextResponse.json({ error: 'Email anggota wajib diisi.' }, { status: 400 });
    const admin = createSupabaseAdminClient();
    const { data: profile, error: profileError } = await admin.from('profiles').select('id,email,full_name,role,status').ilike('email', email).maybeSingle();
    if (profileError) throw profileError;
    if (!profile) return NextResponse.json({ error: 'Buat akun anggota lebih dahulu di Pengaturan.' }, { status: 404 });
    if (profile.role === 'owner') return NextResponse.json({ error: 'Peran Owner tidak dapat diubah dari pengaturan anggota.' }, { status: 403 });
    const role = body.is_admin === true || body.role === 'admin' ? 'admin' : 'member';
    const pageAccess = normalizePageAccess(body.page_access);
    const { error: roleError } = await admin.from('app_user_roles').upsert({
      email: profile.email,
      user_id: profile.id,
      display_name: String(body.display_name || profile.full_name || email).slice(0, 180),
      role,
      is_superuser: false,
      status: profile.status,
      page_access: pageAccess,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'email' });
    if (roleError) throw roleError;
    const { error: updateError } = await admin.from('profiles').update({ role, updated_at: new Date().toISOString() }).eq('id', profile.id);
    if (updateError) throw updateError;
    return NextResponse.json({ success: true, role: { email: profile.email, role, page_access: pageAccess } });
  } catch (error) { return failure(error); }
}
