import { NextResponse } from 'next/server';

// Comments live in the task's raw_data through /api/supabase/tasks.
export async function GET() { return NextResponse.json({ comments: [] }); }
export async function POST() { return NextResponse.json({ error: 'Komentar disimpan melalui /api/supabase/tasks.' }, { status: 410 }); }
