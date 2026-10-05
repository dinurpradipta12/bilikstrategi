import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/clickup/users';
import { getAuthorizedTeams } from '@/lib/clickup/teams';
import type { ClickUpUser } from '@/lib/clickup/types';
import { supabaseRest } from '@/lib/supabase/rest-client';
import { buildOfficeMembers, type SessionRow } from '@/lib/spatial-office/model';

export const runtime = 'edge';
const identityCache = new Map<string, { user: ClickUpUser; expires: number }>();
let rosterCache: { members: ClickUpUser[]; teamId: string; expires: number } | undefined;
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

async function verifiedUser(token: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const key = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
  const cached = identityCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.user;
  const { user } = await getAuthenticatedUser(token);
  if (!user?.id || !user.email) throw new Error('Unauthenticated');
  if (identityCache.size >= 100) identityCache.clear();
  identityCache.set(key, { user, expires: Date.now() + 60_000 });
  return user;
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get('clickup_access_token')?.value;
  if (!token) {
    const oauthConfigured = (process.env.NEXT_PUBLIC_CLICKUP_CLIENT_ID || process.env.CLICKUP_CLIENT_ID) && process.env.CLICKUP_CLIENT_SECRET;
    if (process.env.NODE_ENV === 'development' && !oauthConfigured) {
      return json({ error: 'Data asli belum terhubung di localhost. Konfigurasi login ClickUp dan koneksi Supabase proyek diperlukan pada server lokal; sesi simulasi tidak dapat membaca data tim.' }, 503);
    }
    return json({ error: 'Masuk menggunakan akun ClickUp tim untuk melihat presensi asli. Sesi simulasi tidak dapat digunakan.' }, 401);
  }
  let user: ClickUpUser;
  try { user = await verifiedUser(token); }
  catch { return json({ error: 'Sesi tidak dapat diverifikasi. Silakan masuk kembali.' }, 401); }
  try {
    // The current Team page is backed by this configured ClickUp workspace.
    // Never fall back to the first workspace or trust identity cookies.
    const teamId = process.env.CLICKUP_WORKSPACE_ID || process.env.CLICKUP_TEAM_ID || '90182855619';
    const workspaceToken = process.env.CLICKUP_API_KEY || process.env.CLICKUP_PERSONAL_TOKEN;
    let roster = rosterCache?.teamId === teamId && rosterCache.expires > Date.now() ? rosterCache.members : undefined;
    if (!roster) {
      // Match the Team page's token fallback, while requiring the exact workspace.
      for (const candidate of new Set([workspaceToken, token].filter((value): value is string => Boolean(value)))) {
        try {
          const data = await getAuthorizedTeams(candidate);
          const team = data.teams.find(item => String(item.id) === teamId);
          if (!team) continue;
          roster = team.members.map(member => member.user);
          // Cache only a server-owned roster, never one user's filtered response.
          if (candidate === workspaceToken) rosterCache = { members: roster, teamId, expires: Date.now() + 30_000 };
          break;
        } catch { /* The verified user's token can still access the workspace. */ }
      }
      if (!roster) throw new Error('Roster unavailable');
    }
    if (!roster.some(member => String(member.id) === String(user.id))) return json({ error: 'Anda bukan anggota tim ini.' }, 403);
    // Reuse the existing attendance connection and its RLS permissions. A new
    // service-role credential is not required just to render this read-only view.
    const [roleResult, sessionResult] = await Promise.all([
      supabaseRest.from('app_user_roles').select('email,display_name,status'),
      supabaseRest.from('active_sessions').select('*'),
    ]);
    if (roleResult.error || sessionResult.error) throw new Error('Snapshot unavailable');
    const roles = roleResult.data as { email: string; display_name: string; status: string }[];
    const sessions = sessionResult.data as SessionRow[];
    if (!Array.isArray(roles) || !Array.isArray(sessions)) throw new Error('Invalid snapshot');
    const roleByEmail = new Map(roles.map(role => [role.email.trim().toLowerCase(), role]));
    if (roleByEmail.get(user.email.trim().toLowerCase())?.status === 'inactive') return json({ error: 'Akun ini tidak aktif.' }, 403);
    const activeIds = new Set(roster.filter(member => roleByEmail.get(member.email?.trim().toLowerCase())?.status !== 'inactive').map(member => String(member.id)));
    const members = buildOfficeMembers(roster.map(member => ({
      id: String(member.id), name: roleByEmail.get(member.email?.trim().toLowerCase())?.display_name || member.username || 'Anggota tim',
      email: member.email || '', aliases: [member.username],
    })), sessions).filter(member => activeIds.has(member.id));
    return json({ members, syncedAt: new Date().toISOString() });
  } catch {
    return json({ error: 'Data tim atau presensi belum dapat diperbarui. Coba sinkronkan kembali.' }, 503);
  }
}
