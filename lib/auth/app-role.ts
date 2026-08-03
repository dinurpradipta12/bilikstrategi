export type AppRole = 'owner' | 'admin' | 'member' | 'client';

// This account is the application owner, independent of the active ClickUp session.
export const SUPERUSER_EMAIL = 'snllabsarchive@gmail.com';

export function isSuperuserEmail(email?: string | null) {
  return String(email || '').trim().toLowerCase() === SUPERUSER_EMAIL;
}

export function normalizeAppRole(value: unknown): AppRole {
  if (typeof value === 'number') {
    if (value === 1) return 'owner';
    if (value === 2) return 'admin';
    return 'member';
  }

  const role = String(value || '').trim().toLowerCase();
  if (role === '1' || role.includes('owner')) return 'owner';
  if (role === '2' || role.includes('admin')) return 'admin';
  if (role.includes('client')) return 'client';
  return 'member';
}

export function appRoleToClickUpRole(role: AppRole) {
  return role === 'owner' ? 1 : role === 'admin' ? 2 : 3;
}
