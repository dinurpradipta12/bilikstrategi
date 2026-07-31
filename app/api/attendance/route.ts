import { NextResponse } from 'next/server';

export interface ActiveCheckIn {
  user_name: string;
  user_avatar?: string;
  checkInTime: string;
  checkInTimestamp: number;
  selectedProject: string;
  notesInput: string;
}

export interface SharedAttendanceRecord {
  id: string;
  user_name: string;
  user_avatar: string;
  date: string;
  day_name: string;
  check_in_time: string;
  check_out_time: string;
  duration_hours: number;
  regular_hours: number;
  overtime_hours: number;
  status: 'HADIR' | 'ALPHA' | 'LEMBUR' | 'IZIN' | 'SAKIT' | 'CUTI';
  project_name: string;
  notes: string;
}

// In-memory global store across browsers/sessions
const globalActiveCheckIns = new Map<string, ActiveCheckIn>();
const globalAttendanceHistory: SharedAttendanceRecord[] = [];

export async function GET() {
  const activeList = Array.from(globalActiveCheckIns.values());
  return NextResponse.json({
    success: true,
    activeCheckIns: activeList,
    history: globalAttendanceHistory,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, user_name, user_avatar, selectedProject, notesInput, checkInTime, checkInTimestamp, record } = body;

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
      return NextResponse.json({ success: true, active: activeObj });
    }

    if (action === 'checkout') {
      globalActiveCheckIns.delete(key);
      if (record) {
        globalAttendanceHistory.unshift(record);
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'leave') {
      if (record) {
        globalAttendanceHistory.unshift(record);
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
