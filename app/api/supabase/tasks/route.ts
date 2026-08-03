import { NextRequest, NextResponse } from 'next/server';
import { supabaseRest as supabase } from '@/lib/supabase/rest-client';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const fallbackTasks: any[] = [];

function isUuid(value?: string | null) {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

function uniqueTaskId(raw: any) {
  return String(raw?.id || raw?.clickup_task_id || `app-${crypto.randomUUID()}`);
}

function normalizeStatus(status?: string) {
  const value = String(status || 'to_do').toLowerCase().replace(/\s+/g, '_');
  if (value.includes('progress')) return 'in_progress';
  if (value.includes('review')) return 'in_review';
  if (value.includes('revision')) return 'revision';
  if (value.includes('complete') || value.includes('closed') || value.includes('done')) return 'completed';
  return 'to_do';
}

function rowToTask(row: any) {
  const raw = row.raw_data || {};
  const taskId = String(raw.id || row.clickup_task_id || row.id);
  const dueDate = raw.due_date || row.due_date || new Date(Date.now() + 7 * 86400000).toISOString();

  return {
    id: taskId,
    clickup_task_id: row.clickup_task_id || raw.clickup_task_id || taskId,
    project_id: raw.project_id || row.project_id || '',
    project_name: raw.project_name || '',
    task_name: row.task_name || raw.task_name || raw.name || 'Task',
    description: raw.description || '',
    status: normalizeStatus(row.status || raw.status),
    priority: row.priority || raw.priority || 'normal',
    assignee_ids: Array.isArray(row.assignee_ids) ? row.assignee_ids.map(String) : raw.assignee_ids || [],
    assignee_names: raw.assignee_names || [],
    assignee_avatars: raw.assignee_avatars || [],
    start_date: raw.start_date || row.start_date || new Date().toISOString(),
    due_date: dueDate,
    tags: raw.tags || [],
    custom_fields: raw.custom_fields || [],
    time_estimate_hours: raw.time_estimate_hours || 0,
    time_tracked_hours: raw.time_tracked_hours || 0,
    parent_id: raw.parent_id || null,
    subtask_count: raw.subtask_count ?? raw.subtasks?.length ?? 0,
    comments_count: raw.comments_count ?? raw.comments?.length ?? 0,
    subtasks: raw.subtasks || [],
    comments: raw.comments || [],
    clickup_url: raw.clickup_url || '',
    clickup_updated_at: row.clickup_updated_at || raw.clickup_updated_at || row.last_synced_at || new Date().toISOString(),
    created_at: raw.created_at || row.last_synced_at || new Date().toISOString(),
    raw_data: raw,
  };
}

function taskToRow(input: any, existing?: any) {
  const now = new Date().toISOString();
  const existingRaw = existing?.raw_data || {};
  const id = uniqueTaskId(input);
  const projectId = String(input.project_id || input.projectId || existingRaw.project_id || existing?.project_id || '');
  const mergedRaw = {
    ...existingRaw,
    ...input,
    id,
    clickup_task_id: input.clickup_task_id || input.clickupTaskId || existing?.clickup_task_id || id,
    project_id: projectId,
    task_name: input.task_name || input.name || existingRaw.task_name || existing?.task_name || 'Task',
    description: input.description ?? existingRaw.description ?? '',
    status: normalizeStatus(input.status || existingRaw.status || existing?.status),
    priority: input.priority || existingRaw.priority || existing?.priority || 'normal',
    assignee_ids: input.assignee_ids || input.assignees || existingRaw.assignee_ids || existing?.assignee_ids || [],
    assignee_names: input.assignee_names || existingRaw.assignee_names || [],
    assignee_avatars: input.assignee_avatars || existingRaw.assignee_avatars || [],
    due_date: input.due_date || existingRaw.due_date || existing?.due_date || now,
    start_date: input.start_date || existingRaw.start_date || existing?.start_date || now,
    clickup_updated_at: now,
  };

  return {
    clickup_task_id: mergedRaw.clickup_task_id,
    project_id: isUuid(projectId) ? projectId : null,
    task_name: mergedRaw.task_name,
    status: mergedRaw.status,
    priority: mergedRaw.priority,
    assignee_ids: mergedRaw.assignee_ids,
    start_date: mergedRaw.start_date,
    due_date: mergedRaw.due_date,
    clickup_updated_at: now,
    last_synced_at: now,
    raw_data: mergedRaw,
  };
}

async function findExisting(taskId: string) {
  const byClickup = await supabase
    .from('task_cache')
    .select('*')
    .eq('clickup_task_id', taskId)
    .maybeSingle();

  if (!byClickup.error && byClickup.data) return byClickup.data;
  if (!isUuid(taskId)) return null;

  const byId = await supabase
    .from('task_cache')
    .select('*')
    .eq('id', taskId)
    .maybeSingle();

  return byId.error ? null : byId.data;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId') || searchParams.get('listId');
  const assigneeId = searchParams.get('assigneeId');

  try {
    let query = supabase.from('task_cache').select('*').order('last_synced_at', { ascending: false });
    if (projectId && isUuid(projectId)) query = query.eq('project_id', projectId);

    const { data, error } = await query;
    if (error) throw error;

    fallbackTasks.length = 0;
    fallbackTasks.push(...(data || []));

    let tasks = (data || []).map(rowToTask);
    if (projectId && !isUuid(projectId)) {
      tasks = tasks.filter((task) => task.project_id === projectId || task.clickup_task_id === projectId);
    }
    if (assigneeId) {
      tasks = tasks.filter((task) => task.assignee_ids.includes(String(assigneeId)));
    }

    return NextResponse.json({ tasks }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    let tasks = fallbackTasks.map(rowToTask);
    if (projectId) tasks = tasks.filter((task) => task.project_id === projectId || task.clickup_task_id === projectId);
    if (assigneeId) tasks = tasks.filter((task) => task.assignee_ids.includes(String(assigneeId)));
    return NextResponse.json({ tasks, warning: error?.message || 'Supabase task cache unavailable' }, { headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function POST(req: NextRequest) {
  let body: any = {};
  try {
    body = await req.json();
    const row = taskToRow(body);

    const { data, error } = await supabase
      .from('task_cache')
      .upsert(row, { onConflict: 'clickup_task_id' })
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, task: rowToTask(data) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    const row = taskToRow(body);
    fallbackTasks.unshift(row);
    return NextResponse.json({ success: true, task: rowToTask(row), warning: error?.message || 'Saved to memory fallback' }, { headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const taskId = String(body.taskId || body.id || body.clickup_task_id || '');
    if (!taskId) return NextResponse.json({ error: 'taskId wajib diisi' }, { status: 400 });

    const existing = await findExisting(taskId);
    const row = taskToRow({ ...body, id: body.id || existing?.raw_data?.id || taskId }, existing);

    const { data, error } = await supabase
      .from('task_cache')
      .upsert(row, { onConflict: 'clickup_task_id' })
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, task: rowToTask(data) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Gagal update task aplikasi' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const taskId = searchParams.get('taskId');
  if (!taskId) return NextResponse.json({ error: 'taskId wajib diisi' }, { status: 400 });

  try {
    const existing = await findExisting(taskId);
    if (existing?.clickup_task_id) {
      await supabase.from('task_cache').delete().eq('clickup_task_id', existing.clickup_task_id);
    }
    return NextResponse.json({ success: true, taskId }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    return NextResponse.json({ success: true, taskId, warning: error?.message || 'Delete fallback only' }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
