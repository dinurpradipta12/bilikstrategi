import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
import { getFolderlessLists, createList, deleteList } from '@/lib/clickup/lists';
import { getFolders } from '@/lib/clickup/folders';
import { getTasks } from '@/lib/clickup/tasks';

export async function GET() {
  try {
    const spaceId = process.env.CLICKUP_SPACE_ID || '90182855619';
    
    // Fetch folderless lists and folders in space
    const [folderless, foldersRes] = await Promise.all([
      getFolderlessLists(spaceId).catch(() => ({ lists: [] })),
      getFolders(spaceId).catch(() => ({ folders: [] })),
    ]);

    const allLists = [...(folderless.lists || [])];
    if (foldersRes.folders) {
      for (const folder of foldersRes.folders) {
        if (folder.lists) {
          allLists.push(...folder.lists);
        }
      }
    }

    // For each list, fetch tasks summary to build full project model
    const projects = await Promise.all(
      allLists.map(async (list) => {
        let tasks: any[] = [];
        try {
          const tasksData = await getTasks(list.id, { include_closed: true });
          tasks = tasksData.tasks || [];
        } catch {
          // ignore task fetch error for empty list
        }

        const total_tasks = tasks.length;
        const completed_tasks = tasks.filter(
          (t) => t.status?.type === 'closed' || t.status?.status.toLowerCase() === 'complete' || t.status?.status.toLowerCase() === 'completed'
        ).length;
        const overdue_tasks = tasks.filter((t) => {
          if (!t.due_date) return false;
          const due = parseInt(t.due_date, 10);
          return due < Date.now() && t.status?.type !== 'closed';
        }).length;

        const progress_percentage = total_tasks > 0 ? Math.round((completed_tasks / total_tasks) * 100) : 0;

        return {
          id: list.id,
          clickup_list_id: list.id,
          name: list.name,
          description: list.content || 'Project di ClickUp Workspace',
          client_name: list.folder?.name || list.space?.name || 'Internal Agency',
          status: progress_percentage === 100 ? 'completed' : progress_percentage > 0 ? 'in_progress' : 'planning',
          start_date: new Date().toISOString().split('T')[0],
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          progress_percentage,
          total_tasks,
          completed_tasks,
          overdue_tasks,
          team_lead_name: 'Agency Team',
        };
      })
    );

    return NextResponse.json({ projects });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Gagal mengambil project dari ClickUp' },
      { status: error.status || 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const spaceId = process.env.CLICKUP_SPACE_ID || '90182855619';
    const body = await req.json();
    const { name, content, due_date } = body;

    if (!name) {
      return NextResponse.json({ error: 'Nama project wajib diisi' }, { status: 400 });
    }

    const newList = await createList(spaceId, {
      name,
      content,
      due_date: due_date ? new Date(due_date).getTime() : undefined,
    });

    return NextResponse.json(newList);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Gagal membuat project di ClickUp' },
      { status: error.status || 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const listId = searchParams.get('listId');

    if (!listId) {
      return NextResponse.json({ error: 'listId wajib diisi' }, { status: 400 });
    }

    await deleteList(listId);
    return NextResponse.json({ success: true, listId });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Gagal menghapus project dari ClickUp' },
      { status: error.status || 500 }
    );
  }
}
