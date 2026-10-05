import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdminFetch } from '@/lib/supabase/admin-rest-client';
import { verifyTeamSetupToken } from '@/lib/team-apps/setup-link';

export const runtime = 'edge';

function json(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

export async function GET(req: NextRequest) {
  const invite = new URL(req.url).searchParams.get('invite') || '';
  if (invite.length > 200) return json({ error: 'Link setup tidak valid.' }, 400);
  const id = await verifyTeamSetupToken(invite);
  if (!id) return json({ error: 'Link setup tidak valid atau sudah kedaluwarsa. Minta link baru kepada pengirim.' }, 403);
  if (!isSupabaseAdminConfigured()) return json({ error: 'Setup tim belum tersedia.' }, 503);

  const response = await supabaseAdminFetch(
    `team_app_instances?id=eq.${id}&select=name,slug,short_name,owner_email,tagline,primary_color,accent_color,app_url&limit=1`,
  );
  if (!response.ok) return json({ error: 'Data tim belum tersedia.' }, 503);
  const rows = await response.json() as Record<string, unknown>[];
  if (!rows[0]) return json({ error: 'Tim tidak ditemukan.' }, 404);
  return json({ team: rows[0] });
}
