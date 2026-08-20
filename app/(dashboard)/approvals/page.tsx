'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  ExternalLink,
  FileCheck2,
  FileText,
  Inbox,
  Loader2,
  MessageSquareText,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Settings2,
  TimerReset,
  Trash2,
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
  daily_activity: { label: 'Daily Activity', icon: FileCheck2, color: 'bg-[#E7F4ED] text-[#39785D] dark:bg-[#1E392C] dark:text-[#8DD0A9]' },
  script: { label: 'Approval Script', icon: FileText, color: 'bg-[#E6F1FF] text-[#356AA0] dark:bg-[#29364A] dark:text-[#AFC9EE]' },
  strategy: { label: 'Approval Strategy', icon: Compass, color: 'bg-[#EEE9FF] text-[#6557A5] dark:bg-[#32294C] dark:text-[#D1B8F1]' },
  deliverable: { label: 'Approval Deliverable', icon: BadgeCheck, color: 'bg-[#E3F4F1] text-[#33766D] dark:bg-[#1E3938] dark:text-[#91D6CC]' },
  work_other: { label: 'Approval Pekerjaan Lainnya', icon: BriefcaseBusiness, color: 'bg-[#FFF0DF] text-[#9B6429] dark:bg-[#3D321F] dark:text-[#F2C879]' },
  leave: { label: 'Cuti / Izin', icon: CalendarClock, color: 'bg-[#FFF1DB] text-[#9B6514] dark:bg-[#3D321F] dark:text-[#F2C879]' },
  overtime: { label: 'Lembur', icon: Clock3, color: 'bg-[#E9ECFF] text-[#5B61AD] dark:bg-[#2E3151] dark:text-[#BEC2FF]' },
  kpi: { label: 'KPI / OKR', icon: TimerReset, color: 'bg-[#F2E9FA] text-[#7A4D9D] dark:bg-[#32294C] dark:text-[#D1B8F1]' },
  general: { label: 'Operasional Lainnya', icon: Settings2, color: 'bg-[#EEF2F7] text-[#566176] dark:bg-[#2A3443] dark:text-[#C0C9D6]' },
};

const TYPE_ENTRIES = Object.entries(TYPE_META) as Array<[ApprovalRequestType, ApprovalTypeMeta]>;

const CATEGORY_META: Record<ApprovalRequestCategory, { label: string; description: string; icon: typeof BadgeCheck; color: string }> = {
  work: {
    label: 'Approval Pekerjaan',
    description: 'Script, strategy, deliverable, atau output pekerjaan lainnya.',
    icon: BriefcaseBusiness,
    color: 'bg-[#EAF2FF] text-[#3F679C] dark:bg-[#29364A] dark:text-[#AFC9EE]',
  },
  operational: {
    label: 'Approval Operasional',
    description: 'Cuti, lembur, KPI/OKR, dan kebutuhan operasional lainnya.',
    icon: Settings2,
    color: 'bg-[#FFF2DF] text-[#956325] dark:bg-[#3D321F] dark:text-[#F2C879]',
  },
};

function categoryFor(requestType: ApprovalRequestType): ApprovalRequestCategory {
  return APPROVAL_CATEGORY_BY_TYPE[requestType] || 'operational';
}

const STATUS_META: Record<ApprovalStatus, { label: string; color: string; icon: typeof Check }> = {
  pending: { label: 'Menunggu', color: 'bg-[#FFF1DB] text-[#9B6514] dark:bg-[#3D321F] dark:text-[#F2C879]', icon: Clock3 },
  approved: { label: 'Disetujui', color: 'bg-[#E7F4ED] text-[#39785D] dark:bg-[#1E392C] dark:text-[#8DD0A9]', icon: CheckCircle2 },
  revision: { label: 'Perlu Revisi', color: 'bg-[#E9ECFF] text-[#5B61AD] dark:bg-[#2E3151] dark:text-[#BEC2FF]', icon: RotateCcw },
  rejected: { label: 'Ditolak', color: 'bg-[#FDE9E7] text-[#B14E46] dark:bg-[#3B272B] dark:text-[#FFAAA0]', icon: XCircle },
  cancelled: { label: 'Dibatalkan', color: 'bg-[#EEF2F7] text-[#737680] dark:bg-[#2A3443] dark:text-[#C0C9D6]', icon: X },
};

