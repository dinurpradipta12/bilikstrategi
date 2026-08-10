'use client';

import React, { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Briefcase,
  CheckCircle2,
  CircleDollarSign,
  Loader2,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCw,
  Save,
  ShieldCheck,
  Target,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { isSuperuserEmail } from '@/lib/auth/app-role';

type FinanceSettings = {
  month_key: string;
  monthly_revenue_target: number;
  operational_budget: number;
  currency: string;
};

type FinanceEntry = {
  id: string;
  entry_type: 'revenue' | 'expense';
  status: 'deal' | 'pending' | 'paid' | 'cancelled';
  customer_name: string;
  project_name: string;
  category: string;
  amount: number;
  entry_date: string;
  notes: string;
};

type SalarySetting = {
  user_email: string;
  display_name: string;
  minimum_salary: number;
  monthly_capacity_hours: number;
  hourly_rate: number;
};

type SalaryPayment = {
  id?: string;
  month_key: string;
  user_email: string;
  amount: number;
  paid_date: string;
  payment_method: string;
  bank_name: string;
  account_number: string;
  reference_number: string;
  notes: string;
  status: 'paid' | 'cancelled';
};

type TeamMember = {
  id?: string;
  username?: string;
  email?: string;
  profilePicture?: string;
};

type FinancePayload = {
  settings: FinanceSettings;
  entries: FinanceEntry[];
  salaries: SalarySetting[];
  salaryPayments: SalaryPayment[];
  operational: {
    clients: any[];
    projects: any[];
    tasks: any[];
    invoices: any[];
    quotes: any[];
    attendanceLogs: any[];
  };
  warnings?: string[];
};

function currentMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDate(value: unknown) {
  const dateValue = toText(value).slice(0, 10);
  if (!dateValue) return '-';
  try {
    return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(
      new Date(`${dateValue}T00:00:00`)
    );
  } catch {
    return dateValue;
  }
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toText(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : value == null ? fallback : String(value);
}

function formatCurrency(amount: number, currency = 'IDR') {
  try {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: currency || 'IDR',
      maximumFractionDigits: 0,
    }).format(Math.max(0, amount));
  } catch {
    return `${currency || 'IDR'} ${Math.round(Math.max(0, amount)).toLocaleString('id-ID')}`;
  }
}

function formatCompactCurrency(amount: number, currency = 'IDR') {
  if (Math.abs(amount) < 1_000_000) return formatCurrency(amount, currency);
  const suffix = Math.abs(amount) >= 1_000_000_000 ? 'M' : 'jt';
  const divisor = suffix === 'M' ? 1_000_000_000 : 1_000_000;
  return `${currency} ${(amount / divisor).toFixed(1)} ${suffix}`;
}

function documentMonth(record: any) {
  const data = record?.data || {};
  return toText(data.invoiceDate || data.issueDate || record?.created_at).slice(0, 7);
}

function documentTotal(record: any) {
  const data = record?.data || {};
  if (Number.isFinite(Number(data.total))) return Number(data.total);
  const items = Array.isArray(data.items) ? data.items : [];
  const subtotal = items.reduce(
    (sum: number, item: any) => sum + Math.max(0, toNumber(item.quantity, 1)) * Math.max(0, toNumber(item.unitPrice ?? item.unit_price)),
    0
  );
  const discount = subtotal * Math.max(0, toNumber(data.discountPercent ?? data.discount_percent)) / 100;
  const taxable = Math.max(0, subtotal - discount);
  const tax = taxable * Math.max(0, toNumber(data.taxPercent ?? data.tax_percent)) / 100;
  return Math.max(0, taxable + tax);
}

function isCompletedTask(task: any) {
  const status = toText(task?.status).toLowerCase();
  return status.includes('complete') || status.includes('closed') || status.includes('done');
}

function memberEmail(member: TeamMember) {
  return toText(member.email).toLowerCase() || `${toText(member.username, 'member').toLowerCase().replace(/\s+/g, '.')}@workspace.local`;
}

function memberName(member: TeamMember) {
  return toText(member.username, member.email?.split('@')[0] || 'Team Member');
}

function emptyEntry(): FinanceEntry {
  return {
    id: '',
    entry_type: 'revenue',
    status: 'deal',
    customer_name: '',
    project_name: '',
    category: 'Project deal',
    amount: 0,
    entry_date: today(),
    notes: '',
  };
}

