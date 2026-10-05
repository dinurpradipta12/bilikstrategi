export const TEAM_MODULE_OPTIONS = [
  { key: 'projects', label: 'Project' },
  { key: 'tasks', label: 'Tugas dan My Tasks' },
  { key: 'timeline', label: 'Timeline dan Kalender' },
  { key: 'attendance', label: 'Presensi' },
  { key: 'chat', label: 'Chat tim' },
  { key: 'performance', label: 'KPI dan performa' },
  { key: 'approvals', label: 'Approval' },
  { key: 'automations', label: 'Automasi' },
  { key: 'clients', label: 'Client' },
  { key: 'assets', label: 'Aset' },
  { key: 'content_plan', label: 'Content Plan' },
  { key: 'content_ideas', label: 'Content Idea Bank' },
  { key: 'fee_calculator', label: 'Fee Calculator' },
  { key: 'invoices', label: 'Invoice' },
  { key: 'quotes', label: 'Penawaran' },
  { key: 'agreements', label: 'Perjanjian' },
  { key: 'profitability', label: 'Profitabilitas' },
  { key: 'finance', label: 'Finance' },
  { key: 'salary_slips', label: 'Slip Gaji' },
] as const;

export type TeamModuleKey = typeof TEAM_MODULE_OPTIONS[number]['key'];
export type TeamModuleMap = Record<TeamModuleKey, boolean>;

export const DEFAULT_TEAM_MODULES = Object.fromEntries(
  TEAM_MODULE_OPTIONS.map(({ key }) => [key, true]),
) as TeamModuleMap;

export function normalizeTeamModules(value: unknown): TeamModuleMap {
  const modules = { ...DEFAULT_TEAM_MODULES };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return modules;
  const source = value as Record<string, unknown>;
  for (const { key } of TEAM_MODULE_OPTIONS) {
    if (typeof source[key] === 'boolean') modules[key] = source[key];
  }
  return modules;
}

export function teamModuleForPage(pageKey: string): TeamModuleKey | null {
  if (pageKey === 'my_tasks') return 'tasks';
  if (pageKey === 'calendar') return 'timeline';
  return TEAM_MODULE_OPTIONS.find((option) => option.key === pageKey)?.key || null;
}

export type TeamBranding = {
  name: string;
  short_name: string;
  tagline: string;
  primary_color: string;
  accent_color: string;
  logo_url: string;
  icon_url: string;
  company_name: string;
  company_address: string;
  company_email: string;
  company_phone: string;
  modules_enabled: TeamModuleMap;
};

export const DEFAULT_BRANDING: TeamBranding = {
  name: 'Team Workspace',
  short_name: 'Team',
  tagline: 'Ruang kerja tim Anda',
  primary_color: '#24324A',
  accent_color: '#F26B5E',
  logo_url: '',
  icon_url: '',
  company_name: '',
  company_address: '',
  company_email: '',
  company_phone: '',
  modules_enabled: DEFAULT_TEAM_MODULES,
};

export function normalizeBranding(value: Partial<TeamBranding> | null | undefined): TeamBranding {
  return { ...DEFAULT_BRANDING, ...(value || {}), modules_enabled: normalizeTeamModules(value?.modules_enabled) };
}
