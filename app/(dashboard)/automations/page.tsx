'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Clock3,
  FileClock,
  Gauge,
  History,
  Loader2,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Target,
  TimerOff,
  Trash2,
  Users,
  X,
  Zap,
} from 'lucide-react';
import ModalPortal from '@/components/ui/ModalPortal';
import type {
  AutomationAudience,
  AutomationRule,
  AutomationRun,
  AutomationTemplate,
  AutomationTriggerType,
} from '@/lib/automations/types';

const TRIGGER_META: Record<AutomationTriggerType, { label: string; icon: typeof Zap; color: string }> = {
  missing_checkout: { label: 'Checkout Terlewat', icon: TimerOff, color: 'from-[#FFE7D5] to-[#FFD6B7] text-[#9B5A22]' },
  daily_incomplete: { label: 'Daily Belum Lengkap', icon: Activity, color: 'from-[#DDEBFF] to-[#C9DEFF] text-[#356AA0]' },
  task_overdue: { label: 'Task Overdue', icon: Clock3, color: 'from-[#FDE4E1] to-[#F8CECA] text-[#B14E46]' },
  invoice_due: { label: 'Invoice Jatuh Tempo', icon: FileClock, color: 'from-[#E4F3EA] to-[#CDE9D8] text-[#39785D]' },
  kpi_below: { label: 'KPI Di Bawah Target', icon: Target, color: 'from-[#EFE5FA] to-[#E3D1F3] text-[#795099]' },
};

const AUDIENCE_LABELS: Record<AutomationAudience, string> = {
  assignee: 'Anggota terkait',
  managers: 'Owner & Admin',
  assignee_and_managers: 'Anggota + Owner/Admin',
};

type Payload = {
  storage_ready: boolean;
  viewer: { email: string; name: string; role: string; can_manage: boolean };
  templates: AutomationTemplate[];
  rules: AutomationRule[];
  runs: AutomationRun[];
  runner: { mode: string; interval_seconds: number; timezone: string };
  error?: string;
};

type RuleForm = {
  id?: string;
  name: string;
  description: string;
  trigger_type: AutomationTriggerType;
  audience: AutomationAudience;
  enabled: boolean;
  after_hour: number;
  minimum_progress: number;
  days_overdue: number;
  days_before: number;
  threshold: number;
};

const emptyPayload: Payload = {
  storage_ready: true,
  viewer: { email: '', name: '', role: '', can_manage: false },
  templates: [], rules: [], runs: [],
  runner: { mode: 'active_app', interval_seconds: 60, timezone: 'Asia/Makassar' },
};

const emptyForm: RuleForm = {
  name: '', description: '', trigger_type: 'daily_incomplete', audience: 'assignee', enabled: false,
  after_hour: 16, minimum_progress: 100, days_overdue: 0, days_before: 3, threshold: 70,
};

