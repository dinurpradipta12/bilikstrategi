import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/clickup/users';
import { normalizeIdentityEmail } from '@/lib/auth/app-role';
import { isSupabaseAdminConfigured, supabaseAdminFetch } from '@/lib/supabase/admin-rest-client';
import { parseTeamAppDraft, parseTeamAppLink } from '@/lib/team-apps/validation';

export const runtime = 'edge';

type RoleRow = { role?: string; is_superuser?: boolean; status?: string };

async function requireOwner(req: NextRequest) {
  const token = req.cookies.get('clickup_access_token')?.value;
  if (!token) return { error: NextResponse.json({ error: 'Masuk kembali dengan ClickUp untuk mengelola aplikasi tim.' }, { status: 401 }) };
  if (!isSupabaseAdminConfigured()) return { error: NextResponse.json({ error: 'Koneksi database server belum tersedia.' }, { status: 503 }) };
  try {
    const authenticated = await getAuthenticatedUser(token);
    const email = normalizeIdentityEmail(authenticated?.user?.email);
    if (!email) throw new Error('Email ClickUp tidak tersedia.');
    const response = await supabaseAdminFetch(
      `app_user_roles?select=role,is_superuser,status&email=eq.${encodeURIComponent(email)}&limit=1`,
    );
    if (!response.ok) throw new Error('Peran Owner tidak dapat diperiksa.');
    const rows = await response.json() as RoleRow[];
    const role = rows[0];
    if (!role || role.status !== 'active' || (role.role !== 'owner' && role.is_superuser !== true)) {
      return { error: NextResponse.json({ error: 'Hanya Owner aktif yang dapat mengelola aplikasi tim.' }, { status: 403 }) };
    }
    return { email };
  } catch {
    return { error: NextResponse.json({ error: 'Sesi ClickUp tidak dapat diverifikasi. Masuk kembali.' }, { status: 401 }) };
  }
}

function checkOrigin(req: NextRequest) {
  const origin = req.headers.get('origin');
  return !origin || origin === new URL(req.url).origin;
}

export async function GET(req: NextRequest) {
  const owner = await requireOwner(req);
  if (owner.error) return owner.error;
  const response = await supabaseAdminFetch(
    'team_app_instances?select=id,name,slug,short_name,owner_email,tagline,primary_color,accent_color,hosting_provider,app_url,status,created_at,updated_at&order=created_at.desc',
  );
  if (!response.ok) return NextResponse.json({ error: 'Daftar aplikasi tim belum tersedia. Jalankan migrasi database.' }, { status: 503 });
  return NextResponse.json({ apps: await response.json() });
}

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) return NextResponse.json({ error: 'Asal permintaan tidak valid.' }, { status: 403 });
  const owner = await requireOwner(req);
  if (owner.error) return owner.error;
  let draft;
  try { draft = parseTeamAppDraft(await req.json()); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Data tim tidak valid.' }, { status: 400 }); }
  const response = await supabaseAdminFetch('team_app_instances?select=id,name,slug,short_name,owner_email,tagline,primary_color,accent_color,hosting_provider,app_url,status,created_at,updated_at', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ ...draft, created_by_email: owner.email }),
  });
  if (response.status === 409) return NextResponse.json({ error: 'Slug tim sudah dipakai. Pilih yang lain.' }, { status: 409 });
  if (!response.ok) return NextResponse.json({ error: 'Gagal menyimpan aplikasi tim. Periksa migrasi database.' }, { status: 502 });
  const rows = await response.json();
  return NextResponse.json({ app: rows[0] }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  if (!checkOrigin(req)) return NextResponse.json({ error: 'Asal permintaan tidak valid.' }, { status: 403 });
  const owner = await requireOwner(req);
  if (owner.error) return owner.error;
  let link;
  try { link = parseTeamAppLink(await req.json()); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Tautan tidak valid.' }, { status: 400 }); }
  const response = await supabaseAdminFetch(`team_app_instances?id=eq.${link.id}&select=id,name,slug,short_name,owner_email,tagline,primary_color,accent_color,hosting_provider,app_url,status,created_at,updated_at`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ hosting_provider: link.hosting_provider, app_url: link.app_url, status: 'link_recorded', updated_at: new Date().toISOString() }),
  });
  if (!response.ok) return NextResponse.json({ error: 'Gagal menyimpan tautan aplikasi.' }, { status: 502 });
  const rows = await response.json();
  if (!rows[0]) return NextResponse.json({ error: 'Aplikasi tim tidak ditemukan.' }, { status: 404 });
  return NextResponse.json({ app: rows[0] });
}
