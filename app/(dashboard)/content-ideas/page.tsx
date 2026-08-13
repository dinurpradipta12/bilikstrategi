'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  ExternalLink,
  Filter,
  Lightbulb,
  Link2,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Smartphone,
  Sparkles,
  Target,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import ConfirmModal from '@/components/ui/ConfirmModal';
import ModalPortal from '@/components/ui/ModalPortal';
import {
  CONTENT_PILLAR_SUGGESTIONS,
  CONTENT_PLATFORM_OPTIONS,
  type ContentIdea,
  type ContentIdeasResponse,
  type ContentIndicator,
  type ContentReference,
} from '@/lib/content-ideas/types';

type ActiveTab = 'references' | 'ideas';
type ModalType = 'reference' | 'idea' | null;
type DeleteTarget =
  | { type: 'reference'; item: ContentReference }
  | { type: 'idea'; item: ContentIdea };

type ReferenceForm = {
  id: string;
  platform: string;
  pillar: string;
  content_url: string;
  description: string;
  insight: string;
  is_brand_relevant: boolean;
  is_applied: boolean;
};

type IdeaForm = {
  id: string;
  headline: string;
  pillar: string;
  reference_id: string;
  notes: string;
  is_brand_relevant: boolean;
  is_applied: boolean;
};

const EMPTY_DATA: ContentIdeasResponse = {
  storage_ready: false,
  viewer: { email: '', name: '' },
  references: [],
  ideas: [],
};

const EMPTY_REFERENCE_FORM: ReferenceForm = {
  id: '',
  platform: 'Instagram',
  pillar: '',
  content_url: '',
  description: '',
  insight: '',
  is_brand_relevant: false,
  is_applied: false,
};

const EMPTY_IDEA_FORM: IdeaForm = {
  id: '',
  headline: '',
  pillar: '',
  reference_id: '',
  notes: '',
  is_brand_relevant: false,
  is_applied: false,
};

function formatDate(value: string) {
  if (!value) return '-';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function urlHost(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return value;
  }
}

function referenceLabel(reference: ContentReference) {
  const description = reference.description.trim();
  if (description) return description.length > 80 ? `${description.slice(0, 77)}...` : description;
  return `${reference.platform} · ${urlHost(reference.content_url)}`;
}

function matchesQuery(values: Array<string | null | undefined>, query: string) {
  if (!query) return true;
  const normalized = query.toLocaleLowerCase('id-ID');
  return values.some((value) => String(value || '').toLocaleLowerCase('id-ID').includes(normalized));
}

