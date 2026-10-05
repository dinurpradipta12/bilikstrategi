import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { normalizePageAccess, type PageAccessMap } from '@/lib/auth/page-access';
import { normalizeAppRole, normalizeIdentityEmail, type AppRole } from '@/lib/auth/app-role';
import { DEFAULT_APP_WORKSPACE_ID } from '@/lib/auth/server-workspace-context';

export type ProvisionInput = {
  email: string;
  username: string;
  fullName: string;
  password: string;
  role?: AppRole;
  status?: 'active' | 'inactive';
  isSuperuser?: boolean;
  pageAccess?: unknown;
  capacityHours?: number;
  phone?: string;
  jobTitle?: string;
  division?: string;
  timezone?: string;
  avatarUrl?: string;
  mustChangePassword?: boolean;
};

export function normalizeUsername(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

export function validateUsername(value: unknown) {
  const username = normalizeUsername(value);
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) {
    throw new Error('Username harus 3–32 karakter: huruf kecil, angka, titik, garis bawah, atau tanda hubung.');
  }
  return username;
}

export function validatePassword(value: unknown) {
  const password = String(value || '');
  if (password.length < 10 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    throw new Error('Password minimal 10 karakter dan harus mengandung huruf serta angka.');
  }
  return password;
}

export function validateEmail(value: unknown) {
  const email = normalizeIdentityEmail(value);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Alamat email tidak valid.');
  }
  return email;
}

function text(value: unknown, maxLength: number) {
  return String(value || '').trim().slice(0, maxLength);
}

function boundedCapacity(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 40;
  return Math.max(0, Math.min(240, Math.round(parsed)));
}

function normalizeStatus(value: unknown) {
  return String(value || '').toLowerCase() === 'inactive' ? 'inactive' : 'active';
}

function normalizeRole(value: unknown, isSuperuser = false) {
  const role = normalizeAppRole(value);
  return isSuperuser ? 'owner' : role;
}

async function assertUsernameAvailable(username: string, exceptUserId?: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('profiles')
    .select('id')
    .ilike('username', username)
    .limit(2);

  if (error) throw new Error(error.message || 'Gagal memeriksa username.');
  const conflict = (data || []).find((row) => row.id !== exceptUserId);
  if (conflict) throw new Error('Username sudah digunakan.');
}

export async function linkAuthUserToProfile(input: Omit<ProvisionInput, 'password'> & { userId: string }) {
  const admin = createSupabaseAdminClient();
  const username = validateUsername(input.username);
  const email = validateEmail(input.email);
  const fullName = text(input.fullName, 180) || email.split('@')[0];
  const isSuperuser = input.isSuperuser === true;
  const role = normalizeRole(input.role, isSuperuser);
  const pageAccess: PageAccessMap = normalizePageAccess(input.pageAccess);

  await assertUsernameAvailable(username, input.userId);

  const { error: profileError } = await admin.from('profiles').upsert({
    id: input.userId,
    username,
    full_name: fullName,
    email,
    avatar_url: text(input.avatarUrl, 1_000) || null,
    phone: text(input.phone, 80) || null,
    job_title: text(input.jobTitle, 120) || null,
    division: text(input.division, 120),
    timezone: text(input.timezone, 80) || 'Asia/Makassar',
    capacity_hours: boundedCapacity(input.capacityHours),
    role,
    status: normalizeStatus(input.status),
    must_change_password: input.mustChangePassword !== false,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' });
  if (profileError) throw new Error(profileError.message);

  const { error: roleError } = await admin.from('app_user_roles').upsert({
    email,
    user_id: input.userId,
    display_name: fullName,
    role,
    is_superuser: isSuperuser,
    status: normalizeStatus(input.status),
    page_access: pageAccess,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'email' });
  if (roleError) throw new Error(roleError.message);

  const { error: memberError } = await admin.from('app_workspace_members').upsert({
    workspace_id: DEFAULT_APP_WORKSPACE_ID,
    user_id: input.userId,
    user_name: fullName,
    user_email: email,
    user_avatar: text(input.avatarUrl, 1_000) || '',
    role,
    status: normalizeStatus(input.status),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'workspace_id,user_id' });
  if (memberError) throw new Error(memberError.message);
  return { user_id: input.userId };
}

export async function createAuthUserAndProfile(input: ProvisionInput) {
  const admin = createSupabaseAdminClient();
  const email = validateEmail(input.email);
  const username = validateUsername(input.username);
  const password = validatePassword(input.password);
  const fullName = text(input.fullName, 180) || email.split('@')[0];

  await assertUsernameAvailable(username);

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      username,
    },
  });

  if (error || !data.user) {
    throw new Error(error?.message || 'Akun Supabase Auth gagal dibuat.');
  }

  try {
    const link = await linkAuthUserToProfile({ ...input, email, username, fullName, userId: data.user.id });
    return { user: data.user, link };
  } catch (error) {
    await admin.auth.admin.deleteUser(data.user.id).catch(() => null);
    throw error;
  }
}

export async function bootstrapRequired() {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (error) throw new Error(error.message || 'Gagal memeriksa status bootstrap.');
  return (data.users || []).length === 0;
}
