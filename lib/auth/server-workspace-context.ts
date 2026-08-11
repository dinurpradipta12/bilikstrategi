import { NextRequest } from 'next/server';
import { getAuthenticatedUser } from '@/lib/clickup/users';
import {
  isSuperuserEmail,
  normalizeAppRole,
  normalizeIdentityEmail,
  type AppRole,
} from '@/lib/auth/app-role';
import {
  isSupabaseAdminConfigured,
  supabaseAdminFetch,
} from '@/lib/supabase/admin-rest-client';

export const DEFAULT_APP_WORKSPACE_ID = 'bilik-strategi';

export type ServerWorkspaceIdentity = {
  email: string;
  name: string;
  avatarUrl: string;
};

export type ServerWorkspaceContext = {
  identity: ServerWorkspaceIdentity;
  workspaceId: string;
  appRole: AppRole;
  isSuperuser: boolean;
  isActive: boolean;
  canManage: boolean;
};

function decodeCookie(value: string | undefined) {
  if (!value) return '';
  let decoded = value;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }
  return decoded.trim();
}

function cleanWorkspaceId(value: unknown) {
  const candidate = String(value || DEFAULT_APP_WORKSPACE_ID).trim().slice(0, 80);
  return /^[a-zA-Z0-9_-]+$/.test(candidate) ? candidate : DEFAULT_APP_WORKSPACE_ID;
}

async function readRole(email: string) {
  if (!email || !isSupabaseAdminConfigured()) return null;
  const response = await supabaseAdminFetch(
    `app_user_roles?select=email,display_name,role,is_superuser,status&email=ilike.${encodeURIComponent(email)}&limit=1`
  );
  if (!response.ok) return null;
  const rows = await response.json().catch(() => []);
  return Array.isArray(rows) ? rows[0] || null : rows;
}

async function resolveIdentity(req: NextRequest): Promise<ServerWorkspaceIdentity> {
  const cookieEmail = normalizeIdentityEmail(decodeCookie(req.cookies.get('clickup_user_email')?.value));
  const cookieName = decodeCookie(req.cookies.get('clickup_user_name')?.value);
  const cookieAvatar = decodeCookie(req.cookies.get('clickup_user_avatar')?.value);

  if (cookieEmail) {
    return {
      email: cookieEmail,
      name: cookieName || cookieEmail.split('@')[0] || 'Pengguna',
      avatarUrl: cookieAvatar,
    };
  }

  const accessToken = req.cookies.get('clickup_access_token')?.value;
  if (accessToken) {
    try {
      const authenticated = await getAuthenticatedUser(accessToken);
      const user = authenticated?.user;
      const email = normalizeIdentityEmail(user?.email);
      if (email) {
        return {
          email,
          name: String(user?.username || email.split('@')[0] || 'Pengguna').trim(),
          avatarUrl: String(user?.profilePicture || '').trim(),
        };
      }
    } catch {
      // The route will return an unauthenticated response below.
    }
  }

  return { email: '', name: cookieName || 'Pengguna', avatarUrl: cookieAvatar };
}

export async function getServerWorkspaceContext(req: NextRequest): Promise<ServerWorkspaceContext> {
  const identity = await resolveIdentity(req);
  const roleRecord = await readRole(identity.email).catch(() => null);
  const isSuperuser = isSuperuserEmail(identity.email) || roleRecord?.is_superuser === true;
  const appRole = isSuperuser ? 'owner' : normalizeAppRole(roleRecord?.role);
  const isActive = roleRecord?.status !== 'inactive';
  const canManage = isActive && (isSuperuser || appRole === 'owner' || appRole === 'admin');

  return {
    identity: {
      ...identity,
      name: String(roleRecord?.display_name || identity.name || identity.email.split('@')[0] || 'Pengguna').trim(),
    },
    workspaceId: cleanWorkspaceId(req.cookies.get('app_workspace_id')?.value),
    appRole,
    isSuperuser,
    isActive,
    canManage,
  };
}

export async function getWorkspaceManagerEmails(workspaceId: string) {
  if (!isSupabaseAdminConfigured()) return [];
  const response = await supabaseAdminFetch(
    'app_user_roles?select=email,role,is_superuser,status&status=eq.active'
  );
  if (!response.ok) return [];
  const rows = await response.json().catch(() => []);
  if (!Array.isArray(rows)) return [];

  // Roles are currently workspace-global. Keep workspaceId in the signature so
  // this helper can adopt workspace membership scoping without changing callers.
  void workspaceId;
  return Array.from(new Set(rows
    .filter((row: any) => row?.is_superuser === true || ['owner', 'admin'].includes(normalizeAppRole(row?.role)))
    .map((row: any) => normalizeIdentityEmail(row?.email))
    .filter(Boolean)));
}