export default function ContentIdeasPage() {
  const [data, setData] = useState<ContentIdeasResponse>(EMPTY_DATA);
  const [activeTab, setActiveTab] = useState<ActiveTab>('references');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [query, setQuery] = useState('');
  const [pillarFilter, setPillarFilter] = useState('all');
  const [modalType, setModalType] = useState<ModalType>(null);
  const [referenceForm, setReferenceForm] = useState<ReferenceForm>(EMPTY_REFERENCE_FORM);
  const [ideaForm, setIdeaForm] = useState<IdeaForm>(EMPTY_IDEA_FORM);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [pendingIndicator, setPendingIndicator] = useState('');

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);

    try {
      const response = await fetch('/api/content-ideas', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Content Idea Bank gagal dimuat.');

      setData({
        storage_ready: payload.storage_ready === true,
        viewer: payload.viewer || { email: '', name: '' },
        references: Array.isArray(payload.references) ? payload.references : [],
        ideas: Array.isArray(payload.ideas) ? payload.ideas : [],
        error: payload.error,
      });
      setError(payload.error || '');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Content Idea Bank gagal dimuat.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    const interval = window.setInterval(() => void load(true), 20000);
    const handleFocus = () => void load(true);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(''), 3000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const referenceMap = useMemo(
    () => new Map(data.references.map((reference) => [reference.id, reference])),
    [data.references]
  );

  const pillarOptions = useMemo(() => {
    const values = activeTab === 'references'
      ? data.references.map((item) => item.pillar)
      : data.ideas.map((item) => item.pillar);
    return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'id-ID'));
  }, [activeTab, data.ideas, data.references]);

  const filteredReferences = useMemo(
    () => data.references.filter((reference) => {
      const pillarMatches = pillarFilter === 'all' || reference.pillar === pillarFilter;
      return pillarMatches && matchesQuery([
        reference.platform,
        reference.pillar,
        reference.content_url,
        reference.description,
        reference.insight,
        reference.created_by_name,
      ], query);
    }),
    [data.references, pillarFilter, query]
  );

  const filteredIdeas = useMemo(
    () => data.ideas.filter((idea) => {
      const reference = idea.reference_id ? referenceMap.get(idea.reference_id) : undefined;
      const pillarMatches = pillarFilter === 'all' || idea.pillar === pillarFilter;
      return pillarMatches && matchesQuery([
        idea.headline,
        idea.pillar,
        idea.notes,
        idea.created_by_name,
        reference?.description,
        reference?.platform,
      ], query);
    }),
    [data.ideas, pillarFilter, query, referenceMap]
  );

  const openCreateModal = () => {
    if (activeTab === 'references') {
      setReferenceForm(EMPTY_REFERENCE_FORM);
      setModalType('reference');
      return;
    }
    setIdeaForm(EMPTY_IDEA_FORM);
    setModalType('idea');
  };

  const changeTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    setPillarFilter('all');
    setQuery('');
  };

  const openReferenceEdit = (reference: ContentReference) => {
    setReferenceForm({
      id: reference.id,
      platform: reference.platform,
      pillar: reference.pillar,
      content_url: reference.content_url,
      description: reference.description,
      insight: reference.insight,
      is_brand_relevant: reference.is_brand_relevant,
      is_applied: reference.is_applied,
    });
    setModalType('reference');
  };

  const openIdeaEdit = (idea: ContentIdea) => {
    setIdeaForm({
      id: idea.id,
      headline: idea.headline,
      pillar: idea.pillar,
      reference_id: idea.reference_id || '',
      notes: idea.notes,
      is_brand_relevant: idea.is_brand_relevant,
      is_applied: idea.is_applied,
    });
    setModalType('idea');
  };

  const postAction = async (body: Record<string, unknown>) => {
    const response = await fetch('/api/content-ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Perubahan gagal disimpan.');
    return payload;
  };

  const saveReference = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      await postAction({
        action: referenceForm.id ? 'update_reference' : 'create_reference',
        ...referenceForm,
      });
      await load(true);
      setModalType(null);
      setToast(referenceForm.id ? 'Referensi konten diperbarui.' : 'Referensi konten ditambahkan.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Referensi gagal disimpan.');
    } finally {
      setSaving(false);
    }
  };

  const saveIdea = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      await postAction({
        action: ideaForm.id ? 'update_idea' : 'create_idea',
        ...ideaForm,
        reference_id: ideaForm.reference_id || null,
      });
      await load(true);
      setModalType(null);
      setToast(ideaForm.id ? 'Ide konten diperbarui.' : 'Ide konten ditambahkan.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Ide konten gagal disimpan.');
    } finally {
      setSaving(false);
    }
  };

  const toggleIndicator = async (
    entityType: 'reference' | 'idea',
    id: string,
    indicator: ContentIndicator,
    value: boolean
  ) => {
    const pendingKey = `${entityType}:${id}:${indicator}`;
    setPendingIndicator(pendingKey);
    setError('');
    setData((current) => ({
      ...current,
      references: entityType === 'reference'
        ? current.references.map((item) => item.id === id ? { ...item, [indicator]: value } : item)
        : current.references,
      ideas: entityType === 'idea'
        ? current.ideas.map((item) => item.id === id ? { ...item, [indicator]: value } : item)
        : current.ideas,
    }));

    try {
      await postAction({ action: 'set_indicator', entity_type: entityType, id, indicator, value });
      await load(true);
    } catch (indicatorError) {
      setError(indicatorError instanceof Error ? indicatorError.message : 'Indikator gagal diperbarui.');
      await load(true);
    } finally {
      setPendingIndicator('');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    setError('');

    try {
      await postAction({
        action: deleteTarget.type === 'reference' ? 'delete_reference' : 'delete_idea',
        id: deleteTarget.item.id,
      });
      await load(true);
      setToast(deleteTarget.type === 'reference' ? 'Referensi konten dihapus.' : 'Ide konten dihapus.');
      setDeleteTarget(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Data gagal dihapus.');
    } finally {
      setSaving(false);
    }
  };

  const visibleCount = activeTab === 'references' ? filteredReferences.length : filteredIdeas.length;
  const totalCount = activeTab === 'references' ? data.references.length : data.ideas.length;

  return (
    <div className="min-w-0 space-y-5 pb-6 animate-fade-in">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#F26B5E]">
            <Sparkles className="h-4 w-4" /> Ruang Inspirasi Tim
          </div>
          <h1 className="text-3xl font-black tracking-tight text-[#24324A]">Content Idea Bank</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#737680]">
            Simpan referensi dari social media, ubah insight menjadi ide, lalu tandai yang relevan untuk brand dan sudah diterapkan.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-extrabold">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EEF2F7] px-3 py-1.5 text-[#566176]">
              <Users className="h-3.5 w-3.5" /> Semua user dapat berkontribusi
            </span>
            <span className="rounded-full bg-[#FFF0ED] px-3 py-1.5 text-[#B34F45]">
              {data.references.length} referensi · {data.ideas.length} ide
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void load(true)}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#DDE2EA] bg-white px-4 text-xs font-extrabold text-[#24324A] shadow-sm transition hover:bg-[#F7F7F8]"
          >
            <RefreshCw className={`h-4 w-4 text-[#F26B5E] ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            disabled={!data.storage_ready || loading}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#24324A] px-4 text-xs font-extrabold text-white shadow-sm transition hover:bg-[#31415E] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> {activeTab === 'references' ? 'Tambah Referensi' : 'Tambah Ide'}
          </button>
        </div>
      </header>

      {error && (
        <div className={`flex items-start gap-3 rounded-2xl border p-4 text-sm ${data.storage_ready ? 'border-[#F3C9C5] bg-[#FFF5F3] text-[#9A453E]' : 'border-[#F2D6A4] bg-[#FFF9ED] text-[#8A5B16]'}`}>
          <CircleAlert className="mt-0.5 h-5 w-5 flex-none" />
          <div className="min-w-0">
            <p className="font-extrabold">{data.storage_ready ? 'Perubahan belum dapat diproses' : 'Database Content Idea Bank belum aktif'}</p>
            <p className="mt-1 break-words text-xs leading-5 opacity-80">{error}</p>
          </div>
        </div>
      )}

      <section className="overflow-hidden rounded-3xl border border-[#E1E5EB] bg-white shadow-sm dark:border-[#303742] dark:bg-[#20242C]">
        <div className="border-b border-[#E8E8EC] px-3 pt-3 sm:px-5 sm:pt-5 dark:border-[#303742]">
          <div className="grid grid-cols-2 gap-2 pb-3 sm:flex sm:overflow-x-auto">
            <TabButton
              active={activeTab === 'references'}
              label="Referensi Social Media"
              shortLabel="Referensi"
              count={data.references.length}
              icon={Link2}
              onClick={() => changeTab('references')}
            />
            <TabButton
              active={activeTab === 'ideas'}
              label="Ide Konten"
              shortLabel="Ide Konten"
              count={data.ideas.length}
              icon={Lightbulb}
              onClick={() => changeTab('ideas')}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 border-b border-[#E8E8EC] p-3 sm:p-5 lg:flex-row lg:items-center dark:border-[#303742]">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9A9DA6]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={activeTab === 'references' ? 'Cari platform, link, keterangan, atau insight...' : 'Cari headline, pillar, referensi, atau catatan...'}
              className="h-11 w-full rounded-xl border border-[#DDE2EA] bg-white pl-10 pr-4 text-sm text-[#24324A] outline-none transition focus:border-[#7F91B0]"
            />
          </div>
          <label className="relative min-w-0 sm:w-56">
            <Filter className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7B808B]" />
            <select
              aria-label="Filter pillar"
              value={pillarFilter}
              onChange={(event) => setPillarFilter(event.target.value)}
              className="h-11 w-full appearance-none rounded-xl border border-[#DDE2EA] bg-white pl-10 pr-9 text-xs font-bold text-[#24324A] outline-none"
            >
              <option value="all">Semua Pillar</option>
              {pillarOptions.map((pillar) => <option key={pillar} value={pillar}>{pillar}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#737680]" />
          </label>
          <p className="shrink-0 text-[10px] font-bold text-[#8A8E98]">
            Menampilkan {visibleCount} dari {totalCount}
          </p>
        </div>

        {loading ? (
          <ListLoading />
        ) : activeTab === 'references' ? (
          filteredReferences.length > 0 ? (
            <div className="divide-y divide-[#ECEEF2] dark:divide-[#303742]">
              {filteredReferences.map((reference) => (
                <ReferenceRow
                  key={reference.id}
                  reference={reference}
                  pendingIndicator={pendingIndicator}
                  onToggle={toggleIndicator}
                  onEdit={openReferenceEdit}
                  onDelete={(item) => setDeleteTarget({ type: 'reference', item })}
                />
              ))}
            </div>
          ) : (
            <EmptyList
              icon={Link2}
              title={data.references.length ? 'Referensi tidak ditemukan' : 'Belum ada referensi konten'}
              detail={data.references.length ? 'Coba ganti kata pencarian atau filter pillar.' : 'Tambahkan konten menarik dari social media sebagai bahan inspirasi tim.'}
              actionLabel={data.references.length ? undefined : 'Tambah Referensi Pertama'}
              onAction={data.references.length ? undefined : openCreateModal}
              disabled={!data.storage_ready}
            />
          )
        ) : filteredIdeas.length > 0 ? (
          <div className="divide-y divide-[#ECEEF2] dark:divide-[#303742]">
            {filteredIdeas.map((idea) => (
              <IdeaRow
                key={idea.id}
                idea={idea}
                reference={idea.reference_id ? referenceMap.get(idea.reference_id) : undefined}
                pendingIndicator={pendingIndicator}
                onToggle={toggleIndicator}
                onEdit={openIdeaEdit}
                onDelete={(item) => setDeleteTarget({ type: 'idea', item })}
              />
            ))}
          </div>
        ) : (
          <EmptyList
            icon={Lightbulb}
            title={data.ideas.length ? 'Ide tidak ditemukan' : 'Belum ada ide konten'}
            detail={data.ideas.length ? 'Coba ganti kata pencarian atau filter pillar.' : 'Ubah referensi dan insight tim menjadi ide konten yang siap dikembangkan.'}
            actionLabel={data.ideas.length ? undefined : 'Tambah Ide Pertama'}
            onAction={data.ideas.length ? undefined : openCreateModal}
            disabled={!data.storage_ready}
          />
        )}
      </section>

      {modalType === 'reference' && (
        <ModalPortal onClose={() => { if (!saving) setModalType(null); }}>
          <ReferenceFormModal
            form={referenceForm}
            saving={saving}
            storageReady={data.storage_ready}
            onChange={setReferenceForm}
            onClose={() => setModalType(null)}
            onSubmit={saveReference}
          />
        </ModalPortal>
      )}

      {modalType === 'idea' && (
        <ModalPortal onClose={() => { if (!saving) setModalType(null); }}>
          <IdeaFormModal
            form={ideaForm}
            references={data.references}
            saving={saving}
            storageReady={data.storage_ready}
            onChange={setIdeaForm}
            onClose={() => setModalType(null)}
            onSubmit={saveIdea}
          />
        </ModalPortal>
      )}

      <ConfirmModal
        isOpen={deleteTarget !== null}
        title={deleteTarget?.type === 'reference' ? 'Hapus referensi konten?' : 'Hapus ide konten?'}
        message={deleteTarget?.type === 'reference'
          ? 'Referensi akan dihapus dari daftar. Ide yang terhubung tetap tersimpan, tetapi tidak lagi memiliki referensi.'
          : 'Ide ini akan dihapus permanen dari Content Idea Bank.'}
        loading={saving}
        onCancel={() => { if (!saving) setDeleteTarget(null); }}
        onConfirm={() => void confirmDelete()}
      />

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-[250] flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-[#24324A] px-4 py-2.5 text-xs font-bold text-white shadow-2xl md:bottom-8">
          <Check className="h-4 w-4 text-[#7ED6A7]" /> {toast}
        </div>
      )}

      <datalist id="content-platform-options">
        {CONTENT_PLATFORM_OPTIONS.map((platform) => <option key={platform} value={platform} />)}
      </datalist>
      <datalist id="content-pillar-options">
        {CONTENT_PILLAR_SUGGESTIONS.map((pillar) => <option key={pillar} value={pillar} />)}
      </datalist>
    </div>
  );
}

function TabButton({
  active,
  label,
  shortLabel,
  count,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  shortLabel: string;
  count: number;
  icon: typeof Link2;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border px-2 text-xs font-extrabold transition sm:w-auto sm:shrink-0 sm:px-4 ${active ? 'border-[#24324A] bg-[#24324A] text-white shadow-sm' : 'border-[#DDE2EA] bg-white text-[#626874] hover:bg-[#F7F8FA]'}`}
    >
      <Icon className={`h-4 w-4 ${active ? 'text-[#FF9D91]' : 'text-[#7B808B]'}`} />
      <span className="sm:hidden">{shortLabel}</span>
      <span className="hidden sm:inline">{label}</span>
      <span className={`rounded-full px-2 py-0.5 text-[9px] ${active ? 'bg-white/15 text-white' : 'bg-[#EEF2F7] text-[#626874]'}`}>{count}</span>
    </button>
  );
}

