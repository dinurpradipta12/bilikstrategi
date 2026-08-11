import { NextRequest, NextResponse } from 'next/server';
import { isSuperuserEmail, normalizeAppRole, normalizeIdentityEmail, type AppRole } from '@/lib/auth/app-role';
import { getAuthenticatedUser } from '@/lib/clickup/users';
import { isSupabaseAdminConfigured, supabaseAdminFetch } from '@/lib/supabase/admin-rest-client';
import type {
  PerformanceBootstrap,
  PerformanceCadence,
  PerformanceItem,
  PerformanceItemType,
  PerformanceProfile,
  PerformanceReview,
  PerformanceRoleRecord,
  PerformanceScopeType,
  PerformanceUpdate,
  PerformanceUpdateStatus,
  PerformanceViewer,
} from '@/lib/performance/types';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_WORKSPACE_ID = 'bilik-strategi';
const ITEM_TYPES: PerformanceItemType[] = ['job_description', 'daily_activity', 'objective', 'key_result', 'initiative'];
const CADENCES: PerformanceCadence[] = ['daily', 'weekly', 'monthly', 'quarterly', 'per_activity'];
const SCOPES: PerformanceScopeType[] = ['team', 'division', 'role', 'user'];
const UPDATE_STATUSES: PerformanceUpdateStatus[] = ['todo', 'in_progress', 'completed', 'blocked'];

type RequestIdentity = {
  email: string;
  name: string;
  avatarUrl: string;
};

