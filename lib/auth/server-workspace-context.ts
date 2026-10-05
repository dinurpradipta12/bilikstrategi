import { NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { normalizeAppRole, normalizeIdentityEmail, type AppRole } from '@/lib/auth/app-role';
import { normalizePageAccess, type PageAccessMap } from '@/lib/auth/page-access';
import { createSupabaseServerClient } from '@/lib/supabase/server-client';
import { isSupabaseAdminConfigured, supabaseAdminFetch } from '@/lib/supabase/admin-rest-client';

// This is an internal compatibility key used by existing modules. Every team
// has its own database, so the key never spans installations.
export const DEFAULT_APP_WORKSPACE_ID = 'bilik-strategi';

export type ServerWorkspaceIdentity = {
  id: string;
  email: string;
  name: string;
  username: string;
  avatarUrl: string;
  phone: string;
  jobTitle: string;
  timezone: string;
  capacityHours: number;
  mustChangePassword: boolean;
};

export type ServerWorkspaceContext = {
  identity: ServerWorkspaceIdentity;
  workspaceId: string;
  appRole: AppRole;
  isSuperuser: boolean;
  isActive: boolean;
  canManage: boolean;
  pageAccess: PageAccessMap;
};

type ProfileRow = {
  id?: string;
  username?: string | null;
  full_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  job_title?: string | null;
  timezone?: string | null;
  role?: string | null;
  status?: string | null;
  capacity_hours?: number | null;
  must_change_password?: boolean | null;
};

type RoleRow = {
  email?: string | null;
  user_id?: string | null;
  display_name?: string | null;
  role?: string | null;
  is_superuser?: boolean | null;
  status?: string | null;
  page_access?: unknown;
};

function text(value: unknown, maxLength = 320) {
  return String(value || '').trim().slice(0, maxLength);
}

async function readFirstRow<T>(path: string): Promise<T | null> {
  if (!isSupabaseAdminConfigured()) return null;
  const response = await supabaseAdminFetch(path);
  if (!response.ok) return null;
  const rows = await response.json().catch(() => []);
  return Array.isArray(rows) ? (rows[0] as T | undefined) || null : (rows as T | null);
}

async function readProfileAndRole(userId: string, email: string) {
  const encodedId = encodeURIComponent(userId);
  const encodedEmail = encodeURIComponent(email);
  const [profile, roleById] = await Promise.all([
    readFirstRow<ProfileRow>(
      `profiles?select=id,username,full_name,email,avatar_url,phone,job_title,timezone,role,status,capacity_hours,must_change_password&id=eq.${encodedId}&limit=1`,
    ),
    readFirstRow<RoleRow>(
      `app_user_roles?select=user_id,email,display_name,role,is_superuser,status,page_access&user_id=eq.${encodedId}&limit=1`,
    ),
  ]);

  const role = roleById || await readFirstRow<RoleRow>(
    `app_user_roles?select=user_id,email,display_name,role,is_superuser,status,page_access&email=ilike.${encodedEmail}&limit=1`,
  );

  return { profile, role };
}

export async function getAppIdentityForAuthUser(user: User): Promise<ServerWorkspaceContext> {
  const email = normalizeIdentityEmail(user.email);
  const { profile, role } = await readProfileAndRole(user.id, email);
  const metadata = user.user_metadata || {};
  const name = text(profile?.full_name || role?.display_name || metadata.full_name || metadata.name || email.split('@')[0] || 'Pengguna', 180);
  const appRole = normalizeAppRole(role?.role || profile?.role || metadata.role);
  const isSuperuser = role?.is_superuser === true || profile?.role === 'owner';
  const isActive = Boolean(profile) && profile?.status !== 'inactive' && role?.status !== 'inactive';

  return {
    identity: {
      id: user.id,
      email,
      name,
      username: text(profile?.username || metadata.username || '', 32),
      avatarUrl: text(profile?.avatar_url || metadata.avatar_url || '', 1_000),
      phone: text(profile?.phone || '', 80),
      jobTitle: text(profile?.job_title || '', 120),
      timezone: text(profile?.timezone || 'Asia/Makassar', 80),
      capacityHours: Number(profile?.capacity_hours ?? 40) || 40,
      mustChangePassword: profile?.must_change_password === true,
    },
    workspaceId: DEFAULT_APP_WORKSPACE_ID,
    appRole: isSuperuser ? 'owner' : appRole,
    isSuperuser,
    isActive,
    canManage: isActive && (isSuperuser || appRole === 'owner' || appRole === 'admin'),
    pageAccess: normalizePageAccess(role?.page_access),
  };
}

export async function getServerWorkspaceContext(req: NextRequest): Promise<ServerWorkspaceContext> {
  const { supabase } = createSupabaseServerClient(req);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return {
      identity: {
        id: '',
        email: '',
        name: 'Pengguna',
        username: '',
        avatarUrl: '',
        phone: '',
        jobTitle: '',
        timezone: 'Asia/Makassar',
        capacityHours: 40,
        mustChangePassword: false,
      },
      workspaceId: DEFAULT_APP_WORKSPACE_ID,
      appRole: 'member',
      isSuperuser: false,
      isActive: false,
      canManage: false,
      pageAccess: normalizePageAccess(undefined),
    };
  }

  const context = await getAppIdentityForAuthUser(data.user);
  return {
    ...context,
    workspaceId: DEFAULT_APP_WORKSPACE_ID,
  };
}

export function toCurrentUserPayload(context: ServerWorkspaceContext) {
  return {
    id: context.identity.id,
    username: context.identity.name,
    login_username: context.identity.username,
    email: context.identity.email,
    profilePicture: context.identity.avatarUrl,
    role: context.appRole === 'owner' ? 1 : context.appRole === 'admin' ? 2 : 3,
    app_role: context.appRole,
    is_superuser: context.isSuperuser,
    is_active: context.isActive,
    page_access: context.pageAccess,
    phone: context.identity.phone,
    job_title: context.identity.jobTitle,
    timezone: context.identity.timezone,
    capacity_hours: context.identity.capacityHours,
    must_change_password: context.identity.mustChangePassword,
  };
}

export async function getWorkspaceManagerEmails(workspaceId: string) {
  if (!isSupabaseAdminConfigured()) return [];
  const response = await supabaseAdminFetch(
    'app_user_roles?select=email,role,is_superuser,status&status=eq.active',
  );
  if (!response.ok) return [];
  const rows = await response.json().catch(() => []);
  if (!Array.isArray(rows)) return [];

  void workspaceId;
  return Array.from(new Set(rows
    .filter((row: RoleRow) => row?.is_superuser === true || ['owner', 'admin'].includes(normalizeAppRole(row?.role)))
    .map((row: RoleRow) => normalizeIdentityEmail(row?.email))
    .filter(Boolean)));
}
