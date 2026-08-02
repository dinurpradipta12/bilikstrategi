import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export interface ActiveCheckIn {
  user_name: string;
  user_avatar?: string;
  checkInTime: string;
  checkInTimestamp: number;
  selectedProject: string;
  notesInput: string;
}

// In-memory fallback
const globalActiveCheckIns = new Map<string, ActiveCheckIn>();
const globalAttendanceHistory: any[] = [];

export async function GET() {
  try {
    // 1. Fetch active sessions from Supabase DB
    const { data: dbSessions } = await supabase.from('active_sessions').select('*');

    // 2. Fetch all completed attendance logs from Supabase DB
    const { data: dbLogs } = await supabase
      .from('attendance_logs')
      .select('*')
      .order('created_at', { ascending: false });

    const activeList: ActiveCheckIn[] = (dbSessions || []).map((row) => ({
      user_name: row.user_name,
      user_avatar: row.user_avatar,
      checkInTime: row.check_in_time,
      checkInTimestamp: Number(row.check_in_timestamp),
      selectedProject: row.selected_project,
      notesInput: row.notes_input || '',
    }));

    const historyList = (dbLogs && dbLogs.length > 0) ? dbLogs : globalAttendanceHistory;

    return NextResponse.json(
      {
        success: true,
        source: 'supabase',
        activeCheckIns: activeList,
        history: historyList,
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
      history: globalAttendanceHistory,
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
    const { action, user_name, user_avatar, selectedProject, notesInput, checkInTime, checkInTimestamp, record } = body;

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
          selected_project: activeObj.selectedProject,
          notes_input: activeObj.notesInput,
          updated_at: new Date().toISOString(),
        });
      } catch (dbErr) {
        console.warn('[Attendance API] Supabase checkin error', dbErr);
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
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
