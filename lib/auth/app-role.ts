export type AppRole = 'owner' | 'admin' | 'member' | 'client';

// This account is the application owner, independent of the active ClickUp session.
export const SUPERUSER_EMAIL = 'snllabsarchive@gmail.com';

/**
 * Cookie/query values can arrive URL-encoded, especially after OAuth redirects.
 * Keep one canonical identity comparison for every server and client guard.
 */
export function normalizeIdentityEmail(value: unknown) {
  let normalized = String(value ?? '').trim();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const decoded = decodeURIComponent(normalized).trim();
      if (decoded === normalized) break;
      normalized = decoded;
    } catch {
      break;
    }
  }

  return normalized.toLowerCase();
}

export function isSuperuserEmail(email?: unknown) {
  return normalizeIdentityEmail(email) === SUPERUSER_EMAIL;
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

/**
 * Owner/superuser accounts are unrestricted. Delegated admins still use the
 * per-user page access map so an admin can be limited to selected modules.
 */
export function hasUnrestrictedPageAccess(input: {
  appRole?: unknown;
  role?: unknown;
  isSuperuser?: unknown;
}) {
  return input.isSuperuser === true || normalizeAppRole(input.appRole ?? input.role) === 'owner';
}

export function appRoleToClickUpRole(role: AppRole) {
  return role === 'owner' ? 1 : role === 'admin' ? 2 : 3;
}
