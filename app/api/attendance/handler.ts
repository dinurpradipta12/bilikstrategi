import { NextResponse } from 'next/server';
import { supabaseRest as supabase } from '@/lib/supabase/rest-client';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export interface ActiveCheckIn {
  user_name: string;
  user_avatar?: string;
  checkInTime: string;
  checkInTimestamp: number;
  isPaused?: boolean;
  pausedAt?: string | null;
  accumulatedSeconds?: number;
  selectedProject: string;
  notesInput: string;
}

function textValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

// In-memory fallback
const globalActiveCheckIns = new Map<string, ActiveCheckIn>();
const globalAttendanceHistory: Array<Record<string, unknown>> = [];

export async function GET(req?: Request) {
  const activeOnly = req
    ? new URL(req.url).searchParams.get('active_only') === '1'
    : false;

  try {
    // 1. Fetch active sessions from Supabase DB
    const { data: dbSessions } = await supabase.from('active_sessions').select('*');

    // The global floating control only needs active sessions. Avoid repeatedly
    // loading the complete history while it polls in the background.
    const { data: dbLogs } = activeOnly
      ? { data: [] }
      : await supabase
          .from('attendance_logs')
          .select('*')
          .order('created_at', { ascending: false });

    const activeRows = Array.isArray(dbSessions) ? dbSessions : [];
    const logRows = Array.isArray(dbLogs) ? dbLogs : [];

    const activeList: ActiveCheckIn[] = activeRows.map((row: Record<string, unknown>) => ({
      user_name: textValue(row.user_name),
      user_avatar: textValue(row.user_avatar),
      checkInTime: textValue(row.check_in_time),
      checkInTimestamp: Number(row.check_in_timestamp),
      isPaused: row.is_paused === true,
      pausedAt: textValue(row.paused_at) || null,
      accumulatedSeconds: Number(row.accumulated_seconds || 0),
      selectedProject: textValue(row.selected_project),
      notesInput: textValue(row.notes_input),
    }));

    const historyList = activeOnly
      ? undefined
      : logRows.length > 0
        ? logRows
        : globalAttendanceHistory;

    return NextResponse.json(
      {
        success: true,
        source: 'supabase',
        activeCheckIns: activeList,
        ...(activeOnly ? {} : { history: historyList }),
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (e) {
    console.warn('[Attendance API] Supabase GET fallback to memory', e);
  }

  // Fallback to memory
  const activeList = Array.from(globalActiveCheckIns.values());
  return NextResponse.json(
    {
      success: true,
      source: 'memory',
      activeCheckIns: activeList,
      ...(activeOnly ? {} : { history: globalAttendanceHistory }),
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    }
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      action,
      user_name,
      user_avatar,
      selectedProject,
      notesInput,
      checkInTime,
      checkInTimestamp,
      record,
    } = body;

    // Reset All Attendance History Across All Users (Admin Feature)
    if (action === 'reset_all') {
      globalAttendanceHistory.length = 0;
      globalActiveCheckIns.clear();

      try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://spnawjvexcwhhyfavvew.supabase.co';
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwbmF3anZleGN3aGh5ZmF2dmV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNjU1NDgsImV4cCI6MjEwMDk0MTU0OH0.IYNTrKH7s5aTBcRREiBgq1SOw5ONBcP0uxWpC_tSznU';

        // Delete all rows from attendance_logs and active_sessions
        await fetch(`${url}/rest/v1/attendance_logs?created_at=gt.1970-01-01T00:00:00Z`, {
          method: 'DELETE',
          headers: { apikey: key, Authorization: `Bearer ${key}` },
        }).catch(() => {});

        await fetch(`${url}/rest/v1/active_sessions?updated_at=gt.1970-01-01T00:00:00Z`, {
          method: 'DELETE',
          headers: { apikey: key, Authorization: `Bearer ${key}` },
        }).catch(() => {});

        await supabase.from('attendance_logs').delete().gt('created_at', '1970-01-01T00:00:00Z');
        await supabase.from('active_sessions').delete().gt('updated_at', '1970-01-01T00:00:00Z');
      } catch (dbErr) {
        console.warn('[Attendance API] Supabase reset_all error', dbErr);
      }

      return NextResponse.json({ success: true, message: 'All attendance history reset successfully' });
    }

    if (!user_name) {
      return NextResponse.json({ success: false, error: 'User name is required' }, { status: 400 });
    }

    const key = user_name.trim().toLowerCase();

    if (action === 'checkin') {
      const activeObj: ActiveCheckIn = {
        user_name,
        user_avatar,
        checkInTime: checkInTime || new Date().toLocaleTimeString('id-ID'),
        checkInTimestamp: checkInTimestamp || Date.now(),
        isPaused: false,
        pausedAt: null,
        accumulatedSeconds: 0,
        selectedProject: selectedProject || 'Bilik Strategi Workspace',
        notesInput: notesInput || '',
      };

      globalActiveCheckIns.set(key, activeObj);

      // Write to Supabase DB active_sessions
      try {
        await supabase.from('active_sessions').upsert({
          user_name: user_name,
          user_avatar: user_avatar || '',
          check_in_time: activeObj.checkInTime,
          check_in_timestamp: activeObj.checkInTimestamp,
          is_paused: false,
          paused_at: null,
          accumulated_seconds: 0,
          selected_project: activeObj.selectedProject,
          notes_input: activeObj.notesInput,
          updated_at: new Date().toISOString(),
        });
      } catch (dbErr) {
        console.warn('[Attendance API] Supabase checkin error', dbErr);
      }

      return NextResponse.json({ success: true, active: activeObj });
    }

    if (action === 'pause' || action === 'resume') {
      // The server is the source of truth for accumulated time. This prevents
      // two tabs/devices from counting the same running interval twice.
      const { data: currentRow, error: currentRowError } = await supabase
        .from('active_sessions')
        .select('*')
        .ilike('user_name', user_name)
        .maybeSingle();

      if (currentRowError) {
        throw new Error(currentRowError.message || 'Active session could not be loaded');
      }

      if (!currentRow) {
        return NextResponse.json(
          { success: false, error: 'Active attendance session was not found' },
          { status: 409 }
        );
      }

      const now = Date.now();
      const storedTimestamp = Number(currentRow?.check_in_timestamp || checkInTimestamp || 0);
      const storedAccumulated = Number(currentRow?.accumulated_seconds || 0);
      const storedIsPaused = currentRow?.is_paused === true;
      const runningSeconds = !storedIsPaused && storedTimestamp
        ? Math.max(0, Math.floor((now - storedTimestamp) / 1000))
        : 0;
      const currentTotalSeconds = storedAccumulated + runningSeconds;
      const nextIsPaused = action === 'pause';
      const nextAccumulatedSeconds = currentTotalSeconds;
      const nextTimestamp = nextIsPaused
        ? storedTimestamp || Number(checkInTimestamp || now)
        : now;
      const nextPausedAt = nextIsPaused ? new Date(now).toISOString() : null;

      const activeObj: ActiveCheckIn = {
        user_name: currentRow?.user_name || user_name,
        user_avatar: currentRow?.user_avatar || user_avatar || '',
        checkInTime: currentRow?.check_in_time || checkInTime || new Date(nextTimestamp).toLocaleTimeString('id-ID'),
        checkInTimestamp: nextTimestamp,
        isPaused: nextIsPaused,
        pausedAt: nextPausedAt,
        accumulatedSeconds: nextAccumulatedSeconds,
        selectedProject: currentRow?.selected_project || selectedProject || 'Bilik Strategi Workspace',
        notesInput: currentRow?.notes_input || notesInput || '',
      };

      globalActiveCheckIns.set(key, activeObj);

      const { error: upsertError } = await supabase.from('active_sessions').upsert({
        user_name: activeObj.user_name,
        user_avatar: activeObj.user_avatar || '',
        check_in_time: activeObj.checkInTime,
        check_in_timestamp: activeObj.checkInTimestamp,
        is_paused: activeObj.isPaused,
        paused_at: activeObj.pausedAt || null,
        accumulated_seconds: activeObj.accumulatedSeconds || 0,
        selected_project: activeObj.selectedProject,
        notes_input: activeObj.notesInput,
        updated_at: new Date().toISOString(),
      });

      if (upsertError) {
        throw new Error(upsertError.message || 'Active session could not be saved');
      }

      return NextResponse.json({ success: true, active: activeObj });
    }

    if (action === 'checkout') {
      globalActiveCheckIns.delete(key);
      if (record) {
        globalAttendanceHistory.unshift(record);
      }

      // Delete from Supabase DB active_sessions & insert into attendance_logs
      try {
        await supabase.from('active_sessions').delete().ilike('user_name', user_name);

        if (record) {
          await supabase.from('attendance_logs').insert({
            id: record.id || 'att-' + Date.now(),
            user_name: record.user_name,
            user_avatar: record.user_avatar,
            date: record.date,
            day_name: record.day_name,
            check_in_time: record.check_in_time,
            check_out_time: record.check_out_time,
            duration_hours: record.duration_hours,
            regular_hours: record.regular_hours,
            overtime_hours: record.overtime_hours,
            status: record.status,
            project_name: record.project_name,
            notes: record.notes,
          });
        }
      } catch (dbErr) {
        console.warn('[Attendance API] Supabase checkout error', dbErr);
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Attendance action failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
