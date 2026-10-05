import { NextRequest, NextResponse } from 'next/server';
import * as appUserRoles from '../app/user-roles/handler';
import * as appWorkspaces from '../app/workspaces/handler';
import * as attendance from '../attendance/handler';
import * as attendancePresence from '../attendance/presence/handler';
import * as attendanceSchedule from '../attendance/schedule/handler';
import * as authLogout from '../auth/logout/handler';
import * as authBootstrap from '../auth/bootstrap/handler';
import * as authLogin from '../auth/login/handler';
import * as authMe from '../auth/me/handler';
import * as authPassword from '../auth/password/handler';
import * as adminUsers from '../admin/users/handler';
import * as nativeComments from '../native/comments/handler';
import * as nativeProjects from '../native/projects/handler';
import * as nativeSpaces from '../native/spaces/handler';
import * as nativeSubtasks from '../native/subtasks/handler';
import * as nativeTasks from '../native/tasks/handler';
import * as nativeTeams from '../native/teams/handler';
import * as nativeUser from '../native/user/handler';
import * as nativeChat from '../native/chat/handler';
import * as health from '../health/handler';
import * as supabaseClients from '../supabase/clients/handler';
import * as supabaseProjectMeta from '../supabase/project-meta/handler';
import * as supabaseProjects from '../supabase/projects/handler';
import * as supabaseTasks from '../supabase/tasks/handler';
import * as ownerFinance from '../owner/finance/handler';
import * as ownerSalarySlips from '../owner/salary-slips/handler';
import * as notifications from '../notifications/handler';
import * as performance from '../performance/handler';
import * as approvals from '../approvals/handler';
import * as ownerProfitability from '../owner/profitability/handler';
import * as automations from '../automations/handler';
import * as contentIdeas from '../content-ideas/handler';
import { createSupabaseServerClient } from '@/lib/supabase/server-client';
import { getAppIdentityForAuthUser } from '@/lib/auth/server-workspace-context';
import type { PageAccessKey } from '@/lib/auth/page-access';
import { teamModuleForPage } from '@/lib/branding/types';
import { readTeamBranding } from '@/lib/branding/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Handler = (request: NextRequest) => Promise<Response> | Response;
type RouteModule = Partial<Record<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', Handler>>;

const routes: Record<string, RouteModule> = {
  'app/user-roles': appUserRoles,
  'app/workspaces': appWorkspaces,
  attendance,
  'attendance/presence': attendancePresence,
  'attendance/schedule': attendanceSchedule,
  'auth/bootstrap': authBootstrap,
  'auth/login': authLogin,
  'auth/me': authMe,
  'auth/password': authPassword,
  'auth/logout': authLogout,
  'admin/users': adminUsers,
  'native/comments': nativeComments,
  'native/projects': nativeProjects,
  'native/spaces': nativeSpaces,
  'native/subtasks': nativeSubtasks,
  'native/tasks': nativeTasks,
  'native/teams': nativeTeams,
  'native/user': nativeUser,
  'native/chat': nativeChat,
  health,
  'supabase/clients': supabaseClients,
  'supabase/project-meta': supabaseProjectMeta,
  'supabase/projects': supabaseProjects,
  'supabase/tasks': supabaseTasks,
  'owner/finance': ownerFinance,
  'owner/salary-slips': ownerSalarySlips,
  notifications,
  performance,
  approvals,
  'owner/profitability': ownerProfitability,
  automations,
  'content-ideas': contentIdeas,
};

const accessByPath: Partial<Record<string, PageAccessKey>> = {
  attendance: 'attendance',
  'attendance/presence': 'attendance',
  'attendance/schedule': 'attendance',
  'native/projects': 'projects',
  'native/tasks': 'tasks',
  'native/comments': 'tasks',
  'native/subtasks': 'tasks',
  'native/chat': 'chat',
  'supabase/projects': 'projects',
  'supabase/project-meta': 'projects',
  'supabase/tasks': 'tasks',
  'supabase/clients': 'clients',
  performance: 'performance',
  approvals: 'approvals',
  automations: 'automations',
  'content-ideas': 'content_ideas',
  notifications: 'notifications',
  'owner/profitability': 'profitability',
  'owner/finance': 'finance',
  'owner/salary-slips': 'salary_slips',
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
  const routeModule = routes[path];
  if (!routeModule) {
    return NextResponse.json({ error: 'API route not found' }, { status: 404 });
  }

  const handler = routeModule[request.method as keyof RouteModule];
  if (!handler) return methodNotAllowed(routeModule);

  if (path === 'health' || path === 'auth/bootstrap' || path === 'auth/login'
    || path === 'auth/logout' || path === 'auth/me' || path === 'auth/password') {
    return handler(request);
  }

  const { supabase, applyAuthCookies } = createSupabaseServerClient(request);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return applyAuthCookies(NextResponse.json({ error: 'Silakan masuk terlebih dahulu.' }, { status: 401 }));
  }
  const context = await getAppIdentityForAuthUser(data.user);
  if (!context.isActive) {
    return applyAuthCookies(NextResponse.json({ error: 'Akun tidak aktif.' }, { status: 403 }));
  }
  if (context.identity.mustChangePassword) {
    return applyAuthCookies(NextResponse.json({ error: 'Perbarui password awal sebelum menggunakan aplikasi.' }, { status: 403 }));
  }
  if ((path.startsWith('owner/') && context.appRole !== 'owner')
    || (path === 'admin/users' && !context.canManage)) {
    return applyAuthCookies(NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 }));
  }
  const accessKey = accessByPath[path];
  const moduleKey = accessKey ? teamModuleForPage(accessKey) : null;
  if (moduleKey) {
    const branding = await readTeamBranding();
    if (branding.modules_enabled[moduleKey] === false) {
      return applyAuthCookies(NextResponse.json({ error: 'Fitur ini dinonaktifkan untuk tim Anda.' }, { status: 403 }));
    }
  }
  if (accessKey && context.pageAccess[accessKey] === false && !context.canManage) {
    return applyAuthCookies(NextResponse.json({ error: 'Halaman ini tidak tersedia untuk akun Anda.' }, { status: 403 }));
  }

  const response = await handler(request);
  return response instanceof NextResponse ? applyAuthCookies(response) : response;
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