function dateLabel(value: string | null | undefined) {
  if (!value) return 'Belum pernah';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function conditionsFor(form: RuleForm) {
  if (form.trigger_type === 'missing_checkout') return { after_hour: form.after_hour };
  if (form.trigger_type === 'daily_incomplete') return { after_hour: form.after_hour, minimum_progress: form.minimum_progress };
  if (form.trigger_type === 'task_overdue') return { days_overdue: form.days_overdue };
  if (form.trigger_type === 'invoice_due') return { days_before: form.days_before };
  return { after_hour: form.after_hour, threshold: form.threshold };
}

function formFromRule(rule: AutomationRule): RuleForm {
  return {
    id: rule.id,
    name: rule.name,
    description: rule.description,
    trigger_type: rule.trigger_type,
    audience: (rule.actions?.audience || 'assignee') as AutomationAudience,
    enabled: rule.enabled,
    after_hour: Number(rule.conditions?.after_hour ?? 16),
    minimum_progress: Number(rule.conditions?.minimum_progress ?? 100),
    days_overdue: Number(rule.conditions?.days_overdue ?? 0),
    days_before: Number(rule.conditions?.days_before ?? 3),
    threshold: Number(rule.conditions?.threshold ?? 70),
  };
}

export default function AutomationsPage() {
  const [data, setData] = useState<Payload>(emptyPayload);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningId, setRunningId] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState<RuleForm | null>(null);
  const [tab, setTab] = useState<'rules' | 'history'>('rules');

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch('/api/automations', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Gagal memuat Automation Center.');
      setData({ ...emptyPayload, ...payload, templates: Array.isArray(payload.templates) ? payload.templates : [], rules: Array.isArray(payload.rules) ? payload.rules : [], runs: Array.isArray(payload.runs) ? payload.runs : [] });
      setError(payload.error || '');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Gagal memuat Automation Center.');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function post(body: Record<string, unknown>) {
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/automations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Automation gagal diproses.');
      await load(true);
      return true;
    } catch (postError) {
      setError(postError instanceof Error ? postError.message : 'Automation gagal diproses.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function createTemplate(template: AutomationTemplate) {
    await post({ action: 'create_template', trigger_type: template.trigger_type });
  }

  async function saveRule(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    const success = await post({
      action: 'save_rule', id: form.id, name: form.name, description: form.description,
      trigger_type: form.trigger_type, conditions: conditionsFor(form), actions: { audience: form.audience },
      enabled: form.enabled, cooldown_minutes: 1440,
    });
    if (success) setForm(null);
  }

  async function runNow(rule: AutomationRule) {
    setRunningId(rule.id);
    await post({ action: 'run_now', id: rule.id });
    setRunningId('');
  }

  const activeRules = data.rules.filter((rule) => rule.enabled).length;
  const latestRuns = useMemo(() => data.runs.slice(0, 40), [data.runs]);

  return (
    <div className="min-w-0 space-y-6 pb-24 animate-fade-in">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#F26B5E]"><Zap className="h-4 w-4" /> Operational Automation</div>
          <h1 className="text-3xl font-black tracking-tight text-[#24324A]">Automation Center</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#737680]">Jalankan pengingat operasional otomatis tanpa mengecek presensi, task, invoice, dan KPI satu per satu.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2"><div className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#DDE2EA] bg-white px-4 text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#39785D]"><span className="h-2 w-2 rounded-full bg-[#57A883] animate-pulse" /> Runner {data.runner.interval_seconds} detik</div><button type="button" onClick={() => void load()} className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#DDE2EA] bg-white px-4 text-xs font-extrabold text-[#24324A] shadow-sm hover:bg-[#F7F7F8]"><RefreshCw className={`h-4 w-4 text-[#F26B5E] ${loading ? 'animate-spin' : ''}`} /> Refresh</button><button type="button" disabled={!data.storage_ready} onClick={() => setForm({ ...emptyForm })} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#24324A] px-4 text-xs font-extrabold text-white disabled:opacity-50"><Plus className="h-4 w-4" /> Automation Baru</button></div>
      </header>

      {error && <div className={`flex items-start gap-3 rounded-2xl border p-4 text-sm ${data.storage_ready ? 'border-[#F3C9C5] bg-[#FFF5F3] text-[#9A453E]' : 'border-[#F2D6A4] bg-[#FFF9ED] text-[#8A5B16]'}`}><AlertTriangle className="mt-0.5 h-5 w-5 flex-none" /><div><p className="font-extrabold">{data.storage_ready ? 'Automation belum dapat diproses' : 'Database Automation Center belum aktif'}</p><p className="mt-1 text-xs leading-5">{error}</p></div></div>}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Automation Aktif" value={activeRules} detail={`${data.rules.length} total rule`} icon={Zap} />
        <Stat label="Eksekusi Hari Ini" value={data.runs.filter((run) => run.created_at?.slice(0, 10) === new Date().toISOString().slice(0, 10)).length} detail="Asia/Makassar" icon={Play} />
        <Stat label="Notifikasi Terkirim" value={data.runs.reduce((sum, run) => sum + Number(run.notified_count || 0), 0)} detail="Dari riwayat tersimpan" icon={BellRing} />
        <Stat label="Eksekusi Gagal" value={data.runs.filter((run) => run.status === 'failed').length} detail="Perlu ditinjau" icon={AlertTriangle} />
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2"><Sparkles className="h-4 w-4 text-[#F26B5E]" /><h2 className="text-sm font-black text-[#24324A]">Template Siap Pakai</h2></div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">{data.templates.map((template) => { const meta = TRIGGER_META[template.trigger_type]; const Icon = meta.icon; const added = data.rules.some((rule) => rule.trigger_type === template.trigger_type); return <article key={template.trigger_type} className="flex min-h-48 flex-col rounded-2xl border border-[#E1E5EB] bg-white p-4 shadow-sm"><div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br ${meta.color}`}><Icon className="h-5 w-5" /></div><h3 className="text-xs font-black text-[#24324A]">{template.name}</h3><p className="mt-2 flex-1 text-[10px] leading-5 text-[#737680]">{template.description}</p><button type="button" disabled={added || saving || !data.storage_ready} onClick={() => void createTemplate(template)} className={`mt-3 h-9 rounded-xl text-[10px] font-extrabold ${added ? 'bg-[#E7F4ED] text-[#39785D]' : 'bg-[#24324A] text-white disabled:opacity-50'}`}>{added ? 'Sudah Ditambahkan' : 'Gunakan Template'}</button></article>; })}</div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-[#E1E5EB] bg-white shadow-sm">
        <div className="flex items-center gap-1 border-b border-[#E8E8EC] p-2"><button type="button" onClick={() => setTab('rules')} className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-extrabold ${tab === 'rules' ? 'bg-[#24324A] text-white' : 'text-[#737680] hover:bg-[#F2F4F7]'}`}><Zap className="h-4 w-4" /> Rules</button><button type="button" onClick={() => setTab('history')} className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-extrabold ${tab === 'history' ? 'bg-[#24324A] text-white' : 'text-[#737680] hover:bg-[#F2F4F7]'}`}><History className="h-4 w-4" /> Riwayat</button></div>
        {loading ? <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-[#737680]"><Loader2 className="h-7 w-7 animate-spin text-[#F26B5E]" /><p className="text-xs font-bold">Memuat automation...</p></div> : tab === 'rules' ? <RulesList rules={data.rules} saving={saving} runningId={runningId} onToggle={(rule) => void post({ action: 'toggle', id: rule.id, enabled: !rule.enabled })} onEdit={(rule) => setForm(formFromRule(rule))} onRun={(rule) => void runNow(rule)} onDelete={(rule) => { if (window.confirm(`Hapus automation "${rule.name}"?`)) void post({ action: 'delete', id: rule.id }); }} /> : <RunHistory runs={latestRuns} rules={data.rules} />}
      </section>

      <div className="rounded-2xl border border-[#DDE5F0] bg-[#F4F8FD] p-4 text-[10px] leading-5 text-[#5C687A]"><strong className="text-[#24324A]">Cara runner bekerja:</strong> aplikasi memeriksa rule aktif setiap 60 detik ketika minimal satu user membuka workspace. Setiap rule otomatis hanya membuat satu run terjadwal per hari; tombol “Jalankan” tetap dapat dipakai untuk tes manual. Dedupe database mencegah notifikasi ganda antar tab/perangkat.</div>

      {form && <RuleModal form={form} saving={saving} storageReady={data.storage_ready} setForm={setForm} onSubmit={saveRule} />}
    </div>
  );
}

function Stat({ label, value, detail, icon: Icon }: { label: string; value: number; detail: string; icon: typeof Zap }) {
  return <article className="rounded-2xl border border-[#E1E5EB] bg-white p-4 shadow-sm dark:border-[#303742] dark:bg-[#20242C] sm:p-5"><div className="flex items-start justify-between gap-2"><div><p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#5E6470]">{label}</p><p className="mt-2 text-3xl font-black text-[#24324A]">{value}</p><p className="mt-1 text-[10px] font-semibold text-[#6E7380]">{detail}</p></div><div className="rounded-2xl bg-[#F2F4F7] p-2.5 dark:bg-[#282D36]"><Icon className="h-5 w-5 text-[#566B8D]" /></div></div></article>;
}

function RulesList({ rules, saving, runningId, onToggle, onEdit, onRun, onDelete }: { rules: AutomationRule[]; saving: boolean; runningId: string; onToggle: (rule: AutomationRule) => void; onEdit: (rule: AutomationRule) => void; onRun: (rule: AutomationRule) => void; onDelete: (rule: AutomationRule) => void }) {
  if (!rules.length) return <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center"><div className="mb-4 rounded-2xl bg-[#F2F4F7] p-4 text-[#7B808B]"><Zap className="h-7 w-7" /></div><h2 className="text-base font-black text-[#24324A]">Belum ada automation</h2><p className="mt-2 max-w-md text-xs leading-5 text-[#737680]">Pilih template siap pakai atau buat rule custom pertama Anda.</p></div>;
  return <div className="divide-y divide-[#ECEEF2]">{rules.map((rule) => { const meta = TRIGGER_META[rule.trigger_type]; const Icon = meta.icon; const last = rule.last_result || {}; return <article key={rule.id} className="p-4 sm:p-5"><div className="flex flex-col gap-4 xl:flex-row xl:items-center"><div className="flex min-w-0 flex-1 items-start gap-3"><div className={`inline-flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-gradient-to-br ${meta.color}`}><Icon className="h-5 w-5" /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-black text-[#24324A]">{rule.name}</h3><span className={`rounded-full px-2 py-1 text-[9px] font-extrabold ${rule.enabled ? 'bg-[#E7F4ED] text-[#39785D]' : 'bg-[#EEF2F7] text-[#737680]'}`}>{rule.enabled ? 'AKTIF' : 'NONAKTIF'}</span></div><p className="mt-1 text-[10px] leading-5 text-[#737680]">{rule.description || meta.label}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[9px] font-semibold text-[#8A8E98]"><span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{AUDIENCE_LABELS[(rule.actions?.audience || 'assignee') as AutomationAudience]}</span><span>Terakhir: {dateLabel(rule.last_run_at)}</span><span>{Number(last.matched_count || 0)} cocok · {Number(last.notified_count || 0)} notifikasi</span></div></div></div><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => onToggle(rule)} disabled={saving} className={`relative h-7 w-12 rounded-full transition ${rule.enabled ? 'bg-[#4F9D78]' : 'bg-[#C9CED7]'}`} aria-label={rule.enabled ? 'Nonaktifkan automation' : 'Aktifkan automation'}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${rule.enabled ? 'left-6' : 'left-1'}`} /></button><button type="button" onClick={() => onRun(rule)} disabled={runningId === rule.id || saving} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#DDE2EA] px-3 text-[10px] font-extrabold text-[#24324A] hover:bg-[#F2F4F7] disabled:opacity-50">{runningId === rule.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Jalankan</button><button type="button" onClick={() => onEdit(rule)} className="rounded-xl border border-[#DDE2EA] p-2 text-[#566176] hover:bg-[#F2F4F7]" title="Edit"><Pencil className="h-4 w-4" /></button><button type="button" onClick={() => onDelete(rule)} className="rounded-xl border border-[#F0D3D0] p-2 text-[#D95858] hover:bg-[#FFF0ED]" title="Hapus"><Trash2 className="h-4 w-4" /></button></div></div></article>; })}</div>;
}

function RunHistory({ runs, rules }: { runs: AutomationRun[]; rules: AutomationRule[] }) {
  if (!runs.length) return <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center"><History className="mb-4 h-8 w-8 text-[#9A9DA6]" /><h2 className="text-base font-black text-[#24324A]">Belum ada riwayat</h2><p className="mt-2 text-xs text-[#737680]">Aktifkan atau jalankan rule untuk membuat log pertama.</p></div>;
  const names = new Map(rules.map((rule) => [rule.id, rule.name]));
  return <div className="divide-y divide-[#ECEEF2]">{runs.map((run) => <article key={run.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div className="flex items-start gap-3"><div className={`rounded-xl p-2 ${run.status === 'success' ? 'bg-[#E7F4ED] text-[#39785D]' : run.status === 'failed' ? 'bg-[#FDE9E7] text-[#B14E46]' : 'bg-[#FFF1DB] text-[#9B6514]'}`}>{run.status === 'success' ? <CheckCircle2 className="h-4 w-4" /> : run.status === 'failed' ? <AlertTriangle className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}</div><div><h3 className="text-xs font-black text-[#24324A]">{names.get(run.rule_id) || 'Automation'}</h3><p className="mt-1 text-[10px] text-[#737680]">{dateLabel(run.started_at)} · {run.run_key.startsWith('manual:') ? 'Manual' : 'Terjadwal'}</p></div></div><div className="flex gap-2 text-[10px]"><span className="rounded-lg bg-[#F2F4F7] px-2.5 py-1.5 font-bold text-[#566176]">{run.matched_count} cocok</span><span className="rounded-lg bg-[#F2F4F7] px-2.5 py-1.5 font-bold text-[#566176]">{run.notified_count} terkirim</span></div></article>)}</div>;
}

function RuleModal({ form, saving, storageReady, setForm, onSubmit }: { form: RuleForm; saving: boolean; storageReady: boolean; setForm: React.Dispatch<React.SetStateAction<RuleForm | null>>; onSubmit: (event: React.FormEvent) => void }) {
  const update = <K extends keyof RuleForm>(key: K, value: RuleForm[K]) => setForm((current) => current ? { ...current, [key]: value } : current);
  return <ModalPortal onClose={() => setForm(null)}><form role="dialog" aria-modal="true" onSubmit={onSubmit} className="max-h-[92svh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-2xl sm:rounded-3xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-black text-[#24324A]">{form.id ? 'Edit Automation' : 'Automation Baru'}</h2><p className="mt-1 text-xs text-[#737680]">Atur trigger, kondisi, penerima, dan status rule.</p></div><button type="button" onClick={() => setForm(null)} className="rounded-xl p-2 text-[#737680] hover:bg-[#F2F4F7]"><X className="h-5 w-5" /></button></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="Nama Automation"><input required maxLength={200} value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Contoh: Reminder daily sore" /></Field><Field label="Trigger"><select value={form.trigger_type} onChange={(event) => update('trigger_type', event.target.value as AutomationTriggerType)}>{Object.entries(TRIGGER_META).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}</select></Field><div className="sm:col-span-2"><Field label="Deskripsi"><textarea rows={3} value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="Tujuan automation ini..." /></Field></div><Field label="Penerima"><select value={form.audience} onChange={(event) => update('audience', event.target.value as AutomationAudience)}>{Object.entries(AUDIENCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><ConditionField form={form} update={update} /><label className="flex min-h-11 items-center gap-3 rounded-xl border border-[#DDE2EA] px-3 sm:col-span-2"><input type="checkbox" checked={form.enabled} onChange={(event) => update('enabled', event.target.checked)} className="h-4 w-4 accent-[#24324A]" /><span className="text-xs font-bold text-[#24324A]">Langsung aktif setelah disimpan</span></label></div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setForm(null)} className="h-10 rounded-xl border border-[#DDE2EA] px-4 text-xs font-extrabold text-[#737680]">Batal</button><button type="submit" disabled={saving || !storageReady || !form.name.trim()} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#24324A] px-4 text-xs font-extrabold text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan</button></div></form></ModalPortal>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block [&_input]:h-11 [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-[#DDE2EA] [&_input]:px-3 [&_input]:text-sm [&_input]:outline-none [&_select]:h-11 [&_select]:w-full [&_select]:rounded-xl [&_select]:border [&_select]:border-[#DDE2EA] [&_select]:bg-white [&_select]:px-3 [&_select]:text-sm [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-xl [&_textarea]:border [&_textarea]:border-[#DDE2EA] [&_textarea]:p-3 [&_textarea]:text-sm"><span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#737680]">{label}</span>{children}</label>;
}

function ConditionField({ form, update }: { form: RuleForm; update: <K extends keyof RuleForm>(key: K, value: RuleForm[K]) => void }) {
  if (form.trigger_type === 'missing_checkout') return <NumberField label="Jalankan Setelah Jam" value={form.after_hour} min={0} max={23} suffix="WITA" onChange={(value) => update('after_hour', value)} />;
  if (form.trigger_type === 'daily_incomplete') return <div className="grid grid-cols-2 gap-2"><NumberField label="Setelah Jam" value={form.after_hour} min={0} max={23} onChange={(value) => update('after_hour', value)} /><NumberField label="Target Progress" value={form.minimum_progress} min={0} max={100} suffix="%" onChange={(value) => update('minimum_progress', value)} /></div>;
  if (form.trigger_type === 'task_overdue') return <NumberField label="Minimal Terlambat" value={form.days_overdue} min={0} max={30} suffix="hari" onChange={(value) => update('days_overdue', value)} />;
  if (form.trigger_type === 'invoice_due') return <NumberField label="Ingatkan Sebelum" value={form.days_before} min={0} max={30} suffix="hari" onChange={(value) => update('days_before', value)} />;
  return <div className="grid grid-cols-2 gap-2"><NumberField label="Setelah Jam" value={form.after_hour} min={0} max={23} onChange={(value) => update('after_hour', value)} /><NumberField label="Ambang KPI" value={form.threshold} min={0} max={100} suffix="%" onChange={(value) => update('threshold', value)} /></div>;
}

function NumberField({ label, value, min, max, suffix, onChange }: { label: string; value: number; min: number; max: number; suffix?: string; onChange: (value: number) => void }) {
  return <label className="block"><span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#737680]">{label}</span><div className="relative"><input type="number" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-11 w-full rounded-xl border border-[#DDE2EA] px-3 pr-12 text-sm text-[#24324A] outline-none" />{suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#8A8E98]">{suffix}</span>}</div></label>;
}