export default function OwnerFinancePage() {
  const [access, setAccess] = useState<'checking' | 'allowed' | 'denied'>('checking');
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState<FinancePayload | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [salaryDrafts, setSalaryDrafts] = useState<Record<string, SalarySetting>>({});
  const [entryForm, setEntryForm] = useState<FinanceEntry>(emptyEntry);
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [paymentDraft, setPaymentDraft] = useState<SalaryPayment | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [migrationRequired, setMigrationRequired] = useState(false);

  const loadFinance = useCallback(async (selectedMonth: string) => {
    setIsLoading(true);
    setError('');
    setNotice('');
    try {
      const [financeResponse, teamResponse] = await Promise.all([
        fetch(`/api/owner/finance?month=${encodeURIComponent(selectedMonth)}`, { cache: 'no-store' }),
        fetch('/api/clickup/teams', { cache: 'no-store' }).catch(() => null),
      ]);

      const payload = await financeResponse.json().catch(() => ({}));
      if (financeResponse.status === 403) {
        setAccess('denied');
        return;
      }
      if (!financeResponse.ok) {
        setMigrationRequired(financeResponse.status === 503);
        throw new Error(payload.error || 'Data finance belum dapat dibaca.');
      }

      const membersPayload = teamResponse?.ok ? await teamResponse.json().catch(() => ({})) : {};
      const members = Array.isArray(membersPayload.members) ? membersPayload.members : [];
      const salaries = Array.isArray(payload.salaries) ? payload.salaries : [];
      const nextSalaryDrafts: Record<string, SalarySetting> = {};
      salaries.forEach((salary: SalarySetting) => {
        nextSalaryDrafts[toText(salary.user_email).toLowerCase()] = {
          user_email: toText(salary.user_email).toLowerCase(),
          display_name: toText(salary.display_name),
          minimum_salary: toNumber(salary.minimum_salary),
          monthly_capacity_hours: toNumber(salary.monthly_capacity_hours, 160),
          hourly_rate: toNumber(salary.hourly_rate),
        };
      });

      setData({
        settings: {
          month_key: toText(payload.settings?.month_key, `${selectedMonth}-01`),
          monthly_revenue_target: toNumber(payload.settings?.monthly_revenue_target),
          operational_budget: toNumber(payload.settings?.operational_budget),
          currency: toText(payload.settings?.currency, 'IDR'),
        },
        entries: Array.isArray(payload.entries) ? payload.entries : [],
        salaries,
        salaryPayments: Array.isArray(payload.salaryPayments) ? payload.salaryPayments : [],
        operational: {
          clients: Array.isArray(payload.operational?.clients) ? payload.operational.clients : [],
          projects: Array.isArray(payload.operational?.projects) ? payload.operational.projects : [],
          tasks: Array.isArray(payload.operational?.tasks) ? payload.operational.tasks : [],
          invoices: Array.isArray(payload.operational?.invoices) ? payload.operational.invoices : [],
          quotes: Array.isArray(payload.operational?.quotes) ? payload.operational.quotes : [],
          attendanceLogs: Array.isArray(payload.operational?.attendanceLogs) ? payload.operational.attendanceLogs : [],
        },
        warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
      });
      setTeamMembers(members);
      setSalaryDrafts(nextSalaryDrafts);
      setAccess('allowed');
      setMigrationRequired(false);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Data finance gagal dimuat.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function authorize() {
      try {
        const response = await fetch('/api/clickup/user', { cache: 'no-store' });
        const payload = await response.json().catch(() => ({}));
        const email = toText(payload.user?.email).toLowerCase();
        if (!cancelled && isSuperuserEmail(email) && email === 'snllabsarchive@gmail.com') {
          setAccess('allowed');
        } else if (!cancelled) {
          setAccess('denied');
        }
      } catch {
        if (!cancelled) setAccess('denied');
      }
    }
    authorize();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (access === 'allowed') loadFinance(month);
  }, [access, loadFinance, month]);

  const postFinance = async (body: Record<string, unknown>, successMessage: string) => {
    setIsSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/owner/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 403) {
        setAccess('denied');
        throw new Error('Sesi owner tidak valid. Silakan login kembali.');
      }
      if (!response.ok) throw new Error(payload.error || 'Data gagal disimpan.');
      setNotice(successMessage);
      await loadFinance(month);
      return true;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Data gagal disimpan.');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const settings = data?.settings || {
    month_key: `${month}-01`,
    monthly_revenue_target: 0,
    operational_budget: 0,
    currency: 'IDR',
  };

  const monthEntries = useMemo(
    () => (data?.entries || []).filter((entry) => toText(entry.entry_date).slice(0, 7) === month),
    [data?.entries, month]
  );

  const metrics = useMemo(() => {
    const operational = data?.operational;
    if (!operational) {
      return {
        ledgerRevenue: 0,
        invoiceRevenue: 0,
        recognizedRevenue: 0,
        expenses: 0,
        acceptedQuoteValue: 0,
        acceptedQuotes: 0,
        activeProjects: 0,
        activeClients: 0,
        openTasks: 0,
      };
    }

    const ledgerRevenue = monthEntries.reduce(
      (sum, entry) => sum + (entry.entry_type === 'revenue' && entry.status !== 'cancelled' ? toNumber(entry.amount) : 0),
      0
    );
    const expenses = monthEntries.reduce(
      (sum, entry) => sum + (entry.entry_type === 'expense' && entry.status !== 'cancelled' ? toNumber(entry.amount) : 0),
      0
    );
    const paidInvoices = operational.invoices.filter(
      (invoice) => invoice.status === 'paid' && documentMonth(invoice) === month
    );
    const acceptedQuotes = operational.quotes.filter(
      (quote) => quote.status === 'accepted' && documentMonth(quote) === month
    );
    const invoiceRevenue = paidInvoices.reduce((sum, invoice) => sum + documentTotal(invoice), 0);
    const acceptedQuoteValue = acceptedQuotes.reduce((sum, quote) => sum + documentTotal(quote), 0);

    return {
      ledgerRevenue,
      invoiceRevenue,
      recognizedRevenue: ledgerRevenue + invoiceRevenue,
      expenses,
      acceptedQuoteValue,
      acceptedQuotes: acceptedQuotes.length,
      activeProjects: operational.projects.filter((project) => ['in_progress', 'active'].includes(toText(project.status).toLowerCase())).length,
      activeClients: operational.clients.filter((client) => ['active', 'deal', 'customer'].includes(toText(client.status).toLowerCase())).length,
      openTasks: operational.tasks.filter((task) => !isCompletedTask(task)).length,
    };
  }, [data?.operational, monthEntries, month]);

  const payrollRows = useMemo(() => {
    const operational = data?.operational;
    if (!operational) return [];
    const byEmail = new Map((data?.salaries || []).map((salary) => [toText(salary.user_email).toLowerCase(), salary]));
    const paymentsByEmail = new Map(
      (data?.salaryPayments || [])
        .filter((payment) => toText(payment.month_key).slice(0, 7) === month && payment.status === 'paid')
        .map((payment) => [toText(payment.user_email).toLowerCase(), payment])
    );
    const members = [...teamMembers];
    const existingEmails = new Set(members.map(memberEmail));
    (data?.salaries || []).forEach((salary) => {
      if (!existingEmails.has(toText(salary.user_email).toLowerCase())) {
        members.push({ username: salary.display_name, email: salary.user_email });
      }
    });

    return members.map((member) => {
      const email = memberEmail(member);
      const name = memberName(member);
      const saved = byEmail.get(email);
      const config = salaryDrafts[email] || saved || {
        user_email: email,
        display_name: name,
        minimum_salary: 0,
        monthly_capacity_hours: 160,
        hourly_rate: 0,
      };
      const assignedTasks = operational.tasks.filter((task) => {
        const names = Array.isArray(task.assignee_names) ? task.assignee_names.map((value: unknown) => toText(value).toLowerCase()) : [];
        const ids = Array.isArray(task.assignee_ids) ? task.assignee_ids.map((value: unknown) => toText(value)) : [];
        return ids.includes(toText(member.id)) || names.some((value: string) => value.includes(name.toLowerCase()));
      });
      const openTasks = assignedTasks.filter((task) => !isCompletedTask(task)).length;
      const logs = operational.attendanceLogs.filter((log) => {
        if (toText(log.date || log.attendance_date).slice(0, 7) !== month) return false;
        const logName = toText(log.user_name || log.full_name || log.email).toLowerCase();
        return logName.includes(name.toLowerCase()) || (email && logName === email);
      });
      const attendanceHours = logs.reduce(
        (sum, log) => sum + toNumber(log.regular_hours ?? log.hours_worked ?? log.total_hours) + toNumber(log.overtime_hours),
        0
      );
      const taskHours = assignedTasks.reduce((sum, task) => sum + toNumber(task.time_tracked_hours), 0);
      const trackedHours = attendanceHours || taskHours;
      const capacity = Math.max(1, toNumber(config.monthly_capacity_hours, 160));
      const hourLoad = trackedHours / capacity;
      const taskLoad = openTasks / 8;
      const loadIndex = Math.max(hourLoad, taskLoad);
      const overtimeHours = Math.max(0, trackedHours - capacity);
      const estimatedSalary = Math.max(0, toNumber(config.minimum_salary)) + overtimeHours * Math.max(0, toNumber(config.hourly_rate));

      return {
        member,
        email,
        name,
        config,
        openTasks,
        trackedHours,
        capacity,
        loadIndex,
        estimatedSalary,
        payment: paymentsByEmail.get(email),
      };
    });
  }, [data?.operational, data?.salaries, data?.salaryPayments, salaryDrafts, teamMembers, month]);

  const targetProgress = settings.monthly_revenue_target > 0
    ? Math.min(100, (metrics.recognizedRevenue / settings.monthly_revenue_target) * 100)
    : 0;
  const budgetRemaining = Math.max(0, settings.operational_budget - metrics.expenses);

  const updateSettings = (field: keyof FinanceSettings, value: string) => {
    setData((current) => ({
      ...(current || { entries: [], salaries: [], salaryPayments: [], operational: { clients: [], projects: [], tasks: [], invoices: [], quotes: [], attendanceLogs: [] } }),
      settings: { ...(current?.settings || settings), [field]: field === 'currency' || field === 'month_key' ? value : toNumber(value) },
    } as FinancePayload));
  };

  const submitSettings = (event: FormEvent) => {
    event.preventDefault();
    postFinance({
      action: 'save_settings',
      month,
      monthly_revenue_target: settings.monthly_revenue_target,
      operational_budget: settings.operational_budget,
      currency: settings.currency,
    }, 'Target dan budget bulan ini tersimpan.');
  };

  const submitEntry = async (event: FormEvent) => {
    event.preventDefault();
    const saved = await postFinance({ action: 'save_entry', ...entryForm }, entryForm.id ? 'Transaksi diperbarui.' : 'Transaksi ditambahkan.');
    if (saved) {
      setEntryForm(emptyEntry());
      setIsEntryModalOpen(false);
    }
  };

  const editEntry = (entry: FinanceEntry) => {
    setEntryForm({ ...entry });
    setIsEntryModalOpen(true);
  };

  const deleteEntry = (id: string) => {
    if (!window.confirm('Hapus transaksi finance ini?')) return;
    postFinance({ action: 'delete_entry', id }, 'Transaksi dihapus.');
  };

  const updateSalaryDraft = (email: string, field: keyof SalarySetting, value: string) => {
    const row = payrollRows.find((item) => item.email === email);
    const current = salaryDrafts[email] || row?.config || {
      user_email: email,
      display_name: row?.name || email.split('@')[0],
      minimum_salary: 0,
      monthly_capacity_hours: 160,
      hourly_rate: 0,
    };
    setSalaryDrafts((drafts) => ({
      ...drafts,
      [email]: { ...current, [field]: field === 'display_name' || field === 'user_email' ? value : toNumber(value) },
    }));
  };

  const openPaymentModal = (row: (typeof payrollRows)[number]) => {
    setPaymentDraft({
      id: row.payment?.id,
      month_key: `${month}-01`,
      user_email: row.email,
      amount: row.payment?.amount ?? row.estimatedSalary,
      paid_date: row.payment?.paid_date || today(),
      payment_method: row.payment?.payment_method || 'Bank transfer',
      bank_name: row.payment?.bank_name || '',
      account_number: row.payment?.account_number || '',
      reference_number: row.payment?.reference_number || '',
      notes: row.payment?.notes || '',
      status: row.payment?.status || 'paid',
    });
  };

  const submitPayment = async (event: FormEvent) => {
    event.preventDefault();
    if (!paymentDraft) return;
    const row = payrollRows.find((item) => item.email === paymentDraft.user_email);
    const saved = await postFinance(
      { action: 'save_salary_payment', month, ...paymentDraft },
      `Pembayaran gaji ${row?.name || paymentDraft.user_email} tersimpan.`
    );
    if (saved) setPaymentDraft(null);
  };

  if (access === 'checking') {
    return <main className="min-h-full flex items-center justify-center p-8 text-[#737680]"><Loader2 className="w-6 h-6 animate-spin" /></main>;
  }

  if (access === 'denied') {
    return (
      <main className="min-h-full flex items-center justify-center p-6 bg-[#F7F7F8] dark:bg-[#171A20]">
        <section className="w-full max-w-lg rounded-2xl border border-[#E8E8EC] dark:border-[#303742] bg-white dark:bg-[#20242C] p-8 text-center shadow-sm">
          <ShieldCheck className="mx-auto mb-4 h-10 w-10 text-[#F26B5E]" />
          <h1 className="text-xl font-bold text-[#24324A] dark:text-[#F4F6FA]">Halaman Owner</h1>
          <p className="mt-2 text-sm leading-6 text-[#737680] dark:text-[#98A2B3]">Dashboard pendapatan dan payroll hanya tersedia untuk akun owner utama.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-full bg-[#F7F7F8] dark:bg-[#171A20] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <header className="flex flex-col gap-4 border-b border-[#E8E8EC] dark:border-[#303742] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.16em] text-[#F26B5E]"><Wallet className="h-4 w-4" /> Owner Finance</div>
            <h1 className="mt-2 text-2xl font-bold text-[#24324A] dark:text-[#F4F6FA] sm:text-3xl">Pendapatan & Budget Operasional</h1>
            <p className="mt-1 max-w-2xl text-sm text-[#737680] dark:text-[#98A2B3]">Rekap deal customer, project berjalan, target bulanan, dan estimasi payroll berdasarkan beban task serta jam kerja.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-bold text-[#737680] dark:text-[#98A2B3]" htmlFor="finance-month">Periode</label>
            <input id="finance-month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="rounded-xl border border-[#E8E8EC] bg-white px-3 py-2 text-sm text-[#24324A] dark:border-[#303742] dark:bg-[#20242C] dark:text-[#F4F6FA]" />
            <button type="button" onClick={() => loadFinance(month)} title="Muat ulang data finance" className="inline-flex items-center gap-2 rounded-xl border border-[#E8E8EC] bg-white px-3 py-2 text-xs font-bold text-[#24324A] hover:border-[#F26B5E] dark:border-[#303742] dark:bg-[#20242C] dark:text-[#F4F6FA]"><RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh</button>
          </div>
        </header>

        {error && <div className="rounded-xl border border-[#F26B5E]/30 bg-[#FFF0ED] px-4 py-3 text-sm text-[#B5473D] dark:border-[#F26B5E]/40 dark:bg-[#3B272B] dark:text-[#EF7373]">{error}{migrationRequired && <span className="ml-1">Jalankan migration owner finance di Supabase terlebih dahulu.</span>}</div>}
        {notice && <div className="rounded-xl border border-[#4F9D78]/30 bg-[#EEF8F3] px-4 py-3 text-sm text-[#317A58] dark:border-[#4F9D78]/40 dark:bg-[#1E392C] dark:text-[#62B58D]">{notice}</div>}

        {isLoading && !data ? (
          <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-[#E8E8EC] bg-white dark:border-[#303742] dark:bg-[#20242C]"><Loader2 className="h-7 w-7 animate-spin text-[#F26B5E]" /></div>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard icon={CircleDollarSign} label="Pendapatan tercatat" value={formatCompactCurrency(metrics.recognizedRevenue, settings.currency)} detail={`Ledger ${formatCompactCurrency(metrics.ledgerRevenue, settings.currency)} + invoice paid`} accent="green" />
              <MetricCard icon={Target} label="Target bulanan" value={`${Math.round(targetProgress)}%`} detail={`${formatCompactCurrency(metrics.recognizedRevenue, settings.currency)} dari ${formatCompactCurrency(settings.monthly_revenue_target, settings.currency)}`} accent="coral" progress={targetProgress} />
              <MetricCard icon={Briefcase} label="Project berjalan" value={String(metrics.activeProjects)} detail={`${metrics.openTasks} task belum selesai`} accent="blue" />
              <MetricCard icon={Wallet} label="Sisa budget operasional" value={formatCompactCurrency(budgetRemaining, settings.currency)} detail={`Pengeluaran ${formatCompactCurrency(metrics.expenses, settings.currency)}`} accent="amber" />
            </section>

            <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
              <div className="rounded-2xl border border-[#E8E8EC] bg-white p-5 shadow-sm dark:border-[#303742] dark:bg-[#20242C]">
                <div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="text-base font-bold text-[#24324A] dark:text-[#F4F6FA]">Rekap bisnis</h2><p className="mt-1 text-xs text-[#737680] dark:text-[#98A2B3]">Angka operasional yang berhasil dibaca dari workspace aplikasi.</p></div><TrendingUp className="h-5 w-5 text-[#4F9D78]" /></div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <BusinessStat label="Customer aktif" value={metrics.activeClients} />
                  <BusinessStat label="Deal diterima" value={metrics.acceptedQuotes} detail={formatCompactCurrency(metrics.acceptedQuoteValue, settings.currency)} />
                  <BusinessStat label="Invoice paid" value={formatCompactCurrency(metrics.invoiceRevenue, settings.currency)} />
                </div>
                <p className="mt-4 text-[11px] leading-5 text-[#737680] dark:text-[#98A2B3]">Pendapatan tercatat menggabungkan ledger owner dan invoice berstatus paid. Hindari mencatat invoice yang sama dua kali di ledger.</p>
              </div>

              <form onSubmit={submitSettings} className="rounded-2xl border border-[#E8E8EC] bg-white p-5 shadow-sm dark:border-[#303742] dark:bg-[#20242C]">
                <div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="text-base font-bold text-[#24324A] dark:text-[#F4F6FA]">Target & budget</h2><p className="mt-1 text-xs text-[#737680] dark:text-[#98A2B3]">Simpan parameter budgeting untuk periode terpilih.</p></div><Target className="h-5 w-5 text-[#F26B5E]" /></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Target pendapatan"><input type="number" min="0" value={settings.monthly_revenue_target} onChange={(event) => updateSettings('monthly_revenue_target', event.target.value)} /></Field>
                  <Field label="Budget operasional"><input type="number" min="0" value={settings.operational_budget} onChange={(event) => updateSettings('operational_budget', event.target.value)} /></Field>
                </div>
                <div className="mt-3 flex items-end gap-3"><Field label="Mata uang" className="flex-1"><select value={settings.currency} onChange={(event) => updateSettings('currency', event.target.value)}><option value="IDR">IDR - Rupiah</option><option value="USD">USD - Dollar</option><option value="SGD">SGD - Singapore Dollar</option><option value="MYR">MYR - Ringgit</option></select></Field><button type="submit" disabled={isSaving} className="inline-flex items-center gap-2 rounded-xl bg-[#24324A] px-4 py-2.5 text-xs font-extrabold text-white hover:opacity-90 disabled:opacity-50 dark:bg-[#F26B5E]"><Save className="h-4 w-4" /> Simpan</button></div>
              </form>
            </section>

            <section className="rounded-2xl border border-[#E8E8EC] bg-white shadow-sm dark:border-[#303742] dark:bg-[#20242C]">
              <div className="border-b border-[#E8E8EC] p-5 dark:border-[#303742]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><h2 className="text-base font-bold text-[#24324A] dark:text-[#F4F6FA]">Ledger pendapatan & biaya</h2><p className="mt-1 text-xs text-[#737680] dark:text-[#98A2B3]">Catat deal customer, biaya operasional, dan transaksi lain yang perlu masuk ke budgeting.</p></div>
                  <div className="flex items-center gap-2"><ReceiptText className="h-5 w-5 text-[#F26B5E]" /><button type="button" onClick={() => { setEntryForm(emptyEntry()); setIsEntryModalOpen(true); }} className="inline-flex items-center gap-1.5 rounded-xl bg-[#F26B5E] px-3 py-2 text-xs font-extrabold text-white hover:opacity-90"><Plus className="h-4 w-4" /> Tambah transaksi</button></div>
                </div>
              </div>
              <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-[#F7F7F8] text-[#737680] dark:bg-[#282D36] dark:text-[#98A2B3]"><tr><th className="px-5 py-3 font-bold">Tanggal</th><th className="px-5 py-3 font-bold">Jenis</th><th className="px-5 py-3 font-bold">Customer / Project</th><th className="px-5 py-3 font-bold">Status</th><th className="px-5 py-3 text-right font-bold">Nominal</th><th className="px-5 py-3 text-right font-bold">Aksi</th></tr></thead><tbody className="divide-y divide-[#E8E8EC] dark:divide-[#303742]">{monthEntries.length === 0 ? <tr><td colSpan={6} className="px-5 py-10 text-center text-[#737680] dark:text-[#98A2B3]">Belum ada transaksi pada periode ini.</td></tr> : monthEntries.map((entry) => <tr key={entry.id} className="text-[#24324A] dark:text-[#F4F6FA]"><td className="px-5 py-3">{formatDate(entry.entry_date)}</td><td className="px-5 py-3"><span className={`inline-flex items-center gap-1 font-bold ${entry.entry_type === 'revenue' ? 'text-[#4F9D78]' : 'text-[#D95858]'}`}>{entry.entry_type === 'revenue' ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}{entry.entry_type === 'revenue' ? 'Pendapatan' : 'Biaya'}</span></td><td className="px-5 py-3"><div className="font-semibold">{entry.customer_name || '-'}</div><div className="text-[#737680] dark:text-[#98A2B3]">{entry.project_name || entry.category || '-'}</div></td><td className="px-5 py-3"><span className="rounded-full bg-[#EEF2F7] px-2 py-1 font-bold text-[#40536F] dark:bg-[#2A3340] dark:text-[#C7D0DD]">{entry.status}</span></td><td className={`px-5 py-3 text-right font-bold ${entry.entry_type === 'revenue' ? 'text-[#4F9D78]' : 'text-[#D95858]'}`}>{entry.entry_type === 'revenue' ? '+' : '-'}{formatCurrency(entry.amount, settings.currency)}</td><td className="px-5 py-3 text-right"><button type="button" onClick={() => editEntry(entry)} title="Edit transaksi" className="mr-1 rounded-lg p-2 text-[#737680] hover:bg-[#EEF2F7] hover:text-[#24324A] dark:hover:bg-[#2A3340] dark:hover:text-white"><Pencil className="h-4 w-4" /></button><button type="button" onClick={() => deleteEntry(entry.id)} title="Hapus transaksi" className="rounded-lg p-2 text-[#D95858] hover:bg-[#FFF0ED] dark:hover:bg-[#3B272B]"><Trash2 className="h-4 w-4" /></button></td></tr>)}</tbody></table></div>
            </section>

            <section className="rounded-2xl border border-[#E8E8EC] bg-white shadow-sm dark:border-[#303742] dark:bg-[#20242C]">
              <div className="border-b border-[#E8E8EC] p-5 dark:border-[#303742]"><div className="flex items-start justify-between gap-3"><div><h2 className="text-base font-bold text-[#24324A] dark:text-[#F4F6FA]">Payroll & beban kerja</h2><p className="mt-1 text-xs text-[#737680] dark:text-[#98A2B3]">Atur gaji minimum, kapasitas bulanan, dan rate lembur. Load index memakai task terbuka serta jam presensi yang tersedia.</p></div><Users className="h-5 w-5 text-[#7B68EE]" /></div></div>
              <div className="overflow-x-auto"><table className="w-full min-w-[1260px] text-left text-xs"><thead className="bg-[#F7F7F8] text-[#737680] dark:bg-[#282D36] dark:text-[#98A2B3]"><tr><th className="px-5 py-3 font-bold">Anggota</th><th className="px-5 py-3 font-bold">Task aktif</th><th className="px-5 py-3 font-bold">Jam / kapasitas</th><th className="px-5 py-3 font-bold">Load index</th><th className="px-5 py-3 font-bold">Gaji minimum</th><th className="px-5 py-3 font-bold">Rate lembur</th><th className="px-5 py-3 font-bold">Estimasi bulan ini</th><th className="px-5 py-3 font-bold">Status pembayaran</th><th className="px-5 py-3 text-right font-bold">Aksi</th></tr></thead><tbody className="divide-y divide-[#E8E8EC] dark:divide-[#303742]">{payrollRows.length === 0 ? <tr><td colSpan={9} className="px-5 py-10 text-center text-[#737680] dark:text-[#98A2B3]">Belum ada anggota atau data payroll.</td></tr> : payrollRows.map((row) => { const draft = salaryDrafts[row.email] || row.config; return <tr key={row.email} className="text-[#24324A] dark:text-[#F4F6FA]"><td className="px-5 py-3"><div className="flex items-center gap-2"><img src={row.member.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(row.name)}&background=24324A&color=fff`} alt="" className="h-8 w-8 rounded-full object-cover" /><div><div className="font-bold">{row.name}</div><div className="text-[#737680] dark:text-[#98A2B3]">{row.email}</div></div></div></td><td className="px-5 py-3 font-semibold">{row.openTasks}</td><td className="px-5 py-3">{row.trackedHours.toFixed(1)} / {row.capacity.toFixed(0)} jam</td><td className="px-5 py-3"><span className={`font-bold ${row.loadIndex > 1 ? 'text-[#D95858]' : row.loadIndex >= 0.75 ? 'text-[#E6A23C]' : 'text-[#4F9D78]'}`}>{Math.round(row.loadIndex * 100)}%</span></td><td className="px-5 py-3"><input type="number" min="0" value={draft.minimum_salary} onChange={(event) => updateSalaryDraft(row.email, 'minimum_salary', event.target.value)} className="w-32 rounded-lg border border-[#E8E8EC] bg-white px-2.5 py-2 text-xs dark:border-[#303742] dark:bg-[#171A20] dark:text-[#F4F6FA]" /></td><td className="px-5 py-3"><input type="number" min="0" value={draft.hourly_rate} onChange={(event) => updateSalaryDraft(row.email, 'hourly_rate', event.target.value)} className="w-28 rounded-lg border border-[#E8E8EC] bg-white px-2.5 py-2 text-xs dark:border-[#303742] dark:bg-[#171A20] dark:text-[#F4F6FA]" /></td><td className="px-5 py-3 font-bold text-[#4F9D78]">{formatCurrency(row.estimatedSalary, settings.currency)}</td><td className="px-5 py-3"><button type="button" onClick={() => openPaymentModal(row)} disabled={isSaving} className="min-w-[210px] text-left disabled:opacity-50">{row.payment ? <><span className="flex items-center gap-1.5 font-bold text-[#4F9D78]"><CheckCircle2 className="h-4 w-4" /> Gaji bulan ini sudah dibayarkan</span><span className="mt-1 block text-[11px] text-[#737680] dark:text-[#98A2B3]">{formatCurrency(row.payment.amount, settings.currency)} · {formatDate(row.payment.paid_date)}</span></> : <><span className="flex items-center gap-1.5 font-bold text-[#E6A23C]"><Wallet className="h-4 w-4" /> Belum dibayarkan</span><span className="mt-1 block text-[11px] text-[#737680] dark:text-[#98A2B3]">Klik untuk input pembayaran</span></>}</button></td><td className="px-5 py-3 text-right"><button type="button" onClick={() => postFinance({ action: 'save_salary', ...draft, display_name: row.name, user_email: row.email }, `Pengaturan gaji ${row.name} tersimpan.`)} disabled={isSaving} title="Simpan pengaturan gaji" className="inline-flex items-center gap-1.5 rounded-lg bg-[#24324A] px-3 py-2 text-[11px] font-bold text-white hover:opacity-90 disabled:opacity-50 dark:bg-[#F26B5E]"><Save className="h-3.5 w-3.5" /> Simpan</button></td></tr>; })}</tbody></table></div>
            </section>

            {isEntryModalOpen && (
              <Modal title={entryForm.id ? 'Edit transaksi finance' : 'Tambah transaksi finance'} onClose={() => { setIsEntryModalOpen(false); setEntryForm(emptyEntry()); }}>
                <form onSubmit={submitEntry} className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Jenis"><select value={entryForm.entry_type} onChange={(event) => setEntryForm((entry) => ({ ...entry, entry_type: event.target.value as FinanceEntry['entry_type'] }))}><option value="revenue">Pendapatan</option><option value="expense">Biaya</option></select></Field>
                    <Field label="Status"><select value={entryForm.status} onChange={(event) => setEntryForm((entry) => ({ ...entry, status: event.target.value as FinanceEntry['status'] }))}><option value="deal">Deal</option><option value="pending">Pending</option><option value="paid">Paid</option><option value="cancelled">Cancelled</option></select></Field>
                    <Field label="Customer"><input value={entryForm.customer_name} onChange={(event) => setEntryForm((entry) => ({ ...entry, customer_name: event.target.value }))} placeholder="Nama customer" /></Field>
                    <Field label="Project"><input value={entryForm.project_name} onChange={(event) => setEntryForm((entry) => ({ ...entry, project_name: event.target.value }))} placeholder="Nama project" /></Field>
                    <Field label="Kategori"><input value={entryForm.category} onChange={(event) => setEntryForm((entry) => ({ ...entry, category: event.target.value }))} placeholder="Project deal / software" /></Field>
                    <Field label="Nominal"><input type="number" min="0" value={entryForm.amount} onChange={(event) => setEntryForm((entry) => ({ ...entry, amount: toNumber(event.target.value) }))} /></Field>
                    <Field label="Tanggal"><input type="date" value={entryForm.entry_date} onChange={(event) => setEntryForm((entry) => ({ ...entry, entry_date: event.target.value }))} /></Field>
                  </div>
                  <Field label="Catatan"><textarea rows={3} value={entryForm.notes} onChange={(event) => setEntryForm((entry) => ({ ...entry, notes: event.target.value }))} placeholder="Opsional" /></Field>
                  <div className="flex justify-end gap-2 border-t border-[#E8E8EC] pt-4 dark:border-[#303742]"><button type="button" onClick={() => { setIsEntryModalOpen(false); setEntryForm(emptyEntry()); }} className="rounded-xl border border-[#E8E8EC] px-4 py-2.5 text-xs font-bold text-[#737680] hover:bg-[#F7F7F8] dark:border-[#303742] dark:text-[#C7D0DD] dark:hover:bg-[#282D36]">Batal</button><button type="submit" disabled={isSaving} className="inline-flex items-center gap-2 rounded-xl bg-[#24324A] px-4 py-2.5 text-xs font-extrabold text-white hover:opacity-90 disabled:opacity-50 dark:bg-[#F26B5E]"><Save className="h-4 w-4" /> {entryForm.id ? 'Simpan perubahan' : 'Simpan transaksi'}</button></div>
                </form>
              </Modal>
            )}

            {paymentDraft && (
              <Modal title={`Pembayaran gaji - ${payrollRows.find((row) => row.email === paymentDraft.user_email)?.name || paymentDraft.user_email}`} onClose={() => setPaymentDraft(null)}>
                <form onSubmit={submitPayment} className="space-y-4">
                  <div className="rounded-xl bg-[#F7F7F8] px-4 py-3 text-xs text-[#737680] dark:bg-[#282D36] dark:text-[#C7D0DD]">Periode pembayaran: <strong className="text-[#24324A] dark:text-[#F4F6FA]">{formatDate(paymentDraft.month_key)}</strong>. Data ini hanya dapat diubah oleh Owner.</div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Jumlah dibayar"><input type="number" min="0" value={paymentDraft.amount} onChange={(event) => setPaymentDraft((current) => current ? { ...current, amount: toNumber(event.target.value) } : current)} /></Field>
                    <Field label="Tanggal pembayaran"><input type="date" value={paymentDraft.paid_date} onChange={(event) => setPaymentDraft((current) => current ? { ...current, paid_date: event.target.value } : current)} /></Field>
                    <Field label="Metode pembayaran"><select value={paymentDraft.payment_method} onChange={(event) => setPaymentDraft((current) => current ? { ...current, payment_method: event.target.value } : current)}><option>Bank transfer</option><option>Cash</option><option>E-wallet</option><option>Lainnya</option></select></Field>
                    <Field label="Nama bank / platform"><input value={paymentDraft.bank_name} onChange={(event) => setPaymentDraft((current) => current ? { ...current, bank_name: event.target.value } : current)} placeholder="Contoh: BCA" /></Field>
                    <Field label="Nomor rekening / tujuan"><input value={paymentDraft.account_number} onChange={(event) => setPaymentDraft((current) => current ? { ...current, account_number: event.target.value } : current)} placeholder="Opsional" /></Field>
                    <Field label="Nomor referensi"><input value={paymentDraft.reference_number} onChange={(event) => setPaymentDraft((current) => current ? { ...current, reference_number: event.target.value } : current)} placeholder="Opsional" /></Field>
                  </div>
                  <Field label="Catatan pembayaran"><textarea rows={3} value={paymentDraft.notes} onChange={(event) => setPaymentDraft((current) => current ? { ...current, notes: event.target.value } : current)} placeholder="Catatan atau keterangan transfer" /></Field>
                  <div className="flex justify-end gap-2 border-t border-[#E8E8EC] pt-4 dark:border-[#303742]"><button type="button" onClick={() => setPaymentDraft(null)} className="rounded-xl border border-[#E8E8EC] px-4 py-2.5 text-xs font-bold text-[#737680] hover:bg-[#F7F7F8] dark:border-[#303742] dark:text-[#C7D0DD] dark:hover:bg-[#282D36]">Batal</button><button type="submit" disabled={isSaving} className="inline-flex items-center gap-2 rounded-xl bg-[#4F9D78] px-4 py-2.5 text-xs font-extrabold text-white hover:opacity-90 disabled:opacity-50"><CheckCircle2 className="h-4 w-4" /> Tandai sudah dibayar</button></div>
                </form>
              </Modal>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function MetricCard({ icon: Icon, label, value, detail, accent, progress }: { icon: typeof Wallet; label: string; value: string; detail: string; accent: 'green' | 'coral' | 'blue' | 'amber'; progress?: number }) {
  const colors = { green: 'text-[#4F9D78] bg-[#EEF8F3] dark:bg-[#1E392C]', coral: 'text-[#F26B5E] bg-[#FFF0ED] dark:bg-[#3B272B]', blue: 'text-[#3B82F6] bg-[#EEF2F7] dark:bg-[#2A3443]', amber: 'text-[#E6A23C] bg-[#FEF3D6] dark:bg-[#3D321F]' };
  return <article className="rounded-2xl border border-[#E8E8EC] bg-white p-5 shadow-sm dark:border-[#303742] dark:bg-[#20242C]"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-wide text-[#737680] dark:text-[#98A2B3]">{label}</p><p className="mt-2 text-2xl font-bold text-[#24324A] dark:text-[#F4F6FA]">{value}</p></div><span className={`rounded-xl p-2 ${colors[accent]}`}><Icon className="h-5 w-5" /></span></div><p className="mt-2 text-[11px] text-[#737680] dark:text-[#98A2B3]">{detail}</p>{progress !== undefined && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#EEF2F7] dark:bg-[#2A3340]"><div className="h-full rounded-full bg-[#F26B5E]" style={{ width: `${progress}%` }} /></div>}</article>;
}

function BusinessStat({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return <div className="rounded-xl border border-[#E8E8EC] bg-[#F7F7F8] p-4 dark:border-[#303742] dark:bg-[#282D36]"><p className="text-[11px] font-bold uppercase tracking-wide text-[#737680] dark:text-[#98A2B3]">{label}</p><p className="mt-2 text-xl font-bold text-[#24324A] dark:text-[#F4F6FA]">{value}</p>{detail && <p className="mt-1 text-[11px] text-[#737680] dark:text-[#98A2B3]">{detail}</p>}</div>;
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#24324A]/45 p-4" role="dialog" aria-modal="true" aria-label={title}>
    <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#E8E8EC] bg-white shadow-2xl dark:border-[#303742] dark:bg-[#20242C]">
      <div className="flex items-center justify-between border-b border-[#E8E8EC] px-5 py-4 dark:border-[#303742]"><h2 className="text-base font-bold text-[#24324A] dark:text-[#F4F6FA]">{title}</h2><button type="button" onClick={onClose} title="Tutup" className="rounded-lg p-2 text-[#737680] hover:bg-[#F7F7F8] dark:hover:bg-[#282D36]"><X className="h-5 w-5" /></button></div>
      <div className="p-5">{children}</div>
    </div>
  </div>;
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  const controlClass = 'w-full rounded-xl border border-[#E8E8EC] bg-white px-3 py-2.5 text-sm text-[#24324A] outline-none focus:border-[#F26B5E] dark:border-[#303742] dark:bg-[#171A20] dark:text-[#F4F6FA]';
  const child = React.isValidElement(children) ? children as React.ReactElement<{ className?: string }> : null;
  const control = child
    ? React.cloneElement(child, { className: `${controlClass} ${child.props.className || ''}` })
    : children;
  return <label className={`block ${className}`}><span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[#737680] dark:text-[#98A2B3]">{label}</span>{control}</label>;
}
