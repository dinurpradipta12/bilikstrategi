'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  BarChart3,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Edit3,
  FileText,
  Goal,
  ListChecks,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Target,
  Trash2,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import {
  PERFORMANCE_CADENCE_LABELS,
  PERFORMANCE_ITEM_LABELS,
  PERFORMANCE_STATUS_LABELS,
  type PerformanceBootstrap,
  type PerformanceItem,
  type PerformanceItemType,
  type PerformanceProfile,
  type PerformanceReview,
  type PerformanceUpdate,
  type PerformanceUpdateStatus,
} from '@/lib/performance/types';
import {
  performanceItemAppearsInDailyList,
  performanceItemAppliesToProfile,
} from '@/lib/performance/rules';

type SaveAction = (payload: Record<string, unknown>) => Promise<any>;

const panelClass = 'rounded-2xl border border-[#E5E7EB] bg-white shadow-sm dark:border-[#303742] dark:bg-[#171B22]';
const inputClass = 'w-full rounded-xl border border-[#DDE1E7] bg-white px-3 py-2.5 text-sm text-[#24324A] outline-none transition focus:border-[#F26B5E] focus:ring-2 focus:ring-[#F26B5E]/10 dark:border-[#3A424F] dark:bg-[#11151B] dark:text-[#F4F6FA]';
const labelClass = 'mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#737680] dark:text-[#98A2B3]';

