import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Shared in-memory fallback store across all requests
const globalClientsStore: any[] = [];

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      globalClientsStore.length = 0;
      globalClientsStore.push(...data);
      return NextResponse.json({ clients: data }, { headers: { 'Cache-Control': 'no-store' } });
    }
  } catch (error: any) {
    console.warn('[Clients API] Supabase query error, fallback to memory', error);
  }

  return NextResponse.json({ clients: globalClientsStore }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, id, ...clientData } = body;

    if (action === 'delete') {
      const targetId = id || body.client_id;
      const index = globalClientsStore.findIndex((c) => c.id === targetId);
      if (index !== -1) globalClientsStore.splice(index, 1);

      try {
        await supabase.from('clients').delete().eq('id', targetId);
      } catch (err) {
        console.warn('[Clients API] Supabase delete error', err);
      }

      return NextResponse.json({ success: true, message: 'Client deleted' });
    }

    if (action === 'update') {
      const index = globalClientsStore.findIndex((c) => c.id === id);
      if (index !== -1) {
        globalClientsStore[index] = { ...globalClientsStore[index], ...clientData };
      }

      try {
        await supabase.from('clients').update(clientData).eq('id', id);
      } catch (err) {
        console.warn('[Clients API] Supabase update error', err);
      }

      return NextResponse.json({ success: true, client: clientData });
    }

    // Insert / Upsert new client
    const newClient = {
      id: id || 'cli-' + Date.now(),
      company_name: clientData.company_name || 'Client Baru',
      name: clientData.name || 'PIC Client',
      email: clientData.email || '',
      phone: clientData.phone || '',
      industry: clientData.industry || 'Digital Agency',
      status: clientData.status || 'active',
      notes: clientData.notes || '',
      logo_url: clientData.logo_url || '',
      created_at: new Date().toISOString(),
    };

    const existingIdx = globalClientsStore.findIndex((c) => c.id === newClient.id);
    if (existingIdx !== -1) {
      globalClientsStore[existingIdx] = newClient;
    } else {
      globalClientsStore.unshift(newClient);
    }

    try {
      await supabase.from('clients').upsert([newClient]);
    } catch (err) {
      console.warn('[Clients API] Supabase insert error', err);
    }

    return NextResponse.json({ success: true, client: newClient });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal menyimpan client' }, { status: 500 });
  }
}
