import { NextRequest, NextResponse } from 'next/server';
import { bootstrapRequired, createAuthUserAndProfile } from '@/lib/auth/provisioning';
import { createSupabaseAdminClient } from '@/lib/supabase/admin-client';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

function json(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: { 'Cache-Control': 'no-store' } });
}

function validSetupToken(value: unknown) {
  const expected = process.env.TEAM_SETUP_TOKEN || '';
  const actual = typeof value === 'string' ? value : '';
  if (expected.length < 24 || /^(YOUR_|REPLACE_)/i.test(expected) || actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ actual.charCodeAt(index);
  }
  return difference === 0;
}

export async function GET() {
  try {
    return json({ needs_setup: await bootstrapRequired() });
  } catch {
    return json({ error: 'Konfigurasi database belum siap.' }, 503);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    if (!validSetupToken(body.setup_token)) return json({ error: 'Kode setup tidak valid.' }, 403);
    if (!(await bootstrapRequired())) return json({ error: 'Setup sudah selesai.' }, 409);

    const teamName = String(body.team_name || '').trim().slice(0, 120);
    if (!teamName) return json({ error: 'Nama tim wajib diisi.' }, 400);

    const admin = createSupabaseAdminClient();
    const { data: branding, error: brandingError } = await admin.from('team_branding').select('id').eq('id', true).maybeSingle();
    if (brandingError || !branding) return json({ error: 'Migrasi database tim belum lengkap.' }, 503);

    const created = await createAuthUserAndProfile({
      email: body.email,
      username: body.username,
      fullName: body.full_name,
      password: body.password,
      role: 'owner',
      isSuperuser: true,
      mustChangePassword: false,
    });
    const { error } = await admin.from('team_branding').update({
      name: teamName,
      updated_by: created.user.id,
      updated_at: new Date().toISOString(),
    }).eq('id', true);
    if (error) {
      await admin.from('app_workspace_members').delete().eq('user_id', created.user.id);
      await admin.auth.admin.deleteUser(created.user.id);
      throw new Error(error.message);
    }
    return json({ success: true }, 201);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Setup gagal.' }, 400);
  }
}
