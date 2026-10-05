import { NextResponse } from 'next/server';

// Subtasks live in the task's raw_data through /api/supabase/tasks.
export async function GET() { return NextResponse.json({ subtasks: [] }); }
function useAppTask() { return NextResponse.json({ error: 'Subtask disimpan melalui /api/supabase/tasks.' }, { status: 410 }); }
export async function POST() { return useAppTask(); }
export async function PUT() { return useAppTask(); }
export async function DELETE() { return useAppTask(); }
