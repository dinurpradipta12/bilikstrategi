export type PageAccessKey =
  | 'dashboard'
  | 'projects'
  | 'tasks'
  | 'my_tasks'
  | 'timeline'
  | 'team'
  | 'attendance'
  | 'clients'
  | 'assets'
  | 'content_plan'
  | 'invoices'
  | 'quotes'
  | 'agreements'
  | 'performance'
  | 'approvals'
  | 'profitability'
  | 'notifications'
  | 'activity_logs'
  | 'settings'
  | 'calendar';

export type PageAccessMap = Record<PageAccessKey, boolean>;

export const PAGE_ACCESS_OPTIONS: ReadonlyArray<{
  key: PageAccessKey;
  label: string;
  href: string;
}> = [
  { key: 'dashboard', label: 'Dashboard', href: '/dashboard' },
  { key: 'projects', label: 'Projects', href: '/projects' },
  { key: 'tasks', label: 'ClickUp Tasks', href: '/tasks' },
  { key: 'my_tasks', label: 'My Tasks', href: '/my-tasks' },
  { key: 'timeline', label: 'Timeline', href: '/timeline' },
  { key: 'team', label: 'Team Workload', href: '/team' },
  { key: 'attendance', label: 'Presensi Live', href: '/attendance' },
  { key: 'clients', label: 'Client Listing', href: '/clients' },
  { key: 'assets', label: 'Asset Management', href: '/assets' },
  { key: 'content_plan', label: 'Content Plan & Sheets', href: '/content-plan' },
  { key: 'invoices', label: 'Invoices', href: '/invoices' },
  { key: 'quotes', label: 'Penawaran Harga', href: '/quotes' },
  { key: 'agreements', label: 'Collaboration Agreement', href: '/agreements' },
  { key: 'performance', label: 'KPI & Daily Activity', href: '/performance' },
  { key: 'approvals', label: 'Approval Center', href: '/approvals' },
  { key: 'profitability', label: 'Project Profitability', href: '/profitability' },
  { key: 'notifications', label: 'Notifications', href: '/notifications' },
  { key: 'activity_logs', label: 'Activity Log', href: '/activity-logs' },
  { key: 'settings', label: 'Settings', href: '/settings' },
  { key: 'calendar', label: 'Calendar', href: '/calendar' },
];

export const DEFAULT_PAGE_ACCESS: PageAccessMap = {
  dashboard: true,
  projects: true,
  tasks: true,
  my_tasks: true,
  timeline: true,
  team: true,
  attendance: true,
  clients: true,
  assets: true,
  content_plan: true,
  invoices: true,
  quotes: true,
  agreements: true,
  performance: true,
  approvals: true,
  profitability: false,
  notifications: true,
  activity_logs: true,
  settings: true,
  calendar: true,
};

export function normalizePageAccess(value: unknown): PageAccessMap {
  const normalized = { ...DEFAULT_PAGE_ACCESS };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return normalized;

  const source = value as Record<string, unknown>;
  for (const option of PAGE_ACCESS_OPTIONS) {
    if (typeof source[option.key] === 'boolean') {
      normalized[option.key] = source[option.key] as boolean;
    }
  }

  return normalized;
}

export function pageKeyForPathname(pathname: string): PageAccessKey | null {
  const path = pathname === '/' ? '/dashboard' : pathname;
  const option = PAGE_ACCESS_OPTIONS.find(
    (candidate) => path === candidate.href || path.startsWith(`${candidate.href}/`)
  );
  return option?.key || null;
}

export function firstAllowedPagePath(access: PageAccessMap): string | null {
  return PAGE_ACCESS_OPTIONS.find((option) => access[option.key] !== false)?.href || null;
}
