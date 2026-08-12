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
  Clock3,
  Gauge,
  Loader2,
  Pencil,
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

  useEffect(() => { void load(); }, [load]);

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
                <tbody className="divide-y divide-[#ECEEF2]">{filtered.map((project) => <ProfitabilityTableRow key={project.project_id} project={project} currency={data.currency} onEdit={() => openEdit(project)} />)}</tbody>
              </table>
            </div>
            <div className="divide-y divide-[#ECEEF2] lg:hidden">{filtered.map((project) => <ProfitabilityCard key={project.project_id} project={project} currency={data.currency} onEdit={() => openEdit(project)} />)}</div>
          </>
        )}
      </section>

      {data.warnings.length > 0 && <details className="rounded-2xl border border-[#E1E5EB] bg-white p-4 text-xs text-[#737680]"><summary className="cursor-pointer font-extrabold text-[#24324A]">{data.warnings.length} sumber data belum lengkap</summary><ul className="mt-3 list-disc space-y-1 pl-5">{data.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></details>}

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

function ProfitabilityTableRow({ project, currency, onEdit }: { project: ProjectProfitabilityRow; currency: string; onEdit: () => void }) {
  return <tr className="text-[#24324A] transition hover:bg-[#FAFAFB]"><td className="px-5 py-4"><div className="max-w-xs"><p className="font-black">{project.project_name}</p><p className="mt-1 truncate text-[10px] text-[#737680]">{project.client_name} · {project.tasks_completed}/{project.tasks_total} task selesai</p></div></td><td className="px-4 py-4 text-right"><p className="font-black text-[#39785D]">{compactCurrency(project.revenue, currency)}</p><p className="mt-1 text-[9px] uppercase text-[#8A8E98]">{project.revenue_source}</p></td><td className="px-4 py-4 text-right"><p className="font-bold">{compactCurrency(project.total_cost, currency)}</p><p className="mt-1 text-[9px] text-[#8A8E98]">Labor {compactCurrency(project.labor_cost, currency)}</p></td><td className={`px-4 py-4 text-right font-black ${project.profit >= 0 ? 'text-[#39785D]' : 'text-[#B14E46]'}`}>{project.profit >= 0 ? <ArrowUpRight className="mr-1 inline h-3.5 w-3.5" /> : <ArrowDownRight className="mr-1 inline h-3.5 w-3.5" />}{compactCurrency(project.profit, currency)}</td><td className="px-4 py-4"><MarginBar value={project.margin_percent} /></td><td className="px-4 py-4"><div className="w-28"><p className="mb-1 text-[10px] font-bold">{project.completion_percent.toFixed(0)}% · {project.tasks_overdue} overdue</p><div className="h-1.5 overflow-hidden rounded-full bg-[#E9ECF1]"><div className="h-full rounded-full bg-[#6B86B3]" style={{ width: `${Math.min(100, project.completion_percent)}%` }} /></div></div></td><td className="px-4 py-4"><HealthBadge health={project.health} /></td><td className="px-5 py-4 text-right"><button type="button" onClick={onEdit} className="rounded-xl border border-[#DDE2EA] bg-white p-2 text-[#566176] hover:bg-[#F2F4F7]" title="Atur budget dan override"><Pencil className="h-4 w-4" /></button></td></tr>;
}

function ProfitabilityCard({ project, currency, onEdit }: { project: ProjectProfitabilityRow; currency: string; onEdit: () => void }) {
  return <article className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-sm font-black text-[#24324A]">{project.project_name}</h3><p className="mt-1 truncate text-[10px] text-[#737680]">{project.client_name}</p></div><HealthBadge health={project.health} /></div><div className="mt-4 grid grid-cols-3 gap-2"><MiniMetric label="Revenue" value={compactCurrency(project.revenue, currency)} color="text-[#39785D]" /><MiniMetric label="Cost" value={compactCurrency(project.total_cost, currency)} /><MiniMetric label="Profit" value={compactCurrency(project.profit, currency)} color={project.profit >= 0 ? 'text-[#39785D]' : 'text-[#B14E46]'} /></div><div className="mt-4 flex items-end justify-between gap-3"><div><p className="text-[10px] font-bold text-[#737680]">Margin</p><MarginBar value={project.margin_percent} /></div><button type="button" onClick={onEdit} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#DDE2EA] px-3 text-[10px] font-extrabold text-[#24324A]"><Pencil className="h-3.5 w-3.5" /> Atur</button></div></article>;
}

function MiniMetric({ label, value, color = 'text-[#24324A]' }: { label: string; value: string; color?: string }) {
  return <div className="rounded-xl bg-[#F6F7F9] p-2.5"><p className="text-[9px] font-extrabold uppercase text-[#8A8E98]">{label}</p><p className={`mt-1 truncate text-[11px] font-black ${color}`}>{value}</p></div>;
}

function MoneyField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="block"><span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#737680]">{label}</span><input type="number" min="0" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-11 w-full rounded-xl border border-[#DDE2EA] px-3 text-sm text-[#24324A] outline-none focus:border-[#7F91B0]" /></label>;
}
