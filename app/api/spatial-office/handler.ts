import { resolvePresenceSnapshot } from '@/lib/attendance/presence';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/clickup/users';
import { getAuthorizedTeams } from '@/lib/clickup/teams';
import type { ClickUpUser } from '@/lib/clickup/types';
import { supabaseRest } from '@/lib/supabase/rest-client';
import { supabaseAdminFetch, isSupabaseAdminConfigured } from '@/lib/supabase/admin-rest-client';
import { buildOfficeMembers, memberTasks, parseAvatar, type TaskRow, type SessionRow } from '@/lib/spatial-office/model';

import { readOfficeSpace, mutateOfficeSpace } from '@/lib/spatial-office/space-store';
import { claimDesk, assignDesk, removeDesk, parseOrnaments, parseDesks, setActivity, spaceCapacity } from '@/lib/spatial-office/space';
import { DESKS_PER_ROOM } from '@/lib/spatial-office/model';

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
    const [roleResult, sessionResult, taskResult, avatarResult, presenceResult] = await Promise.all([
      supabaseRest.from('app_user_roles').select('email,display_name,status,role,is_superuser'),
      supabaseRest.from('active_sessions').select('*'),
      supabaseRest.from('task_cache').select('task_name,status,assignee_ids,raw_data'),
      isSupabaseAdminConfigured() ? supabaseAdminFetch(`app_settings?select=key,value&key=like.${encodeURIComponent(`spatial-avatar:${teamId}:*`)}`).catch(() => null) : Promise.resolve(null),
      isSupabaseAdminConfigured() ? supabaseAdminFetch(`attendance_presence_state?select=user_email,session_check_in_timestamp,last_seen_at,last_activity_at,last_foreground_at&workspace_id=eq.${encodeURIComponent(teamId)}`).catch(() => null) : Promise.resolve(null),
    ]);
    if (roleResult.error || sessionResult.error) throw new Error('Snapshot unavailable');
    const roles = roleResult.data as { email: string; display_name: string; status: string; role?: string; is_superuser?: boolean }[];
    const sessions = sessionResult.data as SessionRow[];
    if (!Array.isArray(roles) || !Array.isArray(sessions)) throw new Error('Invalid snapshot');
    const roleByEmail = new Map(roles.map(role => [role.email.trim().toLowerCase(), role]));
    if (roleByEmail.get(user.email.trim().toLowerCase())?.status === 'inactive') return json({ error: 'Akun ini tidak aktif.' }, 403);
    const activeIds = new Set(roster.filter(member => roleByEmail.get(member.email?.trim().toLowerCase())?.status !== 'inactive').map(member => String(member.id)));
    const officeRoster = roster.map(member => ({
      id: String(member.id), name: roleByEmail.get(member.email?.trim().toLowerCase())?.display_name || member.username || 'Anggota tim',
      email: member.email || '', aliases: [member.username],
    }));
    const avatarRows = avatarResult?.ok ? await avatarResult.json() as { key: string; value: unknown }[] : [];
    const avatars = new Map(avatarRows.map(row => [row.key, parseAvatar(row.value)]));
    const tasks = !taskResult.error && Array.isArray(taskResult.data) ? taskResult.data as TaskRow[] : [];
    const presenceRows = presenceResult?.ok ? await presenceResult.json() as {user_email:string;session_check_in_timestamp:number;last_seen_at:string;last_activity_at:string;last_foreground_at:string}[] : [];
    const members = buildOfficeMembers(officeRoster, sessions).filter(member => activeIds.has(member.id)).map(member => ({
      ...member, presenceIdle: (()=>{
        const email=officeRoster.find(item=>item.id===member.id)?.email.toLowerCase();
        const tracked=presenceRows.find(p=>p.user_email?.toLowerCase()===email && Number(p.session_check_in_timestamp)>0 && Number(p.session_check_in_timestamp)===member.startedAt);
        return Boolean(tracked && resolvePresenceSnapshot({isOnline:true,isPaused:member.status==='paused',lastActivityAt:tracked.last_activity_at,lastSeenAt:tracked.last_seen_at,lastForegroundAt:tracked.last_foreground_at}).state!=='active');
      })(), tasks: memberTasks(officeRoster.find(item => item.id === member.id)!, tasks),
      avatar: avatars.get(`spatial-avatar:${teamId}:${member.id}`) || undefined,
    }));
    const office = await readOfficeSpace(teamId, members);
    const ownRole = roleByEmail.get(user.email.trim().toLowerCase());
    const canEditOffice = ownRole?.is_superuser === true || ['admin', 'owner'].includes(String(ownRole?.role || '').trim().toLowerCase());
    return json({ viewerRole: ownRole?.is_superuser === true ? 'owner' : String(ownRole?.role || 'member').trim().toLowerCase(), space: office.space, spaceStorage: office.ready, canEditOffice, members, viewerId: String(user.id), avatarStorage: Boolean(avatarResult?.ok), syncedAt: new Date().toISOString() });
  } catch {
    return json({ error: 'Data tim atau presensi belum dapat diperbarui. Coba sinkronkan kembali.' }, 503);
  }
}

