export const PRESENCE_HEARTBEAT_STALE_MS = 3 * 60 * 1000;
export const PRESENCE_IDLE_MS = 5 * 60 * 1000;
export const PRESENCE_REVIEW_MS = 2 * 60 * 60 * 1000;
export const PRESENCE_CRITICAL_MS = 4 * 60 * 60 * 1000;

export type PresenceState =
  | 'active'
  | 'idle'
  | 'away'
  | 'needs_review'
  | 'critical'
  | 'paused'
  | 'untracked'
  | 'offline';

export type PresenceSnapshot = {
  state: PresenceState;
  inactiveMs: number;
  unseenMs: number;
};

type PresenceSession = {
  isOnline?: boolean;
  isPaused?: boolean;
  lastActivityAt?: string;
  lastSeenAt?: string;
  lastForegroundAt?: string;
};

const PAGE_LABELS: Array<[string, string]> = [
  ['/salary-slips', 'Slip Gaji'],
  ['/content-ideas', 'Content Idea Bank'],
  ['/content-plan', 'Content Plan'],
  ['/fee-calculator', 'Fee Calculator'],
  ['/profitability', 'Project Profitability'],
  ['/notifications', 'Notifikasi'],
  ['/automations', 'Automation Center'],
  ['/performance', 'KPI & Daily Activity'],
  ['/attendance', 'Presensi Live'],
  ['/approvals', 'Approval Center'],
  ['/agreements', 'Collaboration Agreement'],
  ['/dashboard', 'Dashboard'],
  ['/projects', 'Projects'],
  ['/my-tasks', 'My Tasks'],
  ['/tasks', 'ClickUp Tasks'],
  ['/timeline', 'Timeline'],
  ['/team', 'Team Workload'],
  ['/clients', 'Client Listing'],
  ['/assets', 'Asset Management'],
  ['/invoices', 'Invoices'],
  ['/quotes', 'Penawaran Harga'],
  ['/finance', 'Finance'],
  ['/settings', 'Settings'],
  ['/calendar', 'Calendar'],
];

function timestamp(value?: string) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function pageLabelForPath(pathname: string) {
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const match = PAGE_LABELS.find(([path]) => normalized === path || normalized.startsWith(`${path}/`));
  if (match) return match[1];

  return normalized
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.replace(/-/g, ' '))
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' / ') || 'Dashboard';
}

export function resolvePresenceSnapshot(session: PresenceSession, now = Date.now()): PresenceSnapshot {
  if (!session.isOnline) return { state: 'offline', inactiveMs: 0, unseenMs: 0 };
  if (session.isPaused) return { state: 'paused', inactiveMs: 0, unseenMs: 0 };

  const activityAt = timestamp(session.lastActivityAt);
  const seenAt = timestamp(session.lastSeenAt);
  const foregroundAt = timestamp(session.lastForegroundAt);
  if (!activityAt && !seenAt) {
    return { state: 'untracked', inactiveMs: Number.POSITIVE_INFINITY, unseenMs: Number.POSITIVE_INFINITY };
  }

  const inactiveMs = activityAt ? Math.max(0, now - activityAt) : Number.POSITIVE_INFINITY;
  const unseenMs = seenAt ? Math.max(0, now - seenAt) : Number.POSITIVE_INFINITY;

  if (inactiveMs >= PRESENCE_CRITICAL_MS) return { state: 'critical', inactiveMs, unseenMs };
  if (inactiveMs >= PRESENCE_REVIEW_MS) return { state: 'needs_review', inactiveMs, unseenMs };
  if (!foregroundAt) return { state: 'away', inactiveMs, unseenMs };
  if (foregroundAt && now - foregroundAt >= PRESENCE_HEARTBEAT_STALE_MS) {
    return { state: 'away', inactiveMs, unseenMs };
  }
  if (unseenMs >= PRESENCE_HEARTBEAT_STALE_MS) return { state: 'away', inactiveMs, unseenMs };
  if (inactiveMs >= PRESENCE_IDLE_MS) return { state: 'idle', inactiveMs, unseenMs };
  return { state: 'active', inactiveMs, unseenMs };
}

export function formatPresenceAge(durationMs: number) {
  if (!Number.isFinite(durationMs) || durationMs < 0) return 'belum terdeteksi';
  const minutes = Math.floor(durationMs / 60_000);
  if (minutes < 1) return 'baru saja';
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}j ${remainingMinutes}m` : `${hours}j`;
}

export function presenceStateRank(state: PresenceState) {
  return {
    active: 0,
    idle: 1,
    away: 2,
    needs_review: 3,
    critical: 4,
    paused: 5,
    untracked: 6,
    offline: 7,
  }[state];
}
