import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin-client';

export async function GET() {
  const admin = createSupabaseAdminClient();
  const [{ data: projects, error }, { data: tasks, error: taskError }] = await Promise.all([
    admin.from('projects').select('*').order('created_at', { ascending: false }),
    admin.from('task_cache').select('project_id,status,due_date'),
  ]);
  if (error || taskError) return NextResponse.json({ error: error?.message || taskError?.message }, { status: 503 });
  const now = Date.now();
  const mapped = (projects || []).map((project) => {
    const related = (tasks || []).filter((task) => task.project_id === project.id);
    const completed = related.filter((task) => task.status === 'completed').length;
    return {
      ...project,
      clickup_list_id: project.id,
      total_tasks: related.length,
      completed_tasks: completed,
      overdue_tasks: related.filter((task) => task.due_date && new Date(task.due_date).getTime() < now && task.status !== 'completed').length,
      progress_percentage: related.length ? Math.round(completed / related.length * 100) : 0,
    };
  });
  return NextResponse.json({ projects: mapped, source: 'app' });
}

// Project mutations are committed by /api/supabase/projects.
function useAppProjects() { return NextResponse.json({ error: 'Gunakan /api/supabase/projects untuk mengubah project.' }, { status: 410 }); }
export async function POST() { return useAppProjects(); }
export async function DELETE(req: NextRequest) {
  void req;
  return useAppProjects();
}
