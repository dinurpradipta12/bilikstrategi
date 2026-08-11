import type { PerformanceItem, PerformanceProfile } from './types';

const SCOPE_PREFIX = /^(?:role|jabatan|position|division|divisi|team|tim|user|email)\s*:\s*/i;
const ALL_SCOPE_LABELS = new Set([
  '*',
  'all',
  'all team',
  'all user',
  'all users',
  'semua team',
  'semua tim',
  'semua user',
  'semua pengguna',
  'seluruh user',
  'seluruh pengguna',
]);

function normalizeLabel(value: unknown) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[‐‑‒–—―]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/\s*([/|,;])\s*/g, '$1')
    .replace(SCOPE_PREFIX, '')
    .trim();
}

function labelVariants(value: unknown) {
  const normalized = normalizeLabel(value);
  const variants = new Set<string>();
  if (!normalized) return variants;

  variants.add(normalized);
  normalized.split(/[\/|,;\n]+/).forEach((part) => {
    const variant = normalizeLabel(part);
    if (variant) variants.add(variant);
  });
  return variants;
}

function labelsMatch(left: unknown, right: unknown) {
  const leftVariants = labelVariants(left);
  const rightVariants = labelVariants(right);
  for (const variant of leftVariants) {
    if (rightVariants.has(variant)) return true;
  }
  return false;
}

export function performanceItemAppliesToProfile(item: PerformanceItem, profile: PerformanceProfile) {
  if (!item.active) return false;

  // Team scope always means every user. Also accept older/imported universal
  // labels such as "Semua Team" or "Semua User" instead of the canonical "*".
  if (item.scope_type === 'team' || ALL_SCOPE_LABELS.has(normalizeLabel(item.scope_value))) return true;
  if (item.scope_type === 'division') return labelsMatch(item.scope_value, profile.division);
  if (item.scope_type === 'role') return labelsMatch(item.scope_value, profile.role_title);
  return labelsMatch(item.scope_value, profile.user_email);
}

export function performanceItemAppearsInDailyList(item: PerformanceItem) {
  if (!item.active || item.item_type === 'job_description') return false;
  return item.item_type === 'daily_activity' || item.cadence === 'daily';
}
