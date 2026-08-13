'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  BriefcaseBusiness,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  Compass,
  FileCheck2,
  FileText,
  Inbox,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Settings2,
  TimerReset,
  UserRound,
  X,
  XCircle,
} from 'lucide-react';
import ModalPortal from '@/components/ui/ModalPortal';
import { APPROVAL_CATEGORY_BY_TYPE } from '@/lib/approvals/types';
import type {
  ApprovalBootstrap,
  ApprovalRequest,
  ApprovalRequestCategory,
  ApprovalRequestType,
  ApprovalStatus,
} from '@/lib/approvals/types';

type ApprovalTypeMeta = { label: string; icon: typeof BadgeCheck; color: string };

const TYPE_META: Record<ApprovalRequestType, ApprovalTypeMeta> = {
  daily_activity: { label: 'Daily Activity', icon: FileCheck2, color: 'bg-[#E7F4ED] text-[#39785D]' },
  script: { label: 'Approval Script', icon: FileText, color: 'bg-[#E6F1FF] text-[#356AA0]' },
  strategy: { label: 'Approval Strategy', icon: Compass, color: 'bg-[#EEE9FF] text-[#6557A5]' },
  deliverable: { label: 'Approval Deliverable', icon: BadgeCheck, color: 'bg-[#E3F4F1] text-[#33766D]' },
  work_other: { label: 'Approval Pekerjaan Lainnya', icon: BriefcaseBusiness, color: 'bg-[#FFF0DF] text-[#9B6429]' },
  leave: { label: 'Cuti / Izin', icon: CalendarClock, color: 'bg-[#FFF1DB] text-[#9B6514]' },
  overtime: { label: 'Lembur', icon: Clock3, color: 'bg-[#E9ECFF] text-[#5B61AD]' },
  kpi: { label: 'KPI / OKR', icon: TimerReset, color: 'bg-[#F2E9FA] text-[#7A4D9D]' },
  general: { label: 'Operasional Lainnya', icon: Settings2, color: 'bg-[#EEF2F7] text-[#566176]' },
};

const TYPE_ENTRIES = Object.entries(TYPE_META) as Array<[ApprovalRequestType, ApprovalTypeMeta]>;

const CATEGORY_META: Record<ApprovalRequestCategory, { label: string; description: string; icon: typeof BadgeCheck; color: string }> = {
  work: {
    label: 'Approval Pekerjaan',
    description: 'Script, strategy, deliverable, atau output pekerjaan lainnya.',
    icon: BriefcaseBusiness,
    color: 'bg-[#EAF2FF] text-[#3F679C]',
  },
  operational: {
    label: 'Approval Operasional',
    description: 'Cuti, lembur, KPI/OKR, dan kebutuhan operasional lainnya.',
    icon: Settings2,
    color: 'bg-[#FFF2DF] text-[#956325]',
  },
};

function categoryFor(requestType: ApprovalRequestType): ApprovalRequestCategory {
  return APPROVAL_CATEGORY_BY_TYPE[requestType] || 'operational';
}

const STATUS_META: Record<ApprovalStatus, { label: string; color: string; icon: typeof Check }> = {
  pending: { label: 'Menunggu', color: 'bg-[#FFF1DB] text-[#9B6514]', icon: Clock3 },
  approved: { label: 'Disetujui', color: 'bg-[#E7F4ED] text-[#39785D]', icon: CheckCircle2 },
  revision: { label: 'Perlu Revisi', color: 'bg-[#E9ECFF] text-[#5B61AD]', icon: RotateCcw },
  rejected: { label: 'Ditolak', color: 'bg-[#FDE9E7] text-[#B14E46]', icon: XCircle },
  cancelled: { label: 'Dibatalkan', color: 'bg-[#EEF2F7] text-[#737680]', icon: X },
};

const initialBootstrap: ApprovalBootstrap = {
  storage_ready: true,
  viewer: { email: '', name: '', role: 'member', can_manage: false },
  requests: [],
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'U';
}