function IndicatorButton({
  active,
  type,
  pending,
  onClick,
}: {
  active: boolean;
  type: ContentIndicator;
  pending: boolean;
  onClick: () => void;
}) {
  const relevant = type === 'is_brand_relevant';
  const Icon = relevant ? Target : CheckCircle2;
  const label = relevant ? 'Relevan Brand' : 'Sudah Diterapkan';
  const activeClass = relevant
    ? 'border-[#8BB5EE] bg-[#EAF2FF] text-[#315988]'
    : 'border-[#97CCAE] bg-[#E7F4ED] text-[#39785D]';

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`${label}: ${active ? 'ya' : 'belum'}`}
      disabled={pending}
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[10px] font-extrabold transition disabled:cursor-wait disabled:opacity-60 ${active ? activeClass : 'border-[#DDE2EA] bg-white text-[#737680] hover:bg-[#F7F8FA]'}`}
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
      {label}
      {active && <Check className="h-3 w-3" />}
    </button>
  );
}

function ReferenceRow({
  reference,
  pendingIndicator,
  onToggle,
  onEdit,
  onDelete,
}: {
  reference: ContentReference;
  pendingIndicator: string;
  onToggle: (entity: 'reference', id: string, indicator: ContentIndicator, value: boolean) => void;
  onEdit: (reference: ContentReference) => void;
  onDelete: (reference: ContentReference) => void;
}) {
  return (
    <article className="p-4 transition hover:bg-[#FAFAFB] sm:p-5 dark:hover:bg-[#282D36]">
      <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start">
        <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
          <div className="hidden h-11 w-11 flex-none items-center justify-center rounded-2xl bg-[#FFF0ED] text-[#F26B5E] sm:flex">
            <Smartphone className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#24324A] px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wide text-white">{reference.platform}</span>
              <span className="rounded-full bg-[#EEF2F7] px-2.5 py-1 text-[9px] font-extrabold text-[#566176]">{reference.pillar}</span>
              <a
                href={reference.content_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-w-0 items-center gap-1 text-[10px] font-extrabold text-[#416B9B] underline decoration-[#AFC8E5] underline-offset-2 hover:text-[#264E7E]"
                title={reference.content_url}
              >
                <span className="max-w-48 truncate sm:max-w-72">{urlHost(reference.content_url)}</span>
                <ExternalLink className="h-3.5 w-3.5 flex-none" />
              </a>
            </div>

            <div className="mt-3 grid min-w-0 gap-3 lg:grid-cols-2">
              <div className="min-w-0 rounded-xl bg-[#F7F8FA] p-3 dark:bg-[#282D36]">
                <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#8A8E98]">Keterangan Referensi</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-[#3F4652]">{reference.description || 'Belum ada keterangan.'}</p>
              </div>
              <div className="min-w-0 rounded-xl bg-[#FFF9ED] p-3 dark:bg-[#3D321F]">
                <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#9A6C29]">Insight Referensi</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-[#5D4A2F]">{reference.insight || 'Belum ada insight.'}</p>
              </div>
            </div>

            <p className="mt-3 text-[9px] font-semibold text-[#9296A0]">
              Ditambahkan oleh {reference.created_by_name || reference.created_by_email} · Diperbarui {formatDate(reference.updated_at)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:max-w-sm xl:justify-end">
          <IndicatorButton
            active={reference.is_brand_relevant}
            type="is_brand_relevant"
            pending={pendingIndicator === `reference:${reference.id}:is_brand_relevant`}
            onClick={() => onToggle('reference', reference.id, 'is_brand_relevant', !reference.is_brand_relevant)}
          />
          <IndicatorButton
            active={reference.is_applied}
            type="is_applied"
            pending={pendingIndicator === `reference:${reference.id}:is_applied`}
            onClick={() => onToggle('reference', reference.id, 'is_applied', !reference.is_applied)}
          />
          <button type="button" onClick={() => onEdit(reference)} className="rounded-xl border border-[#DDE2EA] p-2 text-[#566176] transition hover:bg-[#EEF2F7]" title="Edit referensi" aria-label="Edit referensi">
            <Pencil className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => onDelete(reference)} className="rounded-xl border border-[#F0D3D0] p-2 text-[#D95858] transition hover:bg-[#FFF0ED]" title="Hapus referensi" aria-label="Hapus referensi">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}

function IdeaRow({
  idea,
  reference,
  pendingIndicator,
  onToggle,
  onEdit,
  onDelete,
}: {
  idea: ContentIdea;
  reference?: ContentReference;
  pendingIndicator: string;
  onToggle: (entity: 'idea', id: string, indicator: ContentIndicator, value: boolean) => void;
  onEdit: (idea: ContentIdea) => void;
  onDelete: (idea: ContentIdea) => void;
}) {
  return (
    <article className="p-4 transition hover:bg-[#FAFAFB] sm:p-5 dark:hover:bg-[#282D36]">
      <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start">
        <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
          <div className="hidden h-11 w-11 flex-none items-center justify-center rounded-2xl bg-[#FFF8E7] text-[#C78621] sm:flex">
            <Lightbulb className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#EEF2F7] px-2.5 py-1 text-[9px] font-extrabold text-[#566176]">{idea.pillar}</span>
              {reference ? (
                <a
                  href={reference.content_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-w-0 items-center gap-1 rounded-full bg-[#EAF2FF] px-2.5 py-1 text-[9px] font-extrabold text-[#315988] hover:bg-[#DCE9FF]"
                  title={`Buka referensi: ${reference.content_url}`}
                >
                  <Link2 className="h-3 w-3 flex-none" />
                  <span className="max-w-48 truncate sm:max-w-72">{referenceLabel(reference)}</span>
                  <ExternalLink className="h-3 w-3 flex-none" />
                </a>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#F2F4F7] px-2.5 py-1 text-[9px] font-bold text-[#8A8E98]">
                  <Link2 className="h-3 w-3" /> Tanpa referensi
                </span>
              )}
            </div>
            <h2 className="mt-2 break-words text-base font-black leading-6 text-[#24324A]">{idea.headline}</h2>
            <div className="mt-3 min-w-0 rounded-xl bg-[#F7F8FA] p-3 dark:bg-[#282D36]">
              <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#8A8E98]">Catatan</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-[#3F4652]">{idea.notes || 'Belum ada catatan tambahan.'}</p>
            </div>
            <p className="mt-3 text-[9px] font-semibold text-[#9296A0]">
              Ditambahkan oleh {idea.created_by_name || idea.created_by_email} · Diperbarui {formatDate(idea.updated_at)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:max-w-sm xl:justify-end">
          <IndicatorButton
            active={idea.is_brand_relevant}
            type="is_brand_relevant"
            pending={pendingIndicator === `idea:${idea.id}:is_brand_relevant`}
            onClick={() => onToggle('idea', idea.id, 'is_brand_relevant', !idea.is_brand_relevant)}
          />
          <IndicatorButton
            active={idea.is_applied}
            type="is_applied"
            pending={pendingIndicator === `idea:${idea.id}:is_applied`}
            onClick={() => onToggle('idea', idea.id, 'is_applied', !idea.is_applied)}
          />
          <button type="button" onClick={() => onEdit(idea)} className="rounded-xl border border-[#DDE2EA] p-2 text-[#566176] transition hover:bg-[#EEF2F7]" title="Edit ide" aria-label="Edit ide">
            <Pencil className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => onDelete(idea)} className="rounded-xl border border-[#F0D3D0] p-2 text-[#D95858] transition hover:bg-[#FFF0ED]" title="Hapus ide" aria-label="Hapus ide">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}

function ReferenceFormModal({
  form,
  saving,
  storageReady,
  onChange,
  onClose,
  onSubmit,
}: {
  form: ReferenceForm;
  saving: boolean;
  storageReady: boolean;
  onChange: React.Dispatch<React.SetStateAction<ReferenceForm>>;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  const update = <K extends keyof ReferenceForm>(key: K, value: ReferenceForm[K]) => {
    onChange((current) => ({ ...current, [key]: value }));
  };

  return (
    <form role="dialog" aria-modal="true" aria-labelledby="reference-form-title" onSubmit={onSubmit} className="max-h-[92svh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-2xl sm:rounded-3xl sm:p-6 dark:bg-[#20242C]">
      <ModalHeader
        icon={Link2}
        title={form.id ? 'Edit Referensi Konten' : 'Tambah Referensi Konten'}
        detail="Catat konten social media yang dapat menjadi inspirasi untuk tim."
        titleId="reference-form-title"
        disabled={saving}
        onClose={onClose}
      />
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <FormField label="Platform Konten">
          <input required maxLength={80} list="content-platform-options" value={form.platform} onChange={(event) => update('platform', event.target.value)} placeholder="Instagram, TikTok, YouTube..." />
        </FormField>
        <FormField label="Pillar">
          <input required maxLength={120} list="content-pillar-options" value={form.pillar} onChange={(event) => update('pillar', event.target.value)} placeholder="Contoh: Edukasi" />
        </FormField>
        <div className="sm:col-span-2">
          <FormField label="Link Konten">
            <div className="relative">
              <ExternalLink className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A8E98]" />
              <input required maxLength={2000} inputMode="url" value={form.content_url} onChange={(event) => update('content_url', event.target.value)} placeholder="https://instagram.com/..." className="pl-10!" />
            </div>
          </FormField>
        </div>
        <div className="sm:col-span-2">
          <FormField label="Keterangan Referensi Konten">
            <textarea rows={3} maxLength={5000} value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="Apa yang menarik dari konten ini?" />
          </FormField>
        </div>
        <div className="sm:col-span-2">
          <FormField label="Insight Referensi Konten">
            <textarea rows={3} maxLength={5000} value={form.insight} onChange={(event) => update('insight', event.target.value)} placeholder="Pelajaran, angle, hook, atau format yang bisa diadaptasi..." />
          </FormField>
        </div>
        <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
          <IndicatorCheckbox active={form.is_brand_relevant} type="is_brand_relevant" onChange={(value) => update('is_brand_relevant', value)} />
          <IndicatorCheckbox active={form.is_applied} type="is_applied" onChange={(value) => update('is_applied', value)} />
        </div>
      </div>
      <ModalActions saving={saving} storageReady={storageReady} submitLabel={form.id ? 'Simpan Perubahan' : 'Tambah Referensi'} onClose={onClose} />
    </form>
  );
}

function IdeaFormModal({
  form,
  references,
  saving,
  storageReady,
  onChange,
  onClose,
  onSubmit,
}: {
  form: IdeaForm;
  references: ContentReference[];
  saving: boolean;
  storageReady: boolean;
  onChange: React.Dispatch<React.SetStateAction<IdeaForm>>;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  const update = <K extends keyof IdeaForm>(key: K, value: IdeaForm[K]) => {
    onChange((current) => ({ ...current, [key]: value }));
  };

  return (
    <form role="dialog" aria-modal="true" aria-labelledby="idea-form-title" onSubmit={onSubmit} className="max-h-[92svh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-2xl sm:rounded-3xl sm:p-6 dark:bg-[#20242C]">
      <ModalHeader
        icon={Lightbulb}
        title={form.id ? 'Edit Ide Konten' : 'Tambah Ide Konten'}
        detail="Ubah insight menjadi headline dan arah konten yang dapat dikembangkan."
        titleId="idea-form-title"
        disabled={saving}
        onClose={onClose}
      />
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FormField label="Headline Ide Konten">
            <input required maxLength={300} value={form.headline} onChange={(event) => update('headline', event.target.value)} placeholder="Contoh: 5 kesalahan brand saat membuat konten edukasi" />
          </FormField>
        </div>
        <FormField label="Pillar">
          <input required maxLength={120} list="content-pillar-options" value={form.pillar} onChange={(event) => update('pillar', event.target.value)} placeholder="Contoh: Edukasi" />
        </FormField>
        <FormField label="Referensi">
          <div className="relative">
            <select value={form.reference_id} onChange={(event) => update('reference_id', event.target.value)} className="appearance-none pr-9!">
              <option value="">Tanpa referensi</option>
              {references.map((reference) => (
                <option key={reference.id} value={reference.id}>{referenceLabel(reference)}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#737680]" />
          </div>
        </FormField>
        <div className="sm:col-span-2">
          <FormField label="Catatan">
            <textarea rows={4} maxLength={5000} value={form.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Tambahkan angle, CTA, format, atau detail eksekusi..." />
          </FormField>
        </div>
        <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
          <IndicatorCheckbox active={form.is_brand_relevant} type="is_brand_relevant" onChange={(value) => update('is_brand_relevant', value)} />
          <IndicatorCheckbox active={form.is_applied} type="is_applied" onChange={(value) => update('is_applied', value)} />
        </div>
      </div>
      <ModalActions saving={saving} storageReady={storageReady} submitLabel={form.id ? 'Simpan Perubahan' : 'Tambah Ide'} onClose={onClose} />
    </form>
  );
}

function ModalHeader({
  icon: Icon,
  title,
  detail,
  titleId,
  disabled,
  onClose,
}: {
  icon: typeof Link2;
  title: string;
  detail: string;
  titleId: string;
  disabled: boolean;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-[#FFF0ED] text-[#F26B5E]">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <h2 id={titleId} className="text-lg font-black text-[#24324A]">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-[#737680]">{detail}</p>
      </div>
      <button type="button" disabled={disabled} onClick={onClose} className="rounded-xl p-2 text-[#737680] transition hover:bg-[#F2F4F7] disabled:opacity-50" aria-label="Tutup form">
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block [&_input]:h-11 [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-[#DDE2EA] [&_input]:bg-white [&_input]:px-3 [&_input]:text-sm [&_input]:text-[#24324A] [&_input]:outline-none [&_input]:transition [&_input]:focus:border-[#7F91B0] [&_select]:h-11 [&_select]:w-full [&_select]:rounded-xl [&_select]:border [&_select]:border-[#DDE2EA] [&_select]:bg-white [&_select]:px-3 [&_select]:text-sm [&_select]:text-[#24324A] [&_select]:outline-none [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-xl [&_textarea]:border [&_textarea]:border-[#DDE2EA] [&_textarea]:bg-white [&_textarea]:p-3 [&_textarea]:text-sm [&_textarea]:text-[#24324A] [&_textarea]:outline-none [&_textarea]:transition [&_textarea]:focus:border-[#7F91B0]">
      <span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#737680]">{label}</span>
      {children}
    </label>
  );
}

function IndicatorCheckbox({
  active,
  type,
  onChange,
}: {
  active: boolean;
  type: ContentIndicator;
  onChange: (value: boolean) => void;
}) {
  const relevant = type === 'is_brand_relevant';
  const Icon = relevant ? Target : BadgeCheck;
  const title = relevant ? 'Relevan dengan brand' : 'Sudah diterapkan';
  const detail = relevant ? 'Ide atau referensi sesuai arah brand.' : 'Konten ini sudah pernah dieksekusi.';

  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition ${active ? (relevant ? 'border-[#8BB5EE] bg-[#EAF2FF]' : 'border-[#97CCAE] bg-[#E7F4ED]') : 'border-[#DDE2EA] bg-white hover:bg-[#F7F8FA]'}`}>
      <input type="checkbox" checked={active} onChange={(event) => onChange(event.target.checked)} className="sr-only" />
      <span className={`mt-0.5 rounded-xl p-2 ${active ? (relevant ? 'bg-[#DCE9FF] text-[#315988]' : 'bg-[#D6EDE0] text-[#39785D]') : 'bg-[#F2F4F7] text-[#737680]'}`}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-extrabold text-[#24324A]">{title}</span>
        <span className="mt-1 block text-[10px] leading-4 text-[#737680]">{detail}</span>
      </span>
      <span className={`ml-auto mt-1 flex h-5 w-5 flex-none items-center justify-center rounded-md border ${active ? 'border-[#4F9D78] bg-[#4F9D78] text-white' : 'border-[#C7CBD3] bg-white'}`}>
        {active && <Check className="h-3.5 w-3.5" />}
      </span>
    </label>
  );
}