const initialBootstrap: ApprovalBootstrap = {
  storage_ready: true,
  viewer: { email: '', name: '', role: 'member', can_manage: false },
  requests: [],
};

const emptyRequestForm = {
  request_type: 'script' as ApprovalRequestType,
  title: '',
  description: '',
};

type ApprovalMutationPayload = {
  success?: boolean;
  request?: ApprovalRequest;
  deleted?: Pick<ApprovalRequest, 'id' | 'title' | 'requested_by_email'>;
  error?: string;
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

function LinkifiedText({ text }: { text: string }) {
  const nodes: React.ReactNode[] = [];
  const urlPattern = /https?:\/\/[^\s]+/gi;
  let cursor = 0;

  for (const match of text.matchAll(urlPattern)) {
    const start = match.index ?? 0;
    const rawUrl = match[0];
    const href = rawUrl.replace(/[),.;!?]+$/g, '');
    const trailingPunctuation = rawUrl.slice(href.length);

    if (start > cursor) nodes.push(text.slice(cursor, start));
    nodes.push(
      <a
        key={`${href}-${start}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title="Buka tautan di tab baru"
        onClick={(event) => event.stopPropagation()}
        className="inline-flex max-w-full items-center gap-1 break-all font-bold text-[#3F679C] underline decoration-[#95B1EE] decoration-2 underline-offset-2 transition hover:text-[#24324A] dark:text-[#AFC9EE] dark:hover:text-white"
      >
        <span>{href}</span>
        <ExternalLink className="h-3 w-3 flex-none" />
      </a>
    );
    if (trailingPunctuation) nodes.push(trailingPunctuation);
    cursor = start + rawUrl.length;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return <>{nodes.length > 0 ? nodes : text}</>;
}

type ApprovalDetailModalProps = {
  request: ApprovalRequest;
  canManage: boolean;
  canEdit: boolean;
  saving: boolean;
  onClose: () => void;
  onReview: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

function ApprovalDetailModal({
  request,
  canManage,
  canEdit,
  saving,
  onClose,
  onReview,
  onEdit,
  onDelete,
}: ApprovalDetailModalProps) {
  const type = TYPE_META[request.request_type] || TYPE_META.general;
  const category = CATEGORY_META[categoryFor(request.request_type)];
  const status = STATUS_META[request.status] || STATUS_META.pending;
  const TypeIcon = type.icon;
  const CategoryIcon = category.icon;
  const StatusIcon = status.icon;
  const hasReviewDetails = Boolean(request.reviewer_name || request.reviewer_email || request.reviewed_at || request.reviewer_note.trim());

  return (
    <ModalPortal onClose={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="approval-detail-title"
        className="flex max-h-[92svh] w-full min-w-0 flex-col overflow-hidden rounded-t-[28px] border border-[#E1E5EB] bg-white shadow-2xl dark:border-[#3A424E] dark:bg-[#20242C] sm:max-w-3xl sm:rounded-[28px]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[#E8E8EC] px-5 py-5 dark:border-[#303742] sm:px-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold ${category.color}`}>
                <CategoryIcon className="h-3 w-3" />{category.label}
              </span>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold ${type.color}`}>
                <TypeIcon className="h-3 w-3" />{type.label}
              </span>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold ${status.color}`}>
                <StatusIcon className="h-3 w-3" />{status.label}
              </span>
            </div>
            <h2 id="approval-detail-title" className="mt-3 break-words text-xl font-black leading-tight text-[#24324A] dark:text-[#F4F6FA] sm:text-2xl">
              {request.title}
            </h2>
            <p className="mt-2 text-xs text-[#737680] dark:text-[#98A2B3]">Detail lengkap permintaan dan hasil evaluasi approval.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-2xl text-[#737680] transition hover:bg-[#F2F4F7] dark:text-[#B9C3D0] dark:hover:bg-[#282D36]"
            aria-label="Tutup detail approval"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-w-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6 sm:py-6">
          <div className="grid min-w-0 gap-5 md:grid-cols-[minmax(0,1.55fr)_minmax(220px,0.8fr)]">
            <section className="min-w-0 rounded-2xl border border-[#E5E8ED] bg-[#F8F9FB] p-4 dark:border-[#3A424E] dark:bg-[#171D27] sm:p-5">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#737680] dark:text-[#98A2B3]">Detail permintaan</p>
              <div className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-[#4F5663] dark:text-[#D1D6DF]">
                {request.description ? <LinkifiedText text={request.description} /> : 'Tidak ada detail tambahan.'}
              </div>
              {request.metadata?.progress !== undefined && (
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#EAF2FF] px-3 py-1.5 text-[11px] font-extrabold text-[#3F679C] dark:bg-[#29364A] dark:text-[#AFC9EE]">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Progress {String(request.metadata.progress)}%
                </div>
              )}
              {(request.source_type || request.source_id) && (
                <div className="mt-5 border-t border-[#E1E5EB] pt-4 text-[11px] leading-5 text-[#737680] dark:border-[#303742] dark:text-[#98A2B3]">
                  <p className="font-extrabold uppercase tracking-[0.12em]">Sumber terhubung</p>
                  <p className="mt-1 break-all">{request.source_type || 'Sumber aplikasi'}{request.source_id ? ` · ${request.source_id}` : ''}</p>
                </div>
              )}
            </section>

            <aside className="min-w-0 space-y-3">
              <section className="rounded-2xl border border-[#E5E8ED] bg-white p-4 dark:border-[#3A424E] dark:bg-[#20242C]">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#737680] dark:text-[#98A2B3]">Diajukan oleh</p>
                <div className="mt-3 flex min-w-0 items-center gap-3">
                  <div className="h-11 w-11 flex-none overflow-hidden rounded-2xl bg-gradient-to-br from-[#D8E5FF] to-[#F2DBEE] ring-1 ring-white/80 dark:ring-[#4B5565]">
                    {request.requested_by_avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={request.requested_by_avatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-xs font-black text-[#40506B]">{initials(request.requested_by_name)}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-[#24324A] dark:text-[#F4F6FA]">{request.requested_by_name}</p>
                    <a href={`mailto:${request.requested_by_email}`} className="mt-0.5 block truncate text-[11px] font-semibold text-[#3F679C] hover:underline dark:text-[#AFC9EE]">
                      {request.requested_by_email}
                    </a>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-[#E5E8ED] bg-white p-4 text-[11px] dark:border-[#3A424E] dark:bg-[#20242C]">
                <div className="flex items-start gap-2 text-[#737680] dark:text-[#AAB4C5]">
                  <CalendarClock className="mt-0.5 h-4 w-4 flex-none" />
                  <div><p className="font-extrabold text-[#24324A] dark:text-[#F4F6FA]">Diajukan</p><p className="mt-0.5">{formatDate(request.submitted_at)}</p></div>
                </div>
                <div className="mt-3 flex items-start gap-2 border-t border-[#ECEEF2] pt-3 text-[#737680] dark:border-[#303742] dark:text-[#AAB4C5]">
                  <RefreshCw className="mt-0.5 h-4 w-4 flex-none" />
                  <div><p className="font-extrabold text-[#24324A] dark:text-[#F4F6FA]">Terakhir diperbarui</p><p className="mt-0.5">{formatDate(request.updated_at)}</p></div>
                </div>
              </section>
            </aside>
          </div>

          <section className="mt-5 rounded-2xl border border-[#DCE5F2] bg-[#F4F8FD] p-4 dark:border-[#3B4A5D] dark:bg-[#243042] sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-none items-center justify-center rounded-2xl bg-[#EAF2FF] text-[#3F679C] dark:bg-[#29364A] dark:text-[#AFC9EE]">
                <MessageSquareText className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#5E6470] dark:text-[#AAB4C5]">Catatan evaluasi</p>
                    <h3 className="mt-1 text-sm font-black text-[#24324A] dark:text-[#F4F6FA]">
                      {hasReviewDetails ? `Evaluasi oleh ${request.reviewer_name || request.reviewer_email || 'reviewer'}` : 'Belum ada evaluasi'}
                    </h3>
                  </div>
                  {request.reviewed_at && <span className="text-[10px] font-semibold text-[#737680] dark:text-[#AAB4C5]">{formatDate(request.reviewed_at)}</span>}
                </div>
                <div className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-[#4F5663] dark:text-[#D1D6DF]">
                  {request.reviewer_note.trim() ? (
                    <LinkifiedText text={request.reviewer_note} />
                  ) : request.status === 'pending' ? (
                    'Approval ini belum ditinjau, sehingga belum ada catatan evaluasi.'
                  ) : (
                    `Keputusan “${status.label}” disimpan tanpa catatan evaluasi tambahan.`
                  )}
                </div>
                {request.reviewer_email && (
                  <a href={`mailto:${request.reviewer_email}`} className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-[#3F679C] hover:underline dark:text-[#AFC9EE]">
                    {request.reviewer_email}
                  </a>
                )}
              </div>
            </div>
          </section>
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-[#E8E8EC] bg-white px-5 py-4 dark:border-[#303742] dark:bg-[#20242C] sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <button type="button" onClick={onClose} className="h-10 rounded-xl border border-[#DDE2EA] px-4 text-xs font-extrabold text-[#626874] transition hover:bg-[#F7F8FA] dark:border-[#3A424E] dark:text-[#D1D6DF] dark:hover:bg-[#282D36]">
            Tutup
          </button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            {canManage && (
              <button type="button" disabled={saving} onClick={onDelete} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#F0C7C4] bg-white px-4 text-xs font-extrabold text-[#B14E46] transition hover:bg-[#FFF0ED] disabled:opacity-50 dark:border-[#633D3A] dark:bg-[#20242C] dark:text-[#FFAAA0] dark:hover:bg-[#3B272B]">
                <Trash2 className="h-4 w-4" /> Hapus
              </button>
            )}
            {canEdit && (
              <button type="button" disabled={saving} onClick={onEdit} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#DDE2EA] bg-white px-4 text-xs font-extrabold text-[#40536F] transition hover:bg-[#F7F8FA] disabled:opacity-50 dark:border-[#3A424E] dark:bg-[#20242C] dark:text-[#C9D5E5] dark:hover:bg-[#282D36]">
                <Pencil className="h-4 w-4" /> Edit
              </button>
            )}
            {canManage && request.status === 'pending' && (
              <button type="button" disabled={saving} onClick={onReview} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#24324A] px-4 text-xs font-extrabold text-white transition hover:bg-[#31415E] disabled:opacity-50">
                <BadgeCheck className="h-4 w-4" /> Tinjau Approval
              </button>
            )}
          </div>
        </footer>
      </section>
    </ModalPortal>
  );
}

export default function ApprovalsPage() {
  const deletedRequestIds = useRef(new Set<string>());
  const [data, setData] = useState<ApprovalBootstrap>(initialBootstrap);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ApprovalStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | ApprovalRequestType>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | ApprovalRequestCategory>('all');
  const [showSubmit, setShowSubmit] = useState(false);
  const [editingRequest, setEditingRequest] = useState<ApprovalRequest | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApprovalRequest | null>(null);
  const [selected, setSelected] = useState<ApprovalRequest | null>(null);
  const [detailRequestId, setDetailRequestId] = useState<string | null>(null);
  const [reviewStatus, setReviewStatus] = useState<'approved' | 'revision' | 'rejected'>('approved');
  const [reviewNote, setReviewNote] = useState('');
  const [form, setForm] = useState({ ...emptyRequestForm });

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch('/api/approvals', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Gagal memuat Approval Center.');
      setData({
        storage_ready: payload.storage_ready !== false,
        viewer: payload.viewer || initialBootstrap.viewer,
        requests: Array.isArray(payload.requests)
          ? payload.requests.filter((request: ApprovalRequest) => !deletedRequestIds.current.has(request.id))
          : [],
      });
      setError(payload.error || '');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Gagal memuat Approval Center.');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoadTimer = window.setTimeout(() => void load(), 0);
    const refreshTimer = window.setInterval(() => void load(true), 5000);
    return () => {
      window.clearTimeout(initialLoadTimer);
      window.clearInterval(refreshTimer);
    };
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

  const detailRequest = detailRequestId
    ? data.requests.find((request) => request.id === detailRequestId) || null
    : null;

  const formCategory = categoryFor(form.request_type);
  const isSourceLinkedEdit = Boolean(editingRequest?.source_type && editingRequest?.source_id);
  const hasStorageConfigError = /SUPABASE_SERVICE_ROLE_KEY|service_role|token anon/i.test(error);
  const formTypeOptions = TYPE_ENTRIES.filter(([value]) =>
    categoryFor(value) === formCategory && (value !== 'daily_activity' || editingRequest?.request_type === 'daily_activity')
  );

  async function mutate(
    method: 'POST' | 'PATCH' | 'DELETE',
    body?: Record<string, unknown>,
    url = '/api/approvals'
  ): Promise<ApprovalMutationPayload | null> {
    setSaving(true);
    setError('');
    try {
      const response = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const payload = await response.json().catch(() => ({})) as ApprovalMutationPayload;
      if (!response.ok) throw new Error(payload.error || 'Permintaan gagal diproses.');

      if (method === 'DELETE') {
        if (!payload.deleted?.id) throw new Error('Database tidak mengonfirmasi approval yang terhapus.');
        deletedRequestIds.current.add(payload.deleted.id);
        setData((current) => ({
          ...current,
          requests: current.requests.filter((request) => request.id !== payload.deleted?.id),
        }));
      }

      await load(true);
      return payload;
    } catch (postError) {
      setError(postError instanceof Error ? postError.message : 'Permintaan gagal diproses.');
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function post(body: Record<string, unknown>) {
    return Boolean(await mutate('POST', body));
  }

  function openCreateRequest() {
    setEditingRequest(null);
    setForm({ ...emptyRequestForm });
    setShowSubmit(true);
  }

  function openEditRequest(request: ApprovalRequest) {
    setDetailRequestId(null);
    setEditingRequest(request);
    setForm({
      request_type: request.request_type,
      title: request.title,
      description: request.description,
    });
    setShowSubmit(true);
  }

  function openReviewRequest(request: ApprovalRequest) {
    setDetailRequestId(null);
    setSelected(request);
    setReviewStatus('approved');
    setReviewNote('');
  }

  function closeRequestForm() {
    setShowSubmit(false);
    setEditingRequest(null);
    setForm({ ...emptyRequestForm });
  }

  async function submitRequest(event: React.FormEvent) {
    event.preventDefault();
    if (!form.title.trim()) return;
    const result = editingRequest
      ? await mutate('PATCH', { id: editingRequest.id, ...form })
      : await mutate('POST', { action: 'submit', ...form });
    if (result) {
      closeRequestForm();
    }
  }

  async function deleteRequest() {
    if (!deleteTarget) return;
    const targetId = deleteTarget.id;
    const result = await mutate('DELETE', undefined, `/api/approvals?id=${encodeURIComponent(targetId)}`);
    if (result?.deleted?.id === targetId) {
      setDeleteTarget(null);
      setDetailRequestId((current) => current === targetId ? null : current);
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
            onClick={openCreateRequest}
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
            <p className="font-extrabold">{data.storage_ready ? 'Approval Center belum dapat dimuat' : hasStorageConfigError ? 'Konfigurasi server Approval Center belum valid' : 'Database Approval Center belum aktif'}</p>
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
              const isOwnRequest = request.requested_by_email === data.viewer.email;
              const canEdit = data.viewer.can_manage || (isOwnRequest && ['pending', 'revision'].includes(request.status));
              return (
                <article
                  key={request.id}
                  data-approval-row={request.id}
                  onClick={() => setDetailRequestId(request.id)}
                  className="cursor-pointer p-4 transition hover:bg-[#FAFAFB] dark:hover:bg-[#282D36] sm:p-5"
                >
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
                        <h3 className="mt-2 text-sm font-black text-[#24324A] dark:text-[#F4F6FA] sm:text-base">
                          <button
                            type="button"
                            data-approval-detail-trigger={request.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              setDetailRequestId(request.id);
                            }}
                            className="rounded-sm text-left outline-none transition hover:text-[#3F679C] focus-visible:ring-2 focus-visible:ring-[#7F91B0] focus-visible:ring-offset-2 dark:hover:text-[#AFC9EE] dark:focus-visible:ring-offset-[#20242C]"
                            aria-label={`Lihat detail approval ${request.title}`}
                          >
                            {request.title}
                          </button>
                        </h3>
                        {request.description && (
                          <p className="mt-1 line-clamp-2 break-words text-xs leading-5 text-[#737680] dark:text-[#AAB4C5]">
                            <LinkifiedText text={request.description} />
                          </p>
                        )}
                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-semibold text-[#8A8E98]">
                          <span className="inline-flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" />{request.requested_by_name}</span>
                          <span>{formatDate(request.submitted_at)}</span>
                          {request.metadata?.progress !== undefined && <span>Progress {String(request.metadata.progress)}%</span>}
                        </div>
                        {request.reviewer_note && (
                          <div className="mt-3 rounded-xl border border-[#E5E8ED] bg-[#F7F8FA] px-3 py-2 text-xs leading-5 text-[#5E6470]">
                            <span className="font-extrabold text-[#24324A]">Catatan {request.reviewer_name || 'reviewer'}:</span>{' '}
                            <LinkifiedText text={request.reviewer_note} />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      {data.viewer.can_manage && request.status === 'pending' && (
                        <button type="button" onClick={(event) => { event.stopPropagation(); openReviewRequest(request); }} className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#24324A] px-3 text-[11px] font-extrabold text-white hover:bg-[#31415E]">
                          <BadgeCheck className="h-4 w-4" /> Tinjau
                        </button>
                      )}
                      {!data.viewer.can_manage && request.status === 'revision' && (
                        <button type="button" disabled={saving} onClick={(event) => { event.stopPropagation(); void post({ action: 'resubmit', id: request.id, title: request.title, description: request.description }); }} className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#5B61AD] px-3 text-[11px] font-extrabold text-white">
                          <Send className="h-3.5 w-3.5" /> Kirim Ulang
                        </button>
                      )}
                      {!data.viewer.can_manage && ['pending', 'revision'].includes(request.status) && (
                        <button type="button" disabled={saving} onClick={(event) => { event.stopPropagation(); if (window.confirm('Batalkan permintaan ini?')) void post({ action: 'cancel', id: request.id }); }} className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#E4E7EC] bg-white px-3 text-[11px] font-extrabold text-[#737680] hover:bg-[#F7F7F8]">
                          <X className="h-3.5 w-3.5" /> Batalkan
                        </button>
                      )}
                      {canEdit && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={(event) => { event.stopPropagation(); openEditRequest(request); }}
                          aria-label={`Edit approval ${request.title}`}
                          className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#DDE2EA] bg-white px-3 text-[11px] font-extrabold text-[#40536F] transition hover:border-[#7F91B0] hover:bg-[#F7F8FA] disabled:opacity-50"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </button>
                      )}
                      {data.viewer.can_manage && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={(event) => { event.stopPropagation(); setError(''); setDeleteTarget(request); }}
                          aria-label={`Hapus approval ${request.title}`}
                          className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#F0C7C4] bg-white px-3 text-[11px] font-extrabold text-[#B14E46] transition hover:bg-[#FFF0ED] disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Hapus
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

      {detailRequest && (
        <ApprovalDetailModal
          request={detailRequest}
          canManage={data.viewer.can_manage}
          canEdit={data.viewer.can_manage || (
            detailRequest.requested_by_email === data.viewer.email
            && ['pending', 'revision'].includes(detailRequest.status)
          )}
          saving={saving}
          onClose={() => setDetailRequestId(null)}
          onReview={() => openReviewRequest(detailRequest)}
          onEdit={() => openEditRequest(detailRequest)}
          onDelete={() => {
            setError('');
            setDetailRequestId(null);
            setDeleteTarget(detailRequest);
          }}
        />
      )}

      {showSubmit && (
        <ModalPortal onClose={closeRequestForm}>
          <form role="dialog" aria-modal="true" onSubmit={submitRequest} className="max-h-[92svh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-xl sm:rounded-3xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div><h2 className="text-lg font-black text-[#24324A]">{editingRequest ? 'Edit Approval' : 'Buat Permintaan Approval'}</h2><p className="mt-1 text-xs text-[#737680]">{editingRequest ? 'Perbarui tipe, judul, atau detail approval yang tersimpan.' : 'Pilih approval pekerjaan atau kebutuhan operasional.'}</p></div>
              <button type="button" onClick={closeRequestForm} className="rounded-xl p-2 text-[#737680] hover:bg-[#F2F4F7]" aria-label="Tutup formulir approval"><X className="h-5 w-5" /></button>
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
                        disabled={isSourceLinkedEdit}
                        onClick={() => setForm((current) => ({ ...current, request_type: categoryValue === 'work' ? 'script' : 'leave' }))}
                        className={`rounded-2xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${active ? 'border-[#24324A] bg-[#F4F7FB] ring-1 ring-[#24324A]' : 'border-[#DDE2EA] bg-white hover:bg-[#F8F9FB]'}`}
                      >
                        <span className="flex items-center gap-2 text-xs font-black text-[#24324A]"><CategoryIcon className="h-4 w-4" />{category.label}</span>
                        <span className="mt-1.5 block text-[10px] leading-4 text-[#737680]">{category.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="block"><span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#737680]">Tipe Approval</span><select disabled={isSourceLinkedEdit} value={form.request_type} onChange={(event) => setForm((current) => ({ ...current, request_type: event.target.value as ApprovalRequestType }))} className="h-11 w-full rounded-xl border border-[#DDE2EA] bg-white px-3 text-sm text-[#24324A] outline-none focus:border-[#7F91B0] disabled:cursor-not-allowed disabled:opacity-60">{formTypeOptions.map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}</select></label>
              {isSourceLinkedEdit && <p className="rounded-xl border border-[#DCE5F2] bg-[#F4F8FD] px-3 py-2 text-[11px] leading-5 text-[#566176]">Approval otomatis tetap terhubung ke sumbernya, sehingga kategori dan tipe tidak dapat diubah. Judul serta detail tetap dapat diedit.</p>}
              <label className="block"><span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#737680]">Judul</span><input required maxLength={300} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder={formCategory === 'work' ? 'Contoh: Approval script campaign Agustus' : 'Contoh: Izin tidak masuk 14 Agustus'} className="h-11 w-full rounded-xl border border-[#DDE2EA] px-3 text-sm text-[#24324A] outline-none focus:border-[#7F91B0]" /></label>
              <label className="block"><span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#737680]">Detail</span><textarea rows={5} maxLength={5000} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder={formCategory === 'work' ? 'Cantumkan project/client, link dokumen, output, serta bagian yang perlu disetujui.' : 'Jelaskan kebutuhan, tanggal, durasi, dan konteks operasional yang perlu ditinjau.'} className="w-full resize-y rounded-xl border border-[#DDE2EA] p-3 text-sm leading-6 text-[#24324A] outline-none focus:border-[#7F91B0]" /></label>
            </div>
            <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={closeRequestForm} className="h-10 rounded-xl border border-[#DDE2EA] px-4 text-xs font-extrabold text-[#737680]">Batal</button><button type="submit" disabled={saving || !form.title.trim()} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#24324A] px-4 text-xs font-extrabold text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingRequest ? <Pencil className="h-4 w-4" /> : <Send className="h-4 w-4" />} {editingRequest ? 'Simpan Perubahan' : 'Kirim Approval'}</button></div>
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

      {deleteTarget && (
        <ModalPortal onClose={() => { if (!saving) setDeleteTarget(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="delete-approval-title" className="w-full rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-3xl sm:p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-[#FFF0ED] text-[#B14E46]"><Trash2 className="h-5 w-5" /></div>
              <div className="min-w-0">
                <h2 id="delete-approval-title" className="text-lg font-black text-[#24324A]">Hapus approval secara permanen?</h2>
                <p className="mt-2 text-xs leading-5 text-[#626874]">Approval <span className="font-extrabold text-[#24324A]">“{deleteTarget.title}”</span> akan dihapus langsung dari database.</p>
              </div>
            </div>
            <div className="mt-5 rounded-2xl border border-[#F0C7C4] bg-[#FFF5F3] p-4 text-xs leading-5 text-[#9A453E]">
              Tindakan ini tidak dapat dibatalkan. Record yang sudah dihapus tidak akan muncul kembali setelah halaman di-refresh.
            </div>
            {error && <p className="mt-3 text-xs font-semibold text-[#B14E46]">{error}</p>}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" disabled={saving} onClick={() => setDeleteTarget(null)} className="h-10 rounded-xl border border-[#DDE2EA] px-4 text-xs font-extrabold text-[#626874] disabled:opacity-50">Batal</button>
              <button type="button" disabled={saving} onClick={() => void deleteRequest()} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#B14E46] px-4 text-xs font-extrabold text-white disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Ya, Hapus Permanen
              </button>
            </div>
          </section>
        </ModalPortal>
      )}
    </div>
  );
}
