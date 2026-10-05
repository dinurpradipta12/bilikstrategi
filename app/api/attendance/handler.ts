import { NextRequest, NextResponse } from 'next/server';
import { supabaseRest as supabase } from '@/lib/supabase/rest-client';
import { getServerWorkspaceContext } from '@/lib/auth/server-workspace-context';
import { createSupabaseServerClient } from '@/lib/supabase/server-client';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

function json(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: { 'Cache-Control': 'no-store' } });
}
function fail(error: unknown) {
  return json({ success: false, error: error instanceof Error ? error.message : 'Presensi gagal disimpan.' }, 503);
}
function required<T>(result: { data: T | null; error: any }): T {
  if (result.error) throw new Error(result.error.message || 'Database presensi tidak tersedia.');
  return result.data as T;
}
function activePayload(row: any) {
  return {
    user_name: row.user_name,
    user_avatar: row.user_avatar || '',
    checkInTime: row.check_in_time,
    checkInTimestamp: Number(row.check_in_timestamp),
    isPaused: row.is_paused === true,
    pausedAt: row.paused_at,
    accumulatedSeconds: Number(row.accumulated_seconds || 0),
    selectedProject: row.selected_project,
    notesInput: row.notes_input || '',
  };
}

export async function GET(req: NextRequest) {
  try {
    const context = await getServerWorkspaceContext(req);
    if (!context.isActive) return json({ error: 'Sesi tidak valid.' }, 401);
    const activeOnly = new URL(req.url).searchParams.get('active_only') === '1';
    const sessions = required<any[]>(await supabase.from('active_sessions').select('*')) || [];
    const logs = activeOnly ? [] : required<any[]>(await supabase.from('attendance_logs').select('*').order('created_at', { ascending: false })) || [];
    return json({ success: true, source: 'supabase', activeCheckIns: sessions.map(activePayload), ...(activeOnly ? {} : { history: logs }) });
  } catch (error) { return fail(error); }
}

export async function POST(req: NextRequest) {
  try {
    const context = await getServerWorkspaceContext(req);
    if (!context.isActive || !context.identity.email) return json({ success: false, error: 'Sesi tidak valid.' }, 401);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');
    if (action === 'reset_all') {
      if (context.appRole !== 'owner' || body.confirm !== 'RESET') {
        return json({ success: false, error: 'Hanya Owner yang dapat mereset seluruh presensi.' }, 403);
      }
      const { supabase: sessionClient, applyAuthCookies } = createSupabaseServerClient(req);
      const { error } = await sessionClient.rpc('reset_team_attendance');
      if (error) throw new Error(error.message);
      return applyAuthCookies(json({ success: true }));
    }
    const email = context.identity.email;
    const existing = required<any>(await supabase.from('active_sessions').select('*').eq('user_email', email).maybeSingle());
    const now = Date.now();

    if (action === 'checkin') {
      if (existing) return json({ success: false, error: 'Anda sudah check-in.' }, 409);
      const row = {
        user_email: email,
        user_name: context.identity.name,
        user_avatar: context.identity.avatarUrl,
        check_in_time: new Date(now).toLocaleTimeString('id-ID', { timeZone: context.identity.timezone }),
        check_in_timestamp: now,
        is_paused: false,
        paused_at: null,
        accumulated_seconds: 0,
        selected_project: String(body.selectedProject || 'Team Workspace').slice(0, 240),
        notes_input: String(body.notesInput || '').slice(0, 1000),
        updated_at: new Date(now).toISOString(),
      };
      const saved = required<any[]>(await supabase.from('active_sessions').insert(row).select('*'));
      return json({ success: true, active: activePayload(saved[0]) }, 201);
    }

    if (!existing) return json({ success: false, error: 'Sesi check-in tidak ditemukan.' }, 409);
    if (action === 'pause' || action === 'resume') {
      const paused = existing.is_paused === true;
      if ((action === 'pause') === paused) return json({ success: false, error: 'Status presensi sudah berubah. Muat ulang halaman.' }, 409);
      const running = paused ? 0 : Math.max(0, Math.floor((now - Number(existing.check_in_timestamp)) / 1000));
      const row = {
        is_paused: action === 'pause',
        paused_at: action === 'pause' ? new Date(now).toISOString() : null,
        accumulated_seconds: Number(existing.accumulated_seconds || 0) + running,
        check_in_timestamp: action === 'resume' ? now : Number(existing.check_in_timestamp),
        updated_at: new Date(now).toISOString(),
      };
      const saved = required<any[]>(await supabase.from('active_sessions').update(row).eq('user_email', email).select('*'));
      if (!saved.length) return json({ success: false, error: 'Sesi check-in tidak ditemukan.' }, 409);
      return json({ success: true, active: activePayload(saved[0]) });
    }

    if (action === 'checkout') {
      const record = body.record && typeof body.record === 'object' ? body.record : {};
      const elapsedSeconds = existing.is_paused === true
        ? 0
        : Math.max(0, Math.floor((now - Number(existing.check_in_timestamp)) / 1000));
      const durationHours = Math.round(Math.max(0, Number(existing.accumulated_seconds || 0) + elapsedSeconds) / 36) / 100;
      const regularHours = durationHours < 1 ? 0 : Math.min(durationHours, 8);
      const overtimeHours = durationHours <= 8 ? 0 : Math.round((durationHours - 8) * 100) / 100;
      const status = durationHours < 1 ? 'ALPHA' : overtimeHours > 0 ? 'LEMBUR' : 'HADIR';
      const dateParts = new Intl.DateTimeFormat('en-US', {
        timeZone: context.identity.timezone, year: 'numeric', month: '2-digit', day: '2-digit',
      }).formatToParts(new Date(now));
      const datePart = (type: Intl.DateTimeFormatPartTypes) => dateParts.find((part) => part.type === type)?.value || '';
      const localDate = `${datePart('year')}-${datePart('month')}-${datePart('day')}`;
      const row = {
        id: `att-${crypto.randomUUID()}`,
        user_email: email,
        user_name: context.identity.name,
        user_avatar: context.identity.avatarUrl,
        date: localDate,
        day_name: new Intl.DateTimeFormat('en-US', { timeZone: context.identity.timezone, weekday: 'short' }).format(new Date(now)),
        check_in_time: existing.check_in_time,
        check_out_time: new Date(now).toLocaleTimeString('id-ID', { timeZone: context.identity.timezone }),
        duration_hours: durationHours,
        regular_hours: regularHours,
        overtime_hours: overtimeHours,
        status,
        project_name: existing.selected_project,
        notes: String(record.notes || (status === 'ALPHA' ? 'Alpha: Durasi kerja kurang dari 1 jam' : 'Presensi Harian Kerja')).slice(0, 1000),
        checkout_source: 'self',
      };
      required(await supabase.from('attendance_logs').insert(row));
      const deleted = await supabase.from('active_sessions').delete().eq('user_email', email).select('*');
      if (deleted.error || !Array.isArray(deleted.data) || deleted.data.length === 0) {
        await supabase.from('attendance_logs').delete().eq('id', row.id);
        throw new Error(deleted.error?.message || 'Check-out gagal menghapus sesi aktif.');
      }
      return json({ success: true, record: row });
    }
    return json({ success: false, error: 'Aksi presensi tidak valid.' }, 400);
  } catch (error) { return fail(error); }
}
