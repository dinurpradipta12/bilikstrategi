import { NextRequest, NextResponse } from 'next/server';
import * as appUserRoles from '../app/user-roles/handler';
import * as appWorkspaces from '../app/workspaces/handler';
import * as attendance from '../attendance/handler';
import * as attendanceSchedule from '../attendance/schedule/handler';
import * as clickupCallback from '../auth/clickup/callback/handler';
import * as clickupLogin from '../auth/clickup/login/handler';
import * as authLogout from '../auth/logout/handler';
import * as clickupComments from '../clickup/comments/handler';
import * as clickupProjects from '../clickup/projects/handler';
import * as clickupSpaces from '../clickup/spaces/handler';
import * as clickupSubtasks from '../clickup/subtasks/handler';
import * as clickupTasks from '../clickup/tasks/handler';
import * as clickupTeams from '../clickup/teams/handler';
import * as clickupUser from '../clickup/user/handler';
import * as health from '../health/handler';
import * as supabaseClients from '../supabase/clients/handler';
import * as supabaseProjectMeta from '../supabase/project-meta/handler';
import * as supabaseProjects from '../supabase/projects/handler';
import * as supabaseTasks from '../supabase/tasks/handler';
import * as clickupWebhook from '../webhooks/clickup/handler';
import * as ownerFinance from '../owner/finance/handler';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Handler = (request: NextRequest) => Promise<Response> | Response;
type RouteModule = Partial<Record<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', Handler>>;

const routes: Record<string, RouteModule> = {
  'app/user-roles': appUserRoles,
  'app/workspaces': appWorkspaces,
  attendance,
  'attendance/schedule': attendanceSchedule,
  'auth/clickup/callback': clickupCallback,
  'auth/clickup/login': clickupLogin,
  'auth/logout': authLogout,
  'clickup/comments': clickupComments,
  'clickup/projects': clickupProjects,
  'clickup/spaces': clickupSpaces,
  'clickup/subtasks': clickupSubtasks,
  'clickup/tasks': clickupTasks,
  'clickup/teams': clickupTeams,
  'clickup/user': clickupUser,
  health,
  'supabase/clients': supabaseClients,
  'supabase/project-meta': supabaseProjectMeta,
  'supabase/projects': supabaseProjects,
  'supabase/tasks': supabaseTasks,
  'webhooks/clickup': clickupWebhook,
  'owner/finance': ownerFinance,
};

function normalizePath(pathname: string) {
  const path = pathname.replace(/^\/api\/?/, '').replace(/\/+$/, '');
  return path || 'health';
}

function methodNotAllowed(module: RouteModule) {
  const allow = Object.keys(module).filter((key) =>
    ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(key)
  );
  return NextResponse.json(
    { error: 'Method Not Allowed' },
    { status: 405, headers: { Allow: allow.join(', ') } }
  );
}

async function dispatch(request: NextRequest) {
  const path = normalizePath(new URL(request.url).pathname);
  const module = routes[path];
  if (!module) {
    return NextResponse.json({ error: 'API route not found' }, { status: 404 });
  }

  const handler = module[request.method as keyof RouteModule];
  if (!handler) return methodNotAllowed(module);
  return handler(request);
}

export function GET(request: NextRequest) {
  return dispatch(request);
}

export function POST(request: NextRequest) {
  return dispatch(request);
}

export function PUT(request: NextRequest) {
  return dispatch(request);
}

export function PATCH(request: NextRequest) {
  return dispatch(request);
}

export function DELETE(request: NextRequest) {
  return dispatch(request);
}
