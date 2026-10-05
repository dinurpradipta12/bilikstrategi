import { NextRequest, NextResponse } from 'next/server';
import { supabaseRest as supabase } from '@/lib/supabase/rest-client';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

function failure(error: unknown) {
  return NextResponse.json({ error: error instanceof Error ? error.message : 'Client gagal disimpan.' }, { status: 503 });
}
function uuid(value: unknown) {
  const text = String(value || '');
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : null;
}
export async function GET() {
  const { data, error } = await supabase.from('clients').select('*').order('created_at', { ascending: false });
  if (error) return failure(error);
  return NextResponse.json({ clients: data || [] }, { headers: { 'Cache-Control': 'no-store' } });
}
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = String(body.action || 'create');
    const id = uuid(body.id || body.client_id);
    if (action === 'delete') {
      if (!id) return NextResponse.json({ error: 'Client tidak valid.' }, { status: 400 });
      const { data, error } = await supabase.from('clients').delete().eq('id', id).select('*');
      if (error) throw error;
      if (!Array.isArray(data) || data.length === 0) return NextResponse.json({ error: 'Client tidak ditemukan.' }, { status: 404 });
      return NextResponse.json({ success: true });
    }
    const payload = {
      name: String(body.name || '').trim(),
      company_name: String(body.company_name || '').trim(),
      email: String(body.email || '').trim(),
      phone: String(body.phone || '').trim(),
      industry: String(body.industry || '').trim(),
      status: String(body.status || 'active'),
      notes: String(body.notes || ''),
      logo_url: String(body.logo_url || ''),
      updated_at: new Date().toISOString(),
    };
    if (!payload.name || !payload.company_name) {
      return NextResponse.json({ error: 'Nama dan perusahaan client wajib diisi.' }, { status: 400 });
    }
    if (action === 'update') {
      if (!id) return NextResponse.json({ error: 'Client tidak valid.' }, { status: 400 });
      const { data, error } = await supabase.from('clients').update(payload).eq('id', id).select('*');
      if (error) throw error;
      if (!Array.isArray(data) || data.length === 0) return NextResponse.json({ error: 'Client tidak ditemukan.' }, { status: 404 });
      return NextResponse.json({ success: true, client: data[0] });
    }
    const { data, error } = await supabase.from('clients').insert({ id: id || crypto.randomUUID(), ...payload }).select('*').single();
    if (error) throw error;
    return NextResponse.json({ success: true, client: data }, { status: 201 });
  } catch (error) { return failure(error); }
}