function ModalActions({
  saving,
  storageReady,
  submitLabel,
  onClose,
}: {
  saving: boolean;
  storageReady: boolean;
  submitLabel: string;
  onClose: () => void;
}) {
  return (
    <div className="mt-6 flex justify-end gap-2 border-t border-[#E8E8EC] pt-5 dark:border-[#303742]">
      <button type="button" onClick={onClose} disabled={saving} className="h-10 rounded-xl border border-[#DDE2EA] px-4 text-xs font-extrabold text-[#737680] transition hover:bg-[#F7F8FA] disabled:opacity-50">Batal</button>
      <button type="submit" disabled={saving || !storageReady} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#24324A] px-4 text-xs font-extrabold text-white transition hover:bg-[#31415E] disabled:cursor-not-allowed disabled:opacity-50">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        {saving ? 'Menyimpan...' : submitLabel}
      </button>
    </div>
  );
}

function EmptyList({
  icon: Icon,
  title,
  detail,
  actionLabel,
  onAction,
  disabled,
}: {
  icon: typeof Lightbulb;
  title: string;
  detail: string;
  actionLabel?: string;
  onAction?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 rounded-2xl bg-[#F2F4F7] p-4 text-[#7B808B] dark:bg-[#282D36]">
        <Icon className="h-7 w-7" />
      </div>
      <h2 className="text-base font-black text-[#24324A]">{title}</h2>
      <p className="mt-2 max-w-md text-xs leading-5 text-[#737680]">{detail}</p>
      {actionLabel && onAction && (
        <button type="button" onClick={onAction} disabled={disabled} className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-[#24324A] px-4 text-xs font-extrabold text-white disabled:opacity-50">
          <Plus className="h-4 w-4" /> {actionLabel}
        </button>
      )}
    </div>
  );
}

function ListLoading() {
  return (
    <div className="divide-y divide-[#ECEEF2] dark:divide-[#303742]">
      {[0, 1, 2].map((item) => (
        <div key={item} className="flex animate-pulse items-start gap-4 p-5">
          <div className="hidden h-11 w-11 rounded-2xl bg-[#EEF0F3] sm:block dark:bg-[#303742]" />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="h-4 w-1/3 rounded bg-[#EEF0F3] dark:bg-[#303742]" />
            <div className="h-16 w-full rounded-xl bg-[#F2F4F7] dark:bg-[#282D36]" />
            <div className="h-3 w-1/2 rounded bg-[#EEF0F3] dark:bg-[#303742]" />
          </div>
        </div>
      ))}
    </div>
  );
}
