import { NextRequest, NextResponse } from 'next/server';
import { getServerWorkspaceContext } from '@/lib/auth/server-workspace-context';
import { normalizeIdentityEmail } from '@/lib/auth/app-role';
import { getAuthenticatedUser } from '@/lib/clickup/users';
import {
  isSupabaseAdminConfigured,
  supabaseAdminFetch,
} from '@/lib/supabase/admin-rest-client';
import { pageLabelForPath } from '@/lib/attendance/presence';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ActiveSessionRow = Record<string, unknown>;
type PresenceStateRow = Record<string, unknown>;

type VerifiedIdentity = {
  email: string;
  name: string;
  avatarUrl: string;
};

const verifiedIdentityCache = new Map<string, VerifiedIdentity & { expiresAt: number }>();
const VERIFIED_IDENTITY_CACHE_MS = 10 * 60 * 1000;

function noStoreJson(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

function text(value: unknown, maxLength = 240) {
  return String(value || '').trim().slice(0, maxLength);
}

function normalizeIdentity(value: unknown) {
  return text(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function emailValue(value: unknown) {
  const candidate = text(value, 320).toLowerCase();
  return candidate.includes('@') ? candidate : '';
}

function isoTimestamp(value: unknown, now: number) {
  const parsed = Date.parse(text(value, 80));
  if (!Number.isFinite(parsed)) return new Date(now).toISOString();
  const clamped = Math.min(now + 60_000, Math.max(now - 24 * 60 * 60 * 1000, parsed));
  return new Date(clamped).toISOString();
}

function cleanPath(value: unknown) {
  const candidate = text(value, 240);
  return candidate.startsWith('/') && !candidate.startsWith('//') ? candidate : '/dashboard';
}

async function tokenFingerprint(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function getVerifiedIdentity(req: NextRequest): Promise<VerifiedIdentity | null> {
  const accessToken = req.cookies.get('clickup_access_token')?.value;
  if (!accessToken) return null;

  const fingerprint = await tokenFingerprint(accessToken);
  const cached = verifiedIdentityCache.get(fingerprint);
  if (cached && cached.expiresAt > Date.now()) {
    return { email: cached.email, name: cached.name, avatarUrl: cached.avatarUrl };
  }

  try {
    const authenticated = await getAuthenticatedUser(accessToken);
    const user = authenticated?.user;
    const email = normalizeIdentityEmail(user?.email);
    if (!email) return null;

    const identity = {
      email,
      name: text(user?.username, 180) || email.split('@')[0] || 'Pengguna',
      avatarUrl: text(user?.profilePicture, 1000),
    };
    if (verifiedIdentityCache.size >= 100) {
      const now = Date.now();
      for (const [key, entry] of verifiedIdentityCache) {
        if (entry.expiresAt <= now) verifiedIdentityCache.delete(key);
      }
      if (verifiedIdentityCache.size >= 100) {
        const oldestKey = verifiedIdentityCache.keys().next().value;
        if (oldestKey) verifiedIdentityCache.delete(oldestKey);
      }
    }
    verifiedIdentityCache.set(fingerprint, {
      ...identity,
      expiresAt: Date.now() + VERIFIED_IDENTITY_CACHE_MS,
    });
    return identity;
  } catch {
    verifiedIdentityCache.delete(fingerprint);
    return null;
  }
}

async function getVerifiedWorkspaceContext(req: NextRequest) {
  const verifiedIdentity = await getVerifiedIdentity(req);
  if (!verifiedIdentity) return null;

  const context = await getServerWorkspaceContext(req);
  if (context.identity.email && context.identity.email !== verifiedIdentity.email) return null;

  return {
    ...context,
    identity: verifiedIdentity,
  };
}

async function responseRows(response: Response) {
  const payload = await response.json().catch(() => []);
  return Array.isArray(payload) ? payload : [];
}

async function readActiveSessions() {
  const response = await supabaseAdminFetch('active_sessions?select=*');
  if (!response.ok) throw new Error(await response.text());
  return responseRows(response);
}

async function readPresenceStates(workspaceId: string) {
  const response = await supabaseAdminFetch(
    `attendance_presence_state?select=*&workspace_id=eq.${encodeURIComponent(workspaceId)}&order=updated_at.desc`,
  );
  if (!response.ok) return { rows: [] as PresenceStateRow[], storageReady: false };
  return { rows: await responseRows(response) as PresenceStateRow[], storageReady: true };
}

async function readExistingForcedCheckout(
  userEmail: string,
  userName: string,
  date: string,
  checkInTime: string,
) {
  const identityFilter = userEmail
    ? `user_email=eq.${encodeURIComponent(userEmail)}`
    : userName
      ? `user_name=eq.${encodeURIComponent(userName)}`
      : '';
  if (!identityFilter || !date || !checkInTime) {
    return { record: null as ActiveSessionRow | null, storageReady: false };
  }

  const response = await supabaseAdminFetch(
    `attendance_logs?select=*&checkout_source=eq.admin&date=eq.${encodeURIComponent(date)}` +
      `&check_in_time=eq.${encodeURIComponent(checkInTime)}&${identityFilter}` +
      '&order=created_at.desc&limit=1',
  );
  if (!response.ok) return { record: null as ActiveSessionRow | null, storageReady: false };

  const rows = await responseRows(response);
  return {
    record: (rows[0] || null) as ActiveSessionRow | null,
    storageReady: true,
  };
}

function sessionMatchesIdentity(row: ActiveSessionRow, email: string, name: string) {
  const rowEmail = emailValue(row.user_email);
  if (rowEmail && email && rowEmail === email) return true;

  const rowName = normalizeIdentity(row.user_name);
  const identityName = normalizeIdentity(name);
  const emailPrefix = normalizeIdentity(email.split('@')[0]);
  return Boolean(rowName && (
    rowName === identityName ||
    rowName === emailPrefix ||
    (rowName.length > 3 && identityName.includes(rowName)) ||
    (identityName.length > 3 && rowName.includes(identityName))
  ));
}

function sessionFilter(row: ActiveSessionRow) {
  const email = emailValue(row.user_email);
  const rawUserName = String(row.user_name || '').slice(0, 180);
  const checkInTimestamp = Number(row.check_in_timestamp || 0);
  const filters: string[] = [];

  if (email) filters.push(`user_email=eq.${encodeURIComponent(email)}`);

  // Keep the value exactly as stored in Supabase. ClickUp usernames can contain
  // trailing whitespace; trimming it here makes PostgREST successfully delete
  // zero rows while still returning a 204 response.
  if (rawUserName) filters.push(`user_name=eq.${encodeURIComponent(rawUserName)}`);
  if (Number.isFinite(checkInTimestamp) && checkInTimestamp > 0) {
    filters.push(`check_in_timestamp=eq.${checkInTimestamp}`);
  }

  return filters.join('&');
}

function presenceMatchesSession(presence: PresenceStateRow, session: ActiveSessionRow) {
  const presenceName = normalizeIdentity(presence.user_name);
  const sessionName = normalizeIdentity(session.user_name);
  const presenceTimestamp = Number(presence.session_check_in_timestamp || 0);
  const sessionTimestamp = Number(session.check_in_timestamp || 0);

  if (presenceTimestamp && sessionTimestamp) return presenceTimestamp === sessionTimestamp;
  return Boolean(presenceName && sessionName && presenceName === sessionName);
}

async function deletePresenceState(userEmail: string) {
  if (!userEmail) return true;
  const response = await supabaseAdminFetch(
    `attendance_presence_state?user_email=eq.${encodeURIComponent(userEmail)}`,
    { method: 'DELETE', headers: { Prefer: 'return=minimal' } },
  );
  return response.ok;
}

async function insertActivityEvent(payload: Record<string, unknown>) {
  const response = await supabaseAdminFetch('attendance_activity_events', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(payload),
  });
  return response.ok;
}

function localDateParts(date: Date) {
  const timeZone = 'Asia/Makassar';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value || '';

  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    dayName: new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date),
    time: new Intl.DateTimeFormat('id-ID', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date),
  };
}

async function handleHeartbeat(req: NextRequest, body: Record<string, unknown>) {
  const context = await getVerifiedWorkspaceContext(req);
  if (!context) {
    return noStoreJson({ error: 'Sesi ClickUp tidak valid. Silakan login ulang.' }, 401);
  }
  if (!isSupabaseAdminConfigured()) {
    return noStoreJson({ tracking: false, storage_ready: false }, 503);
  }

  const sessions = await readActiveSessions();
  const session = sessions.find((row) => sessionMatchesIdentity(
    row,
    context.identity.email,
    context.identity.name,
  ));

  if (!session) {
    await deletePresenceState(context.identity.email).catch(() => false);
    return noStoreJson({ success: true, tracking: false, storage_ready: true });
  }

  const now = Date.now();
  const currentPath = cleanPath(body.current_path);
  const pageLabel = text(body.current_page_label, 120) || pageLabelForPath(currentPath);
  const eventType = ['page_view', 'interaction'].includes(text(body.event_type, 30))
    ? text(body.event_type, 30)
    : 'heartbeat';
  const presenceResponse = await supabaseAdminFetch(
    `attendance_presence_state?select=*&user_email=eq.${encodeURIComponent(context.identity.email)}&limit=1`,
  );
  const existingPresence = presenceResponse.ok
    ? (await responseRows(presenceResponse))[0] || {}
    : {};
  const previousPath = text(existingPresence.current_path, 240);
  const incomingActivityAt = isoTimestamp(body.last_activity_at, now);
  const existingActivityMs = Date.parse(text(existingPresence.last_activity_at, 80));
  const incomingActivityMs = Date.parse(incomingActivityAt);
  const activityAt = new Date(Math.max(
    Number.isFinite(existingActivityMs) ? Math.min(now + 60_000, existingActivityMs) : 0,
    incomingActivityMs,
  )).toISOString();
  const isAppActive = body.is_app_active === true;
  const existingForegroundAt = text(existingPresence.last_foreground_at, 80) || null;
  const presencePayload = {
    workspace_id: context.workspaceId,
    user_email: context.identity.email,
    user_name: context.identity.name,
    session_check_in_timestamp: Number(session.check_in_timestamp || 0) || null,
    last_seen_at: new Date(now).toISOString(),
    last_activity_at: activityAt,
    last_foreground_at: isAppActive ? new Date(now).toISOString() : existingForegroundAt,
    current_path: isAppActive ? currentPath : previousPath || currentPath,
    current_page_label: isAppActive
      ? pageLabel
      : text(existingPresence.current_page_label, 120) || pageLabel,
    device_type: isAppActive
      ? text(body.device_type, 24) || 'unknown'
      : text(existingPresence.device_type, 24) || text(body.device_type, 24) || 'unknown',
    app_mode: isAppActive
      ? text(body.app_mode, 24) || 'browser'
      : text(existingPresence.app_mode, 24) || text(body.app_mode, 24) || 'browser',
    updated_at: new Date(now).toISOString(),
  };

  const updateResponse = await supabaseAdminFetch(
    'attendance_presence_state?on_conflict=user_email',
    {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(presencePayload),
    },
  );

  if (!updateResponse.ok) {
    return noStoreJson({
      success: false,
      tracking: false,
      storage_ready: false,
      migration_required: true,
    }, 503);
  }

  let eventStored = true;
  if ((eventType === 'page_view' && previousPath !== currentPath) || eventType === 'interaction') {
    eventStored = await insertActivityEvent({
      workspace_id: context.workspaceId,
      user_email: context.identity.email,
      user_name: context.identity.name,
      session_check_in_timestamp: Number(session.check_in_timestamp || 0) || null,
      event_type: eventType,
      page_path: currentPath,
      page_label: pageLabel,
      device_type: presencePayload.device_type,
      app_mode: presencePayload.app_mode,
      metadata: {
        visibility: text(body.visibility, 20) || 'unknown',
      },
      created_at: new Date(now).toISOString(),
    });
  }

  return noStoreJson({
    success: true,
    tracking: true,
    storage_ready: eventStored,
    last_seen_at: presencePayload.last_seen_at,
    last_activity_at: activityAt,
  });
}

async function handleForceCheckout(req: NextRequest, body: Record<string, unknown>) {
  const context = await getVerifiedWorkspaceContext(req);
  if (!context) return noStoreJson({ error: 'Sesi ClickUp tidak valid. Silakan login ulang.' }, 401);
  if (!context.canManage) {
    return noStoreJson({ error: 'Hanya Admin atau Owner yang dapat melakukan checkout paksa.' }, 403);
  }
  if (!isSupabaseAdminConfigured()) {
    return noStoreJson({ error: 'SUPABASE_SERVICE_ROLE_KEY belum tersedia di server.' }, 503);
  }

  const targetEmail = emailValue(body.target_email);
  const targetName = text(body.target_user_name, 180);
  const sessions = await readActiveSessions();
  const session = sessions.find((row) => {
    const rowEmail = emailValue(row.user_email);
    if (targetEmail && rowEmail === targetEmail) return true;
    return normalizeIdentity(row.user_name) === normalizeIdentity(targetName);
  });

  if (!session) return noStoreJson({ error: 'Sesi presensi aktif tidak ditemukan.' }, 409);

  const presenceStateResult = await readPresenceStates(context.workspaceId);
  const presenceState = presenceStateResult.rows.find((row) => {
    const rowEmail = emailValue(row.user_email);
    if (targetEmail && rowEmail === targetEmail) return true;
    return presenceMatchesSession(row, session);
  }) || {};

  const now = Date.now();
  const lastActivityMs = Date.parse(text(presenceState.last_activity_at, 80));
  const useLastActivity = body.checkout_at === 'last_activity' && Number.isFinite(lastActivityMs);
  const checkoutAtMs = useLastActivity ? Math.min(now, lastActivityMs) : now;
  const segmentStartedAt = Number(session.check_in_timestamp || 0);
  const accumulatedSeconds = Math.max(0, Number(session.accumulated_seconds || 0));
  const runningSeconds = session.is_paused === true || !segmentStartedAt
    ? 0
    : Math.max(0, Math.floor((checkoutAtMs - segmentStartedAt) / 1000));
  const totalSeconds = accumulatedSeconds + runningSeconds;
  const durationHours = Number((totalSeconds / 3600).toFixed(2));
  const status = durationHours < 1 ? 'ALPHA' : durationHours > 8 ? 'LEMBUR' : 'HADIR';
  const regularHours = durationHours < 1 ? 0 : Math.min(8, durationHours);
  const overtimeHours = durationHours > 8 ? Number((durationHours - 8).toFixed(2)) : 0;
  const checkoutAt = new Date(checkoutAtMs);
  const local = localDateParts(checkoutAt);
  const reason = text(body.reason, 320) || 'Sesi dihentikan oleh admin.';
  const inactivitySeconds = Number.isFinite(lastActivityMs)
    ? Math.max(0, Math.floor((now - lastActivityMs) / 1000))
    : null;
  const targetUserName = text(session.user_name, 180) || targetName || 'Anggota tim';
  const targetUserEmail = emailValue(session.user_email) ||
    targetEmail ||
    emailValue(presenceState.user_email);
  const recordId = `att-admin-${crypto.randomUUID()}`;
  const auditNote = [
    text(session.notes_input, 700) || 'Presensi Harian Kerja',
    `Checkout paksa oleh ${context.identity.name}.`,
    `Alasan: ${reason}`,
    useLastActivity ? 'Waktu checkout menggunakan aktivitas aplikasi terakhir.' : 'Waktu checkout menggunakan waktu tindakan admin.',
  ].join(' ');

  const baseRecord = {
    id: recordId,
    user_name: targetUserName,
    user_avatar: text(session.user_avatar, 1000),
    date: local.date,
    day_name: local.dayName,
    check_in_time: text(session.check_in_time, 40) || '-',
    check_out_time: local.time,
    duration_hours: durationHours,
    regular_hours: regularHours,
    overtime_hours: overtimeHours,
    status,
    project_name: text(session.selected_project, 240) || 'Bilik Strategi Workspace',
    notes: auditNote,
  };
  const extendedRecord = {
    ...baseRecord,
    user_email: targetUserEmail || null,
    checkout_source: 'admin',
    checkout_by_email: context.identity.email,
    checkout_by_name: context.identity.name,
    checkout_reason: reason,
    inactivity_seconds: inactivitySeconds,
  };

  const existingCheckout = await readExistingForcedCheckout(
    targetUserEmail,
    targetUserName,
    local.date,
    baseRecord.check_in_time,
  );
  let storedRecord: ActiveSessionRow = existingCheckout.record || extendedRecord;
  let extendedStorageReady = existingCheckout.storageReady;
  let historyCreatedThisRequest = false;

  if (!existingCheckout.record) {
    let historyResponse = await supabaseAdminFetch('attendance_logs', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(extendedRecord),
    });
    extendedStorageReady = historyResponse.ok;

    if (!historyResponse.ok) {
      historyResponse = await supabaseAdminFetch('attendance_logs', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(baseRecord),
      });
    }

    if (!historyResponse.ok) {
      return noStoreJson({ error: 'Riwayat checkout gagal disimpan; sesi tidak dihapus.' }, 502);
    }
    historyCreatedThisRequest = true;
    storedRecord = extendedStorageReady ? extendedRecord : baseRecord;
  }

  const activeSessionFilter = sessionFilter(session);
  if (!activeSessionFilter) {
    if (historyCreatedThisRequest) {
      await supabaseAdminFetch(
        `attendance_logs?id=eq.${encodeURIComponent(recordId)}`,
        { method: 'DELETE', headers: { Prefer: 'return=minimal' } },
      ).catch(() => null);
    }
    return noStoreJson({ error: 'Identitas sesi aktif tidak lengkap; checkout dibatalkan.' }, 409);
  }
  const deleteResponse = await supabaseAdminFetch(
    `active_sessions?${activeSessionFilter}`,
    { method: 'DELETE', headers: { Prefer: 'return=representation' } },
  );
  const deletedSessions = deleteResponse.ok ? await responseRows(deleteResponse) : [];
  if (!deleteResponse.ok || deletedSessions.length === 0) {
    // Do not leave a false checkout record behind when Supabase accepted the
    // DELETE request but its filter did not match an active session.
    if (historyCreatedThisRequest) {
      await supabaseAdminFetch(
        `attendance_logs?id=eq.${encodeURIComponent(recordId)}`,
        { method: 'DELETE', headers: { Prefer: 'return=minimal' } },
      ).catch(() => null);
    }
    return noStoreJson({
      error: 'Sesi aktif tidak berhasil dihapus dari Supabase. Silakan muat ulang lalu coba lagi.',
    }, 502);
  }

  const eventStored = await insertActivityEvent({
    workspace_id: context.workspaceId,
    user_email: targetUserEmail || 'unknown',
    user_name: targetUserName,
    session_check_in_timestamp: Number(session.check_in_timestamp || 0) || null,
    event_type: 'forced_checkout',
    page_path: text(presenceState.current_path, 240) || null,
    page_label: text(presenceState.current_page_label, 120) || null,
    device_type: text(presenceState.device_type, 24) || null,
    app_mode: text(presenceState.app_mode, 24) || null,
    metadata: {
      admin_email: context.identity.email,
      admin_name: context.identity.name,
      reason,
      checkout_at: useLastActivity ? 'last_activity' : 'now',
      duration_hours: durationHours,
      inactivity_seconds: inactivitySeconds,
    },
    created_at: new Date(now).toISOString(),
  });

  await deletePresenceState(targetUserEmail || emailValue(presenceState.user_email)).catch(() => false);

  return noStoreJson({
    success: true,
    record: storedRecord,
    activity_storage_ready: extendedStorageReady && eventStored,
  });
}

