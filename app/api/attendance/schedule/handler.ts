import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/clickup/users';
import {
  isSuperuserEmail,
  normalizeAppRole,
  normalizeIdentityEmail,
  type AppRole,
} from '@/lib/auth/app-role';
import { supabaseRest } from '@/lib/supabase/rest-client';
import {
  isSupabaseAdminConfigured,
  supabaseAdminFetch,
} from '@/lib/supabase/admin-rest-client';
import {
  ATTENDANCE_WORKSPACE_KEY,
  DEFAULT_ATTENDANCE_TIMEZONE,
  formatDateYmd,
  getNextWorkingLabel,
  getWorkDayForDate,
  isValidDateYmd,
  normalizeAttendanceSchedule,
  normalizeWorkDays,
  toAttendanceAccessRequest,
  type AttendanceAccessRequest,
  type AttendanceSchedule,
} from '@/lib/attendance/schedule';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type RequestIdentity = {
  email: string;
  name: string;
  appRole: AppRole;
  isAdmin: boolean;
};

function decodeCookie(value: string | undefined) {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeEmail(value: unknown) {
  return normalizeIdentityEmail(value);
}

function noStoreJson(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

function errorResponse(error: unknown, fallback: string, status = 500) {
  const message = error instanceof Error ? error.message : String(error || fallback);
  return noStoreJson({ error: message || fallback }, status);
}

async function resolveIdentity(req: NextRequest): Promise<RequestIdentity> {
  let email = normalizeEmail(decodeCookie(req.cookies.get('clickup_user_email')?.value));
  let name = decodeCookie(req.cookies.get('clickup_user_name')?.value) || 'Pengguna';
  let appRole = normalizeAppRole(decodeCookie(req.cookies.get('clickup_user_role')?.value));

  const accessToken = req.cookies.get('clickup_access_token')?.value;
  if (accessToken && !email) {
    try {
      const authenticated = await getAuthenticatedUser(accessToken);
      const user = authenticated?.user || {};
      email = normalizeEmail(user.email) || email;
      name = String(user.username || name);
      appRole = normalizeAppRole(user.role || appRole);
    } catch {
      // The cookie identity remains usable if ClickUp is temporarily unavailable.
    }
  }

  let isAdmin = false;
  if (email) {
    try {
      const storedRole = await supabaseRest
        .from('app_user_roles')
        .select('role,is_superuser,status')
        .ilike('email', email)
        .maybeSingle();

      if (!storedRole.error && storedRole.data?.status !== 'inactive') {
        appRole = normalizeAppRole(storedRole.data?.role || appRole);
        isAdmin = storedRole.data?.is_superuser === true;
      }
    } catch {
      // The app can still use the ClickUp role while the optional role table is unavailable.
    }
  }

  if (isSuperuserEmail(email)) appRole = 'owner';
  isAdmin = isAdmin || isSuperuserEmail(email) || appRole === 'owner' || appRole === 'admin';

  return { email, name, appRole, isAdmin };
}

async function readSchedule() {
  const result = await supabaseRest
    .from('attendance_work_schedules')
    .select('*')
    .eq('workspace_key', ATTENDANCE_WORKSPACE_KEY)
    .maybeSingle();

  const configured = !result.error && Boolean(result.data);
  const schedule = normalizeAttendanceSchedule(result.data, configured);
  return { schedule, configured, error: result.error };
}

async function readRequest(email: string, requestDate: string): Promise<AttendanceAccessRequest | null> {
  if (!email || !isSupabaseAdminConfigured()) return null;

  const response = await supabaseAdminFetch(
    `attendance_access_requests?select=*&email=eq.${encodeURIComponent(email)}&request_date=eq.${requestDate}`
  );
  if (!response.ok) throw new Error(await response.text());

  const rows = await response.json().catch(() => []);
  return Array.isArray(rows) && rows[0] ? toAttendanceAccessRequest(rows[0]) : null;
}

async function readPendingRequests(): Promise<AttendanceAccessRequest[]> {
  if (!isSupabaseAdminConfigured()) return [];

  const response = await supabaseAdminFetch(
    'attendance_access_requests?select=*&status=eq.pending&order=created_at.desc'
  );
  if (!response.ok) throw new Error(await response.text());

  const rows = await response.json().catch(() => []);
  return Array.isArray(rows) ? rows.map((row) => toAttendanceAccessRequest(row)) : [];
}

function getRequestedDate(value: unknown, timezone: string) {
  const candidate = String(value || '');
  return isValidDateYmd(candidate) ? candidate : formatDateYmd(new Date(), timezone);
}

async function saveSchedule(
  schedule: AttendanceSchedule,
  identity: RequestIdentity
) {
  const response = await supabaseAdminFetch(
    `attendance_work_schedules?on_conflict=workspace_key`,
    {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({
        workspace_key: ATTENDANCE_WORKSPACE_KEY,
        timezone: schedule.timezone || DEFAULT_ATTENDANCE_TIMEZONE,
        days: normalizeWorkDays(schedule.days),
        updated_by_email: identity.email || null,
        updated_by_name: identity.name || null,
        updated_at: new Date().toISOString(),
      }),
    }
  );

  if (!response.ok) throw new Error(await response.text());
  const rows = await response.json().catch(() => []);
  return rows?.[0] ? normalizeAttendanceSchedule(rows[0], true) : schedule;
}

export async function GET(req: NextRequest) {
  try {
    const identity = await resolveIdentity(req);
    const { searchParams } = new URL(req.url);
    const includeRequests = searchParams.get('include_requests') === '1';
    const { schedule, configured } = await readSchedule();
    const date = getRequestedDate(searchParams.get('date'), schedule.timezone);
    const workDay = getWorkDayForDate(schedule, date);
    const isHoliday = configured && workDay?.isWorking !== true;
    const accessControlReady = configured && isSupabaseAdminConfigured();
    const request = !identity.isAdmin && accessControlReady
      ? await readRequest(identity.email, date)
      : null;
    const allowed =
      identity.isAdmin ||
      !isHoliday ||
      !accessControlReady ||
      request?.status === 'approved';

    let requests: AttendanceAccessRequest[] = [];
    if (identity.isAdmin && includeRequests && accessControlReady) {
      requests = await readPendingRequests();
    }

    return noStoreJson({
      success: true,
      storage_ready: configured,
      access_control_ready: accessControlReady,
      schedule,
      access: {
        is_admin: identity.isAdmin,
        date,
        is_holiday: isHoliday,
        allowed,
        request_status: identity.isAdmin ? 'approved' : request?.status || 'none',
        request,
        next_working_label: getNextWorkingLabel(schedule, date),
      },
      requests,
    });
  } catch (error) {
    return errorResponse(
      error,
      'Gagal memuat pengaturan hari kerja. Jalankan migration presensi dan pastikan environment Supabase server sudah tersedia.'
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const identity = await resolveIdentity(req);
    if (!identity.isAdmin) {
      return noStoreJson({ error: 'Hanya Admin atau Owner yang dapat mengatur hari dan jam kerja.' }, 403);
    }
    if (!isSupabaseAdminConfigured()) {
      return noStoreJson({ error: 'SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi di environment server.' }, 503);
    }

    const body = await req.json().catch(() => ({}));
    const timezone = String(body.timezone || DEFAULT_ATTENDANCE_TIMEZONE).trim() || DEFAULT_ATTENDANCE_TIMEZONE;
    const schedule: AttendanceSchedule = {
      workspaceKey: ATTENDANCE_WORKSPACE_KEY,
      timezone,
      days: normalizeWorkDays(body.days),
      updatedAt: new Date().toISOString(),
      configured: true,
    };
    const saved = await saveSchedule(schedule, identity);
    return noStoreJson({ success: true, schedule: saved });
  } catch (error) {
    return errorResponse(error, 'Gagal menyimpan hari dan jam kerja ke Supabase.');
  }
}

export async function POST(req: NextRequest) {
  try {
    const identity = await resolveIdentity(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'request_access');
    const { schedule } = await readSchedule();

    if (!isSupabaseAdminConfigured()) {
      return noStoreJson({ error: 'SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi di environment server.' }, 503);
    }

    if (action === 'request_access') {
      if (!identity.email) {
        return noStoreJson({ error: 'Identitas akun belum terbaca. Silakan login ulang.' }, 401);
      }

      const requestDate = getRequestedDate(body.request_date || body.date, schedule.timezone);
      const reason = String(body.reason || '').trim();
      if (!reason) return noStoreJson({ error: 'Alasan izin wajib diisi.' }, 400);
      if (reason.length > 1000) return noStoreJson({ error: 'Alasan izin maksimal 1000 karakter.' }, 400);

      const existing = await readRequest(identity.email, requestDate);
      if (existing?.status === 'approved' || existing?.status === 'pending') {
        return noStoreJson({ success: true, request: existing });
      }

      const payload = {
        email: identity.email,
        display_name: identity.name || identity.email.split('@')[0],
        request_date: requestDate,
        reason,
        status: 'pending',
        reviewed_by_email: null,
        reviewed_by_name: null,
        reviewed_at: null,
        updated_at: new Date().toISOString(),
      };

      const response = existing
        ? await supabaseAdminFetch(`attendance_access_requests?id=eq.${encodeURIComponent(existing.id)}`, {
            method: 'PATCH',
            headers: { Prefer: 'return=representation' },
            body: JSON.stringify(payload),
          })
        : await supabaseAdminFetch('attendance_access_requests', {
            method: 'POST',
            headers: { Prefer: 'return=representation' },
            body: JSON.stringify(payload),
          });

      if (!response.ok) throw new Error(await response.text());
      const rows = await response.json().catch(() => []);
      const savedRequest = Array.isArray(rows) ? rows[0] : rows;
      return noStoreJson({ success: true, request: savedRequest ? toAttendanceAccessRequest(savedRequest) : null });
    }

    if (action === 'review_request') {
      if (!identity.isAdmin) {
        return noStoreJson({ error: 'Hanya Admin atau Owner yang dapat memproses permintaan izin.' }, 403);
      }

      const requestId = String(body.request_id || body.id || '').trim();
      const status = body.status === 'approved' || body.status === 'rejected' ? body.status : null;
      if (!requestId || !status) {
        return noStoreJson({ error: 'ID permintaan dan status persetujuan wajib diisi.' }, 400);
      }

      const response = await supabaseAdminFetch(`attendance_access_requests?id=eq.${encodeURIComponent(requestId)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          status,
          reviewed_by_email: identity.email || null,
          reviewed_by_name: identity.name || null,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });

      if (!response.ok) throw new Error(await response.text());
      const rows = await response.json().catch(() => []);
      const savedRequest = Array.isArray(rows) ? rows[0] : rows;
      return noStoreJson({ success: true, request: savedRequest ? toAttendanceAccessRequest(savedRequest) : null });
    }

    return noStoreJson({ error: `Action tidak dikenal: ${action}` }, 400);
  } catch (error) {
    return errorResponse(error, 'Gagal memproses permintaan akses presensi.');
  }
}
