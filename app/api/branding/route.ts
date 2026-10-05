import { NextRequest, NextResponse } from 'next/server';
import { getServerWorkspaceContext } from '@/lib/auth/server-workspace-context';
import { createSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { readTeamBranding } from '@/lib/branding/server';
import { normalizeTeamModules, type TeamBranding } from '@/lib/branding/types';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const editable = [
  'name', 'short_name', 'tagline', 'primary_color', 'accent_color',
  'company_name', 'company_address', 'company_email', 'company_phone',
] as const;

export async function GET() {
  return NextResponse.json({ branding: await readTeamBranding() }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(req: NextRequest) {
  const context = await getServerWorkspaceContext(req);
  if (!context.identity.id || !context.isActive || !context.canManage) {
    return NextResponse.json({ error: 'Hanya Owner atau Admin yang dapat mengubah identitas aplikasi.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const changes: Partial<TeamBranding> = {};
    for (const key of editable) {
      if (typeof body[key] !== 'string') continue;
      const value = body[key].trim();
      if (key.endsWith('_color')) {
        if (!/^#[0-9a-fA-F]{6}$/.test(value)) return NextResponse.json({ error: 'Warna harus dalam format #RRGGBB.' }, { status: 400 });
      } else if (value.length > (key === 'company_address' ? 500 : 160)) {
        return NextResponse.json({ error: `${key} terlalu panjang.` }, { status: 400 });
      }
      changes[key] = value;
    }
    if (body.modules_enabled !== undefined) {
      if (!context.isSuperuser) {
        return NextResponse.json({ error: 'Hanya Owner yang dapat mengatur fitur aplikasi.' }, { status: 403 });
      }
      if (!body.modules_enabled || typeof body.modules_enabled !== 'object' || Array.isArray(body.modules_enabled)) {
        return NextResponse.json({ error: 'Pengaturan fitur tidak valid.' }, { status: 400 });
      }
      changes.modules_enabled = normalizeTeamModules(body.modules_enabled);
    }
    if (changes.name === '' || changes.short_name === '') {
      return NextResponse.json({ error: 'Nama aplikasi wajib diisi.' }, { status: 400 });
    }
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from('team_branding').update({
      ...changes,
      updated_by: context.identity.id,
      updated_at: new Date().toISOString(),
    }).eq('id', true);
    if (error) throw new Error(error.message);
    return NextResponse.json({ branding: await readTeamBranding() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Gagal menyimpan identitas aplikasi.' }, { status: 400 });
  }
}