type RequestContext = {
  identity: RequestIdentity;
  workspaceId: string;
  roleRecord: PerformanceRoleRecord | null;
  appRole: AppRole;
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

function cleanText(value: unknown, fallback = '', maxLength = 2000) {
  const text = String(value ?? fallback).trim();
  return text.slice(0, maxLength);
}

function cleanEmail(value: unknown) {
  return normalizeIdentityEmail(value).slice(0, 320);
}

function cleanNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function cleanDate(value: unknown, fallback: string) {
  const date = cleanText(value, fallback, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : fallback;
}

function getWorkspaceId(req: NextRequest) {
  const candidate = cleanText(req.cookies.get('app_workspace_id')?.value, DEFAULT_WORKSPACE_ID, 80);
  return /^[a-zA-Z0-9_-]+$/.test(candidate) ? candidate : DEFAULT_WORKSPACE_ID;
}

async function getRequestIdentity(req: NextRequest): Promise<RequestIdentity> {
  const cookieEmail = cleanEmail(decodeCookie(req.cookies.get('clickup_user_email')?.value));
  const cookieName = decodeCookie(req.cookies.get('clickup_user_name')?.value);
  const cookieAvatar = decodeCookie(req.cookies.get('clickup_user_avatar')?.value);

  if (cookieEmail) {
    const name = cookieName || cookieEmail.split('@')[0];
    return {
      email: cookieEmail,
      name,
      avatarUrl: cookieAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=24324A&color=fff`,
    };
  }

  const accessToken = req.cookies.get('clickup_access_token')?.value;
  if (accessToken) {
    try {
      const authenticated = await getAuthenticatedUser(accessToken);
      const user = authenticated?.user;
      const email = cleanEmail(user?.email);
      if (email) {
        const name = cleanText(user?.username, email.split('@')[0], 160);
        return {
          email,
          name,
          avatarUrl: cleanText(user?.profilePicture, `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=24324A&color=fff`, 1200),
        };
      }
    } catch {
      // Continue to the unauthenticated response below.
    }
  }

  return { email: '', name: cookieName || 'Pengguna', avatarUrl: cookieAvatar };
}

async function adminJson(path: string, init: RequestInit = {}) {
  const response = await supabaseAdminFetch(path, init);
  const text = await response.text();
  let parsed: any = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  if (!response.ok) {
    const message = typeof parsed === 'string'
      ? parsed
      : parsed?.message || parsed?.error_description || parsed?.hint || `Supabase REST error ${response.status}`;
    throw new Error(message);
  }
  return parsed;
}

async function getRoleRecord(email: string): Promise<PerformanceRoleRecord | null> {
  if (!email || !isSupabaseAdminConfigured()) return null;
  const rows = await adminJson(
    `app_user_roles?select=email,display_name,role,is_superuser,status&email=ilike.${encodeURIComponent(email)}&limit=1`
  );
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row) return null;
  return {
    email: cleanEmail(row.email),
    display_name: cleanText(row.display_name, email.split('@')[0], 160),
    role: normalizeAppRole(row.role),
    is_superuser: row.is_superuser === true,
    status: row.status === 'inactive' ? 'inactive' : 'active',
  };
}

async function getRequestContext(req: NextRequest): Promise<RequestContext> {
  const identity = await getRequestIdentity(req);
  const workspaceId = getWorkspaceId(req);
  const roleRecord = await getRoleRecord(identity.email).catch(() => null);
  const superuser = isSuperuserEmail(identity.email) || roleRecord?.is_superuser === true;
  const appRole = superuser ? 'owner' : normalizeAppRole(roleRecord?.role);
  const canManage = roleRecord?.status !== 'inactive' && (superuser || appRole === 'owner' || appRole === 'admin');
  return { identity, workspaceId, roleRecord, appRole, canManage };
}

function defaultProfile(context: RequestContext): PerformanceProfile {
  const { identity, workspaceId, roleRecord, appRole, canManage } = context;
  const roleTitle = appRole === 'owner'
    ? 'Owner / Project Lead'
    : appRole === 'admin'
      ? 'Workspace Admin'
      : appRole === 'client'
        ? 'Client'
        : 'Team Member';

  return {
    workspace_id: workspaceId,
    user_email: identity.email,
    display_name: roleRecord?.display_name || identity.name || identity.email.split('@')[0] || 'Pengguna',
    avatar_url: identity.avatarUrl || null,
    division: 'Agency Team',
    role_title: roleTitle,
    job_summary: '',
    manager_email: null,
    can_manage: canManage,
    active: roleRecord?.status !== 'inactive',
  };
}

function mapProfile(row: any): PerformanceProfile {
  return {
    workspace_id: cleanText(row.workspace_id, DEFAULT_WORKSPACE_ID, 80),
    user_email: cleanEmail(row.user_email),
    display_name: cleanText(row.display_name, 'Pengguna', 160),
    avatar_url: row.avatar_url ? cleanText(row.avatar_url, '', 1200) : null,
    division: cleanText(row.division, 'Agency Team', 160),
    role_title: cleanText(row.role_title, 'Team Member', 160),
    job_summary: cleanText(row.job_summary, '', 5000),
    manager_email: row.manager_email ? cleanEmail(row.manager_email) : null,
    can_manage: row.can_manage === true,
    active: row.active !== false,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapItem(row: any): PerformanceItem {
  return {
    id: cleanText(row.id, '', 80),
    workspace_id: cleanText(row.workspace_id, DEFAULT_WORKSPACE_ID, 80),
    parent_id: row.parent_id ? cleanText(row.parent_id, '', 80) : null,
    item_type: ITEM_TYPES.includes(row.item_type) ? row.item_type : 'initiative',
    title: cleanText(row.title, 'Kegiatan', 300),
    description: cleanText(row.description, '', 5000),
    cadence: CADENCES.includes(row.cadence) ? row.cadence : 'daily',
    scope_type: SCOPES.includes(row.scope_type) ? row.scope_type : 'team',
    scope_value: cleanText(row.scope_value, '*', 320),
    weight: cleanNumber(row.weight, 10, 0, 100),
    target_value: cleanNumber(row.target_value, 100, 0.01, 1_000_000),
    unit: cleanText(row.unit, 'percent', 80),
    sort_order: Math.round(cleanNumber(row.sort_order, 0, -100_000, 100_000)),
    active: row.active !== false,
    created_by: row.created_by || null,
    updated_by: row.updated_by || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapUpdate(row: any): PerformanceUpdate {
  return {
    id: cleanText(row.id, '', 80),
    workspace_id: cleanText(row.workspace_id, DEFAULT_WORKSPACE_ID, 80),
    item_id: row.item_id ? cleanText(row.item_id, '', 80) : null,
    user_email: cleanEmail(row.user_email),
    activity_date: cleanText(row.activity_date, '', 10),
    title: cleanText(row.title, 'Aktivitas', 300),
    details: cleanText(row.details, '', 5000),
    progress: Math.round(cleanNumber(row.progress, 0, 0, 100)),
    status: UPDATE_STATUSES.includes(row.status) ? row.status : 'todo',
    evidence_url: row.evidence_url ? cleanText(row.evidence_url, '', 1200) : null,
    blocker_note: row.blocker_note ? cleanText(row.blocker_note, '', 2000) : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapReview(row: any): PerformanceReview {
  return {
    id: cleanText(row.id, '', 80),
    workspace_id: cleanText(row.workspace_id, DEFAULT_WORKSPACE_ID, 80),
    user_email: cleanEmail(row.user_email),
    reviewer_email: cleanEmail(row.reviewer_email),
    period_start: cleanText(row.period_start, '', 10),
    period_end: cleanText(row.period_end, '', 10),
    overall_score: cleanNumber(row.overall_score, 0, 0, 100),
    quality_score: cleanNumber(row.quality_score, 0, 0, 100),
    ownership_score: cleanNumber(row.ownership_score, 0, 0, 100),
    collaboration_score: cleanNumber(row.collaboration_score, 0, 0, 100),
    notes: cleanText(row.notes, '', 5000),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function itemAppliesToProfile(item: PerformanceItem, profile: PerformanceProfile) {
  if (!item.active) return false;
  const scopeValue = item.scope_value.trim().toLowerCase();
  if (item.scope_type === 'team') return scopeValue === '*' || scopeValue === 'all' || !scopeValue;
  if (item.scope_type === 'division') return profile.division.trim().toLowerCase() === scopeValue;
  if (item.scope_type === 'role') return profile.role_title.trim().toLowerCase() === scopeValue;
  return profile.user_email.trim().toLowerCase() === scopeValue;
}

function mergeProfiles(
  workspaceId: string,
  storedProfiles: PerformanceProfile[],
  roles: PerformanceRoleRecord[]
) {
  const profileByEmail = new Map(storedProfiles.map((profile) => [profile.user_email, profile]));
  for (const role of roles) {
    if (!role.email || profileByEmail.has(role.email)) continue;
    const roleTitle = role.role === 'owner'
      ? 'Owner / Project Lead'
      : role.role === 'admin'
        ? 'Workspace Admin'
        : role.role === 'client'
          ? 'Client'
          : 'Team Member';
    profileByEmail.set(role.email, {
      workspace_id: workspaceId,
      user_email: role.email,
      display_name: role.display_name,
      avatar_url: null,
      division: 'Agency Team',
      role_title: roleTitle,
      job_summary: '',
      manager_email: null,
      can_manage: role.role === 'owner' || role.role === 'admin' || role.is_superuser,
      active: role.status === 'active',
    });
  }
  return Array.from(profileByEmail.values()).sort((a, b) => a.display_name.localeCompare(b.display_name, 'id'));
}

function emptyBootstrap(context: RequestContext, warning: string): PerformanceBootstrap {
  const profile = defaultProfile(context);
  const viewer: PerformanceViewer = {
    email: context.identity.email,
    name: context.identity.name,
    avatar_url: context.identity.avatarUrl,
    app_role: context.appRole,
    can_manage: context.canManage,
  };
  return {
    storage_ready: false,
    workspace_id: context.workspaceId,
    viewer,
    profile,
    profiles: [profile],
    items: [],
    updates: [],
    reviews: [],
    roles: [],
    refreshed_at: new Date().toISOString(),
    warning,
  };
}

function noStoreJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Cache-Control', 'no-store');
  return NextResponse.json(body, { ...init, headers });
}

export async function GET(req: NextRequest) {
  const context = await getRequestContext(req);
  if (!context.identity.email) {
    return noStoreJson({ error: 'Sesi pengguna tidak memiliki identitas email.' }, { status: 401 });
  }

  if (!isSupabaseAdminConfigured()) {
    return noStoreJson(emptyBootstrap(context, 'SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi.'));
  }

  try {
    const workspace = encodeURIComponent(context.workspaceId);
    const since = new Date();
    since.setDate(since.getDate() - 92);
    const sinceDate = since.toISOString().slice(0, 10);

    const [profileRows, itemRows, updateRows, reviewRows, roleRows, workspaceMemberRows] = await Promise.all([
      adminJson(`app_performance_profiles?select=*&workspace_id=eq.${workspace}&order=display_name.asc`),
      adminJson(`app_performance_items?select=*&workspace_id=eq.${workspace}&order=sort_order.asc,created_at.asc`),
      adminJson(`app_performance_updates?select=*&workspace_id=eq.${workspace}&activity_date=gte.${sinceDate}&order=activity_date.desc,updated_at.desc`),
      adminJson(`app_performance_reviews?select=*&workspace_id=eq.${workspace}&order=period_end.desc,updated_at.desc`),
      adminJson('app_user_roles?select=email,display_name,role,is_superuser,status&status=eq.active&order=display_name.asc'),
      adminJson(`app_workspace_members?select=user_email,user_avatar&workspace_id=eq.${workspace}&status=eq.active`).catch(() => []),
    ]);

    const roles: PerformanceRoleRecord[] = (Array.isArray(roleRows) ? roleRows : []).map((row: any) => ({
      email: cleanEmail(row.email),
      display_name: cleanText(row.display_name, String(row.email || '').split('@')[0] || 'Pengguna', 160),
      role: normalizeAppRole(row.role),
      is_superuser: row.is_superuser === true,
      status: row.status === 'inactive' ? 'inactive' : 'active',
    }));
    const storedProfiles = (Array.isArray(profileRows) ? profileRows : []).map(mapProfile);
    const clickUpAvatarByEmail = new Map<string, string>();
    (Array.isArray(workspaceMemberRows) ? workspaceMemberRows : []).forEach((row: any) => {
      const email = cleanEmail(row.user_email);
      const avatar = cleanText(row.user_avatar, '', 1200);
      if (email && avatar) clickUpAvatarByEmail.set(email, avatar);
    });
    const profiles = mergeProfiles(context.workspaceId, storedProfiles, roles).map((profile) => ({
      ...profile,
      avatar_url: clickUpAvatarByEmail.get(profile.user_email)
        || (profile.user_email === context.identity.email ? context.identity.avatarUrl || null : null),
    }));
    const currentProfile = profiles.find((profile) => profile.user_email === context.identity.email) || defaultProfile(context);
    const allItems = (Array.isArray(itemRows) ? itemRows : []).map(mapItem);
    const allUpdates = (Array.isArray(updateRows) ? updateRows : []).map(mapUpdate);
    const allReviews = (Array.isArray(reviewRows) ? reviewRows : []).map(mapReview);
    const viewer: PerformanceViewer = {
      email: context.identity.email,
      name: context.identity.name,
      avatar_url: context.identity.avatarUrl,
      app_role: context.appRole,
      can_manage: context.canManage,
    };

    const response: PerformanceBootstrap = context.canManage
      ? {
          storage_ready: true,
          workspace_id: context.workspaceId,
          viewer,
          profile: currentProfile,
          profiles,
          items: allItems,
          updates: allUpdates,
          reviews: allReviews,
          roles,
          refreshed_at: new Date().toISOString(),
        }
      : {
          storage_ready: true,
          workspace_id: context.workspaceId,
          viewer,
          profile: currentProfile,
          profiles: [currentProfile],
          items: allItems.filter((item) => itemAppliesToProfile(item, currentProfile)),
          updates: allUpdates.filter((update) => update.user_email === context.identity.email),
          reviews: allReviews.filter((review) => review.user_email === context.identity.email),
          roles: [],
          refreshed_at: new Date().toISOString(),
        };

    return noStoreJson(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tabel performance belum tersedia.';
    return noStoreJson(emptyBootstrap(context, message));
  }
}

function requireStorage() {
  if (!isSupabaseAdminConfigured()) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi di environment server.');
  }
}

function ensureManager(context: RequestContext) {
  if (!context.canManage) {
    throw new Error('Hanya Owner atau Admin Workspace yang dapat mengatur KPI dan job description.');
  }
}

export async function POST(req: NextRequest) {
  const context = await getRequestContext(req);
  if (!context.identity.email) {
    return noStoreJson({ error: 'Sesi pengguna tidak memiliki identitas email.' }, { status: 401 });
  }

  try {
    requireStorage();
    const body = await req.json().catch(() => ({}));
    const action = cleanText(body.action, '', 80);
    const workspace = encodeURIComponent(context.workspaceId);
    const now = new Date().toISOString();
    const today = now.slice(0, 10);

    if (action === 'save_profile') {
      ensureManager(context);
      const userEmail = cleanEmail(body.user_email);
      if (!userEmail) throw new Error('Email anggota wajib diisi.');
      const payload = {
        workspace_id: context.workspaceId,
        user_email: userEmail,
        display_name: cleanText(body.display_name, userEmail.split('@')[0], 160),
        division: cleanText(body.division, 'Agency Team', 160),
        role_title: cleanText(body.role_title, 'Team Member', 160),
        job_summary: cleanText(body.job_summary, '', 5000),
        manager_email: cleanEmail(body.manager_email) || null,
        can_manage: body.can_manage === true,
        active: body.active !== false,
        updated_at: now,
      };
      const saved = await adminJson('app_performance_profiles?on_conflict=workspace_id,user_email', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(payload),
      });
      return noStoreJson({ success: true, profile: mapProfile(Array.isArray(saved) ? saved[0] : saved) });
    }

    if (action === 'save_item') {
      ensureManager(context);
      const itemType: PerformanceItemType = ITEM_TYPES.includes(body.item_type) ? body.item_type : 'initiative';
      const cadence: PerformanceCadence = CADENCES.includes(body.cadence) ? body.cadence : 'daily';
      const scopeType: PerformanceScopeType = SCOPES.includes(body.scope_type) ? body.scope_type : 'team';
      const title = cleanText(body.title, '', 300);
      if (!title) throw new Error('Nama KPI atau kegiatan wajib diisi.');
      const parentId = cleanText(body.parent_id, '', 80) || null;
      const payload = {
        workspace_id: context.workspaceId,
        parent_id: parentId,
        item_type: itemType,
        title,
        description: cleanText(body.description, '', 5000),
        cadence,
        scope_type: scopeType,
        scope_value: scopeType === 'team' ? '*' : cleanText(body.scope_value, '', 320),
        weight: cleanNumber(body.weight, 10, 0, 100),
        target_value: cleanNumber(body.target_value, 100, 0.01, 1_000_000),
        unit: cleanText(body.unit, 'percent', 80),
        sort_order: Math.round(cleanNumber(body.sort_order, 0, -100_000, 100_000)),
        active: body.active !== false,
        updated_by: context.identity.email,
        updated_at: now,
      };
      const itemId = cleanText(body.id, '', 80);
      const saved = itemId
        ? await adminJson(`app_performance_items?id=eq.${encodeURIComponent(itemId)}&workspace_id=eq.${workspace}`, {
            method: 'PATCH',
            headers: { Prefer: 'return=representation' },
            body: JSON.stringify(payload),
          })
        : await adminJson('app_performance_items', {
            method: 'POST',
            headers: { Prefer: 'return=representation' },
            body: JSON.stringify({ ...payload, created_by: context.identity.email }),
          });
      const row = Array.isArray(saved) ? saved[0] : saved;
      return noStoreJson({ success: true, item: row ? mapItem(row) : null });
    }

    if (action === 'delete_item') {
      ensureManager(context);
      const itemId = cleanText(body.id, '', 80);
      if (!itemId) throw new Error('ID KPI tidak ditemukan.');
      await adminJson(`app_performance_items?id=eq.${encodeURIComponent(itemId)}&workspace_id=eq.${workspace}`, {
        method: 'DELETE',
        headers: { Prefer: 'return=minimal' },
      });
      return noStoreJson({ success: true });
    }

    if (action === 'save_update') {
      const requestedEmail = cleanEmail(body.user_email);
      const userEmail = context.canManage && requestedEmail ? requestedEmail : context.identity.email;
      if (!context.canManage && requestedEmail && requestedEmail !== context.identity.email) {
        return noStoreJson({ error: 'Member hanya dapat mengubah progres miliknya sendiri.' }, { status: 403 });
      }
      const title = cleanText(body.title, '', 300);
      if (!title) throw new Error('Nama aktivitas wajib diisi.');
      const itemId = cleanText(body.item_id, '', 80) || null;
      const activityDate = cleanDate(body.activity_date, today);
      const progress = Math.round(cleanNumber(body.progress, 0, 0, 100));
      const status: PerformanceUpdateStatus = UPDATE_STATUSES.includes(body.status)
        ? body.status
        : progress >= 100
          ? 'completed'
          : progress > 0
            ? 'in_progress'
            : 'todo';
      const payload = {
        workspace_id: context.workspaceId,
        item_id: itemId,
        user_email: userEmail,
        activity_date: activityDate,
        title,
        details: cleanText(body.details, '', 5000),
        progress,
        status,
        evidence_url: cleanText(body.evidence_url, '', 1200) || null,
        blocker_note: cleanText(body.blocker_note, '', 2000) || null,
        updated_at: now,
      };
      const updateId = cleanText(body.id, '', 80);
      let saved: any;
      if (updateId) {
        saved = await adminJson(
          `app_performance_updates?id=eq.${encodeURIComponent(updateId)}&workspace_id=eq.${workspace}&user_email=eq.${encodeURIComponent(userEmail)}`,
          {
            method: 'PATCH',
            headers: { Prefer: 'return=representation' },
            body: JSON.stringify(payload),
          }
        );
      } else if (itemId) {
        saved = await adminJson(
          'app_performance_updates?on_conflict=workspace_id,item_id,user_email,activity_date',
          {
            method: 'POST',
            headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
            body: JSON.stringify(payload),
          }
        );
      } else {
        saved = await adminJson('app_performance_updates', {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify(payload),
        });
      }
      const row = Array.isArray(saved) ? saved[0] : saved;
      return noStoreJson({ success: true, update: row ? mapUpdate(row) : null });
    }

    if (action === 'delete_update') {
      const updateId = cleanText(body.id, '', 80);
      if (!updateId) throw new Error('ID aktivitas tidak ditemukan.');
      const ownershipFilter = context.canManage ? '' : `&user_email=eq.${encodeURIComponent(context.identity.email)}`;
      await adminJson(
        `app_performance_updates?id=eq.${encodeURIComponent(updateId)}&workspace_id=eq.${workspace}${ownershipFilter}`,
        { method: 'DELETE', headers: { Prefer: 'return=minimal' } }
      );
      return noStoreJson({ success: true });
    }

    if (action === 'save_review') {
      ensureManager(context);
      const userEmail = cleanEmail(body.user_email);
      if (!userEmail) throw new Error('Pilih anggota yang akan dinilai.');
      const periodStart = cleanDate(body.period_start, today.slice(0, 8) + '01');
      const periodEnd = cleanDate(body.period_end, today);
      if (periodStart > periodEnd) throw new Error('Periode mulai tidak boleh melewati periode selesai.');
      const payload = {
        workspace_id: context.workspaceId,
        user_email: userEmail,
        reviewer_email: context.identity.email,
        period_start: periodStart,
        period_end: periodEnd,
        overall_score: cleanNumber(body.overall_score, 0, 0, 100),
        quality_score: cleanNumber(body.quality_score, 0, 0, 100),
        ownership_score: cleanNumber(body.ownership_score, 0, 0, 100),
        collaboration_score: cleanNumber(body.collaboration_score, 0, 0, 100),
        notes: cleanText(body.notes, '', 5000),
        updated_at: now,
      };
      const saved = await adminJson(
        'app_performance_reviews?on_conflict=workspace_id,user_email,period_start,period_end',
        {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
          body: JSON.stringify(payload),
        }
      );
      const row = Array.isArray(saved) ? saved[0] : saved;
      return noStoreJson({ success: true, review: row ? mapReview(row) : null });
    }

    return noStoreJson({ error: 'Aksi performance tidak dikenali.' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal menyimpan data performance.';
    const forbidden = message.startsWith('Hanya Owner') || message.includes('miliknya sendiri');
    const storageUnavailable = message.includes('SUPABASE_SERVICE_ROLE_KEY') || message.includes('schema cache') || message.includes('Could not find');
    return noStoreJson({ error: message }, { status: forbidden ? 403 : storageUnavailable ? 503 : 400 });
  }
}
