import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data, error } = await supabase.from('clients').select('*');
    if (error) throw error;
    return NextResponse.json({ clients: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal mengambil data client' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { data, error } = await supabase.from('clients').insert([body]).select('*');
    if (error) throw error;
    return NextResponse.json({ client: data?.[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal menyimpan client' }, { status: 500 });
  }
}
