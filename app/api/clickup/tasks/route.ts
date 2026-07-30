import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
import { getTasks, getFilteredTeamTasks, createTask, updateTask, deleteTask } from '@/lib/clickup/tasks';

function mapClickUpTaskToAgencyTask(cuTask: any) {
  const statusStr = (cuTask.status?.status || 'to_do').toLowerCase().replace(/\s+/g, '_');
  let mappedStatus = 'to_do';
  if (statusStr.includes('progress')) mappedStatus = 'in_progress';
  else if (statusStr.includes('review')) mappedStatus = 'in_review';
  else if (statusStr.includes('revision')) mappedStatus = 'revision';
  else if (statusStr.includes('complete') || statusStr.includes('closed') || statusStr.includes('done')) mappedStatus = 'completed';

  let priority: 'urgent' | 'high' | 'normal' | 'low' = 'normal';
  if (cuTask.priority) {
    const p = String(cuTask.priority.priority || cuTask.priority).toLowerCase();
    if (p.includes('urgent') || p === '1') priority = 'urgent';
    else if (p.includes('high') || p === '2') priority = 'high';
    else if (p.includes('normal') || p === '3') priority = 'normal';
    else if (p.includes('low') || p === '4') priority = 'low';
  }

  const assignees = cuTask.assignees || [];
  const assignee_ids = assignees.map((a: any) => String(a.id));
  const assignee_names = assignees.map((a: any) => a.username || a.email || 'Team Member');
  const assignee_avatars = assignees.map((a: any) => a.profilePicture || 'https://attachments.clickup.com/profilePictures/276885530_r2L.jpg');

  const start_date = cuTask.start_date
    ? new Date(parseInt(cuTask.start_date, 10)).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  const due_date = cuTask.due_date
    ? new Date(parseInt(cuTask.due_date, 10)).toISOString().split('T')[0]
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  return {
    id: cuTask.id,
    clickup_task_id: cuTask.id,
    project_id: cuTask.list?.id || 'list-default',
    project_name: cuTask.list?.name || cuTask.space?.name || 'General Project',
    task_name: cuTask.name,
    description: cuTask.description || cuTask.text_content || '',
    status: mappedStatus,
    priority,
    assignee_ids: assignee_ids.length > 0 ? assignee_ids : ['276885530'],
    assignee_names: assignee_names.length > 0 ? assignee_names : ['Dinur Pradipta'],
    assignee_avatars: assignee_avatars.length > 0 ? assignee_avatars : ['https://attachments.clickup.com/profilePictures/276885530_r2L.jpg'],
    start_date,
    due_date,
    tags: (cuTask.tags || []).map((t: any) => t.name || String(t)),
    custom_fields: (cuTask.custom_fields || []).map((f: any) => ({ name: f.name, value: String(f.value || '') })),
    time_estimate_hours: cuTask.time_estimate ? cuTask.time_estimate / 3600000 : 0,
    time_tracked_hours: cuTask.time_spent ? cuTask.time_spent / 3600000 : 0,
    parent_id: cuTask.parent || null,
    subtask_count: cuTask.subtasks?.length || 0,
    comments_count: cuTask.comments?.length || 0,
    clickup_url: cuTask.url || `https://app.clickup.com/t/${cuTask.id}`,
    clickup_updated_at: cuTask.date_updated ? new Date(parseInt(cuTask.date_updated, 10)).toISOString() : new Date().toISOString(),
    created_at: cuTask.date_created ? new Date(parseInt(cuTask.date_created, 10)).toISOString() : new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const listId = searchParams.get('listId');
    const assigneeId = searchParams.get('assigneeId');
    const teamId = process.env.CLICKUP_TEAM_ID || '90182855619';

    let rawTasks: any[] = [];
    if (listId) {
      const data = await getTasks(listId, { include_closed: true, subtasks: true });
      rawTasks = data.tasks || [];
    } else {
      const data = await getFilteredTeamTasks(teamId, { include_closed: true, subtasks: true });
      rawTasks = data.tasks || [];
    }

    let mapped = rawTasks.map(mapClickUpTaskToAgencyTask);

    if (assigneeId) {
      mapped = mapped.filter((t) => t.assignee_ids.includes(String(assigneeId)));
    }

    return NextResponse.json({ tasks: mapped, raw: rawTasks });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Gagal mengambil task dari ClickUp' },
      { status: error.status || 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { listId, name, description, priority, assignees, due_date } = body;

    const targetListId = listId || process.env.CLICKUP_DEFAULT_LIST_ID || '901819386455';

    let numericPriority: number | undefined;
    if (priority === 'urgent') numericPriority = 1;
    else if (priority === 'high') numericPriority = 2;
    else if (priority === 'normal') numericPriority = 3;
    else if (priority === 'low') numericPriority = 4;

    const newTaskData = await createTask(targetListId, {
      name,
      description,
      priority: numericPriority,
      assignees: assignees ? assignees.map(Number) : undefined,
      due_date: due_date ? new Date(due_date).getTime() : undefined,
    });

    return NextResponse.json({ task: mapClickUpTaskToAgencyTask(newTaskData), raw: newTaskData });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Gagal membuat task ClickUp' },
      { status: error.status || 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { taskId, status, priority, name, description } = body;

    if (!taskId) {
      return NextResponse.json({ error: 'taskId wajib diisi' }, { status: 400 });
    }

    const updatePayload: any = {};
    if (status) {
      // ClickUp status string format
      if (status === 'completed') updatePayload.status = 'complete';
      else if (status === 'in_progress') updatePayload.status = 'in progress';
      else if (status === 'in_review') updatePayload.status = 'in review';
      else if (status === 'to_do') updatePayload.status = 'to do';
      else updatePayload.status = status;
    }
    if (priority) {
      if (priority === 'urgent') updatePayload.priority = 1;
      else if (priority === 'high') updatePayload.priority = 2;
      else if (priority === 'normal') updatePayload.priority = 3;
      else if (priority === 'low') updatePayload.priority = 4;
    }
    if (name) updatePayload.name = name;
    if (description !== undefined) updatePayload.description = description;

    const updatedTask = await updateTask(taskId, updatePayload);
    return NextResponse.json({ task: mapClickUpTaskToAgencyTask(updatedTask), raw: updatedTask });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Gagal mengupdate task ClickUp' },
      { status: error.status || 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json({ error: 'taskId wajib diisi' }, { status: 400 });
    }

    await deleteTask(taskId);
    return NextResponse.json({ success: true, taskId });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Gagal menghapus task dari ClickUp' },
      { status: error.status || 500 }
    );
  }
}
