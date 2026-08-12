'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Eye,
  Gauge,
  Info,
  ListChecks,
  Loader2,
  Pencil,
  ReceiptText,
  RefreshCw,
  Search,
  TrendingUp,
  WalletCards,
  X,
} from 'lucide-react';
import ModalPortal from '@/components/ui/ModalPortal';
import type { ProfitabilityPayload, ProjectProfitabilityRow, ProfitabilityHealth } from '@/lib/profitability/types';

const HEALTH_META: Record<ProfitabilityHealth, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  healthy: { label: 'Sehat', color: 'bg-[#E6F4EC] text-[#39785D]', icon: CheckCircle2 },
  watch: { label: 'Perlu Pantau', color: 'bg-[#FFF1DB] text-[#9B6514]', icon: Gauge },
  loss: { label: 'Risiko Rugi', color: 'bg-[#FDE9E7] text-[#B14E46]', icon: AlertTriangle },
};

const REVENUE_SOURCE_LABEL: Record<ProjectProfitabilityRow['revenue_source'], string> = {
  override: 'Override manual',
  finance: 'Ledger finance',
  invoice: 'Invoice paid',
  none: 'Belum ada sumber',
};

function currentMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatCurrency(value: number, currency = 'IDR') {
  try {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value || 0);
  } catch {
    return `${currency} ${Math.round(value || 0).toLocaleString('id-ID')}`;
  }
}

function compactCurrency(value: number, currency = 'IDR') {
  if (Math.abs(value) < 1_000_000) return formatCurrency(value, currency);
  const divisor = Math.abs(value) >= 1_000_000_000 ? 1_000_000_000 : 1_000_000;
  const suffix = divisor === 1_000_000_000 ? 'M' : 'jt';
  return `${currency} ${(value / divisor).toFixed(1)} ${suffix}`;
}

