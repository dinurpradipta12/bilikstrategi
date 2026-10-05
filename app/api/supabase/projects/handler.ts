import { NextRequest, NextResponse } from 'next/server';
import { supabaseRest as supabase } from '@/lib/supabase/rest-client';
import { getNotificationActor, publishProjectEvent } from '@/lib/notifications/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

function uuid(value: unknown) {
  const text = String(value || '');
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : null;
}
function failure(error: unknown) {
  return NextResponse.json({ error: error instanceof Error ? error.message : 'Project gagal disimpan.' }, { status: 503 });
}

export async function GET() {
  const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
  if (error) return failure(error);
  return NextResponse.json({ projects: data || [] }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = String(body.action || 'create');
    const id = uuid(body.id || body.project_id);
    const actor = await getNotificationActor(req);
    if (action === 'delete') {
      if (!id) return NextResponse.json({ error: 'Project tidak valid.' }, { status: 400 });
      const { data, error } = await supabase.from('projects').delete().eq('id', id).select('*');
      if (error) throw error;
      if (!Array.isArray(data) || data.length === 0) return NextResponse.json({ error: 'Project tidak ditemukan.' }, { status: 404 });
      await publishProjectEvent(req, {
        type: 'project_deleted', title: 'Project dihapus',
        message: `${actor.name} menghapus project "${data[0].name}".`,
        projectId: id, projectName: data[0].name, token: new Date().toISOString(),
      }).catch(() => null);
      return NextResponse.json({ success: true, message: 'Project deleted' });
    }

    let previous: Record<string, any> | null = null;
    if (action === 'update' && id) {
      const result = await supabase.from('projects').select('*').eq('id', id).maybeSingle();
      if (result.error) throw result.error;
      previous = result.data;
      if (!previous) return NextResponse.json({ error: 'Project tidak ditemukan.' }, { status: 404 });
    }
    const payload = {
      ...(action === 'create' ? { id: id || crypto.randomUUID() } : {}),
      name: String(body.name ?? previous?.name ?? '').trim(),
      description: String(body.description ?? body.content ?? previous?.description ?? '').trim(),
      status: String(body.status ?? previous?.status ?? 'in_progress'),
      client_id: body.client_id === undefined ? previous?.client_id || null : uuid(body.client_id),
      client_name: String(body.client_name ?? previous?.client_name ?? ''),
      team_lead_id: body.team_lead_id === undefined ? previous?.team_lead_id || null : uuid(body.team_lead_id),
      team_lead_name: String(body.team_lead_name ?? previous?.team_lead_name ?? actor.name),
      member_ids: Array.isArray(body.member_ids) ? body.member_ids.map(String) : previous?.member_ids || [],
      start_date: body.start_date ?? previous?.start_date ?? null,
      due_date: body.due_date ?? previous?.due_date ?? null,
      updated_at: new Date().toISOString(),
    };
    if (!payload.name) return NextResponse.json({ error: 'Nama project wajib diisi.' }, { status: 400 });
    if (action === 'update') {
      if (!id) return NextResponse.json({ error: 'Project tidak valid.' }, { status: 400 });
      const { data, error } = await supabase.from('projects').update(payload).eq('id', id).select('*');
      if (error) throw error;
      if (!Array.isArray(data) || data.length === 0) return NextResponse.json({ error: 'Project tidak ditemukan.' }, { status: 404 });
      return NextResponse.json({ success: true, project: data[0] });
    }
    const { data, error } = await supabase.from('projects').insert(payload).select('*').single();
    if (error) throw error;
    await publishProjectEvent(req, {
      type: 'project_created', title: 'Project baru dibuat',
      message: `${actor.name} membuat project "${data.name}".`,
      projectId: data.id, projectName: data.name, token: String(data.created_at || Date.now()),
    }).catch(() => null);
    return NextResponse.json({ success: true, project: data }, { status: 201 });
  } catch (error) { return failure(error); }
}