const PROFILE_THEMES = [
  { gradient: 'linear-gradient(135deg, #FFD9D4 0%, #FFB8AE 100%)', avatar: 'FFD9D4' },
  { gradient: 'linear-gradient(135deg, #DDF6E8 0%, #AEE7C8 100%)', avatar: 'DDF6E8' },
  { gradient: 'linear-gradient(135deg, #DFEAFF 0%, #B8D1FF 100%)', avatar: 'DFEAFF' },
  { gradient: 'linear-gradient(135deg, #F2E2FF 0%, #D8BDF2 100%)', avatar: 'F2E2FF' },
  { gradient: 'linear-gradient(135deg, #FFF1C9 0%, #FFD98C 100%)', avatar: 'FFF1C9' },
  { gradient: 'linear-gradient(135deg, #DDF5F5 0%, #AADFE2 100%)', avatar: 'DDF5F5' },
  { gradient: 'linear-gradient(135deg, #FFE2EF 0%, #F5B8D3 100%)', avatar: 'FFE2EF' },
  { gradient: 'linear-gradient(135deg, #E8E3FF 0%, #C8BDF8 100%)', avatar: 'E8E3FF' },
] as const;

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function formatDate(value: string, options?: Intl.DateTimeFormatOptions) {
  if (!value) return '-';
  const date = new Date(`${value}${value.length === 10 ? 'T00:00:00' : ''}`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('id-ID', options || { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function profileTheme(profile: PerformanceProfile) {
  const key = `${profile.user_email}|${profile.display_name}`;
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = ((hash << 5) - hash + key.charCodeAt(index)) | 0;
  }
  return PROFILE_THEMES[Math.abs(hash) % PROFILE_THEMES.length];
}

function avatarFor(profile: PerformanceProfile) {
  const theme = profileTheme(profile);
  return profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.display_name)}&background=${theme.avatar}&color=24324A`;
}

function scopeLabel(item: PerformanceItem, profiles: PerformanceProfile[] = []) {
  if (item.scope_type === 'team') return 'Semua User';
  if (item.scope_type === 'division') return `Divisi: ${item.scope_value}`;
  if (item.scope_type === 'role') return `Jabatan: ${item.scope_value}`;
  const targetEmail = item.scope_value.trim().toLowerCase();
  const profile = profiles.find((candidate) => candidate.user_email.trim().toLowerCase() === targetEmail);
  return `User: ${profile?.display_name || item.scope_value}`;
}

function latestReview(reviews: PerformanceReview[], email: string) {
  return reviews
    .filter((review) => review.user_email === email)
    .sort((a, b) => b.period_end.localeCompare(a.period_end))[0];
}

function latestUpdate(updates: PerformanceUpdate[], email: string, itemId: string | null, date?: string) {
  return updates
    .filter((update) => (
      update.user_email === email &&
      update.item_id === itemId &&
      (!date || update.activity_date === date)
    ))
    .sort((a, b) => String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || '')))[0];
}

function progressColor(progress: number) {
  if (progress >= 80) return '#4F9D78';
  if (progress >= 50) return '#E6A23C';
  return '#F26B5E';
}

function statusClasses(status: PerformanceUpdateStatus) {
  if (status === 'completed') return 'bg-[#EAF6EF] text-[#347256] dark:bg-[#1E3A2D] dark:text-[#78C59A]';
  if (status === 'in_progress') return 'bg-[#EAF1FF] text-[#376BB2] dark:bg-[#1E304D] dark:text-[#7EA8E7]';
  if (status === 'blocked') return 'bg-[#FFF0ED] text-[#C45449] dark:bg-[#4A2725] dark:text-[#F49B92]';
  return 'bg-[#F1F2F4] text-[#737680] dark:bg-[#272D36] dark:text-[#AAB2BF]';
}

function cadenceClasses(cadence: PerformanceItem['cadence']) {
  if (cadence === 'daily') return 'bg-[#DDEBE2] text-[#315E46]';
  if (cadence === 'weekly') return 'bg-[#E9DDF5] text-[#654281]';
  if (cadence === 'monthly') return 'bg-[#E8E8E8] text-[#505050]';
  if (cadence === 'quarterly') return 'bg-[#F5E0D3] text-[#704629]';
  return 'bg-[#EDE3DE] text-[#664D42]';
}

function ProgressBar({ value, compact = false }: { value: number; compact?: boolean }) {
  const safe = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <div className={`w-full overflow-hidden rounded-full bg-[#ECEEF1] dark:bg-[#303742] ${compact ? 'h-1.5' : 'h-2.5'}`}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${safe}%`, backgroundColor: progressColor(safe) }}
      />
    </div>
  );
}

function EmptyState({ icon: Icon, title, description }: { icon: typeof Target; title: string; description: string }) {
  return (
    <div className={`${panelClass} flex min-h-56 flex-col items-center justify-center px-6 py-10 text-center`}>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F1F4F8] text-[#737680] dark:bg-[#252B34] dark:text-[#98A2B3]">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-sm font-extrabold text-[#24324A] dark:text-[#F4F6FA]">{title}</h3>
      <p className="mt-2 max-w-md text-xs leading-5 text-[#737680] dark:text-[#98A2B3]">{description}</p>
    </div>
  );
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div data-mobile-modal className="fixed inset-0 z-[120] flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm md:items-center md:p-5">
      <div data-mobile-modal-panel className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-[#E5E7EB] bg-white shadow-2xl dark:border-[#303742] dark:bg-[#171B22] md:max-w-2xl md:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-[#E8E8EC] bg-white/95 px-5 py-4 backdrop-blur dark:border-[#303742] dark:bg-[#171B22]/95">
          <div>
            <h2 className="text-base font-extrabold text-[#24324A] dark:text-[#F4F6FA]">{title}</h2>
            {subtitle && <p className="mt-1 text-xs text-[#737680] dark:text-[#98A2B3]">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-[#737680] hover:bg-[#F2F3F5] dark:hover:bg-[#252B34]" aria-label="Tutup modal">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function StorageWarning({ message }: { message?: string }) {
  return (
    <div className="mb-5 flex items-start gap-3 rounded-2xl border border-[#F4C7C2] bg-[#FFF5F3] p-4 text-[#8D3E37] dark:border-[#6B3834] dark:bg-[#351F1E] dark:text-[#F4AAA3]">
      <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
      <div>
        <p className="text-sm font-extrabold">Penyimpanan KPI belum aktif</p>
        <p className="mt-1 text-xs leading-5">
          Jalankan migration <code className="font-bold">20260811130000_performance_kpi_activity.sql</code> di Supabase. {message || ''}
        </p>
      </div>
    </div>
  );
}

function PageHeader({ data, refreshing, onRefresh }: { data: PerformanceBootstrap; refreshing: boolean; onRefresh: () => void }) {
  return (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="mb-2 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#F26B5E]">
          <Target className="h-4 w-4" />
          People Performance
        </div>
        <h1 className="text-2xl font-black tracking-tight text-[#24324A] dark:text-[#F4F6FA] sm:text-3xl">
          KPI &amp; Daily Activity
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#737680] dark:text-[#98A2B3]">
          {data.viewer.can_manage
            ? 'Pantau completion rate, atur job description, evaluasi progres team, dan laporkan daily activity Anda sendiri.'
            : 'Kelola checklist harian, laporkan progres, dan lihat target serta evaluasi sesuai role Anda.'}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-right dark:border-[#303742] dark:bg-[#171B22] sm:block">
          <div className="flex items-center justify-end gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#4F9D78]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#4F9D78]" />
            Sinkron 5 detik
          </div>
          <p className="mt-0.5 text-[10px] text-[#737680] dark:text-[#98A2B3]">Terakhir {new Date(data.refreshed_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-xl border border-[#DDE1E7] bg-white px-3.5 py-2.5 text-xs font-extrabold text-[#24324A] shadow-sm transition hover:border-[#F26B5E] disabled:opacity-60 dark:border-[#3A424F] dark:bg-[#171B22] dark:text-[#F4F6FA]"
        >
          <RefreshCw className={`h-4 w-4 text-[#F26B5E] ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, helper, tone }: { icon: typeof Target; label: string; value: string; helper: string; tone: string }) {
  return (
    <div className={`${panelClass} p-4 sm:p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#737680] dark:text-[#98A2B3]">{label}</p>
          <p className="mt-2 text-2xl font-black text-[#24324A] dark:text-[#F4F6FA]">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${tone}18`, color: tone }}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-3 text-[11px] leading-5 text-[#737680] dark:text-[#98A2B3]">{helper}</p>
    </div>
  );
}

type ItemDraft = {
  id?: string;
  parent_id: string;
  item_type: PerformanceItemType;
  title: string;
  description: string;
  cadence: PerformanceItem['cadence'];
  scope_type: PerformanceItem['scope_type'];
  scope_value: string;
  weight: number;
  target_value: number;
  unit: string;
  sort_order: number;
  active: boolean;
};

const emptyItemDraft: ItemDraft = {
  parent_id: '',
  item_type: 'daily_activity',
  title: '',
  description: '',
  cadence: 'daily',
  scope_type: 'team',
  scope_value: '*',
  weight: 10,
  target_value: 100,
  unit: 'percent',
  sort_order: 0,
  active: true,
};

const emptyJobDescriptionDraft: ItemDraft = {
  parent_id: '',
  item_type: 'job_description',
  title: '',
  description: '',
  cadence: 'per_activity',
  scope_type: 'team',
  scope_value: '*',
  weight: 0,
  target_value: 100,
  unit: 'text',
  sort_order: 0,
  active: true,
};

type ProfileDraft = {
  user_email: string;
  display_name: string;
  division: string;
  role_title: string;
  job_summary: string;
  manager_email: string;
  can_manage: boolean;
  active: boolean;
};

function ManagerWorkspace({ data, saveAction }: { data: PerformanceBootstrap; saveAction: SaveAction }) {
  const [tab, setTab] = useState<'overview' | 'jobdesc' | 'items' | 'activity' | 'team' | 'reviews'>('overview');
  const [itemDraft, setItemDraft] = useState<ItemDraft | null>(null);
  const [profileDraft, setProfileDraft] = useState<ProfileDraft | null>(null);
  const [reviewDraft, setReviewDraft] = useState({
    user_email: '', period_start: startOfMonthKey(), period_end: localDateKey(), overall_score: 80,
    quality_score: 80, ownership_score: 80, collaboration_score: 80, notes: '',
  });
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [jobDescriptionSearch, setJobDescriptionSearch] = useState('');
  const [itemType, setItemType] = useState<'all' | PerformanceItemType>('all');
  const [activityDate, setActivityDate] = useState(localDateKey());
  const today = localDateKey();

  const activeProfiles = useMemo(() => data.profiles.filter((profile) => profile.active), [data.profiles]);

  const memberMetrics = useMemo(() => activeProfiles.map((profile) => {
    const dailyItems = data.items.filter((item) => (
      performanceItemAppliesToProfile(item, profile) &&
      performanceItemAppearsInDailyList(item)
    ));
    const todayRows = data.updates.filter((update) => update.user_email === profile.user_email && update.activity_date === today);
    const templateProgress = dailyItems.map((item) => latestUpdate(todayRows, profile.user_email, item.id, today)?.progress || 0);
    const completion = templateProgress.length > 0 ? average(templateProgress) : average(todayRows.map((update) => update.progress));
    const completed = todayRows.filter((update) => update.status === 'completed').length;
    const blocked = todayRows.filter((update) => update.status === 'blocked').length;
    const latest = data.updates
      .filter((update) => update.user_email === profile.user_email)
      .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))[0];
    return { profile, completion, completed, expected: dailyItems.length, blocked, latest };
  }), [activeProfiles, data.items, data.updates, today]);

  const teamCompletion = average(memberMetrics.map((metric) => metric.completion));
  const todayUpdates = data.updates.filter((update) => update.activity_date === today);
  const completedToday = todayUpdates.filter((update) => update.status === 'completed').length;
  const activeGoals = data.items.filter((item) => item.active && (item.item_type === 'objective' || item.item_type === 'key_result')).length;
  const attentionCount = memberMetrics.filter((metric) => metric.completion < 50 || metric.blocked > 0).length;

  const filteredItems = data.items.filter((item) => {
    const query = search.toLowerCase().trim();
    return item.item_type !== 'job_description' && (itemType === 'all' || item.item_type === itemType) && (
      !query || item.title.toLowerCase().includes(query) || item.scope_value.toLowerCase().includes(query)
    );
  });

  const jobDescriptionItems = data.items.filter((item) => {
    if (item.item_type !== 'job_description') return false;
    const query = jobDescriptionSearch.toLowerCase().trim();
    return !query || item.title.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query) || item.scope_value.toLowerCase().includes(query);
  });

  const filteredUpdates = data.updates.filter((update) => update.activity_date === activityDate);

  const openNewProfile = () => {
    const firstRole = data.roles.find((role) => !data.profiles.some((profile) => profile.user_email === role.email));
    setProfileDraft({
      user_email: firstRole?.email || '',
      display_name: firstRole?.display_name || '',
      division: 'Agency Team',
      role_title: 'Team Member',
      job_summary: '',
      manager_email: '',
      can_manage: firstRole?.role === 'owner' || firstRole?.role === 'admin',
      active: true,
    });
  };

  const editProfile = (profile: PerformanceProfile) => setProfileDraft({
    user_email: profile.user_email,
    display_name: profile.display_name,
    division: profile.division,
    role_title: profile.role_title,
    job_summary: profile.job_summary,
    manager_email: profile.manager_email || '',
    can_manage: profile.can_manage,
    active: profile.active,
  });

  const editItem = (item: PerformanceItem) => setItemDraft({
    id: item.id,
    parent_id: item.parent_id || '',
    item_type: item.item_type,
    title: item.title,
    description: item.description,
    cadence: item.cadence,
    scope_type: item.scope_type,
    scope_value: item.scope_value,
    weight: item.weight,
    target_value: item.target_value,
    unit: item.unit,
    sort_order: item.sort_order,
    active: item.active,
  });

  const openNewJobDescription = () => {
    const nextSortOrder = data.items
      .filter((item) => item.item_type === 'job_description')
      .reduce((highest, item) => Math.max(highest, item.sort_order), 0) + 10;
    setItemDraft({ ...emptyJobDescriptionDraft, sort_order: nextSortOrder });
  };

  const submitItem = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!itemDraft || saving) return;
    setSaving(true);
    try {
      const normalizedDraft = itemDraft.item_type === 'job_description'
        ? { ...itemDraft, parent_id: '', cadence: 'per_activity', weight: 0, target_value: 100, unit: 'text' }
        : itemDraft;
      await saveAction({ action: 'save_item', ...normalizedDraft });
      setItemDraft(null);
    } finally {
      setSaving(false);
    }
  };

  const submitProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profileDraft || saving) return;
    setSaving(true);
    try {
      await saveAction({ action: 'save_profile', ...profileDraft });
      setProfileDraft(null);
    } finally {
      setSaving(false);
    }
  };

  const submitReview = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!reviewDraft.user_email || saving) return;
    setSaving(true);
    try {
      await saveAction({ action: 'save_review', ...reviewDraft });
      setShowReviewModal(false);
      setReviewDraft((current) => ({ ...current, notes: '' }));
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (item: PerformanceItem) => {
    const confirmation = item.item_type === 'job_description'
      ? `Hapus job description “${item.title}”?`
      : `Hapus “${item.title}”? Progress yang sudah tercatat tetap tersimpan sebagai aktivitas.`;
    if (!window.confirm(confirmation)) return;
    await saveAction({ action: 'delete_item', id: item.id });
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'jobdesc', label: 'Job Description', icon: BriefcaseBusiness },
    { id: 'items', label: 'KPI & Daily', icon: Target },
    { id: 'activity', label: 'Activity Live', icon: Activity },
    { id: 'team', label: 'Profil Team', icon: Users },
    { id: 'reviews', label: 'Penilaian', icon: ClipboardCheck },
  ] as const;

  return (
    <>
      <div className="mb-5 overflow-x-auto pb-1">
        <div className="inline-flex min-w-full gap-1 rounded-2xl border border-[#E5E7EB] bg-white p-1.5 dark:border-[#303742] dark:bg-[#171B22] sm:min-w-0">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex min-w-max flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-extrabold transition ${tab === id ? 'bg-[#24324A] text-white shadow-sm dark:bg-[#F26B5E]' : 'text-[#737680] hover:bg-[#F3F4F6] dark:text-[#AAB2BF] dark:hover:bg-[#252B34]'}`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard icon={TrendingUp} label="Team Completion" value={`${teamCompletion}%`} helper="Rata-rata progres kegiatan wajib hari ini." tone="#4F9D78" />
            <StatCard icon={CheckCircle2} label="Selesai Hari Ini" value={String(completedToday)} helper={`${todayUpdates.length} update dikirim oleh team.`} tone="#3B82F6" />
            <StatCard icon={Goal} label="OKR Aktif" value={String(activeGoals)} helper="Objective dan key result aktif workspace." tone="#7B68EE" />
            <StatCard icon={AlertCircle} label="Perlu Perhatian" value={String(attentionCount)} helper="Anggota di bawah 50% atau memiliki blocker." tone="#F26B5E" />
          </div>

          <section className={`${panelClass} overflow-hidden`}>
            <div className="flex flex-col gap-3 border-b border-[#E8E8EC] px-4 py-4 dark:border-[#303742] sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div>
                <h2 className="text-sm font-extrabold text-[#24324A] dark:text-[#F4F6FA]">Progress Team Hari Ini</h2>
                <p className="mt-1 text-[11px] text-[#737680] dark:text-[#98A2B3]">Completion dihitung dari checklist yang berlaku untuk role dan divisi tiap user.</p>
              </div>
              <button type="button" onClick={() => setTab('activity')} className="inline-flex items-center gap-1 text-xs font-extrabold text-[#F26B5E]">
                Lihat activity <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
              {memberMetrics.length === 0 ? (
                <p className="col-span-full py-10 text-center text-xs text-[#737680]">Belum ada profil team.</p>
              ) : memberMetrics.map(({ profile, completion, completed, expected, blocked, latest }) => (
                <button key={profile.user_email} type="button" onClick={() => { editProfile(profile); }} className="rounded-2xl border border-[#E8E8EC] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#F26B5E]/50 hover:shadow-md dark:border-[#303742]">
                  <div className="flex items-start gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={avatarFor(profile)} alt={profile.display_name} className="h-10 w-10 rounded-xl object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-extrabold text-[#24324A] dark:text-[#F4F6FA]">{profile.display_name}</p>
                          <p className="truncate text-[11px] text-[#737680] dark:text-[#98A2B3]">{profile.role_title} · {profile.division}</p>
                        </div>
                        <span className="text-sm font-black" style={{ color: progressColor(completion) }}>{completion}%</span>
                      </div>
                      <div className="mt-3"><ProgressBar value={completion} compact /></div>
                      <div className="mt-3 flex items-center gap-3 text-[10px] font-semibold text-[#737680] dark:text-[#98A2B3]">
                        <span>{completed}/{expected || 0} selesai</span>
                        {blocked > 0 && <span className="text-[#D95858]">{blocked} blocker</span>}
                      </div>
                      <p className="mt-2 line-clamp-1 text-[10px] text-[#9A9DA5]">{latest ? `Terakhir: ${latest.title}` : 'Belum ada laporan hari ini'}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {tab === 'jobdesc' && (
        <section className={`${panelClass} overflow-hidden`}>
          <div className="border-b border-[#E8E8EC] p-4 dark:border-[#303742] sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-sm font-extrabold text-[#24324A] dark:text-[#F4F6FA]">Job Description</h2>
                <p className="mt-1 text-[11px] text-[#737680] dark:text-[#98A2B3]">Tuliskan tanggung jawab pekerjaan berdasarkan role, divisi, atau user. Bagian ini tidak dihitung sebagai progress maupun KPI.</p>
              </div>
              <button type="button" onClick={openNewJobDescription} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#24324A] px-4 py-2.5 text-xs font-extrabold text-white shadow-sm hover:bg-[#1B2638] dark:bg-[#F26B5E]">
                <Plus className="h-4 w-4" /> Tambah Job Description
              </button>
            </div>
            <label className="relative mt-4 block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9A9DA5]" />
              <input value={jobDescriptionSearch} onChange={(event) => setJobDescriptionSearch(event.target.value)} placeholder="Cari tanggung jawab atau scope..." className={`${inputClass} pl-9`} />
            </label>
          </div>
          <div className="divide-y divide-[#E8E8EC] dark:divide-[#303742]">
            {jobDescriptionItems.length === 0 ? (
              <div className="flex flex-col items-center px-5 py-14 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F1F4F8] text-[#737680] dark:bg-[#252B34] dark:text-[#98A2B3]"><FileText className="h-6 w-6" /></div>
                <p className="mt-4 text-sm font-extrabold text-[#24324A] dark:text-[#F4F6FA]">Belum ada job description</p>
                <p className="mt-1 text-xs text-[#737680] dark:text-[#98A2B3]">Tambahkan tanggung jawab pekerjaan agar otomatis tampil pada user yang sesuai.</p>
              </div>
            ) : jobDescriptionItems.map((item) => (
              <div key={item.id} className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_220px_72px] md:items-center sm:px-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-[#24324A] dark:text-[#F4F6FA]">{item.title}</p>
                    {!item.active && <span className="rounded-md bg-[#F1F2F4] px-2 py-0.5 text-[9px] font-bold text-[#737680]">Nonaktif</span>}
                  </div>
                  {item.description && <p className="mt-1 whitespace-pre-line text-[11px] leading-5 text-[#737680] dark:text-[#98A2B3] md:line-clamp-3">{item.description}</p>}
                </div>
                <div>
                  <p className="md:hidden text-[9px] font-bold uppercase tracking-wider text-[#9A9DA5]">Ditampilkan Kepada</p>
                  <p className="text-xs font-semibold text-[#4A5568] dark:text-[#CBD2DC]">{scopeLabel(item, data.profiles)}</p>
                </div>
                <div className="flex items-center justify-end gap-1">
                  <button type="button" onClick={() => editItem(item)} className="rounded-lg p-2 text-[#737680] hover:bg-[#EEF2F7] hover:text-[#24324A] dark:hover:bg-[#252B34]" aria-label={`Edit ${item.title}`}><Edit3 className="h-4 w-4" /></button>
                  <button type="button" onClick={() => deleteItem(item)} className="rounded-lg p-2 text-[#C45449] hover:bg-[#FFF0ED] dark:hover:bg-[#4A2725]" aria-label={`Hapus ${item.title}`}><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === 'items' && (
        <section className={`${panelClass} overflow-hidden`}>
          <div className="border-b border-[#E8E8EC] p-4 dark:border-[#303742] sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-sm font-extrabold text-[#24324A] dark:text-[#F4F6FA]">KPI, OKR &amp; Daily Activity</h2>
                <p className="mt-1 text-[11px] text-[#737680] dark:text-[#98A2B3]">Atur kegiatan terukur berdasarkan team, divisi, jabatan, atau user tertentu.</p>
              </div>
              <button type="button" onClick={() => setItemDraft({ ...emptyItemDraft })} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#24324A] px-4 py-2.5 text-xs font-extrabold text-white shadow-sm hover:bg-[#1B2638] dark:bg-[#F26B5E]">
                <Plus className="h-4 w-4" /> Tambah KPI / Activity
              </button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
              <label className="relative block">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9A9DA5]" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari kegiatan atau scope..." className={`${inputClass} pl-9`} />
              </label>
              <select value={itemType} onChange={(event) => setItemType(event.target.value as typeof itemType)} className={inputClass}>
                <option value="all">Semua Tipe</option>
                {Object.entries(PERFORMANCE_ITEM_LABELS).filter(([value]) => value !== 'job_description').map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          </div>
          <div className="divide-y divide-[#E8E8EC] dark:divide-[#303742]">
            {filteredItems.length === 0 ? (
              <div className="py-14 text-center text-xs text-[#737680]">Belum ada kegiatan sesuai filter.</div>
            ) : filteredItems.map((item) => (
              <div key={item.id} className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_130px_180px_100px_72px] md:items-center sm:px-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-[#24324A] dark:text-[#F4F6FA]">{item.title}</p>
                    {!item.active && <span className="rounded-md bg-[#F1F2F4] px-2 py-0.5 text-[9px] font-bold text-[#737680]">Nonaktif</span>}
                  </div>
                  {item.description && <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-[#737680] dark:text-[#98A2B3]">{item.description}</p>}
                </div>
                <div>
                  <p className="md:hidden text-[9px] font-bold uppercase tracking-wider text-[#9A9DA5]">Tipe</p>
                  <span className="text-xs font-bold text-[#4A5568] dark:text-[#CBD2DC]">{PERFORMANCE_ITEM_LABELS[item.item_type]}</span>
                </div>
                <div>
                  <p className="md:hidden text-[9px] font-bold uppercase tracking-wider text-[#9A9DA5]">Target</p>
                  <p className="text-xs font-semibold text-[#4A5568] dark:text-[#CBD2DC]">{scopeLabel(item, data.profiles)}</p>
                </div>
                <div className="flex items-center gap-2 md:block">
                  <span className={`inline-flex rounded-lg px-2.5 py-1 text-[10px] font-extrabold ${cadenceClasses(item.cadence)}`}>{PERFORMANCE_CADENCE_LABELS[item.cadence]}</span>
                  <span className="text-[10px] font-bold text-[#737680] md:ml-0 md:mt-1 md:block">Bobot {item.weight}%</span>
                </div>
                <div className="flex items-center justify-end gap-1">
                  <button type="button" onClick={() => editItem(item)} className="rounded-lg p-2 text-[#737680] hover:bg-[#EEF2F7] hover:text-[#24324A] dark:hover:bg-[#252B34]" aria-label={`Edit ${item.title}`}><Edit3 className="h-4 w-4" /></button>
                  <button type="button" onClick={() => deleteItem(item)} className="rounded-lg p-2 text-[#C45449] hover:bg-[#FFF0ED] dark:hover:bg-[#4A2725]" aria-label={`Hapus ${item.title}`}><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === 'activity' && (
        <section className={`${panelClass} overflow-hidden`}>
          <div className="flex flex-col gap-3 border-b border-[#E8E8EC] p-4 dark:border-[#303742] sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <h2 className="text-sm font-extrabold text-[#24324A] dark:text-[#F4F6FA]">Activity Live</h2>
              <p className="mt-1 text-[11px] text-[#737680] dark:text-[#98A2B3]">Update terbaru dari checklist dan laporan progres team.</p>
            </div>
            <input type="date" value={activityDate} onChange={(event) => setActivityDate(event.target.value)} className={`${inputClass} sm:w-auto`} />
          </div>
          <div className="divide-y divide-[#E8E8EC] dark:divide-[#303742]">
            {filteredUpdates.length === 0 ? (
              <div className="py-14 text-center text-xs text-[#737680]">Belum ada activity pada {formatDate(activityDate)}.</div>
            ) : filteredUpdates.map((update) => {
              const profile = data.profiles.find((candidate) => candidate.user_email === update.user_email);
              return (
                <div key={update.id} className="flex gap-3 px-4 py-4 sm:px-5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={profile ? avatarFor(profile) : `https://ui-avatars.com/api/?name=${encodeURIComponent(update.user_email)}&background=24324A&color=fff`} alt="" className="h-9 w-9 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-extrabold text-[#24324A] dark:text-[#F4F6FA]">{profile?.display_name || update.user_email}</p>
                        <p className="mt-1 text-sm font-bold text-[#303B4F] dark:text-[#E6EAF0]">{update.title}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-lg px-2.5 py-1 text-[10px] font-extrabold ${statusClasses(update.status)}`}>{PERFORMANCE_STATUS_LABELS[update.status]}</span>
                        <span className="text-xs font-black" style={{ color: progressColor(update.progress) }}>{update.progress}%</span>
                      </div>
                    </div>
                    {update.details && <p className="mt-2 text-xs leading-5 text-[#737680] dark:text-[#98A2B3]">{update.details}</p>}
                    {update.blocker_note && <p className="mt-2 rounded-lg bg-[#FFF0ED] px-3 py-2 text-[11px] text-[#A6463D] dark:bg-[#4A2725] dark:text-[#F4AAA3]">Blocker: {update.blocker_note}</p>}
                    <div className="mt-3"><ProgressBar value={update.progress} compact /></div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {tab === 'team' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-extrabold text-[#24324A] dark:text-[#F4F6FA]">Profil, Divisi &amp; Jabatan</h2>
              <p className="mt-1 text-[11px] text-[#737680] dark:text-[#98A2B3]">Scope KPI otomatis mengikuti data ini.</p>
            </div>
            <button type="button" onClick={openNewProfile} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#24324A] px-4 py-2.5 text-xs font-extrabold text-white dark:bg-[#F26B5E]"><Plus className="h-4 w-4" /> Atur User</button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.profiles.map((profile) => {
              const applicable = data.items.filter((item) => item.item_type !== 'job_description' && performanceItemAppliesToProfile(item, profile)).length;
              const review = latestReview(data.reviews, profile.user_email);
              return (
                <button key={profile.user_email} type="button" onClick={() => editProfile(profile)} className={`${panelClass} p-4 text-left transition hover:-translate-y-0.5 hover:border-[#F26B5E]/50 hover:shadow-md`}>
                  <div className="flex items-start gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={avatarFor(profile)} alt={profile.display_name} className="h-12 w-12 rounded-2xl object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-extrabold text-[#24324A] dark:text-[#F4F6FA]">{profile.display_name}</p>
                        {profile.can_manage && <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0 text-[#4F9D78]" />}
                      </div>
                      <p className="mt-0.5 truncate text-[11px] font-semibold text-[#737680] dark:text-[#98A2B3]">{profile.role_title}</p>
                      <p className="mt-2 inline-flex rounded-lg bg-[#F1F4F8] px-2 py-1 text-[10px] font-bold text-[#4A5568] dark:bg-[#252B34] dark:text-[#CBD2DC]">{profile.division}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[#ECEEF1] pt-3 text-[10px] dark:border-[#303742]">
                    <div><span className="block text-[#9A9DA5]">Target berlaku</span><strong className="mt-1 block text-[#24324A] dark:text-[#F4F6FA]">{applicable} item</strong></div>
                    <div><span className="block text-[#9A9DA5]">Nilai terakhir</span><strong className="mt-1 block text-[#24324A] dark:text-[#F4F6FA]">{review ? `${Math.round(review.overall_score)} / 100` : 'Belum dinilai'}</strong></div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'reviews' && (
        <section className={`${panelClass} overflow-hidden`}>
          <div className="flex flex-col gap-3 border-b border-[#E8E8EC] p-4 dark:border-[#303742] sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <h2 className="text-sm font-extrabold text-[#24324A] dark:text-[#F4F6FA]">Penilaian Performa</h2>
              <p className="mt-1 text-[11px] text-[#737680] dark:text-[#98A2B3]">Nilai kualitas, ownership, kolaborasi, dan hasil akhir per periode.</p>
            </div>
            <button type="button" onClick={() => { setReviewDraft((current) => ({ ...current, user_email: current.user_email || activeProfiles[0]?.user_email || '' })); setShowReviewModal(true); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#24324A] px-4 py-2.5 text-xs font-extrabold text-white dark:bg-[#F26B5E]"><Plus className="h-4 w-4" /> Buat Penilaian</button>
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3 sm:p-5">
            {data.reviews.length === 0 ? (
              <p className="col-span-full py-10 text-center text-xs text-[#737680]">Belum ada penilaian performa.</p>
            ) : data.reviews.map((review) => {
              const profile = data.profiles.find((candidate) => candidate.user_email === review.user_email);
              return (
                <div key={review.id} className="rounded-2xl border border-[#E8E8EC] p-4 dark:border-[#303742]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold text-[#24324A] dark:text-[#F4F6FA]">{profile?.display_name || review.user_email}</p>
                      <p className="mt-1 text-[10px] text-[#737680] dark:text-[#98A2B3]">{formatDate(review.period_start)} – {formatDate(review.period_end)}</p>
                    </div>
                    <div className="rounded-xl bg-[#EEF8F3] px-3 py-2 text-center dark:bg-[#1E3A2D]">
                      <span className="block text-lg font-black text-[#347256] dark:text-[#78C59A]">{Math.round(review.overall_score)}</span>
                      <span className="text-[8px] font-bold uppercase text-[#5C8B72]">Score</span>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    {[['Quality', review.quality_score], ['Ownership', review.ownership_score], ['Teamwork', review.collaboration_score]].map(([label, score]) => (
                      <div key={String(label)} className="rounded-xl bg-[#F7F7F8] px-2 py-2 dark:bg-[#252B34]"><strong className="block text-xs text-[#24324A] dark:text-[#F4F6FA]">{Math.round(Number(score))}</strong><span className="text-[8px] text-[#737680]">{label}</span></div>
                    ))}
                  </div>
                  {review.notes && <p className="mt-3 line-clamp-3 text-[11px] leading-5 text-[#737680] dark:text-[#98A2B3]">{review.notes}</p>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {itemDraft?.item_type === 'job_description' && (
        <Modal title={itemDraft.id ? 'Edit Job Description' : 'Tambah Job Description'} subtitle="Tulis tanggung jawab pekerjaan yang akan dibaca oleh user sesuai scope." onClose={() => setItemDraft(null)}>
          <form onSubmit={submitItem} className="space-y-4">
            <label><span className={labelClass}>Judul Tanggung Jawab</span><input required value={itemDraft.title} onChange={(event) => setItemDraft({ ...itemDraft, title: event.target.value })} className={inputClass} placeholder="Contoh: Mengelola seluruh aktivitas Instagram" /></label>
            <label><span className={labelClass}>Uraian Tanggung Jawab</span><textarea value={itemDraft.description} onChange={(event) => setItemDraft({ ...itemDraft, description: event.target.value })} className={`${inputClass} min-h-40 resize-y`} placeholder="Jelaskan tanggung jawab, ruang lingkup pekerjaan, dan ekspektasi peran..." /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label><span className={labelClass}>Ditampilkan Kepada</span><select value={itemDraft.scope_type} onChange={(event) => setItemDraft({ ...itemDraft, scope_type: event.target.value as PerformanceItem['scope_type'], scope_value: event.target.value === 'team' ? '*' : '' })} className={inputClass}><option value="team">Semua User</option><option value="division">Divisi</option><option value="role">Jabatan / Role</option><option value="user">User Tertentu</option></select></label>
              <label><span className={labelClass}>Nilai Scope</span>{itemDraft.scope_type === 'team' ? <input disabled value="Semua User" className={`${inputClass} opacity-60`} /> : itemDraft.scope_type === 'user' ? <select required value={itemDraft.scope_value} onChange={(event) => setItemDraft({ ...itemDraft, scope_value: event.target.value })} className={inputClass}><option value="">Pilih user</option>{data.profiles.map((profile) => <option key={profile.user_email} value={profile.user_email}>{profile.display_name}</option>)}</select> : <><input list={`jobdesc-scope-${itemDraft.scope_type}`} required value={itemDraft.scope_value} onChange={(event) => setItemDraft({ ...itemDraft, scope_value: event.target.value })} className={inputClass} placeholder={itemDraft.scope_type === 'division' ? 'Contoh: Social Media' : 'Contoh: Social Media Specialist'} /><datalist id={`jobdesc-scope-${itemDraft.scope_type}`}>{Array.from(new Set(data.profiles.map((profile) => itemDraft.scope_type === 'division' ? profile.division : profile.role_title))).map((value) => <option key={value} value={value} />)}</datalist></>}</label>
            </div>
            <label className="flex items-center gap-3 rounded-xl border border-[#E5E7EB] px-3 py-3 text-xs font-bold text-[#4A5568] dark:border-[#303742] dark:text-[#CBD2DC]"><input type="checkbox" checked={itemDraft.active} onChange={(event) => setItemDraft({ ...itemDraft, active: event.target.checked })} className="h-4 w-4 accent-[#F26B5E]" /> Tampilkan job description ke user</label>
            <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setItemDraft(null)} className="rounded-xl border border-[#DDE1E7] px-4 py-2.5 text-xs font-bold text-[#737680] dark:border-[#3A424F]">Batal</button><button disabled={saving} type="submit" className="inline-flex items-center gap-2 rounded-xl bg-[#24324A] px-5 py-2.5 text-xs font-extrabold text-white disabled:opacity-60 dark:bg-[#F26B5E]"><Save className="h-4 w-4" /> {saving ? 'Menyimpan...' : 'Simpan Job Description'}</button></div>
          </form>
        </Modal>
      )}

      {itemDraft && itemDraft.item_type !== 'job_description' && (
        <Modal title={itemDraft.id ? 'Edit KPI / Activity' : 'Tambah KPI / Activity'} subtitle="Aturan ini otomatis muncul pada user yang sesuai scope." onClose={() => setItemDraft(null)}>
          <form onSubmit={submitItem} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label><span className={labelClass}>Tipe</span><select value={itemDraft.item_type} onChange={(event) => setItemDraft({ ...itemDraft, item_type: event.target.value as PerformanceItemType })} className={inputClass}>{Object.entries(PERFORMANCE_ITEM_LABELS).filter(([value]) => value !== 'job_description').map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label><span className={labelClass}>Satuan Waktu</span><select value={itemDraft.cadence} onChange={(event) => setItemDraft({ ...itemDraft, cadence: event.target.value as PerformanceItem['cadence'] })} className={inputClass}>{Object.entries(PERFORMANCE_CADENCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            </div>
            <label><span className={labelClass}>Nama Kegiatan / Objective</span><input required value={itemDraft.title} onChange={(event) => setItemDraft({ ...itemDraft, title: event.target.value })} className={inputClass} placeholder="Contoh: Upload konten sesuai jadwal" /></label>
            <label><span className={labelClass}>Detail &amp; Ekspektasi</span><textarea value={itemDraft.description} onChange={(event) => setItemDraft({ ...itemDraft, description: event.target.value })} className={`${inputClass} min-h-24 resize-y`} placeholder="Jelaskan output, standar kualitas, atau bukti yang diharapkan..." /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label><span className={labelClass}>Berlaku Untuk</span><select value={itemDraft.scope_type} onChange={(event) => setItemDraft({ ...itemDraft, scope_type: event.target.value as PerformanceItem['scope_type'], scope_value: event.target.value === 'team' ? '*' : '' })} className={inputClass}><option value="team">Semua User</option><option value="division">Divisi</option><option value="role">Jabatan / Role</option><option value="user">User Tertentu</option></select></label>
              <label><span className={labelClass}>Nilai Scope</span>{itemDraft.scope_type === 'team' ? <input disabled value="Semua User" className={`${inputClass} opacity-60`} /> : itemDraft.scope_type === 'user' ? <select value={itemDraft.scope_value} onChange={(event) => setItemDraft({ ...itemDraft, scope_value: event.target.value })} className={inputClass}><option value="">Pilih user</option>{data.profiles.map((profile) => <option key={profile.user_email} value={profile.user_email}>{profile.display_name}</option>)}</select> : <><input list={`scope-${itemDraft.scope_type}`} required value={itemDraft.scope_value} onChange={(event) => setItemDraft({ ...itemDraft, scope_value: event.target.value })} className={inputClass} placeholder={itemDraft.scope_type === 'division' ? 'Contoh: Social Media' : 'Contoh: Social Media Specialist'} /><datalist id={`scope-${itemDraft.scope_type}`}>{Array.from(new Set(data.profiles.map((profile) => itemDraft.scope_type === 'division' ? profile.division : profile.role_title))).map((value) => <option key={value} value={value} />)}</datalist></>}</label>
            </div>
            {(itemDraft.item_type === 'key_result' || itemDraft.item_type === 'initiative') && <label><span className={labelClass}>Objective Induk (Opsional)</span><select value={itemDraft.parent_id} onChange={(event) => setItemDraft({ ...itemDraft, parent_id: event.target.value })} className={inputClass}><option value="">Tanpa objective induk</option>{data.items.filter((item) => item.item_type === 'objective' && item.id !== itemDraft.id).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <label><span className={labelClass}>Bobot %</span><input type="number" min="0" max="100" value={itemDraft.weight} onChange={(event) => setItemDraft({ ...itemDraft, weight: Number(event.target.value) })} className={inputClass} /></label>
              <label><span className={labelClass}>Target</span><input type="number" min="0.01" value={itemDraft.target_value} onChange={(event) => setItemDraft({ ...itemDraft, target_value: Number(event.target.value) })} className={inputClass} /></label>
              <label><span className={labelClass}>Unit</span><input value={itemDraft.unit} onChange={(event) => setItemDraft({ ...itemDraft, unit: event.target.value })} className={inputClass} /></label>
              <label><span className={labelClass}>Urutan</span><input type="number" value={itemDraft.sort_order} onChange={(event) => setItemDraft({ ...itemDraft, sort_order: Number(event.target.value) })} className={inputClass} /></label>
            </div>
            <label className="flex items-center gap-3 rounded-xl border border-[#E5E7EB] px-3 py-3 text-xs font-bold text-[#4A5568] dark:border-[#303742] dark:text-[#CBD2DC]"><input type="checkbox" checked={itemDraft.active} onChange={(event) => setItemDraft({ ...itemDraft, active: event.target.checked })} className="h-4 w-4 accent-[#F26B5E]" /> Item aktif dan ditampilkan ke user</label>
            <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setItemDraft(null)} className="rounded-xl border border-[#DDE1E7] px-4 py-2.5 text-xs font-bold text-[#737680] dark:border-[#3A424F]">Batal</button><button disabled={saving} type="submit" className="inline-flex items-center gap-2 rounded-xl bg-[#24324A] px-5 py-2.5 text-xs font-extrabold text-white disabled:opacity-60 dark:bg-[#F26B5E]"><Save className="h-4 w-4" /> {saving ? 'Menyimpan...' : 'Simpan'}</button></div>
          </form>
        </Modal>
      )}

      {profileDraft && (
        <Modal title="Atur Profil Performance" subtitle="Divisi dan jabatan menentukan jobdesc serta KPI yang diterima user." onClose={() => setProfileDraft(null)}>
          <form onSubmit={submitProfile} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label><span className={labelClass}>Email Login</span><input list="performance-role-emails" required type="email" value={profileDraft.user_email} onChange={(event) => { const role = data.roles.find((candidate) => candidate.email === event.target.value); setProfileDraft({ ...profileDraft, user_email: event.target.value, display_name: role?.display_name || profileDraft.display_name, can_manage: role ? role.role === 'owner' || role.role === 'admin' : profileDraft.can_manage }); }} className={inputClass} /><datalist id="performance-role-emails">{data.roles.map((role) => <option key={role.email} value={role.email}>{role.display_name}</option>)}</datalist></label>
              <label><span className={labelClass}>Nama Lengkap</span><input required value={profileDraft.display_name} onChange={(event) => setProfileDraft({ ...profileDraft, display_name: event.target.value })} className={inputClass} /></label>
              <label><span className={labelClass}>Divisi</span><input list="performance-divisions" required value={profileDraft.division} onChange={(event) => setProfileDraft({ ...profileDraft, division: event.target.value })} className={inputClass} placeholder="Social Media" /><datalist id="performance-divisions">{Array.from(new Set(data.profiles.map((profile) => profile.division))).map((value) => <option key={value} value={value} />)}</datalist></label>
              <label><span className={labelClass}>Jabatan / Role</span><input list="performance-roles" required value={profileDraft.role_title} onChange={(event) => setProfileDraft({ ...profileDraft, role_title: event.target.value })} className={inputClass} placeholder="Social Media Specialist" /><datalist id="performance-roles">{Array.from(new Set(data.profiles.map((profile) => profile.role_title))).map((value) => <option key={value} value={value} />)}<option value="Social Media Specialist" /></datalist></label>
              <label><span className={labelClass}>Manager</span><select value={profileDraft.manager_email} onChange={(event) => setProfileDraft({ ...profileDraft, manager_email: event.target.value })} className={inputClass}><option value="">Belum ditentukan</option>{data.profiles.filter((profile) => profile.user_email !== profileDraft.user_email).map((profile) => <option key={profile.user_email} value={profile.user_email}>{profile.display_name}</option>)}</select></label>
            </div>
            <div className="rounded-xl border border-[#D9E5F5] bg-[#F2F7FF] px-3 py-3 text-[11px] leading-5 text-[#49617F] dark:border-[#33445B] dark:bg-[#1B2635] dark:text-[#AFC3DE]">Avatar otomatis mengikuti foto profil ClickUp berdasarkan Email Login. Ubah foto langsung dari profil ClickUp jika diperlukan.</div>
            <label><span className={labelClass}>Ringkasan Pekerjaan</span><textarea value={profileDraft.job_summary} onChange={(event) => setProfileDraft({ ...profileDraft, job_summary: event.target.value })} className={`${inputClass} min-h-28 resize-y`} placeholder="Jelaskan fokus utama dan outcome yang diharapkan dari role ini..." /></label>
            <label className="flex items-center gap-3 rounded-xl border border-[#E5E7EB] px-3 py-3 text-xs font-bold text-[#4A5568] dark:border-[#303742] dark:text-[#CBD2DC]"><input type="checkbox" checked={profileDraft.active} onChange={(event) => setProfileDraft({ ...profileDraft, active: event.target.checked })} className="h-4 w-4 accent-[#F26B5E]" /> Profil aktif dan masuk perhitungan team</label>
            <div className="rounded-xl bg-[#F7F7F8] px-3 py-3 text-[11px] leading-5 text-[#737680] dark:bg-[#252B34] dark:text-[#AAB2BF]">Hak dashboard owner mengikuti role aplikasi Owner/Admin yang diatur pada halaman Team. Field profil ini tidak dapat menaikkan hak akses sendiri.</div>
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setProfileDraft(null)} className="rounded-xl border border-[#DDE1E7] px-4 py-2.5 text-xs font-bold text-[#737680] dark:border-[#3A424F]">Batal</button><button disabled={saving} type="submit" className="inline-flex items-center gap-2 rounded-xl bg-[#24324A] px-5 py-2.5 text-xs font-extrabold text-white disabled:opacity-60 dark:bg-[#F26B5E]"><Save className="h-4 w-4" /> {saving ? 'Menyimpan...' : 'Simpan Profil'}</button></div>
          </form>
        </Modal>
      )}

      {showReviewModal && (
        <Modal title="Penilaian Performa" subtitle="Penilaian ini akan tampil pada profil member terkait." onClose={() => setShowReviewModal(false)}>
          <form onSubmit={submitReview} className="space-y-4">
            <label><span className={labelClass}>Anggota Team</span><select required value={reviewDraft.user_email} onChange={(event) => setReviewDraft({ ...reviewDraft, user_email: event.target.value })} className={inputClass}><option value="">Pilih anggota</option>{activeProfiles.map((profile) => <option key={profile.user_email} value={profile.user_email}>{profile.display_name} · {profile.role_title}</option>)}</select></label>
            <div className="grid gap-4 sm:grid-cols-2"><label><span className={labelClass}>Periode Mulai</span><input type="date" value={reviewDraft.period_start} onChange={(event) => setReviewDraft({ ...reviewDraft, period_start: event.target.value })} className={inputClass} /></label><label><span className={labelClass}>Periode Selesai</span><input type="date" value={reviewDraft.period_end} onChange={(event) => setReviewDraft({ ...reviewDraft, period_end: event.target.value })} className={inputClass} /></label></div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{([['overall_score', 'Overall'], ['quality_score', 'Quality'], ['ownership_score', 'Ownership'], ['collaboration_score', 'Teamwork']] as const).map(([key, label]) => <label key={key}><span className={labelClass}>{label}</span><input type="number" min="0" max="100" value={reviewDraft[key]} onChange={(event) => setReviewDraft({ ...reviewDraft, [key]: Number(event.target.value) })} className={inputClass} /></label>)}</div>
            <label><span className={labelClass}>Catatan &amp; Feedback</span><textarea value={reviewDraft.notes} onChange={(event) => setReviewDraft({ ...reviewDraft, notes: event.target.value })} className={`${inputClass} min-h-32 resize-y`} placeholder="Tuliskan pencapaian, area pengembangan, dan next action..." /></label>
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setShowReviewModal(false)} className="rounded-xl border border-[#DDE1E7] px-4 py-2.5 text-xs font-bold text-[#737680] dark:border-[#3A424F]">Batal</button><button disabled={saving} type="submit" className="inline-flex items-center gap-2 rounded-xl bg-[#24324A] px-5 py-2.5 text-xs font-extrabold text-white disabled:opacity-60 dark:bg-[#F26B5E]"><Save className="h-4 w-4" /> {saving ? 'Menyimpan...' : 'Simpan Nilai'}</button></div>
          </form>
        </Modal>
      )}
    </>
  );
}

function ActivityEditor({ item, profile, update, date, saveAction }: { item: PerformanceItem; profile: PerformanceProfile; update?: PerformanceUpdate; date: string; saveAction: SaveAction }) {
  const [progress, setProgress] = useState(update?.progress || 0);
  const [status, setStatus] = useState<PerformanceUpdateStatus>(update?.status || 'todo');
  const [details, setDetails] = useState(update?.details || '');
  const [evidenceUrl, setEvidenceUrl] = useState(update?.evidence_url || '');
  const [blocker, setBlocker] = useState(update?.blocker_note || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setProgress(update?.progress || 0);
    setStatus(update?.status || 'todo');
    setDetails(update?.details || '');
    setEvidenceUrl(update?.evidence_url || '');
    setBlocker(update?.blocker_note || '');
  }, [update]);

  const toggleComplete = () => {
    if (status === 'completed') {
      setStatus('in_progress');
      setProgress(50);
    } else {
      setStatus('completed');
      setProgress(100);
    }
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await saveAction({
        action: 'save_update', id: update?.id, item_id: item.id, user_email: profile.user_email,
        activity_date: date, title: item.title, details, progress, status, evidence_url: evidenceUrl,
        blocker_note: status === 'blocked' ? blocker : '',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`${panelClass} p-4 sm:p-5`}>
      <div className="flex items-start gap-3">
        <button type="button" onClick={toggleComplete} className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border transition ${status === 'completed' ? 'border-[#4F9D78] bg-[#4F9D78] text-white' : 'border-[#CDD2D9] text-transparent hover:border-[#4F9D78] dark:border-[#4A5361]'}`} aria-label={status === 'completed' ? 'Tandai belum selesai' : 'Tandai selesai'}><Check className="h-4 w-4" /></button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-extrabold text-[#24324A] dark:text-[#F4F6FA]">{item.title}</h3><span className={`rounded-lg px-2 py-0.5 text-[9px] font-extrabold ${cadenceClasses(item.cadence)}`}>{PERFORMANCE_CADENCE_LABELS[item.cadence]}</span></div>
              {item.description && <p className="mt-1 text-[11px] leading-5 text-[#737680] dark:text-[#98A2B3]">{item.description}</p>}
            </div>
            <span className="text-sm font-black" style={{ color: progressColor(progress) }}>{progress}%</span>
          </div>
          <div className="mt-3"><ProgressBar value={progress} compact /></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-[150px_minmax(0,1fr)]">
            <select value={status} onChange={(event) => { const next = event.target.value as PerformanceUpdateStatus; setStatus(next); if (next === 'completed') setProgress(100); }} className={inputClass}>{Object.entries(PERFORMANCE_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <label className="flex items-center gap-3 rounded-xl border border-[#DDE1E7] px-3 py-2 dark:border-[#3A424F]"><input type="range" min="0" max="100" step="5" value={progress} onChange={(event) => { const value = Number(event.target.value); setProgress(value); setStatus(value >= 100 ? 'completed' : value > 0 ? 'in_progress' : 'todo'); }} className="h-1.5 flex-1 accent-[#F26B5E]" /><span className="w-9 text-right text-[10px] font-bold text-[#737680]">{progress}%</span></label>
          </div>
          <textarea value={details} onChange={(event) => setDetails(event.target.value)} className={`${inputClass} mt-3 min-h-20 resize-y text-xs`} placeholder="Apa yang dikerjakan, output, dan progresnya?" />
          <div className="mt-3 grid gap-3 sm:grid-cols-2"><input value={evidenceUrl} onChange={(event) => setEvidenceUrl(event.target.value)} className={`${inputClass} text-xs`} placeholder="Link bukti / dokumen (opsional)" />{status === 'blocked' && <input value={blocker} onChange={(event) => setBlocker(event.target.value)} className={`${inputClass} border-[#F4C7C2] text-xs`} placeholder="Jelaskan blocker..." />}</div>
          <div className="mt-3 flex justify-end"><button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#24324A] px-4 py-2.5 text-xs font-extrabold text-white disabled:opacity-60 dark:bg-[#F26B5E]"><Save className="h-3.5 w-3.5" /> {saving ? 'Menyimpan...' : 'Simpan Progress'}</button></div>
        </div>
      </div>
    </div>
  );
}

function MemberWorkspace({ data, saveAction }: { data: PerformanceBootstrap; saveAction: SaveAction }) {
  const [tab, setTab] = useState<'today' | 'job' | 'okr' | 'reviews'>('today');
  const [date, setDate] = useState(localDateKey());
  const [customTitle, setCustomTitle] = useState('');
  const [customDetails, setCustomDetails] = useState('');
  const [customProgress, setCustomProgress] = useState(0);
  const [savingCustom, setSavingCustom] = useState(false);
  const profile = data.profile;
  const applicableItems = data.items.filter((item) => performanceItemAppliesToProfile(item, profile));
  const measurableItems = applicableItems.filter((item) => item.item_type !== 'job_description');
  const dailyItems = applicableItems.filter(performanceItemAppearsInDailyList);
  const jobItems = applicableItems.filter((item) => item.item_type === 'job_description');
  const okrItems = applicableItems.filter((item) => (
    ['objective', 'key_result', 'initiative'].includes(item.item_type) &&
    !performanceItemAppearsInDailyList(item)
  ));
  const personalUpdates = data.updates.filter((update) => update.user_email === profile.user_email);
  const personalReviews = data.reviews.filter((item) => item.user_email === profile.user_email);
  const dateUpdates = personalUpdates.filter((update) => update.activity_date === date);
  const todayProgress = dailyItems.length > 0
    ? average(dailyItems.map((item) => latestUpdate(dateUpdates, profile.user_email, item.id, date)?.progress || 0))
    : average(dateUpdates.map((update) => update.progress));
  const review = latestReview(personalReviews, profile.user_email);
  const theme = profileTheme(profile);

  const submitCustom = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!customTitle.trim() || savingCustom) return;
    setSavingCustom(true);
    try {
      await saveAction({
        action: 'save_update', activity_date: date, title: customTitle, details: customDetails,
        progress: customProgress, status: customProgress >= 100 ? 'completed' : customProgress > 0 ? 'in_progress' : 'todo',
      });
      setCustomTitle('');
      setCustomDetails('');
      setCustomProgress(0);
    } finally {
      setSavingCustom(false);
    }
  };

  const tabs = [
    { id: 'today', label: 'Daily List', icon: ListChecks },
    { id: 'job', label: 'Job Description', icon: BriefcaseBusiness },
    { id: 'okr', label: 'OKR & KPI', icon: Goal },
    { id: 'reviews', label: 'Penilaian', icon: ClipboardCheck },
  ] as const;

  return (
    <>
      <section className={`${panelClass} mb-5 overflow-hidden`}>
        <div data-performance-profile className="performance-profile-gradient px-4 py-5 text-[#24324A] sm:px-6 sm:py-6" style={{ backgroundImage: theme.gradient }}>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={avatarFor(profile)} alt={profile.display_name} className="h-16 w-16 rounded-2xl border-2 border-white/60 object-cover shadow-sm sm:h-20 sm:w-20" />
              <div data-performance-profile-identity className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2"><h2 className="truncate text-xl font-black sm:text-2xl">{profile.display_name}</h2><span data-performance-profile-badge className="rounded-lg border border-white/40 bg-white/45 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[#24324A]">{data.viewer.app_role}</span></div>
                <p className="text-sm font-bold text-[#24324A]/85">{profile.role_title}</p>
                <p className="mt-1 flex items-center gap-1.5 text-[11px] text-[#24324A]/65"><Users className="h-3.5 w-3.5" /> {profile.division}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:min-w-64">
              <div data-performance-profile-stat className="rounded-2xl border border-white/35 bg-white/40 px-4 py-3"><span className="text-[9px] font-bold uppercase tracking-wider text-[#24324A]/60">Progress Hari Ini</span><strong className="mt-1 block text-2xl font-black">{todayProgress}%</strong></div>
              <div data-performance-profile-stat className="rounded-2xl border border-white/35 bg-white/40 px-4 py-3"><span className="text-[9px] font-bold uppercase tracking-wider text-[#24324A]/60">Nilai Terakhir</span><strong className="mt-1 block text-2xl font-black">{review ? Math.round(review.overall_score) : '-'}</strong></div>
            </div>
          </div>
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_220px] sm:p-5">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#9A9DA5]">Fokus Peran</p>
            <p className="mt-2 text-sm leading-6 text-[#4A5568] dark:text-[#CBD2DC]">{profile.job_summary || 'Owner belum menambahkan ringkasan pekerjaan untuk profil ini.'}</p>
          </div>
          <div className="rounded-xl bg-[#F7F7F8] px-4 py-3 dark:bg-[#252B34]"><p className="text-[10px] font-extrabold uppercase tracking-wider text-[#9A9DA5]">Target Berlaku</p><p className="mt-1 text-sm font-black text-[#24324A] dark:text-[#F4F6FA]">{measurableItems.length} kegiatan</p><p className="mt-1 text-[10px] text-[#737680]">Sesuai role dan divisi Anda</p></div>
        </div>
      </section>

      <div className="mb-5 overflow-x-auto pb-1">
        <div className="inline-flex min-w-full gap-1 rounded-2xl border border-[#E5E7EB] bg-white p-1.5 dark:border-[#303742] dark:bg-[#171B22] sm:min-w-0">
          {tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setTab(id)} className={`flex min-w-max flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-extrabold transition ${tab === id ? 'bg-[#24324A] text-white dark:bg-[#F26B5E]' : 'text-[#737680] hover:bg-[#F3F4F6] dark:text-[#AAB2BF] dark:hover:bg-[#252B34]'}`}><Icon className="h-4 w-4" />{label}</button>)}
        </div>
      </div>

      {tab === 'today' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-extrabold text-[#24324A] dark:text-[#F4F6FA]">Checklist &amp; Progress Harian</h2><p className="mt-1 text-[11px] text-[#737680] dark:text-[#98A2B3]">Lengkapi detail pekerjaan agar progress dapat masuk ke KPI Anda.</p></div><input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={`${inputClass} sm:w-auto`} /></div>
          {dailyItems.length === 0 ? <EmptyState icon={ListChecks} title="Daily list belum diatur" description="Owner atau admin perlu menambahkan kegiatan harian untuk role atau divisi Anda." /> : dailyItems.map((item) => <ActivityEditor key={item.id} item={item} profile={profile} update={latestUpdate(dateUpdates, profile.user_email, item.id, date)} date={date} saveAction={saveAction} />)}
          <form onSubmit={submitCustom} className={`${panelClass} p-4 sm:p-5`}>
            <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EEF2F7] text-[#24324A] dark:bg-[#252B34] dark:text-[#F4F6FA]"><Plus className="h-4 w-4" /></div><div><h3 className="text-sm font-extrabold text-[#24324A] dark:text-[#F4F6FA]">Tambahkan Pekerjaan Lain</h3><p className="text-[10px] text-[#737680]">Untuk aktivitas ad-hoc di luar template harian.</p></div></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px]"><input required value={customTitle} onChange={(event) => setCustomTitle(event.target.value)} className={inputClass} placeholder="Nama pekerjaan hari ini" /><label className="flex items-center gap-2 rounded-xl border border-[#DDE1E7] px-3 dark:border-[#3A424F]"><input type="range" min="0" max="100" step="5" value={customProgress} onChange={(event) => setCustomProgress(Number(event.target.value))} className="h-1.5 min-w-0 flex-1 accent-[#F26B5E]" /><span className="w-8 text-right text-[10px] font-bold text-[#737680]">{customProgress}%</span></label></div>
            <textarea value={customDetails} onChange={(event) => setCustomDetails(event.target.value)} className={`${inputClass} mt-3 min-h-20 resize-y text-xs`} placeholder="Detail pekerjaan, output, dan progress..." />
            <div className="mt-3 flex justify-end"><button type="submit" disabled={savingCustom} className="inline-flex items-center gap-2 rounded-xl bg-[#24324A] px-4 py-2.5 text-xs font-extrabold text-white disabled:opacity-60 dark:bg-[#F26B5E]"><Plus className="h-4 w-4" />{savingCustom ? 'Menyimpan...' : 'Tambah Activity'}</button></div>
          </form>
        </div>
      )}

      {tab === 'job' && (
        <section className={`${panelClass} overflow-hidden`}>
          <div className="border-b border-[#E8E8EC] bg-[#E8F0EC] px-4 py-4 dark:border-[#303742] dark:bg-[#20342B] sm:px-5"><h2 className="text-base font-black text-[#24324A] dark:text-[#F4F6FA]">Berdasarkan Jabatan – {profile.role_title}</h2><p className="mt-1 text-[11px] text-[#5D7168] dark:text-[#A6C0B2]">Tanggung jawab dan ekspektasi utama pada role Anda.</p></div>
          {jobItems.length === 0 ? <div className="p-4"><EmptyState icon={FileText} title="Job description belum tersedia" description="Owner atau admin belum menetapkan job description untuk role Anda." /></div> : <ol className="divide-y divide-[#ECEEF1] dark:divide-[#303742]">{jobItems.map((item, index) => <li key={item.id} className="flex gap-4 px-4 py-4 sm:px-5"><span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[#F1F4F8] text-xs font-black text-[#24324A] dark:bg-[#252B34] dark:text-[#F4F6FA]">{index + 1}</span><div><h3 className="text-sm font-extrabold text-[#303B4F] dark:text-[#E6EAF0]">{item.title}</h3>{item.description && <p className="mt-1.5 whitespace-pre-line text-xs leading-6 text-[#737680] dark:text-[#98A2B3]">{item.description}</p>}</div></li>)}</ol>}
        </section>
      )}

      {tab === 'okr' && (
        <div className="space-y-4">
          <div><h2 className="text-sm font-extrabold text-[#24324A] dark:text-[#F4F6FA]">OKR, Key Result &amp; Initiative</h2><p className="mt-1 text-[11px] text-[#737680] dark:text-[#98A2B3]">Laporkan progress aktual agar objective team dan personal selalu terukur.</p></div>
          {okrItems.length === 0 ? <EmptyState icon={Goal} title="OKR belum ditetapkan" description="Owner atau admin belum menambahkan objective dan key result untuk scope Anda." /> : okrItems.map((item) => <ActivityEditor key={item.id} item={item} profile={profile} update={latestUpdate(personalUpdates, profile.user_email, item.id)} date={localDateKey()} saveAction={saveAction} />)}
        </div>
      )}

      {tab === 'reviews' && (
        <div className="space-y-4">
          {personalReviews.length === 0 ? <EmptyState icon={ClipboardCheck} title="Belum ada penilaian" description="Review dari owner atau admin akan muncul di sini setelah periode evaluasi." /> : personalReviews.map((item) => <section key={item.id} className={`${panelClass} p-4 sm:p-5`}><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-wider text-[#9A9DA5]">Periode {formatDate(item.period_start)} – {formatDate(item.period_end)}</p><h3 className="mt-2 text-lg font-black text-[#24324A] dark:text-[#F4F6FA]">Review Performa</h3></div><div className="rounded-2xl bg-[#EEF8F3] px-5 py-3 text-center dark:bg-[#1E3A2D]"><strong className="block text-2xl font-black text-[#347256] dark:text-[#78C59A]">{Math.round(item.overall_score)}</strong><span className="text-[9px] font-bold uppercase tracking-wider text-[#5C8B72]">Overall Score</span></div></div><div className="mt-5 grid grid-cols-3 gap-3">{[['Quality', item.quality_score], ['Ownership', item.ownership_score], ['Teamwork', item.collaboration_score]].map(([label, score]) => <div key={String(label)} className="rounded-xl bg-[#F7F7F8] p-3 text-center dark:bg-[#252B34]"><strong className="block text-lg font-black text-[#24324A] dark:text-[#F4F6FA]">{Math.round(Number(score))}</strong><span className="text-[9px] text-[#737680]">{label}</span></div>)}</div>{item.notes && <div className="mt-4 rounded-xl border border-[#E8E8EC] px-4 py-3 dark:border-[#303742]"><p className="text-[10px] font-bold uppercase tracking-wider text-[#9A9DA5]">Feedback</p><p className="mt-2 text-xs leading-6 text-[#4A5568] dark:text-[#CBD2DC]">{item.notes}</p></div>}</section>)}
        </div>
      )}
    </>
  );
}

function ManagerWorkspaceSwitcher({ data, saveAction }: { data: PerformanceBootstrap; saveAction: SaveAction }) {
  const [view, setView] = useState<'team' | 'personal'>('team');

  const views = [
    { id: 'team', label: 'Dashboard Team', icon: BarChart3 },
    { id: 'personal', label: 'Daily Saya', icon: ListChecks },
  ] as const;

  return (
    <>
      <div className="mb-5 grid w-full grid-cols-2 gap-1 rounded-2xl border border-[#E5E7EB] bg-white p-1.5 shadow-sm dark:border-[#303742] dark:bg-[#171B22] sm:w-fit sm:min-w-[360px]">
        {views.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            aria-pressed={view === id}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-extrabold transition ${view === id ? 'bg-[#24324A] text-white shadow-sm dark:bg-[#F26B5E]' : 'text-[#737680] hover:bg-[#F3F4F6] dark:text-[#AAB2BF] dark:hover:bg-[#252B34]'}`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {view === 'team'
        ? <ManagerWorkspace data={data} saveAction={saveAction} />
        : <MemberWorkspace data={data} saveAction={saveAction} />}
    </>
  );
}

export default function PerformanceWorkspace() {
  const [data, setData] = useState<PerformanceBootstrap | null>(null);
  const [clickUpAvatars, setClickUpAvatars] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const response = await fetch('/api/performance', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Gagal memuat KPI dan activity.');
      setData(payload);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Gagal memuat KPI dan activity.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadClickUpAvatars = useCallback(async () => {
    try {
      const response = await fetch('/api/clickup/teams', { cache: 'no-store' });
      if (!response.ok) return;
      const payload = await response.json().catch(() => ({}));
      const members = Array.isArray(payload.members) ? payload.members : [];
      const next: Record<string, string> = {};
      members.forEach((member: any) => {
        const email = String(member?.email || '').trim().toLowerCase();
        const avatar = String(member?.profilePicture || '').trim();
        if (email && avatar) next[email] = avatar;
      });
      setClickUpAvatars(next);
    } catch {
      // Keep the existing avatar map when ClickUp is temporarily unavailable.
    }
  }, []);

  useEffect(() => {
    loadData();
    loadClickUpAvatars();
    const refreshPerformance = () => loadData(true);
    const refreshAll = () => {
      loadData(true);
      loadClickUpAvatars();
    };
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') refreshPerformance();
    }, 5000);
    window.addEventListener('focus', refreshAll);
    window.addEventListener('bilik-workspace-updated', refreshAll);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshAll);
      window.removeEventListener('bilik-workspace-updated', refreshAll);
    };
  }, [loadClickUpAvatars, loadData]);

  const saveAction = useCallback<SaveAction>(async (payload) => {
    const response = await fetch('/api/performance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = result.error || 'Data gagal disimpan.';
      setError(message);
      throw new Error(message);
    }
    setError('');
    setNotice('Perubahan berhasil disimpan dan disinkronkan ke team.');
    window.setTimeout(() => setNotice(''), 3200);
    await loadData(true);
    return result;
  }, [loadData]);

  const syncedData = useMemo(() => {
    if (!data) return null;
    const syncProfile = (profile: PerformanceProfile): PerformanceProfile => ({
      ...profile,
      avatar_url: clickUpAvatars[profile.user_email.trim().toLowerCase()]
        || profile.avatar_url
        || (profile.user_email.trim().toLowerCase() === data.viewer.email.trim().toLowerCase()
          ? data.viewer.avatar_url || null
          : null),
    });
    return {
      ...data,
      profile: syncProfile(data.profile),
      profiles: data.profiles.map(syncProfile),
    };
  }, [clickUpAvatars, data]);

  if (loading || !syncedData) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center"><div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-[#24324A]/15 border-t-[#F26B5E]" /><p className="mt-3 text-xs font-bold text-[#737680]">Memuat workspace performance...</p></div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] pb-6">
      <PageHeader data={syncedData} refreshing={refreshing} onRefresh={() => { loadData(); loadClickUpAvatars(); }} />
      {!syncedData.storage_ready && <StorageWarning message={syncedData.warning} />}
      {error && <div className="mb-4 flex items-start gap-2 rounded-xl border border-[#F4C7C2] bg-[#FFF5F3] px-4 py-3 text-xs font-semibold text-[#A6463D] dark:border-[#6B3834] dark:bg-[#351F1E] dark:text-[#F4AAA3]"><AlertCircle className="h-4 w-4 flex-shrink-0" />{error}</div>}
      {notice && <div className="fixed bottom-24 left-1/2 z-[140] flex -translate-x-1/2 items-center gap-2 rounded-xl bg-[#24324A] px-4 py-3 text-xs font-extrabold text-white shadow-2xl md:bottom-6"><CheckCircle2 className="h-4 w-4 text-[#78C59A]" />{notice}</div>}
      {syncedData.viewer.can_manage ? <ManagerWorkspaceSwitcher data={syncedData} saveAction={saveAction} /> : <MemberWorkspace data={syncedData} saveAction={saveAction} />}
    </div>
  );
}
