import { NextRequest, NextResponse } from 'next/server';
import { supabaseRest as supabase } from '@/lib/supabase/rest-client';
import { getNotificationActor, publishProjectEvent } from '@/lib/notifications/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Shared in-memory fallback store across all requests
const globalProjectsStore: any[] = [];

async function publishProjectNotification(req: NextRequest, input: Parameters<typeof publishProjectEvent>[1]) {
  await publishProjectEvent(req, input).catch((error) => {
    console.warn('[Projects API] Notification publish failed:', error);
  });
}

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
    const { action, id, notification_silent: notificationSilent, actor_name: _actorName, ...projectData } = body;
    const actorName = getNotificationActor(req).name;

    if (action === 'delete') {
      const targetId = id || body.project_id;
      const existingProject = globalProjectsStore.find((p) => p.id === targetId);
      const index = globalProjectsStore.findIndex((p) => p.id === targetId);
      if (index !== -1) globalProjectsStore.splice(index, 1);

      try {
        const { error } = await supabase.from('projects').delete().eq('id', targetId);
        if (!error && !notificationSilent) {
          await publishProjectNotification(req, {
            type: 'project_deleted',
            title: 'Project dihapus',
            message: `${actorName} menghapus project "${existingProject?.name || body.name || 'Project'}".`,
            projectId: String(targetId),
            projectName: String(existingProject?.name || body.name || 'Project'),
            token: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.warn('[Projects API] Supabase delete error', err);
      }

      return NextResponse.json({ success: true, message: 'Project deleted' });
    }

    if (action === 'update') {
      const index = globalProjectsStore.findIndex((p) => p.id === id);
      const updatedAt = new Date().toISOString();
      const updatedProject = {
        ...(index !== -1 ? globalProjectsStore[index] : {}),
        ...projectData,
        id,
        updated_at: updatedAt,
      };
      if (index !== -1) {
        globalProjectsStore[index] = updatedProject;
      }

      try {
        const { error } = await supabase.from('projects').update({ ...projectData, updated_at: updatedAt }).eq('id', id);
        if (!error && !notificationSilent) {
          await publishProjectNotification(req, {
            type: 'project_updated',
            title: 'Project diperbarui',
            message: `${actorName} memperbarui project "${updatedProject.name || 'Project'}".`,
            projectId: String(id),
            projectName: String(updatedProject.name || 'Project'),
            token: updatedAt,
            payload: { status: updatedProject.status || null },
          });
        }
      } catch (err) {
        console.warn('[Projects API] Supabase update error', err);
      }

      return NextResponse.json({ success: true, project: updatedProject });
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
      const { error } = await supabase.from('projects').upsert([newProject]);
      if (!error && !notificationSilent) {
        await publishProjectNotification(req, {
          type: 'project_created',
          title: 'Project baru dibuat',
          message: `${actorName} membuat project "${newProject.name}".`,
          projectId: String(newProject.id),
          projectName: String(newProject.name),
          token: String(newProject.created_at),
          payload: { status: newProject.status },
        });
      }
    } catch (err) {
      console.warn('[Projects API] Supabase insert error', err);
    }

    return NextResponse.json({ success: true, project: newProject });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal menyimpan project' }, { status: 500 });
  }
}