export default function ApprovalsPage() {
  const [data, setData] = useState<ApprovalBootstrap>(initialBootstrap);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ApprovalStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | ApprovalRequestType>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | ApprovalRequestCategory>('all');
  const [showSubmit, setShowSubmit] = useState(false);
  const [selected, setSelected] = useState<ApprovalRequest | null>(null);
  const [reviewStatus, setReviewStatus] = useState<'approved' | 'revision' | 'rejected'>('approved');
  const [reviewNote, setReviewNote] = useState('');
  const [form, setForm] = useState({ request_type: 'script' as ApprovalRequestType, title: '', description: '' });

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch('/api/approvals', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Gagal memuat Approval Center.');
      setData({
        storage_ready: payload.storage_ready !== false,
        viewer: payload.viewer || initialBootstrap.viewer,
        requests: Array.isArray(payload.requests) ? payload.requests : [],
      });
      setError(payload.error || '');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Gagal memuat Approval Center.');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 5000);
    return () => window.clearInterval(timer);
  }, [load]);

  const stats = useMemo(() => ({
    pending: data.requests.filter((item) => item.status === 'pending').length,
    approved: data.requests.filter((item) => item.status === 'approved').length,
    revision: data.requests.filter((item) => item.status === 'revision').length,
    work: data.requests.filter((item) => categoryFor(item.request_type) === 'work').length,
    operational: data.requests.filter((item) => categoryFor(item.request_type) === 'operational').length,
    total: data.requests.length,
  }), [data.requests]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.requests.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (typeFilter !== 'all' && item.request_type !== typeFilter) return false;
      if (categoryFilter !== 'all' && categoryFor(item.request_type) !== categoryFilter) return false;
      if (!needle) return true;
      return [item.title, item.description, item.requested_by_name, item.requested_by_email]
        .some((value) => String(value || '').toLowerCase().includes(needle));
    });
  }, [categoryFilter, data.requests, query, statusFilter, typeFilter]);

  const formCategory = categoryFor(form.request_type);
  const formTypeOptions = TYPE_ENTRIES.filter(([value]) => value !== 'daily_activity' && categoryFor(value) === formCategory);

  async function post(body: Record<string, unknown>) {
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Permintaan gagal diproses.');
      await load(true);
      return true;
    } catch (postError) {
      setError(postError instanceof Error ? postError.message : 'Permintaan gagal diproses.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function submitRequest(event: React.FormEvent) {
    event.preventDefault();
    if (!form.title.trim()) return;
    if (await post({ action: 'submit', ...form })) {
      setForm({ request_type: 'script', title: '', description: '' });
      setShowSubmit(false);
    }
  }

  async function reviewRequest(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    if (await post({ action: 'review', id: selected.id, status: reviewStatus, reviewer_note: reviewNote })) {
      setSelected(null);
      setReviewNote('');
      setReviewStatus('approved');
    }
  }

  return (
    <div className="min-w-0 space-y-6 pb-24 animate-fade-in">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#F26B5E]">
            <BadgeCheck className="h-4 w-4" /> Workflow Persetujuan
          </div>
          <h1 className="text-3xl font-black tracking-tight text-[#24324A]">Approval Center</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#737680]">
            {data.viewer.can_manage
              ? 'Tinjau approval pekerjaan dan kebutuhan operasional tim dalam antrean yang terpisah dan jelas.'
              : 'Kirim approval pekerjaan atau permintaan operasional, lalu pantau status serta catatan reviewer.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#DDE2EA] bg-white px-4 text-xs font-extrabold text-[#24324A] shadow-sm transition hover:bg-[#F7F7F8]"
          >
            <RefreshCw className={`h-4 w-4 text-[#F26B5E] ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowSubmit(true)}
            disabled={!data.storage_ready}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#24324A] px-4 text-xs font-extrabold text-white shadow-sm transition hover:bg-[#31415E] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Buat Permintaan
          </button>
        </div>
      </header>

      {error && (
        <div className={`flex items-start gap-3 rounded-2xl border p-4 text-sm ${data.storage_ready ? 'border-[#F3C9C5] bg-[#FFF5F3] text-[#9A453E]' : 'border-[#F2D6A4] bg-[#FFF9ED] text-[#8A5B16]'}`}>
          <CircleAlert className="mt-0.5 h-5 w-5 flex-none" />
          <div>
            <p className="font-extrabold">{data.storage_ready ? 'Approval Center belum dapat dimuat' : 'Database Approval Center belum aktif'}</p>
            <p className="mt-1 text-xs leading-5 opacity-80">{error}</p>
          </div>
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: 'Menunggu', value: stats.pending, icon: Clock3, iconColor: 'text-[#A46D18]' },
          { label: 'Disetujui', value: stats.approved, icon: CheckCircle2, iconColor: 'text-[#39785D]' },
          { label: 'Perlu Revisi', value: stats.revision, icon: RotateCcw, iconColor: 'text-[#5B61AD]' },
          { label: 'Total Permintaan', value: stats.total, icon: Inbox, iconColor: 'text-[#765096]' },
        ].map((stat) => (
          <article key={stat.label} className="rounded-2xl border border-[#E1E5EB] bg-white p-4 shadow-sm dark:border-[#303742] dark:bg-[#20242C] sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#5E6470]">{stat.label}</p>
                <p className="mt-2 text-3xl font-black text-[#24324A]">{stat.value}</p>
              </div>
              <div className="rounded-2xl bg-[#F2F4F7] p-3 dark:bg-[#282D36]"><stat.icon className={`h-5 w-5 ${stat.iconColor}`} /></div>
            </div>
          </article>
        ))}
      </section>

      <section className="overflow-hidden rounded-3xl border border-[#E1E5EB] bg-white shadow-sm">
        <div className="border-b border-[#E8E8EC] p-4 sm:p-5">
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              aria-pressed={categoryFilter === 'all'}
              onClick={() => setCategoryFilter('all')}
              className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-[11px] font-extrabold transition ${categoryFilter === 'all' ? 'border-[#24324A] bg-[#24324A] text-white' : 'border-[#DDE2EA] bg-white text-[#626874] hover:bg-[#F7F8FA]'}`}
            >
              <Inbox className="h-4 w-4" /> Semua Approval <span className="rounded-full bg-white/20 px-2 py-0.5">{stats.total}</span>
            </button>
            <button
              type="button"
              aria-pressed={categoryFilter === 'work'}
              onClick={() => {
                setCategoryFilter('work');
                if (typeFilter !== 'all' && categoryFor(typeFilter) !== 'work') setTypeFilter('all');
              }}
              className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-[11px] font-extrabold transition ${categoryFilter === 'work' ? 'border-[#3F679C] bg-[#EAF2FF] text-[#315988]' : 'border-[#DDE2EA] bg-white text-[#626874] hover:bg-[#F7F8FA]'}`}
            >
              <BriefcaseBusiness className="h-4 w-4" /> Pekerjaan <span className="rounded-full bg-white/60 px-2 py-0.5">{stats.work}</span>
            </button>
            <button
              type="button"
              aria-pressed={categoryFilter === 'operational'}
              onClick={() => {
                setCategoryFilter('operational');
                if (typeFilter !== 'all' && categoryFor(typeFilter) !== 'operational') setTypeFilter('all');
              }}
              className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-[11px] font-extrabold transition ${categoryFilter === 'operational' ? 'border-[#B17C39] bg-[#FFF2DF] text-[#8B5C21]' : 'border-[#DDE2EA] bg-white text-[#626874] hover:bg-[#F7F8FA]'}`}
            >
              <Settings2 className="h-4 w-4" /> Operasional <span className="rounded-full bg-white/60 px-2 py-0.5">{stats.operational}</span>
            </button>
          </div>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9A9DA6]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari judul, anggota, atau detail..."
                className="h-11 w-full rounded-xl border border-[#DDE2EA] bg-white pl-10 pr-4 text-sm text-[#24324A] outline-none transition focus:border-[#7F91B0]"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <label className="relative">
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="h-11 w-full appearance-none rounded-xl border border-[#DDE2EA] bg-white pl-3 pr-9 text-xs font-bold text-[#24324A] outline-none sm:w-40">
                  <option value="all">Semua Status</option>
                  {Object.entries(STATUS_META).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#737680]" />
              </label>
              <label className="relative">
                <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)} className="h-11 w-full appearance-none rounded-xl border border-[#DDE2EA] bg-white pl-3 pr-9 text-xs font-bold text-[#24324A] outline-none sm:w-44">
                  <option value="all">Semua Tipe</option>
                  <optgroup label="Approval Pekerjaan">
                    {TYPE_ENTRIES.filter(([value]) => categoryFor(value) === 'work').map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
                  </optgroup>
                  <optgroup label="Approval Operasional">
                    {TYPE_ENTRIES.filter(([value]) => categoryFor(value) === 'operational').map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
                  </optgroup>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#737680]" />
              </label>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-[#737680]">
            <Loader2 className="h-7 w-7 animate-spin text-[#F26B5E]" />
            <p className="text-xs font-bold">Memuat antrean approval...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
            <div className="mb-4 rounded-2xl bg-[#F2F4F7] p-4 text-[#7B808B]"><Inbox className="h-7 w-7" /></div>
            <h2 className="text-base font-black text-[#24324A]">Belum ada permintaan</h2>
            <p className="mt-2 max-w-md text-xs leading-5 text-[#737680]">Daily activity yang disimpan akan otomatis masuk ke sini. Permintaan lain dapat dibuat melalui tombol di atas.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#ECEEF2]">
            {filtered.map((request) => {
              const type = TYPE_META[request.request_type] || TYPE_META.general;
              const category = CATEGORY_META[categoryFor(request.request_type)];
              const status = STATUS_META[request.status] || STATUS_META.pending;
              const TypeIcon = type.icon;
              const CategoryIcon = category.icon;
              const StatusIcon = status.icon;
              return (
                <article key={request.id} className="p-4 transition hover:bg-[#FAFAFB] dark:hover:bg-[#282D36] sm:p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className="h-11 w-11 flex-none overflow-hidden rounded-2xl bg-gradient-to-br from-[#D8E5FF] to-[#F2DBEE] ring-1 ring-white">
                        {request.requested_by_avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={request.requested_by_avatar} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-xs font-black text-[#40506B]">{initials(request.requested_by_name)}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold ${category.color}`}><CategoryIcon className="h-3 w-3" />{category.label}</span>
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold ${type.color}`}><TypeIcon className="h-3 w-3" />{type.label}</span>
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold ${status.color}`}><StatusIcon className="h-3 w-3" />{status.label}</span>
                        </div>
                        <h3 className="mt-2 text-sm font-black text-[#24324A] sm:text-base">{request.title}</h3>
                        {request.description && <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#737680]">{request.description}</p>}
                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-semibold text-[#8A8E98]">
                          <span className="inline-flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" />{request.requested_by_name}</span>
                          <span>{formatDate(request.submitted_at)}</span>
                          {request.metadata?.progress !== undefined && <span>Progress {String(request.metadata.progress)}%</span>}
                        </div>
                        {request.reviewer_note && (
                          <div className="mt-3 rounded-xl border border-[#E5E8ED] bg-[#F7F8FA] px-3 py-2 text-xs leading-5 text-[#5E6470]">
                            <span className="font-extrabold text-[#24324A]">Catatan {request.reviewer_name || 'reviewer'}:</span> {request.reviewer_note}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      {data.viewer.can_manage && request.status === 'pending' && (
                        <button type="button" onClick={() => { setSelected(request); setReviewStatus('approved'); setReviewNote(''); }} className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#24324A] px-3 text-[11px] font-extrabold text-white hover:bg-[#31415E]">
                          <BadgeCheck className="h-4 w-4" /> Tinjau
                        </button>
                      )}
                      {!data.viewer.can_manage && request.status === 'revision' && (
                        <button type="button" disabled={saving} onClick={() => void post({ action: 'resubmit', id: request.id, title: request.title, description: request.description })} className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#5B61AD] px-3 text-[11px] font-extrabold text-white">
                          <Send className="h-3.5 w-3.5" /> Kirim Ulang
                        </button>
                      )}
                      {!data.viewer.can_manage && ['pending', 'revision'].includes(request.status) && (
                        <button type="button" disabled={saving} onClick={() => { if (window.confirm('Batalkan permintaan ini?')) void post({ action: 'cancel', id: request.id }); }} className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#E4E7EC] bg-white px-3 text-[11px] font-extrabold text-[#737680] hover:bg-[#F7F7F8]">
                          <X className="h-3.5 w-3.5" /> Batalkan
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {showSubmit && (
        <ModalPortal onClose={() => setShowSubmit(false)}>
          <form role="dialog" aria-modal="true" onSubmit={submitRequest} className="max-h-[92svh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-xl sm:rounded-3xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div><h2 className="text-lg font-black text-[#24324A]">Buat Permintaan Approval</h2><p className="mt-1 text-xs text-[#737680]">Pilih approval pekerjaan atau kebutuhan operasional.</p></div>
              <button type="button" onClick={() => setShowSubmit(false)} className="rounded-xl p-2 text-[#737680] hover:bg-[#F2F4F7]"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-6 space-y-4">
              <div>
                <span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#737680]">Kategori Approval</span>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(['work', 'operational'] as const).map((categoryValue) => {
                    const category = CATEGORY_META[categoryValue];
                    const CategoryIcon = category.icon;
                    const active = formCategory === categoryValue;
                    return (
                      <button
                        key={categoryValue}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setForm((current) => ({ ...current, request_type: categoryValue === 'work' ? 'script' : 'leave' }))}
                        className={`rounded-2xl border p-3 text-left transition ${active ? 'border-[#24324A] bg-[#F4F7FB] ring-1 ring-[#24324A]' : 'border-[#DDE2EA] bg-white hover:bg-[#F8F9FB]'}`}
                      >
                        <span className="flex items-center gap-2 text-xs font-black text-[#24324A]"><CategoryIcon className="h-4 w-4" />{category.label}</span>
                        <span className="mt-1.5 block text-[10px] leading-4 text-[#737680]">{category.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="block"><span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#737680]">Tipe Approval</span><select value={form.request_type} onChange={(event) => setForm((current) => ({ ...current, request_type: event.target.value as ApprovalRequestType }))} className="h-11 w-full rounded-xl border border-[#DDE2EA] bg-white px-3 text-sm text-[#24324A] outline-none focus:border-[#7F91B0]">{formTypeOptions.map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}</select></label>
              <label className="block"><span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#737680]">Judul</span><input required maxLength={300} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder={formCategory === 'work' ? 'Contoh: Approval script campaign Agustus' : 'Contoh: Izin tidak masuk 14 Agustus'} className="h-11 w-full rounded-xl border border-[#DDE2EA] px-3 text-sm text-[#24324A] outline-none focus:border-[#7F91B0]" /></label>
              <label className="block"><span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#737680]">Detail</span><textarea rows={5} maxLength={5000} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder={formCategory === 'work' ? 'Cantumkan project/client, link dokumen, output, serta bagian yang perlu disetujui.' : 'Jelaskan kebutuhan, tanggal, durasi, dan konteks operasional yang perlu ditinjau.'} className="w-full resize-y rounded-xl border border-[#DDE2EA] p-3 text-sm leading-6 text-[#24324A] outline-none focus:border-[#7F91B0]" /></label>
            </div>
            <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setShowSubmit(false)} className="h-10 rounded-xl border border-[#DDE2EA] px-4 text-xs font-extrabold text-[#737680]">Batal</button><button type="submit" disabled={saving || !form.title.trim()} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#24324A] px-4 text-xs font-extrabold text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Kirim Approval</button></div>
          </form>
        </ModalPortal>
      )}

      {selected && (
        <ModalPortal onClose={() => setSelected(null)}>
          <form role="dialog" aria-modal="true" onSubmit={reviewRequest} className="max-h-[92svh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-xl sm:rounded-3xl sm:p-6">
            <div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-black text-[#24324A]">Tinjau Permintaan</h2><p className="mt-1 text-xs text-[#737680]">{selected.requested_by_name} · {CATEGORY_META[categoryFor(selected.request_type)].label} · {TYPE_META[selected.request_type]?.label}</p></div><button type="button" onClick={() => setSelected(null)} className="rounded-xl p-2 text-[#737680] hover:bg-[#F2F4F7]"><X className="h-5 w-5" /></button></div>
            <div className="mt-5 rounded-2xl border border-[#E5E8ED] bg-[#F8F9FB] p-4"><h3 className="font-black text-[#24324A]">{selected.title}</h3><p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-[#626874]">{selected.description || 'Tidak ada detail tambahan.'}</p></div>
            <div className="mt-5 grid grid-cols-3 gap-2">{(['approved', 'revision', 'rejected'] as const).map((value) => { const meta = STATUS_META[value]; const Icon = meta.icon; return <button key={value} type="button" onClick={() => setReviewStatus(value)} className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl border px-2 text-[10px] font-extrabold transition ${reviewStatus === value ? 'border-[#24324A] bg-[#24324A] text-white' : 'border-[#E1E5EB] bg-white text-[#5E6470]'}`}><Icon className="h-5 w-5" />{meta.label}</button>; })}</div>
            <label className="mt-5 block"><span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#737680]">Catatan Reviewer</span><textarea rows={4} value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder={reviewStatus === 'revision' ? 'Tuliskan bagian yang perlu diperbaiki...' : 'Tambahkan catatan bila diperlukan.'} className="w-full resize-y rounded-xl border border-[#DDE2EA] p-3 text-sm leading-6 text-[#24324A] outline-none focus:border-[#7F91B0]" /></label>
            <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setSelected(null)} className="h-10 rounded-xl border border-[#DDE2EA] px-4 text-xs font-extrabold text-[#737680]">Batal</button><button type="submit" disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#24324A] px-4 text-xs font-extrabold text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />} Simpan Keputusan</button></div>
          </form>
        </ModalPortal>
      )}
    </div>
  );
}