function formatMonthLabel(value: string) {
  const [year, month] = value.split('-').map(Number);
  if (!year || !month) return value;
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function ratio(value: number, total: number) {
  return total > 0 ? (value / total) * 100 : 0;
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

const emptyPayload: ProfitabilityPayload = {
  storage_ready: true,
  month: currentMonth(),
  currency: 'IDR',
  viewer: { email: '', name: '', role: '', can_manage: false },
  summary: { revenue: 0, cost: 0, profit: 0, margin_percent: 0, labor_hours: 0, healthy_projects: 0, at_risk_projects: 0 },
  projects: [],
  warnings: [],
};

type EditForm = {
  project_id: string;
  project_name: string;
  client_name: string;
  budget: string;
  revenue_override: string;
  labor_cost_override: string;
  external_cost: string;
  notes: string;
};

function fieldValue(value: number | null | undefined) {
  return value === null || value === undefined ? '' : String(Math.round(value));
}

export default function ProfitabilityPage() {
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState<ProfitabilityPayload>(emptyPayload);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [health, setHealth] = useState<'all' | ProfitabilityHealth>('all');
  const [insight, setInsight] = useState<ProjectProfitabilityRow | null>(null);
  const [edit, setEdit] = useState<EditForm | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/owner/profitability?month=${encodeURIComponent(month)}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Gagal memuat profitability project.');
      setData({ ...emptyPayload, ...payload, summary: { ...emptyPayload.summary, ...(payload.summary || {}) }, projects: Array.isArray(payload.projects) ? payload.projects : [], warnings: Array.isArray(payload.warnings) ? payload.warnings : [] });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Gagal memuat profitability project.');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.projects.filter((project) => {
      if (health !== 'all' && project.health !== health) return false;
      if (!needle) return true;
      return [project.project_name, project.client_name].some((value) => value.toLowerCase().includes(needle));
    });
  }, [data.projects, health, query]);

  function openEdit(project: ProjectProfitabilityRow) {
    setEdit({
      project_id: project.project_id,
      project_name: project.project_name,
      client_name: project.client_name,
      budget: fieldValue(project.budget),
      revenue_override: fieldValue(project.revenue_override),
      labor_cost_override: fieldValue(project.labor_cost_override),
      external_cost: fieldValue(project.external_cost),
      notes: project.notes,
    });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!edit) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/owner/profitability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_settings', month, ...edit }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Gagal menyimpan pengaturan project.');
      setEdit(null);
      await load(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Gagal menyimpan pengaturan project.');
    } finally {
      setSaving(false);
    }
  }

  const cards = [
    { label: 'Revenue Project', value: compactCurrency(data.summary.revenue, data.currency), detail: `${data.projects.length} project terukur`, icon: CircleDollarSign, color: 'text-[#356AA0]' },
    { label: 'Total Cost', value: compactCurrency(data.summary.cost, data.currency), detail: `${data.summary.labor_hours.toFixed(1)} jam kerja`, icon: WalletCards, color: 'text-[#795099]' },
    { label: 'Net Profit', value: compactCurrency(data.summary.profit, data.currency), detail: `${data.summary.margin_percent.toFixed(1)}% margin`, icon: TrendingUp, color: data.summary.profit >= 0 ? 'text-[#39785D]' : 'text-[#B14E46]' },
    { label: 'Project Sehat', value: String(data.summary.healthy_projects), detail: `${data.summary.at_risk_projects} risiko rugi`, icon: CheckCircle2, color: 'text-[#9B6514]' },
  ];

  return (
    <div className="min-w-0 space-y-6 pb-24 animate-fade-in">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#F26B5E]"><BarChart3 className="h-4 w-4" /> Financial Intelligence</div>
          <h1 className="text-3xl font-black tracking-tight text-[#24324A]">Project Profitability</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#737680]">Bandingkan revenue, biaya tenaga kerja, biaya eksternal, margin, dan progress setiap project dalam satu periode.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="h-11 rounded-xl border border-[#DDE2EA] bg-white px-3 text-xs font-extrabold text-[#24324A] outline-none" />
          <button type="button" onClick={() => void load()} className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#DDE2EA] bg-white px-4 text-xs font-extrabold text-[#24324A] shadow-sm hover:bg-[#F7F7F8]"><RefreshCw className={`h-4 w-4 text-[#F26B5E] ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
        </div>
      </header>

      {error && <div className="flex items-start gap-3 rounded-2xl border border-[#F3C9C5] bg-[#FFF5F3] p-4 text-sm text-[#9A453E]"><AlertTriangle className="mt-0.5 h-5 w-5 flex-none" /><div><p className="font-extrabold">Data belum dapat dimuat</p><p className="mt-1 text-xs leading-5">{error}</p></div></div>}
      {!data.storage_ready && <div className="rounded-2xl border border-[#F2D6A4] bg-[#FFF9ED] p-4 text-xs leading-5 text-[#8A5B16]"><strong>Migration profitability belum aktif.</strong> Data sumber tetap dihitung, tetapi budget dan override baru dapat disimpan setelah SQL fase 2 dijalankan.</div>}

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {cards.map((card) => <article key={card.label} className="rounded-2xl border border-[#E1E5EB] bg-white p-4 shadow-sm dark:border-[#303742] dark:bg-[#20242C] sm:p-5"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#5E6470]">{card.label}</p><p className="mt-2 truncate text-xl font-black text-[#24324A] sm:text-2xl">{card.value}</p><p className="mt-1 text-[10px] font-semibold text-[#6E7380]">{card.detail}</p></div><div className="rounded-2xl bg-[#F2F4F7] p-2.5 dark:bg-[#282D36]"><card.icon className={`h-5 w-5 ${card.color}`} /></div></div></article>)}
      </section>

      <section className="overflow-hidden rounded-3xl border border-[#E1E5EB] bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#E8E8EC] p-4 sm:flex-row sm:items-center sm:p-5">
          <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9A9DA6]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari project atau client..." className="h-11 w-full rounded-xl border border-[#DDE2EA] pl-10 pr-4 text-sm text-[#24324A] outline-none focus:border-[#7F91B0]" /></div>
          <label className="relative"><select value={health} onChange={(event) => setHealth(event.target.value as typeof health)} className="h-11 w-full appearance-none rounded-xl border border-[#DDE2EA] bg-white pl-3 pr-9 text-xs font-bold text-[#24324A] outline-none sm:w-44"><option value="all">Semua Kondisi</option>{Object.entries(HEALTH_META).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#737680]" /></label>
        </div>

        {loading ? <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-[#737680]"><Loader2 className="h-7 w-7 animate-spin text-[#F26B5E]" /><p className="text-xs font-bold">Menghitung margin tiap project...</p></div> : filtered.length === 0 ? <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center"><div className="mb-4 rounded-2xl bg-[#F2F4F7] p-4 text-[#7B808B]"><BriefcaseBusiness className="h-7 w-7" /></div><h2 className="text-base font-black text-[#24324A]">Belum ada project terukur</h2><p className="mt-2 max-w-md text-xs leading-5 text-[#737680]">Project akan muncul dari database project, transaksi finance, atau nama project pada presensi.</p></div> : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1180px] text-left text-xs">
                <thead className="bg-[#F7F8FA] text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#737680]"><tr><th className="px-5 py-3">Project</th><th className="px-4 py-3 text-right">Revenue</th><th className="px-4 py-3 text-right">Total Cost</th><th className="px-4 py-3 text-right">Profit</th><th className="px-4 py-3">Margin</th><th className="px-4 py-3">Progress</th><th className="px-4 py-3">Kondisi</th><th className="px-5 py-3 text-right">Atur</th></tr></thead>
                <tbody className="divide-y divide-[#ECEEF2]">{filtered.map((project) => <ProfitabilityTableRow key={project.project_id} project={project} currency={data.currency} onOpen={() => setInsight(project)} onEdit={() => openEdit(project)} />)}</tbody>
              </table>
            </div>
            <div className="divide-y divide-[#ECEEF2] lg:hidden">{filtered.map((project) => <ProfitabilityCard key={project.project_id} project={project} currency={data.currency} onOpen={() => setInsight(project)} onEdit={() => openEdit(project)} />)}</div>
          </>
        )}
      </section>

      {data.warnings.length > 0 && <details className="rounded-2xl border border-[#E1E5EB] bg-white p-4 text-xs text-[#737680]"><summary className="cursor-pointer font-extrabold text-[#24324A]">{data.warnings.length} sumber data belum lengkap</summary><ul className="mt-3 list-disc space-y-1 pl-5">{data.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></details>}

      {insight && <ProjectInsightModal project={insight} currency={data.currency} month={month} onClose={() => setInsight(null)} onEdit={() => { setInsight(null); openEdit(insight); }} />}

      {edit && <ModalPortal onClose={() => setEdit(null)}><form role="dialog" aria-modal="true" onSubmit={save} className="max-h-[92svh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-2xl sm:rounded-3xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-black text-[#24324A]">Atur Profitability</h2><p className="mt-1 text-xs text-[#737680]">{edit.project_name} · {month}</p></div><button type="button" onClick={() => setEdit(null)} className="rounded-xl p-2 text-[#737680] hover:bg-[#F2F4F7]"><X className="h-5 w-5" /></button></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><MoneyField label="Budget Project" value={edit.budget} onChange={(value) => setEdit((current) => current ? { ...current, budget: value } : current)} placeholder="0" /><MoneyField label="Biaya Eksternal" value={edit.external_cost} onChange={(value) => setEdit((current) => current ? { ...current, external_cost: value } : current)} placeholder="0" /><MoneyField label="Override Revenue" value={edit.revenue_override} onChange={(value) => setEdit((current) => current ? { ...current, revenue_override: value } : current)} placeholder="Kosong = hitung otomatis" /><MoneyField label="Override Biaya Tenaga" value={edit.labor_cost_override} onChange={(value) => setEdit((current) => current ? { ...current, labor_cost_override: value } : current)} placeholder="Kosong = presensi × rate" /></div><label className="mt-4 block"><span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#737680]">Client</span><input value={edit.client_name} onChange={(event) => setEdit((current) => current ? { ...current, client_name: event.target.value } : current)} className="h-11 w-full rounded-xl border border-[#DDE2EA] px-3 text-sm text-[#24324A] outline-none focus:border-[#7F91B0]" /></label><label className="mt-4 block"><span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#737680]">Catatan</span><textarea rows={4} value={edit.notes} onChange={(event) => setEdit((current) => current ? { ...current, notes: event.target.value } : current)} placeholder="Asumsi biaya, scope, atau konteks margin..." className="w-full resize-y rounded-xl border border-[#DDE2EA] p-3 text-sm leading-6 text-[#24324A] outline-none focus:border-[#7F91B0]" /></label><p className="mt-3 text-[10px] leading-4 text-[#8A8E98]">Kosongkan override agar revenue dan biaya tenaga kembali dihitung otomatis dari finance, invoice, presensi, dan rate anggota.</p><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setEdit(null)} className="h-10 rounded-xl border border-[#DDE2EA] px-4 text-xs font-extrabold text-[#737680]">Batal</button><button type="submit" disabled={saving || !data.storage_ready} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#24324A] px-4 text-xs font-extrabold text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />} Simpan</button></div></form></ModalPortal>}
    </div>
  );
}

function MarginBar({ value }: { value: number }) {
  const width = Math.min(100, Math.max(0, value));
  const color = value >= 30 ? 'bg-[#4F9D78]' : value >= 10 ? 'bg-[#E6A23C]' : 'bg-[#D95858]';
  return <div className="w-28"><div className="mb-1 flex items-center justify-between"><span className={`font-black ${value >= 0 ? 'text-[#24324A]' : 'text-[#D95858]'}`}>{value.toFixed(1)}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-[#E9ECF1]"><div className={`h-full rounded-full ${color}`} style={{ width: `${width}%` }} /></div></div>;
}

function HealthBadge({ health }: { health: ProfitabilityHealth }) {
  const meta = HEALTH_META[health]; const Icon = meta.icon;
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold ${meta.color}`}><Icon className="h-3 w-3" />{meta.label}</span>;
}

function ProjectInsightModal({ project, currency, month, onClose, onEdit }: { project: ProjectProfitabilityRow; currency: string; month: string; onClose: () => void; onEdit: () => void }) {
  const pendingTasks = Math.max(0, project.tasks_total - project.tasks_completed);
  const costToRevenue = ratio(project.total_cost, project.revenue);
  const budgetUtilization = ratio(project.total_cost, project.budget);
  const profitPerHour = project.labor_hours > 0 ? project.profit / project.labor_hours : null;
  const revenuePerCompletedTask = project.tasks_completed > 0 ? project.revenue / project.tasks_completed : null;
  const financeCostShare = ratio(project.finance_expense, project.total_cost);
  const externalCostShare = ratio(project.external_cost, project.total_cost);
  const laborCostShare = ratio(project.labor_cost, project.total_cost);
  const narrative = project.revenue === 0 && project.total_cost === 0
    ? 'Revenue dan biaya project belum tercatat pada periode ini. Tambahkan transaksi, invoice paid, jam kerja, atau override agar analitik dapat dihitung.'
    : project.profit < 0
      ? `Project mengalami rugi ${formatCurrency(Math.abs(project.profit), currency)}. Tinjau komponen biaya dan sumber revenue sebelum periode ditutup.`
      : project.margin_percent >= 30
        ? `Project menghasilkan profit ${formatCurrency(project.profit, currency)} dengan margin sehat ${project.margin_percent.toFixed(1)}%.`
        : `Project masih menghasilkan profit ${formatCurrency(project.profit, currency)}, tetapi margin ${project.margin_percent.toFixed(1)}% perlu dipantau.`;

  return (
    <ModalPortal onClose={onClose}>
      <section role="dialog" aria-modal="true" aria-label={`Insight profitability ${project.project_name}`} className="max-h-[94svh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl dark:bg-[#20242C] md:max-w-5xl md:rounded-3xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[#E8E8EC] bg-white/95 px-5 py-4 backdrop-blur dark:border-[#303742] dark:bg-[#20242C]/95 md:px-6">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2"><HealthBadge health={project.health} /><span className="rounded-full bg-[#EEF2F7] px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wide text-[#566176] dark:bg-[#282D36]">{project.project_status.replaceAll('_', ' ')}</span></div>
            <h2 className="truncate text-lg font-black text-[#24324A] dark:text-[#F4F6FA] md:text-xl">{project.project_name}</h2>
            <p className="mt-1 text-xs text-[#737680] dark:text-[#98A2B3]">{project.client_name} · Insight {formatMonthLabel(month)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={onEdit} aria-label="Edit profitability project" className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#F26B5E] px-3.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-[#D95858]"><Pencil className="h-4 w-4" /><span className="hidden sm:inline">Edit</span></button>
            <button type="button" onClick={onClose} className="rounded-xl p-2.5 text-[#737680] transition hover:bg-[#F2F4F7] dark:hover:bg-[#282D36]" aria-label="Tutup insight"><X className="h-5 w-5" /></button>
          </div>
        </header>

        <div className="space-y-5 p-4 md:p-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <InsightSummaryCard label="Revenue" value={formatCurrency(project.revenue, currency)} detail={REVENUE_SOURCE_LABEL[project.revenue_source]} icon={CircleDollarSign} tone="green" />
            <InsightSummaryCard label="Total Cost" value={formatCurrency(project.total_cost, currency)} detail={`${project.labor_hours.toFixed(1)} jam kerja`} icon={WalletCards} tone="purple" />
            <InsightSummaryCard label="Net Profit" value={formatCurrency(project.profit, currency)} detail={`${project.margin_percent.toFixed(1)}% margin`} icon={TrendingUp} tone={project.profit >= 0 ? 'green' : 'red'} />
            <InsightSummaryCard label="Completion" value={`${project.completion_percent.toFixed(0)}%`} detail={`${project.tasks_completed}/${project.tasks_total} task selesai`} icon={ListChecks} tone="blue" />
          </div>

          <div className={`flex items-start gap-3 rounded-2xl border p-4 ${project.profit < 0 ? 'border-[#F3C9C5] bg-[#FFF5F3] text-[#9A453E] dark:border-[#6B3834] dark:bg-[#351F1E] dark:text-[#F4AAA3]' : 'border-[#D8E6DE] bg-[#F2F8F5] text-[#356D53] dark:border-[#315344] dark:bg-[#1E3229] dark:text-[#91C9AA]'}`}>
            <Info className="mt-0.5 h-5 w-5 shrink-0" />
            <div><p className="text-xs font-black uppercase tracking-wide">Kesimpulan periode</p><p className="mt-1 text-xs leading-5">{narrative}</p></div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <InsightSection title="Detail Revenue" subtitle={`Sumber aktif: ${REVENUE_SOURCE_LABEL[project.revenue_source]}`} icon={ReceiptText}>
              <InsightLine label="Revenue yang digunakan" value={formatCurrency(project.revenue, currency)} strong valueClass="text-[#39785D]" />
              <InsightLine label="Terdeteksi dari ledger finance" value={formatCurrency(project.finance_revenue, currency)} />
              <InsightLine label="Terdeteksi dari invoice paid" value={formatCurrency(project.invoice_revenue, currency)} />
              <InsightLine label="Override revenue" value={project.revenue_override === null ? 'Tidak digunakan' : formatCurrency(project.revenue_override, currency)} />
              <p className="mt-3 rounded-xl bg-[#F7F8FA] px-3 py-2 text-[10px] leading-4 text-[#737680] dark:bg-[#252B34] dark:text-[#98A2B3]">Sistem memakai satu sumber utama sesuai prioritas: override, ledger finance, lalu invoice paid. Angka sumber tidak dijumlahkan agar revenue tidak terhitung ganda.</p>
            </InsightSection>

            <InsightSection title="Komposisi Cost" subtitle={`${costToRevenue.toFixed(1)}% dari revenue`} icon={WalletCards}>
              <CostCompositionRow label="Biaya tenaga kerja" value={project.labor_cost} total={project.total_cost} currency={currency} color="bg-[#6B86B3]" detail={`${project.labor_hours.toFixed(1)} jam · ${laborCostShare.toFixed(1)}% cost`} />
              <CostCompositionRow label="Biaya eksternal" value={project.external_cost} total={project.total_cost} currency={currency} color="bg-[#8A68A6]" detail={`${externalCostShare.toFixed(1)}% cost`} />
              <CostCompositionRow label="Expense dari finance" value={project.finance_expense} total={project.total_cost} currency={currency} color="bg-[#E6A23C]" detail={`${financeCostShare.toFixed(1)}% cost`} />
              <div className="mt-3 border-t border-[#E8E8EC] pt-3 dark:border-[#303742]"><InsightLine label="Total cost" value={formatCurrency(project.total_cost, currency)} strong /></div>
              {project.labor_cost_override !== null && <p className="mt-2 text-[10px] text-[#737680] dark:text-[#98A2B3]">Biaya tenaga memakai override {formatCurrency(project.labor_cost_override, currency)}; hasil kalkulasi jam × rate adalah {formatCurrency(project.labor_cost_calculated, currency)}.</p>}
            </InsightSection>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <InsightSection title="Progress Pekerjaan" subtitle={`${pendingTasks} task belum selesai`} icon={ListChecks}>
              <div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-3xl font-black text-[#24324A] dark:text-[#F4F6FA]">{project.completion_percent.toFixed(0)}%</p><p className="mt-1 text-[10px] text-[#737680] dark:text-[#98A2B3]">Completion rate</p></div><span className="text-right text-xs font-bold text-[#737680] dark:text-[#98A2B3]">{project.tasks_completed} selesai<br />{project.tasks_overdue} overdue</span></div>
              <div className="h-2.5 overflow-hidden rounded-full bg-[#E9ECF1] dark:bg-[#303742]"><div className="h-full rounded-full bg-[#6B86B3] transition-all" style={{ width: `${clampPercent(project.completion_percent)}%` }} /></div>
              <div className="mt-4 grid grid-cols-3 gap-2"><MiniMetric label="Total" value={String(project.tasks_total)} /><MiniMetric label="Selesai" value={String(project.tasks_completed)} color="text-[#39785D]" /><MiniMetric label="Overdue" value={String(project.tasks_overdue)} color={project.tasks_overdue > 0 ? 'text-[#B14E46]' : 'text-[#39785D]'} /></div>
            </InsightSection>

            <InsightSection title="Budget Control" subtitle={project.budget > 0 ? `${budgetUtilization.toFixed(1)}% budget terpakai` : 'Budget belum ditetapkan'} icon={Gauge}>
              <InsightLine label="Budget project" value={project.budget > 0 ? formatCurrency(project.budget, currency) : 'Belum diatur'} strong />
              <InsightLine label="Total cost aktual" value={formatCurrency(project.total_cost, currency)} />
              <InsightLine label={project.budget_variance >= 0 ? 'Sisa budget' : 'Melebihi budget'} value={project.budget > 0 ? formatCurrency(Math.abs(project.budget_variance), currency) : '-'} valueClass={project.budget > 0 && project.budget_variance < 0 ? 'text-[#B14E46]' : 'text-[#39785D]'} />
              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[#E9ECF1] dark:bg-[#303742]"><div className={`h-full rounded-full ${budgetUtilization > 100 ? 'bg-[#D95858]' : budgetUtilization > 80 ? 'bg-[#E6A23C]' : 'bg-[#4F9D78]'}`} style={{ width: `${clampPercent(budgetUtilization)}%` }} /></div>
            </InsightSection>
          </div>

          <InsightSection title="Indikator Turunan" subtitle="Dihitung otomatis dari data periode ini" icon={BarChart3}>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <InsightMetric label="Cost / Revenue" value={project.revenue > 0 ? `${costToRevenue.toFixed(1)}%` : '-'} detail="Efisiensi biaya" />
              <InsightMetric label="Profit / Jam" value={profitPerHour === null ? '-' : compactCurrency(profitPerHour, currency)} detail="Dari jam project" />
              <InsightMetric label="Revenue / Task" value={revenuePerCompletedTask === null ? '-' : compactCurrency(revenuePerCompletedTask, currency)} detail="Per task selesai" />
              <InsightMetric label="Labor Aktual" value={formatCurrency(project.labor_cost_calculated, currency)} detail={project.labor_cost_override === null ? 'Dipakai sistem' : 'Sebelum override'} />
            </div>
          </InsightSection>

          <div className="rounded-2xl border border-[#E1E5EB] bg-[#F7F8FA] p-4 dark:border-[#303742] dark:bg-[#252B34]"><p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#737680] dark:text-[#98A2B3]">Catatan Project</p><p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-[#4F5868] dark:text-[#CBD2DC]">{project.notes || 'Belum ada catatan profitability untuk project ini.'}</p></div>
        </div>
      </section>
    </ModalPortal>
  );
}

function InsightSummaryCard({ label, value, detail, icon: Icon, tone }: { label: string; value: string; detail: string; icon: typeof CircleDollarSign; tone: 'green' | 'purple' | 'blue' | 'red' }) {
  const tones = { green: 'bg-[#E7F4ED] text-[#39785D] dark:bg-[#1E392C]', purple: 'bg-[#F2E9FA] text-[#795099] dark:bg-[#32294C]', blue: 'bg-[#EAF2FF] text-[#356AA0] dark:bg-[#29364A]', red: 'bg-[#FDE9E7] text-[#B14E46] dark:bg-[#3B272B]' };
  return <article className="rounded-2xl border border-[#E1E5EB] bg-[#F7F8FA] p-3.5 dark:border-[#303742] dark:bg-[#282D36] md:p-4"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#737680] dark:text-[#98A2B3]">{label}</p><p className="mt-2 truncate text-base font-black text-[#24324A] dark:text-[#F4F6FA] md:text-xl">{value}</p><p className="mt-1 truncate text-[9px] text-[#737680] dark:text-[#98A2B3]">{detail}</p></div><span className={`rounded-xl p-2 ${tones[tone]}`}><Icon className="h-4 w-4" /></span></div></article>;
}

function InsightSection({ title, subtitle, icon: Icon, children }: { title: string; subtitle: string; icon: typeof CircleDollarSign; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-[#E1E5EB] bg-white p-4 dark:border-[#303742] dark:bg-[#20242C] md:p-5"><div className="mb-4 flex items-start gap-3"><span className="rounded-xl bg-[#EEF2F7] p-2 text-[#566176] dark:bg-[#282D36] dark:text-[#AAB4C3]"><Icon className="h-4 w-4" /></span><div><h3 className="text-sm font-black text-[#24324A] dark:text-[#F4F6FA]">{title}</h3><p className="mt-0.5 text-[10px] text-[#737680] dark:text-[#98A2B3]">{subtitle}</p></div></div>{children}</section>;
}

function InsightLine({ label, value, strong = false, valueClass = '' }: { label: string; value: string; strong?: boolean; valueClass?: string }) {
  return <div className="flex items-start justify-between gap-4 py-2"><span className="text-[11px] text-[#737680] dark:text-[#98A2B3]">{label}</span><span className={`text-right text-[11px] ${strong ? 'font-black' : 'font-bold'} text-[#24324A] dark:text-[#F4F6FA] ${valueClass}`}>{value}</span></div>;
}

function CostCompositionRow({ label, value, total, currency, color, detail }: { label: string; value: number; total: number; currency: string; color: string; detail: string }) {
  return <div className="mb-3 last:mb-0"><div className="mb-1.5 flex items-end justify-between gap-3"><div><p className="text-[11px] font-bold text-[#24324A] dark:text-[#E8EBF0]">{label}</p><p className="mt-0.5 text-[9px] text-[#737680] dark:text-[#98A2B3]">{detail}</p></div><p className="text-[11px] font-black text-[#24324A] dark:text-[#F4F6FA]">{formatCurrency(value, currency)}</p></div><div className="h-1.5 overflow-hidden rounded-full bg-[#E9ECF1] dark:bg-[#303742]"><div className={`h-full rounded-full ${color}`} style={{ width: `${clampPercent(ratio(value, total))}%` }} /></div></div>;
}

function InsightMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-xl bg-[#F7F8FA] p-3 dark:bg-[#282D36]"><p className="text-[9px] font-extrabold uppercase tracking-wide text-[#737680] dark:text-[#98A2B3]">{label}</p><p className="mt-2 truncate text-sm font-black text-[#24324A] dark:text-[#F4F6FA]">{value}</p><p className="mt-1 text-[9px] text-[#8A8E98] dark:text-[#98A2B3]">{detail}</p></div>;
}

function ProfitabilityTableRow({ project, currency, onOpen, onEdit }: { project: ProjectProfitabilityRow; currency: string; onOpen: () => void; onEdit: () => void }) {
  return <tr role="button" tabIndex={0} aria-label={`Buka insight ${project.project_name}`} onClick={onOpen} onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(); } }} className="group cursor-pointer text-[#24324A] transition hover:bg-[#FAFAFB] focus-visible:bg-[#FAFAFB] focus-visible:outline-none dark:hover:bg-[#282D36] dark:focus-visible:bg-[#282D36]"><td className="px-5 py-4"><div className="max-w-xs"><p className="font-black">{project.project_name}</p><p className="mt-1 truncate text-[10px] text-[#737680]">{project.client_name} · {project.tasks_completed}/{project.tasks_total} task selesai</p><p className="mt-1 inline-flex items-center gap-1 text-[9px] font-bold text-[#6B86B3] opacity-0 transition group-hover:opacity-100"><Eye className="h-3 w-3" /> Lihat insight lengkap</p></div></td><td className="px-4 py-4 text-right"><p className="font-black text-[#39785D]">{compactCurrency(project.revenue, currency)}</p><p className="mt-1 text-[9px] uppercase text-[#8A8E98]">{project.revenue_source}</p></td><td className="px-4 py-4 text-right"><p className="font-bold">{compactCurrency(project.total_cost, currency)}</p><p className="mt-1 text-[9px] text-[#8A8E98]">Labor {compactCurrency(project.labor_cost, currency)}</p></td><td className={`px-4 py-4 text-right font-black ${project.profit >= 0 ? 'text-[#39785D]' : 'text-[#B14E46]'}`}>{project.profit >= 0 ? <ArrowUpRight className="mr-1 inline h-3.5 w-3.5" /> : <ArrowDownRight className="mr-1 inline h-3.5 w-3.5" />}{compactCurrency(project.profit, currency)}</td><td className="px-4 py-4"><MarginBar value={project.margin_percent} /></td><td className="px-4 py-4"><div className="w-28"><p className="mb-1 text-[10px] font-bold">{project.completion_percent.toFixed(0)}% · {project.tasks_overdue} overdue</p><div className="h-1.5 overflow-hidden rounded-full bg-[#E9ECF1]"><div className="h-full rounded-full bg-[#6B86B3]" style={{ width: `${Math.min(100, project.completion_percent)}%` }} /></div></div></td><td className="px-4 py-4"><HealthBadge health={project.health} /></td><td className="px-5 py-4 text-right"><button type="button" onClick={(event) => { event.stopPropagation(); onEdit(); }} onKeyDown={(event) => event.stopPropagation()} className="rounded-xl bg-[#F26B5E] p-2 text-white shadow-sm transition hover:bg-[#D95858]" title="Edit budget dan override"><Pencil className="h-4 w-4" /></button></td></tr>;
}

function ProfitabilityCard({ project, currency, onOpen, onEdit }: { project: ProjectProfitabilityRow; currency: string; onOpen: () => void; onEdit: () => void }) {
  return <article role="button" tabIndex={0} aria-label={`Buka insight ${project.project_name}`} onClick={onOpen} onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(); } }} className="cursor-pointer p-4 transition hover:bg-[#FAFAFB] focus-visible:bg-[#FAFAFB] focus-visible:outline-none dark:hover:bg-[#282D36] dark:focus-visible:bg-[#282D36]"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-sm font-black text-[#24324A]">{project.project_name}</h3><p className="mt-1 truncate text-[10px] text-[#737680]">{project.client_name}</p><p className="mt-1 inline-flex items-center gap-1 text-[9px] font-bold text-[#6B86B3]"><Eye className="h-3 w-3" /> Ketuk untuk insight lengkap</p></div><HealthBadge health={project.health} /></div><div className="mt-4 grid grid-cols-3 gap-2"><MiniMetric label="Revenue" value={compactCurrency(project.revenue, currency)} color="text-[#39785D]" /><MiniMetric label="Cost" value={compactCurrency(project.total_cost, currency)} /><MiniMetric label="Profit" value={compactCurrency(project.profit, currency)} color={project.profit >= 0 ? 'text-[#39785D]' : 'text-[#B14E46]'} /></div><div className="mt-4 flex items-end justify-between gap-3"><div><p className="text-[10px] font-bold text-[#737680]">Margin</p><MarginBar value={project.margin_percent} /></div><button type="button" onClick={(event) => { event.stopPropagation(); onEdit(); }} onKeyDown={(event) => event.stopPropagation()} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#F26B5E] px-3 text-[10px] font-extrabold text-white shadow-sm transition hover:bg-[#D95858]"><Pencil className="h-3.5 w-3.5" /> Edit</button></div></article>;
}

function MiniMetric({ label, value, color = 'text-[#24324A]' }: { label: string; value: string; color?: string }) {
  return <div className="rounded-xl bg-[#F6F7F9] p-2.5"><p className="text-[9px] font-extrabold uppercase text-[#8A8E98]">{label}</p><p className={`mt-1 truncate text-[11px] font-black ${color}`}>{value}</p></div>;
}

function MoneyField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="block"><span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#737680]">{label}</span><input type="number" min="0" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-11 w-full rounded-xl border border-[#DDE2EA] px-3 text-sm text-[#24324A] outline-none focus:border-[#7F91B0]" /></label>;
}
