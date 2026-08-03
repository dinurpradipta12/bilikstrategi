import { NextRequest, NextResponse } from 'next/server';
import { supabaseRest as supabase } from '@/lib/supabase/rest-client';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Shared in-memory fallback store across all requests
const globalProjectsStore: any[] = [];

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      globalProjectsStore.length = 0;
      globalProjectsStore.push(...data);
      return NextResponse.json({ projects: data }, { headers: { 'Cache-Control': 'no-store' } });
    }
  } catch (error: any) {
    console.warn('[Projects API] Supabase query error, fallback to memory', error);
  }

  return NextResponse.json({ projects: globalProjectsStore }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, id, ...projectData } = body;

    if (action === 'delete') {
      const targetId = id || body.project_id;
      const index = globalProjectsStore.findIndex((p) => p.id === targetId);
      if (index !== -1) globalProjectsStore.splice(index, 1);

      try {
        await supabase.from('projects').delete().eq('id', targetId);
      } catch (err) {
        console.warn('[Projects API] Supabase delete error', err);
      }

      return NextResponse.json({ success: true, message: 'Project deleted' });
    }

    if (action === 'update') {
      const index = globalProjectsStore.findIndex((p) => p.id === id);
      if (index !== -1) {
        globalProjectsStore[index] = { ...globalProjectsStore[index], ...projectData };
      }

      try {
        await supabase.from('projects').update(projectData).eq('id', id);
      } catch (err) {
        console.warn('[Projects API] Supabase update error', err);
      }

      return NextResponse.json({ success: true, project: projectData });
    }

    // Insert / Upsert new project
    const isValidUUID = id && typeof id === 'string' && id.length > 20 && id.includes('-');
    const newId = isValidUUID ? id : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'b0eebc99-9c0b-4ef8-bb6d-' + Date.now().toString(16).padStart(12, '0'));

    const newProject = {
      id: newId,
      name: projectData.name || 'Project Baru',
      description: projectData.description || projectData.content || '',
      status: projectData.status || 'in_progress',
      client_name: projectData.client_name || 'Bilik Strategi Workspace',
      team_lead_name: projectData.team_lead_name || 'Dinur Pradipta',
      progress: projectData.progress || 0,
      start_date: projectData.start_date || new Date().toISOString().split('T')[0],
      due_date: projectData.due_date || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      created_at: new Date().toISOString(),
    };

    const existingIdx = globalProjectsStore.findIndex((p) => p.id === newProject.id);
    if (existingIdx !== -1) {
      globalProjectsStore[existingIdx] = newProject;
    } else {
      globalProjectsStore.unshift(newProject);
    }

    try {
      await supabase.from('projects').upsert([newProject]);
    } catch (err) {
      console.warn('[Projects API] Supabase insert error', err);
    }

    return NextResponse.json({ success: true, project: newProject });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal menyimpan project' }, { status: 500 });
  }
}