export async function GET(req: NextRequest) {
  try {
    const context = await getVerifiedWorkspaceContext(req);
    if (!context) return noStoreJson({ error: 'Sesi ClickUp tidak valid. Silakan login ulang.' }, 401);
    if (!context.canManage) {
      return noStoreJson({ error: 'Hanya Admin atau Owner yang dapat melihat log aktivitas.' }, 403);
    }
    if (!isSupabaseAdminConfigured()) {
      return noStoreJson({ events: [], storage_ready: false }, 503);
    }

    if (req.nextUrl.searchParams.get('view') === 'statuses') {
      const [sessions, presenceResult] = await Promise.all([
        readActiveSessions(),
        readPresenceStates(context.workspaceId),
      ]);
      const activePresence = presenceResult.rows.filter((presence) =>
        sessions.some((session) => presenceMatchesSession(presence, session)),
      );
      return noStoreJson({
        success: true,
        storage_ready: presenceResult.storageReady,
        presences: activePresence,
      });
    }

    const email = emailValue(req.nextUrl.searchParams.get('user_email'));
    const name = text(req.nextUrl.searchParams.get('user_name'), 180);
    if (!email && !name) return noStoreJson({ error: 'User target wajib dipilih.' }, 400);

    const filter = email
      ? `user_email=eq.${encodeURIComponent(email)}`
      : `user_name=ilike.${encodeURIComponent(name)}`;
    const response = await supabaseAdminFetch(
      `attendance_activity_events?select=id,user_email,user_name,event_type,page_path,page_label,device_type,app_mode,metadata,created_at&${filter}&order=created_at.desc&limit=30`,
    );

    if (!response.ok) {
      return noStoreJson({ events: [], storage_ready: false, migration_required: true });
    }

    return noStoreJson({ success: true, storage_ready: true, events: await responseRows(response) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal memuat aktivitas pengguna.';
    return noStoreJson({ error: message }, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = text(body.action, 40) || 'heartbeat';
    if (action === 'heartbeat') return handleHeartbeat(req, body);
    if (action === 'force_checkout') return handleForceCheckout(req, body);
    return noStoreJson({ error: 'Aksi presence tidak dikenali.' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Presence action failed.';
    return noStoreJson({ error: message }, 500);
  }
}
