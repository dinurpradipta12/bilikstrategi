import { NextRequest, NextResponse } from 'next/server';
import { getServerWorkspaceContext } from '@/lib/auth/server-workspace-context';
import { createSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { createAuthUserAndProfile, linkAuthUserToProfile } from '@/lib/auth/provisioning';
import { normalizePageAccess } from '@/lib/auth/page-access';
import { normalizeAppRole } from '@/lib/auth/app-role';

export const runtime = 'edge';

async function manager(req: NextRequest) {
  const context = await getServerWorkspaceContext(req);
  return context.identity.id && context.isActive && context.canManage ? context : null;
}

function denied() { return NextResponse.json({ error: 'Hanya Owner atau Admin yang dapat mengelola pengguna.' }, { status: 403 }); }
function errorResponse(error: unknown) {
  return NextResponse.json({ error: error instanceof Error ? error.message : 'Gagal mengelola pengguna.' }, { status: 400 });
}

export async function GET(req: NextRequest) {
  if (!(await manager(req))) return denied();
  try {
    const admin = createSupabaseAdminClient();
    const [{ data: profiles, error }, { data: roles, error: roleError }] = await Promise.all([
      admin.from('profiles').select('id,username,full_name,email,avatar_url,phone,job_title,division,timezone,role,status,capacity_hours,must_change_password').order('full_name'),
      admin.from('app_user_roles').select('user_id,is_superuser,page_access'),
    ]);
    if (error || roleError) throw new Error(error?.message || roleError?.message);
    const roleById = new Map((roles || []).map((role) => [role.user_id, role]));
    return NextResponse.json({ users: (profiles || []).map((profile) => ({
      ...profile,
      is_superuser: roleById.get(profile.id)?.is_superuser === true,
      page_access: normalizePageAccess(roleById.get(profile.id)?.page_access),
      provisioned: true,
    })) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(req: NextRequest) {
  const actor = await manager(req);
  if (!actor) return denied();
  try {
    const body = await req.json();
    const role = normalizeAppRole(body.role);
    if (role === 'owner' && !actor.isSuperuser) return denied();
    const created = await createAuthUserAndProfile({
      email: body.email,
      username: body.username,
      fullName: body.full_name,
      password: body.password,
      role,
      status: body.status,
      isSuperuser: role === 'owner',
      pageAccess: normalizePageAccess(body.page_access),
      capacityHours: body.capacity_hours,
      phone: body.phone,
      jobTitle: body.job_title,
      division: body.division,
      timezone: body.timezone,
      mustChangePassword: body.must_change_password !== false,
    });
    return NextResponse.json({ success: true, user_id: created.user.id }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(req: NextRequest) {
  const actor = await manager(req);
  if (!actor) return denied();
  try {
    const body = await req.json();
    const userId = String(body.user_id || '');
    if (!userId) return NextResponse.json({ error: 'Pengguna tidak ditemukan.' }, { status: 400 });
    const admin = createSupabaseAdminClient();
    const [{ data: current, error }, { data: currentRole, error: roleError }] = await Promise.all([
      admin.from('profiles').select('*').eq('id', userId).maybeSingle(),
      admin.from('app_user_roles').select('page_access').eq('user_id', userId).maybeSingle(),
    ]);
    if (error || !current) return NextResponse.json({ error: 'Pengguna tidak ditemukan.' }, { status: 404 });
    if (roleError) throw roleError;
    const role = normalizeAppRole(body.role || current.role);
    if ((role === 'owner' || current.role === 'owner') && !actor.isSuperuser) return denied();
    await linkAuthUserToProfile({
      userId,
      email: current.email,
      username: body.username ?? current.username,
      fullName: body.full_name ?? current.full_name,
      avatarUrl: body.avatar_url ?? current.avatar_url,
      phone: body.phone ?? current.phone,
      jobTitle: body.job_title ?? current.job_title,
      division: body.division ?? current.division,
      timezone: body.timezone ?? current.timezone,
      capacityHours: body.capacity_hours ?? current.capacity_hours,
      role,
      status: body.status ?? current.status,
      isSuperuser: role === 'owner',
      pageAccess: normalizePageAccess(body.page_access ?? currentRole?.page_access),
      mustChangePassword: current.must_change_password,
    });
    return NextResponse.json({ success: true });
  } catch (error) { return errorResponse(error); }
}
