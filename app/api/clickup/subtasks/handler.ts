import { NextRequest, NextResponse } from 'next/server';
import { createTask, updateTask, deleteTask, getTaskById } from '@/lib/clickup/tasks';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('clickup_access_token')?.value || process.env.CLICKUP_API_KEY || process.env.CLICKUP_PERSONAL_TOKEN;
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
    }

    const taskData = await getTaskById(taskId, token);
    const subtasks = taskData.subtasks || [];
    return NextResponse.json({ subtasks });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Gagal mengambil subtask dari ClickUp' },
      { status: error.status || 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('clickup_access_token')?.value || process.env.CLICKUP_API_KEY || process.env.CLICKUP_PERSONAL_TOKEN;
    const body = await req.json();
    const { listId, parentId, name } = body;

    if (!listId || !parentId || !name) {
      return NextResponse.json({ error: 'listId, parentId, and name are required' }, { status: 400 });
    }

    const newSubtask = await createTask(
      listId,
      {
        name,
        parent: parentId,
      },
      token
    );

    return NextResponse.json({ subtask: newSubtask });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Gagal membuat subtask di ClickUp' },
      { status: error.status || 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const token = req.cookies.get('clickup_access_token')?.value || process.env.CLICKUP_API_KEY || process.env.CLICKUP_PERSONAL_TOKEN;
    const body = await req.json();
    const { subtaskId, status } = body;

    if (!subtaskId) {
      return NextResponse.json({ error: 'subtaskId is required' }, { status: 400 });
    }

    const updated = await updateTask(subtaskId, { status }, token);
    return NextResponse.json({ subtask: updated });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Gagal memperbarui subtask di ClickUp' },
      { status: error.status || 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const token = req.cookies.get('clickup_access_token')?.value || process.env.CLICKUP_API_KEY || process.env.CLICKUP_PERSONAL_TOKEN;
    const { searchParams } = new URL(req.url);
    const subtaskId = searchParams.get('subtaskId');

    if (!subtaskId) {
      return NextResponse.json({ error: 'subtaskId is required' }, { status: 400 });
    }

    await deleteTask(subtaskId, token);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Gagal menghapus subtask dari ClickUp' },
      { status: error.status || 500 }
    );
  }
}