export async function PUT(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (origin && origin !== new URL(req.url).origin) return json({ error: 'Asal permintaan tidak sesuai.' }, 403);
  if (Number(req.headers.get('content-length') || 0) > 2048) return json({ error: 'Data avatar terlalu besar.' }, 413);
  // Reuse the verified identity, exact workspace membership, and inactive-user check.
  // The client never chooses whose preferences are written.
  const auth = await GET(req);
  if (!auth.ok) return auth;
  const snapshot = await auth.json();
  if (!snapshot.avatarStorage) return json({ error: 'Penyimpanan avatar belum tersedia. Periksa koneksi server ke app_settings.' }, 503);
  let avatar;
  try { avatar = parseAvatar((await req.json()).avatar); } catch { return json({ error: 'Data avatar tidak valid.' }, 400); }
  if (!avatar) return json({ error: 'Pilihan avatar tidak valid.' }, 400);
  const teamId = process.env.CLICKUP_WORKSPACE_ID || process.env.CLICKUP_TEAM_ID || '90182855619';
  try {
    const response = await supabaseAdminFetch('app_settings?on_conflict=key', {
      method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ key: `spatial-avatar:${teamId}:${snapshot.viewerId}`, value: avatar, updated_at: new Date().toISOString() }),
    });
    if (!response.ok) throw new Error('Save failed');
    return json({ avatar });
  } catch { return json({ error: 'Avatar belum tersimpan. Coba kembali.' }, 503); }
}

export async function PATCH(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (origin && origin !== new URL(req.url).origin) return json({ error: 'Asal permintaan tidak sesuai.' }, 403);
  const auth = await GET(req);
  if (!auth.ok) return auth;
  const snapshot = await auth.json();
  if (!snapshot.spaceStorage) return json({ error: 'Penyimpanan kantor belum terhubung.' }, 503);
  let action;
  try {
    const raw = await req.text();
    if (raw.length > 40000) return json({ error: 'Data terlalu besar.' }, 413);
    action = JSON.parse(raw);
  } catch { return json({ error: 'Data perubahan tidak valid.' }, 400); }
  if (!action || !['claim', 'assign', 'remove-desk', 'layout', 'activity'].includes(action.type)) return json({ error: 'Perintah kantor tidak valid.' }, 400);
  if(action.version!==4) return json({error:'Kantor telah diperbarui. Muat ulang halaman sebelum mengubah meja.'},409);
  if (['layout','assign','remove-desk'].includes(action.type) && !snapshot.canEditOffice) return json({ error: 'Hanya admin atau owner yang dapat mengatur meja dan ornamen.' }, 403);
  const teamId = process.env.CLICKUP_WORKSPACE_ID || process.env.CLICKUP_TEAM_ID || '90182855619';
  try {
    const space = await mutateOfficeSpace(teamId, snapshot.members, current => {
      if (action.type === 'activity') return setActivity(current, snapshot.viewerId, action.zone);
      if (action.type === 'claim') return claimDesk(current, snapshot.viewerId, action.slot, snapshot.members.length);
      if (action.type === 'assign') return assignDesk(current,action.memberId,action.slot,snapshot.members.length);
      if (action.type === 'remove-desk') return removeDesk(current,action.slot,snapshot.members.length);
      if (action.layoutRevision !== current.layoutRevision) throw new Error('Denah telah diubah admin lain. Muat denah terbaru sebelum menyimpan.');
      const rooms = spaceCapacity(current, snapshot.members.length) / DESKS_PER_ROOM;
      const desks = parseDesks(action.desks ?? current.desks, rooms);
      if(desks.some(d=>d.removed && !current.desks.some(old=>old.slot===d.slot && old.removed))) throw new Error('Gunakan Hapus objek pada menu meja untuk memindahkan pemiliknya dengan aman.');
      const ornaments = parseOrnaments(action.ornaments, rooms, desks);
      return { ...current, revision: current.revision + 1, layoutRevision: current.layoutRevision + 1, ornaments, desks };
    });
    return json({ space });
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'Perubahan belum tersimpan.' }, 409); }
}
