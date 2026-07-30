import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data, error } = await supabase.from('projects').select('*');
    if (error) throw error;
    return NextResponse.json({ projects: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal mengambil data project' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { data, error } = await supabase.from('projects').insert([body]).select('*');
    if (error) throw error;
    return NextResponse.json({ project: data?.[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal menyimpan project' }, { status: 500 });
  }
}
