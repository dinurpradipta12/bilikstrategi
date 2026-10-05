import { NextRequest, NextResponse } from 'next/server';
import * as appTasks from '@/app/api/supabase/tasks/handler';

export const GET = appTasks.GET;

// Task writes must target the app-first endpoint so callers never mistake a
// compatibility request for a committed database change.
function useAppTasks() { return NextResponse.json({ error: 'Gunakan /api/supabase/tasks untuk mengubah tugas.' }, { status: 410 }); }
export async function POST() { return useAppTasks(); }
export async function PUT() { return useAppTasks(); }
export async function DELETE(req: NextRequest) {
  void req;
  return useAppTasks();
}
