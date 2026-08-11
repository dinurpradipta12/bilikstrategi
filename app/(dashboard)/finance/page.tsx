'use client';

import React, { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  ArrowDownRight,
  ArrowUpRight,
  Briefcase,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Coins,
  Loader2,
  ListChecks,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  Trash2,
  TrendingUp,
  TriangleAlert,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { isSuperuserEmail } from '@/lib/auth/app-role';
import {
  calculateProjectProfitShares,
  type ProfitShareMemberIdentity,
  type ProfitShareSetting,
  type ProjectProfitShareRow,
} from '@/lib/finance/profit-sharing';

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
  profitShareSettings: ProfitShareSetting[];
  profitShareStorageReady: boolean;
  operational: {
    clients: any[];
    projects: any[];
    tasks: any[];
    invoices: any[];
    quotes: any[];
    attendanceLogs: any[];
    profitabilitySettings: Array<Record<string, unknown>>;
  };
  warnings?: string[];
};

type SalaryMonthRecap = {
  key: string;
  label: string;
  income: number;
  hours: number;
  completedTasks: number;
  relatedTasks: number;
  handledProjects: number;
  kpi: number;
  paid: boolean;
};

type SalaryRecapRow = {
  member: TeamMember;
  email: string;
  name: string;
  months: SalaryMonthRecap[];
  totalIncome: number;
  totalHours: number;
  totalCompletedTasks: number;
  totalHandledProjects: number;
  averageKpi: number;
  paidMonths: number;
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
    }).format(amount);
  } catch {
    return `${currency || 'IDR'} ${Math.round(amount).toLocaleString('id-ID')}`;
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

function monthFromValue(value: unknown) {
  const candidate = toText(value);
  const match = candidate.match(/^(\d{4}-\d{2})/);
  return match?.[1] || '';
}

function yearMonths(year: string) {
  return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}`);
}

function monthLabel(monthKey: string) {
  try {
    return new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(new Date(`${monthKey}-01T00:00:00`));
  } catch {
    return monthKey.slice(5);
  }
}

function taskRaw(task: any) {
  return task?.raw_data || task?.raw || {};
}

function taskValues(task: any, keys: string[]) {
  const raw = taskRaw(task);
  return keys
    .flatMap((key) => [task?.[key], raw?.[key]])
    .filter((value) => value !== undefined && value !== null && value !== '');
}

function taskAssignedTo(task: any, member: TeamMember, name: string, email: string) {
  const raw = taskRaw(task);
  const names = [
    ...(Array.isArray(task?.assignee_names) ? task.assignee_names : []),
    ...(Array.isArray(raw?.assignee_names) ? raw.assignee_names : []),
    ...(Array.isArray(raw?.assignees) ? raw.assignees : []),
  ].map((value: any) => toText(value?.username || value?.email || value?.name || value).toLowerCase());
  const ids = [
    ...(Array.isArray(task?.assignee_ids) ? task.assignee_ids : []),
    ...(Array.isArray(raw?.assignee_ids) ? raw.assignee_ids : []),
    ...(Array.isArray(raw?.assignees) ? raw.assignees.map((value: any) => value?.id) : []),
  ].map((value: unknown) => toText(value));
  return ids.includes(toText(member.id)) || names.some((value) => value === name.toLowerCase() || value === email || value.includes(name.toLowerCase()));
}

function taskIntersectsMonth(task: any, key: string) {
  const starts = taskValues(task, ['start_date', 'startDate', 'date_created', 'created_at']).map(monthFromValue).filter(Boolean);
  const ends = taskValues(task, ['due_date', 'dueDate', 'date_done', 'completed_at', 'updated_at', 'clickup_updated_at']).map(monthFromValue).filter(Boolean);
  const start = starts[0] || '';
  const end = ends[0] || start;
  if (start && end && start <= key && end >= key) return true;
  return [...starts, ...ends].includes(key);
}

function taskCompletedInMonth(task: any, key: string) {
  const completed = taskValues(task, ['completed_at', 'date_completed', 'date_done', 'completedAt', 'dateDone']).map(monthFromValue).find(Boolean);
  return (completed || monthFromValue(task?.updated_at) || monthFromValue(task?.clickup_updated_at) || monthFromValue(taskRaw(task)?.updated_at) || monthFromValue(taskRaw(task)?.clickup_updated_at) || monthFromValue(task?.due_date)) === key;
}

function taskProjectKey(task: any) {
  const raw = taskRaw(task);
  return toText(
    task?.project_id || raw?.project_id || raw?.list?.id || raw?.folder?.id || raw?.space?.id ||
      task?.project_name || raw?.project_name || raw?.list?.name || raw?.folder?.name || raw?.space?.name || task?.id || task?.clickup_task_id || task?.task_name || raw?.task_name || 'unassigned'
  ).toLowerCase();
}

function attendanceBelongsTo(log: any, name: string, email: string) {
  const value = toText(log?.user_name || log?.full_name || log?.email).toLowerCase();
  return value === email || value === name.toLowerCase() || value.includes(name.toLowerCase());
}

function attendanceHours(log: any) {
  return toNumber(log?.regular_hours ?? log?.hours_worked ?? log?.total_hours) + toNumber(log?.overtime_hours);
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
  const [profitShareDraft, setProfitShareDraft] = useState<ProfitShareSetting | null>(null);
  const [activeTab, setActiveTab] = useState<'finance' | 'profit-sharing' | 'salary-recap'>('finance');
  const [selectedSalaryRecap, setSelectedSalaryRecap] = useState<SalaryRecapRow | null>(null);
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
        profitShareSettings: (Array.isArray(payload.profitShareSettings) ? payload.profitShareSettings : []).map((setting: ProfitShareSetting) => ({
          ...setting,
          project_key: toText(setting.project_key),
          month_key: toText(setting.month_key),
          project_name: toText(setting.project_name),
          client_name: toText(setting.client_name),
          agreed_service_value: setting.agreed_service_value === null || setting.agreed_service_value === undefined ? null : toNumber(setting.agreed_service_value),
          operational_deduction_percent: toNumber(setting.operational_deduction_percent),
          tax_percent: toNumber(setting.tax_percent),
          other_deduction_amount: toNumber(setting.other_deduction_amount),
          team_share_percent: toNumber(setting.team_share_percent, 30),
          task_weight_percent: toNumber(setting.task_weight_percent, 40),
          completion_weight_percent: toNumber(setting.completion_weight_percent, 30),
          hours_weight_percent: toNumber(setting.hours_weight_percent, 30),
          notes: toText(setting.notes),
        })),
        profitShareStorageReady: payload.profitShareStorageReady === true,
        operational: {
          clients: Array.isArray(payload.operational?.clients) ? payload.operational.clients : [],
          projects: Array.isArray(payload.operational?.projects) ? payload.operational.projects : [],
          tasks: Array.isArray(payload.operational?.tasks) ? payload.operational.tasks : [],
          invoices: Array.isArray(payload.operational?.invoices) ? payload.operational.invoices : [],
          quotes: Array.isArray(payload.operational?.quotes) ? payload.operational.quotes : [],
          attendanceLogs: Array.isArray(payload.operational?.attendanceLogs) ? payload.operational.attendanceLogs : [],
          profitabilitySettings: Array.isArray(payload.operational?.profitabilitySettings) ? payload.operational.profitabilitySettings : [],
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

  const profitShareMembers = useMemo<ProfitShareMemberIdentity[]>(() => teamMembers.map((member) => ({
    id: toText(member.id),
    name: memberName(member),
    email: toText(member.email).toLowerCase(),
    avatar: toText(member.profilePicture),
  })), [teamMembers]);

  const profitShareRows = useMemo<ProjectProfitShareRow[]>(() => {
    if (!data) return [];
    return calculateProjectProfitShares({
      month,
      entries: data.entries,
      settings: data.profitShareSettings,
      members: profitShareMembers,
      salaries: data.salaries,
      operational: data.operational,
    });
  }, [data, month, profitShareMembers]);

  const projectOptions = useMemo(() => Array.from(new Set((data?.operational.projects || [])
    .map((project) => toText(project?.name || project?.project_name))
    .filter(Boolean))), [data?.operational.projects]);

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

  const salaryRecapRows = useMemo<SalaryRecapRow[]>(() => {
    const operational = data?.operational;
    if (!operational) return [];

    const year = month.slice(0, 4);
    const months = yearMonths(year);
    const salaryByEmail = new Map((data?.salaries || []).map((salary) => [toText(salary.user_email).toLowerCase(), salary]));
    const payments = data?.salaryPayments || [];

    return payrollRows.map((payrollRow) => {
      const { member, email, name } = payrollRow;
      const config = salaryDrafts[email] || salaryByEmail.get(email) || payrollRow.config;
      const projectKeys = new Set<string>();
      const monthRows = months.map((key) => {
        const memberTasks = operational.tasks.filter((task) => taskAssignedTo(task, member, name, email) && taskIntersectsMonth(task, key));
        const completedTasks = memberTasks.filter((task) => isCompletedTask(task) && taskCompletedInMonth(task, key)).length;
        memberTasks.forEach((task) => projectKeys.add(taskProjectKey(task)));

        const logs = operational.attendanceLogs.filter((log) => monthFromValue(log?.date || log?.attendance_date || log?.created_at) === key && attendanceBelongsTo(log, name, email));
        const attendance = logs.reduce((sum, log) => sum + attendanceHours(log), 0);
        const taskHours = memberTasks.reduce((sum, task) => sum + toNumber(task?.time_tracked_hours ?? taskRaw(task)?.time_tracked_hours), 0);
        const hours = attendance || taskHours;
        const capacity = Math.max(1, toNumber(config.monthly_capacity_hours, 160));
        const overtime = Math.max(0, hours - capacity);
        const estimate = Math.max(0, toNumber(config.minimum_salary)) + overtime * Math.max(0, toNumber(config.hourly_rate));
        const payment = payments.find((item) => toText(item.user_email).toLowerCase() === email && monthFromValue(item.month_key) === key && item.status === 'paid');
        const relatedTasks = memberTasks.length;

        return {
          key,
          label: monthLabel(key),
          income: payment ? toNumber(payment.amount) : estimate,
          hours,
          completedTasks,
          relatedTasks,
          handledProjects: new Set(memberTasks.map(taskProjectKey)).size,
          kpi: relatedTasks > 0 ? Math.round((completedTasks / relatedTasks) * 100) : 0,
          paid: Boolean(payment),
        };
      });

      const kpiMonths = monthRows.filter((row) => row.relatedTasks > 0);
      return {
        member,
        email,
        name,
        months: monthRows,
        totalIncome: monthRows.reduce((sum, row) => sum + row.income, 0),
        totalHours: monthRows.reduce((sum, row) => sum + row.hours, 0),
        totalCompletedTasks: monthRows.reduce((sum, row) => sum + row.completedTasks, 0),
        totalHandledProjects: projectKeys.size,
        averageKpi: kpiMonths.length ? Math.round(kpiMonths.reduce((sum, row) => sum + row.kpi, 0) / kpiMonths.length) : 0,
        paidMonths: monthRows.filter((row) => row.paid).length,
      };
    });
  }, [data?.operational, data?.salaryPayments, data?.salaries, month, payrollRows, salaryDrafts]);

  const targetProgress = settings.monthly_revenue_target > 0
    ? Math.min(100, (metrics.recognizedRevenue / settings.monthly_revenue_target) * 100)
    : 0;
  const budgetRemaining = Math.max(0, settings.operational_budget - metrics.expenses);

  const updateSettings = (field: keyof FinanceSettings, value: string) => {
    setData((current) => ({
      ...(current || { entries: [], salaries: [], salaryPayments: [], profitShareSettings: [], profitShareStorageReady: false, operational: { clients: [], projects: [], tasks: [], invoices: [], quotes: [], attendanceLogs: [], profitabilitySettings: [] } }),
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

  const submitProfitShare = async (event: FormEvent) => {
    event.preventDefault();
    if (!profitShareDraft) return;
    const saved = await postFinance(
      { action: 'save_profit_share_setting', month, ...profitShareDraft },
      `Pengaturan bagi hasil ${profitShareDraft.project_name} tersimpan.`
    );
    if (saved) setProfitShareDraft(null);
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
    <main className="min-h-full overflow-x-hidden bg-[#F7F7F8] px-4 py-5 dark:bg-[#171A20] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <header className="flex flex-col gap-4 border-b border-[#E8E8EC] dark:border-[#303742] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.16em] text-[#F26B5E]"><Wallet className="h-4 w-4" /> Owner Finance</div>
            <h1 className="mt-2 text-2xl font-bold text-[#24324A] dark:text-[#F4F6FA] sm:text-3xl">Pendapatan & Budget Operasional</h1>
            <p className="mt-1 max-w-2xl text-sm text-[#737680] dark:text-[#98A2B3]">Rekap deal customer, budget, payroll, serta pembagian profit project berdasarkan task, completion, dan jam kerja.</p>
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
            <div className="w-full overflow-x-auto pb-1">
              <div className="inline-flex min-w-max rounded-xl border border-[#E8E8EC] bg-white p-1 shadow-sm dark:border-[#303742] dark:bg-[#20242C]" role="tablist" aria-label="Tampilan finance">
                <button type="button" role="tab" aria-selected={activeTab === 'finance'} onClick={() => setActiveTab('finance')} className={`rounded-lg px-3 py-2 text-xs font-extrabold transition ${activeTab === 'finance' ? 'bg-[#24324A] text-white dark:bg-[#F26B5E]' : 'text-[#737680] hover:bg-[#F7F7F8] dark:text-[#C7D0DD] dark:hover:bg-[#282D36]'}`}>Finance & Payroll</button>
                <button type="button" role="tab" aria-selected={activeTab === 'profit-sharing'} onClick={() => setActiveTab('profit-sharing')} className={`rounded-lg px-3 py-2 text-xs font-extrabold transition ${activeTab === 'profit-sharing' ? 'bg-[#24324A] text-white dark:bg-[#F26B5E]' : 'text-[#737680] hover:bg-[#F7F7F8] dark:text-[#C7D0DD] dark:hover:bg-[#282D36]'}`}>Bagi Hasil Project</button>
                <button type="button" role="tab" aria-selected={activeTab === 'salary-recap'} onClick={() => setActiveTab('salary-recap')} className={`rounded-lg px-3 py-2 text-xs font-extrabold transition ${activeTab === 'salary-recap' ? 'bg-[#24324A] text-white dark:bg-[#F26B5E]' : 'text-[#737680] hover:bg-[#F7F7F8] dark:text-[#C7D0DD] dark:hover:bg-[#282D36]'}`}>Rekap Gaji 12 Bulan</button>
              </div>
            </div>

            {activeTab === 'finance' ? (
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
                    <div><Field label="Project"><input list="finance-project-options" value={entryForm.project_name} onChange={(event) => setEntryForm((entry) => ({ ...entry, project_name: event.target.value }))} placeholder="Pilih atau tulis nama project" /></Field><datalist id="finance-project-options">{projectOptions.map((project) => <option key={project} value={project} />)}</datalist></div>
                    <Field label="Kategori"><input value={entryForm.category} onChange={(event) => setEntryForm((entry) => ({ ...entry, category: event.target.value }))} placeholder="Project deal / software" /></Field>
                    <Field label="Nominal"><input type="number" min="0" value={entryForm.amount} onChange={(event) => setEntryForm((entry) => ({ ...entry, amount: toNumber(event.target.value) }))} /></Field>
                    <Field label="Tanggal"><input type="date" value={entryForm.entry_date} onChange={(event) => setEntryForm((entry) => ({ ...entry, entry_date: event.target.value }))} /></Field>
                  </div>
                  <Field label="Catatan"><textarea rows={3} value={entryForm.notes} onChange={(event) => setEntryForm((entry) => ({ ...entry, notes: event.target.value }))} placeholder="Opsional" /></Field>
                  <p className="rounded-xl bg-[#EEF2F7] px-4 py-3 text-[11px] leading-5 text-[#40536F] dark:bg-[#2A3340] dark:text-[#C7D0DD]">Pendapatan berstatus <strong>Deal</strong> atau <strong>Paid</strong> akan otomatis menjadi nilai jasa pada tab Bagi Hasil Project. Gunakan nama project yang sama agar pencocokan akurat.</p>
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
            ) : activeTab === 'profit-sharing' ? (
              <ProfitSharingTab
                rows={profitShareRows}
                currency={settings.currency}
                storageReady={data?.profitShareStorageReady !== false}
                isSaving={isSaving}
                draft={profitShareDraft}
                onConfigure={(row) => setProfitShareDraft({ ...row.setting })}
                onDraftChange={setProfitShareDraft}
                onSave={submitProfitShare}
                onClose={() => setProfitShareDraft(null)}
              />
            ) : (
              <SalaryRecapTab
                rows={salaryRecapRows}
                year={month.slice(0, 4)}
                currency={settings.currency}
                selectedRow={selectedSalaryRecap}
                onSelect={setSelectedSalaryRecap}
                onClose={() => setSelectedSalaryRecap(null)}
              />
            )}
          </>
        )}
      </div>
    </main>
  );
}

function revenueSourceLabel(source: ProjectProfitShareRow['revenue_source']) {
  return {
    manual: 'Nilai deal manual',
    finance: 'Transaksi Finance',
    invoice: 'Invoice Paid',
    quote: 'Penawaran Accepted',
    project: 'Project / Profitability',
    none: 'Belum ada nilai jasa',
  }[source];
}

function ProfitSharingTab({
  rows,
  currency,
  storageReady,
  isSaving,
  draft,
  onConfigure,
  onDraftChange,
  onSave,
  onClose,
}: {
  rows: ProjectProfitShareRow[];
  currency: string;
  storageReady: boolean;
  isSaving: boolean;
  draft: ProfitShareSetting | null;
  onConfigure: (row: ProjectProfitShareRow) => void;
  onDraftChange: React.Dispatch<React.SetStateAction<ProfitShareSetting | null>>;
  onSave: (event: FormEvent) => void;
  onClose: () => void;
}) {
  const totals = rows.reduce((summary, row) => ({
    service: summary.service + row.service_value,
    deductions: summary.deductions + row.total_deduction,
    net: summary.net + row.net_profit,
    teamPool: summary.teamPool + row.team_fee_pool,
  }), { service: 0, deductions: 0, net: 0, teamPool: 0 });
  const activeRow = draft ? rows.find((row) => row.project_key === draft.project_key) : undefined;
  const weightTotal = draft
    ? toNumber(draft.task_weight_percent) + toNumber(draft.completion_weight_percent) + toNumber(draft.hours_weight_percent)
    : 0;
  const roundedWeightTotal = Math.round(weightTotal * 100) / 100;
  const weightsBalanced = Math.abs(weightTotal - 100) < 0.01;
  const updateDraft = (field: keyof ProfitShareSetting, value: string | number | null) => {
    onDraftChange((current) => current ? { ...current, [field]: value } : current);
  };

  return (
    <div className="min-w-0 space-y-5">
      {!storageReady && (
        <section className="flex items-start gap-3 rounded-2xl border border-[#E6A23C]/35 bg-[#FEF3D6] p-4 text-[#805500] dark:border-[#E6A23C]/40 dark:bg-[#3D321F] dark:text-[#F1B852]">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="min-w-0"><h2 className="text-sm font-bold">Penyimpanan bagi hasil belum aktif</h2><p className="mt-1 break-words text-xs leading-5">Jalankan migration <code className="break-all">20260812010000_project_profit_sharing.sql</code> di Supabase SQL Editor. Simulasi tetap dapat dilihat, tetapi pengaturan belum bisa disimpan.</p></div>
        </section>
      )}

      <section className="rounded-2xl border border-[#E8E8EC] bg-white p-5 shadow-sm dark:border-[#303742] dark:bg-[#20242C]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl"><div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.14em] text-[#F26B5E]"><Coins className="h-4 w-4" /> Profit Sharing Project</div><h2 className="mt-2 text-lg font-bold text-[#24324A] dark:text-[#F4F6FA]">Pembagian fee berbasis kontribusi nyata</h2><p className="mt-1 text-xs leading-5 text-[#737680] dark:text-[#98A2B3]">Nilai jasa dikurangi biaya project, operasional, pajak, dan potongan lain. Pool tim kemudian dibagi berdasarkan task selesai, completion rate, serta jam kerja pada project.</p></div>
          <div className="rounded-xl bg-[#EEF2F7] px-4 py-3 text-[11px] leading-5 text-[#40536F] dark:bg-[#2A3340] dark:text-[#C7D0DD]"><strong>Urutan nilai otomatis:</strong><br />Finance Deal/Paid → Invoice Paid → Penawaran Accepted → nilai project.</div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={CircleDollarSign} label="Nilai jasa" value={formatCompactCurrency(totals.service, currency)} detail={`${rows.length} project terdeteksi`} accent="green" />
          <MetricCard icon={ReceiptText} label="Total potongan" value={formatCompactCurrency(totals.deductions, currency)} detail="Biaya, operasional, pajak, lainnya" accent="amber" />
          <MetricCard icon={TrendingUp} label="Profit bersih" value={formatCompactCurrency(totals.net, currency)} detail="Setelah seluruh potongan" accent="blue" />
          <MetricCard icon={Users} label="Pool fee tim" value={formatCompactCurrency(totals.teamPool, currency)} detail={`${rows.filter((row) => row.configured).length}/${rows.length} project sudah diatur`} accent="coral" />
        </div>
      </section>

      {rows.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-[#E8E8EC] bg-white px-5 py-14 text-center dark:border-[#303742] dark:bg-[#20242C]">
          <Briefcase className="mx-auto h-9 w-9 text-[#98A2B3]" /><h2 className="mt-3 text-sm font-bold text-[#24324A] dark:text-[#F4F6FA]">Belum ada project yang dapat dihitung</h2><p className="mt-1 text-xs text-[#737680] dark:text-[#98A2B3]">Tambahkan project atau transaksi Finance dengan nama project untuk memulai perhitungan.</p>
        </section>
      ) : rows.map((row) => (
        <article key={row.project_key} className="min-w-0 overflow-hidden rounded-2xl border border-[#E8E8EC] bg-white shadow-sm dark:border-[#303742] dark:bg-[#20242C]">
          <div className="border-b border-[#E8E8EC] p-5 dark:border-[#303742]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="break-words text-base font-bold text-[#24324A] dark:text-[#F4F6FA]">{row.project_name}</h2><span className={`rounded-full px-2 py-1 text-[10px] font-extrabold ${row.configured ? 'bg-[#EEF8F3] text-[#317A58] dark:bg-[#1E392C] dark:text-[#62B58D]' : 'bg-[#FEF3D6] text-[#A56A00] dark:bg-[#3D321F] dark:text-[#F1B852]'}`}>{row.configured ? 'Aturan tersimpan' : 'Simulasi default'}</span><span className="rounded-full bg-[#EEF2F7] px-2 py-1 text-[10px] font-bold text-[#40536F] dark:bg-[#2A3340] dark:text-[#C7D0DD]">{revenueSourceLabel(row.revenue_source)}</span></div><p className="mt-1 text-xs text-[#737680] dark:text-[#98A2B3]">{row.client_name} · Status {row.project_status || 'belum diatur'}</p></div>
              <button type="button" onClick={() => onConfigure(row)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#24324A] px-4 py-2.5 text-xs font-extrabold text-white hover:opacity-90 dark:bg-[#F26B5E]"><SlidersHorizontal className="h-4 w-4" /> Atur perhitungan</button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
              <BusinessStat label="Nilai jasa" value={formatCompactCurrency(row.service_value, currency)} />
              <BusinessStat label="Total potongan" value={formatCompactCurrency(row.total_deduction, currency)} />
              <BusinessStat label="Profit bersih" value={formatCompactCurrency(row.net_profit, currency)} />
              <BusinessStat label="Pool tim" value={formatCompactCurrency(row.team_fee_pool, currency)} />
              <BusinessStat label="Bagian perusahaan" value={formatCompactCurrency(row.company_retained, currency)} />
            </div>
          </div>

          <div className="grid min-w-0 gap-5 p-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div className="min-w-0 space-y-4">
              <div className="rounded-xl bg-[#F7F7F8] p-4 dark:bg-[#282D36]"><p className="text-[11px] font-extrabold uppercase tracking-wide text-[#737680] dark:text-[#98A2B3]">Rincian potongan</p><div className="mt-3 space-y-2 text-xs"><ProfitLine label="Biaya project dari ledger" value={row.recorded_expense} currency={currency} /><ProfitLine label={`Operasional (${toNumber(row.setting.operational_deduction_percent)}%)`} value={row.operational_deduction} currency={currency} /><ProfitLine label={`Pajak (${toNumber(row.setting.tax_percent)}%)`} value={row.tax_deduction} currency={currency} /><ProfitLine label="Potongan lainnya" value={row.other_deduction} currency={currency} /><div className="border-t border-[#E0E3E8] pt-2 dark:border-[#3A414C]"><ProfitLine label="Total" value={row.total_deduction} currency={currency} strong /></div></div></div>
              <div className="grid grid-cols-3 gap-2"><ContributionStat icon={ListChecks} label="Task" value={`${row.tasks_completed}/${row.tasks_total}`} /><ContributionStat icon={Target} label="Completion" value={`${Math.round(row.completion_percent)}%`} /><ContributionStat icon={Clock} label="Jam project" value={`${row.labor_hours.toFixed(1)}j`} /></div>
              <div className="rounded-xl border border-dashed border-[#D8DDE5] px-4 py-3 text-[11px] leading-5 text-[#737680] dark:border-[#3A414C] dark:text-[#98A2B3]">Bobot aktif: task {toNumber(row.setting.task_weight_percent)}%, completion {toNumber(row.setting.completion_weight_percent)}%, dan jam kerja {toNumber(row.setting.hours_weight_percent)}%. Komponen tanpa data otomatis dikeluarkan lalu bobot sisanya dinormalisasi.</div>
            </div>

            <div className="min-w-0">
              <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-[#24324A] dark:text-[#F4F6FA]">Alokasi fee anggota</h3><p className="mt-1 text-[11px] text-[#737680] dark:text-[#98A2B3]">Pool tim {toNumber(row.setting.team_share_percent)}% dari profit bersih.</p></div><Users className="h-5 w-5 shrink-0 text-[#7B68EE]" /></div>
              {row.allocations.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#D8DDE5] px-4 py-10 text-center text-xs text-[#737680] dark:border-[#3A414C] dark:text-[#98A2B3]">Belum ada assignee task atau jam kerja yang cocok dengan project ini.</div>
              ) : (
                <div className="max-w-full overflow-x-auto rounded-xl border border-[#E8E8EC] dark:border-[#303742]">
                  <table className="w-full min-w-[690px] text-left text-xs"><thead className="bg-[#F7F7F8] text-[#737680] dark:bg-[#282D36] dark:text-[#98A2B3]"><tr><th className="px-4 py-3 font-bold">Anggota</th><th className="px-4 py-3 text-right font-bold">Task</th><th className="px-4 py-3 text-right font-bold">Completion</th><th className="px-4 py-3 text-right font-bold">Jam</th><th className="px-4 py-3 text-right font-bold">Kontribusi</th><th className="px-4 py-3 text-right font-bold">Fee</th></tr></thead><tbody className="divide-y divide-[#E8E8EC] dark:divide-[#303742]">{row.allocations.map((allocation) => <tr key={allocation.key} className="text-[#24324A] dark:text-[#F4F6FA]"><td className="px-4 py-3"><div className="flex items-center gap-2"><Image unoptimized src={allocation.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(allocation.name)}&background=EEF2F7&color=24324A`} alt="" width={32} height={32} className="h-8 w-8 rounded-full object-cover" /><div className="min-w-0"><div className="max-w-[180px] truncate font-bold">{allocation.name}</div><div className="max-w-[180px] truncate text-[10px] text-[#737680] dark:text-[#98A2B3]">{allocation.email || 'ClickUp member'}</div></div></div></td><td className="px-4 py-3 text-right">{allocation.tasks_completed}/{allocation.tasks_assigned}</td><td className="px-4 py-3 text-right">{Math.round(allocation.completion_percent)}%</td><td className="px-4 py-3 text-right">{allocation.hours.toFixed(1)}</td><td className="px-4 py-3 text-right font-bold text-[#7B68EE]">{allocation.contribution_percent.toFixed(1)}%</td><td className="px-4 py-3 text-right font-extrabold text-[#4F9D78]">{formatCurrency(allocation.fee_amount, currency)}</td></tr>)}</tbody></table>
                </div>
              )}
            </div>
          </div>
        </article>
      ))}

      {draft && (
        <Modal title={`Atur bagi hasil - ${draft.project_name}`} onClose={onClose} wide>
          <form onSubmit={onSave} className="space-y-5">
            <div className="rounded-xl bg-[#EEF2F7] px-4 py-3 text-xs leading-5 text-[#40536F] dark:bg-[#2A3340] dark:text-[#C7D0DD]">Kosongkan nilai deal agar sistem membaca otomatis. Nilai yang sedang terdeteksi: <strong>{formatCurrency(activeRow?.service_value || 0, currency)}</strong> dari {activeRow ? revenueSourceLabel(activeRow.revenue_source) : 'data project'}.</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nama project"><input value={draft.project_name} disabled /></Field>
              <Field label="Customer / client"><input value={draft.client_name} onChange={(event) => updateDraft('client_name', event.target.value)} placeholder="Nama client" /></Field>
              <Field label="Nilai jasa deal (opsional)"><input type="number" min="0" value={draft.agreed_service_value ?? ''} onChange={(event) => updateDraft('agreed_service_value', event.target.value === '' ? null : toNumber(event.target.value))} placeholder="Otomatis jika dikosongkan" /></Field>
              <Field label="Pool fee untuk tim (%)"><input type="number" min="0" max="100" step="0.01" value={draft.team_share_percent} onChange={(event) => updateDraft('team_share_percent', toNumber(event.target.value))} /></Field>
            </div>

            <section className="rounded-xl border border-[#E8E8EC] p-4 dark:border-[#303742]"><div className="mb-3"><h3 className="text-sm font-bold text-[#24324A] dark:text-[#F4F6FA]">Potongan sebelum profit dibagi</h3><p className="mt-1 text-[11px] text-[#737680] dark:text-[#98A2B3]">Biaya project dari ledger selalu ikut dipotong otomatis.</p></div><div className="grid gap-4 sm:grid-cols-3"><Field label="Operasional (%)"><input type="number" min="0" max="100" step="0.01" value={draft.operational_deduction_percent} onChange={(event) => updateDraft('operational_deduction_percent', toNumber(event.target.value))} /></Field><Field label="Pajak (%)"><input type="number" min="0" max="100" step="0.01" value={draft.tax_percent} onChange={(event) => updateDraft('tax_percent', toNumber(event.target.value))} /></Field><Field label="Potongan lain (nominal)"><input type="number" min="0" value={draft.other_deduction_amount} onChange={(event) => updateDraft('other_deduction_amount', toNumber(event.target.value))} /></Field></div></section>

            <section className="rounded-xl border border-[#E8E8EC] p-4 dark:border-[#303742]"><div className="mb-3 flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-sm font-bold text-[#24324A] dark:text-[#F4F6FA]">Bobot kontribusi anggota</h3><p className="mt-1 text-[11px] text-[#737680] dark:text-[#98A2B3]">Sistem menormalisasi bobot yang tersedia; disarankan total 100%.</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-extrabold ${weightsBalanced ? 'bg-[#EEF8F3] text-[#317A58] dark:bg-[#1E392C] dark:text-[#62B58D]' : 'bg-[#FEF3D6] text-[#A56A00] dark:bg-[#3D321F] dark:text-[#F1B852]'}`}>Total {roundedWeightTotal}%</span></div><div className="grid gap-4 sm:grid-cols-3"><Field label="Task selesai (%)"><input type="number" min="0" max="100" step="0.01" value={draft.task_weight_percent} onChange={(event) => updateDraft('task_weight_percent', toNumber(event.target.value))} /></Field><Field label="Completion rate (%)"><input type="number" min="0" max="100" step="0.01" value={draft.completion_weight_percent} onChange={(event) => updateDraft('completion_weight_percent', toNumber(event.target.value))} /></Field><Field label="Jam kerja project (%)"><input type="number" min="0" max="100" step="0.01" value={draft.hours_weight_percent} onChange={(event) => updateDraft('hours_weight_percent', toNumber(event.target.value))} /></Field></div></section>

            <Field label="Catatan aturan"><textarea rows={3} value={draft.notes} onChange={(event) => updateDraft('notes', event.target.value)} placeholder="Contoh: potongan tools campaign, kesepakatan fee tim, atau dasar perhitungan pajak" /></Field>
            <div className="rounded-xl bg-[#F7F7F8] px-4 py-3 text-[11px] leading-5 text-[#737680] dark:bg-[#282D36] dark:text-[#98A2B3]"><strong className="text-[#24324A] dark:text-[#F4F6FA]">Rumus:</strong> nilai jasa − (biaya ledger + operasional + pajak + potongan lain) = profit bersih. Profit bersih × pool tim = fee yang dibagi berdasarkan skor kontribusi.</div>
            <div className="flex flex-col-reverse gap-2 border-t border-[#E8E8EC] pt-4 dark:border-[#303742] sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="rounded-xl border border-[#E8E8EC] px-4 py-2.5 text-xs font-bold text-[#737680] hover:bg-[#F7F7F8] dark:border-[#303742] dark:text-[#C7D0DD] dark:hover:bg-[#282D36]">Batal</button><button type="submit" disabled={isSaving || !storageReady} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#24324A] px-4 py-2.5 text-xs font-extrabold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#F26B5E]"><Save className="h-4 w-4" /> Simpan aturan</button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function ProfitLine({ label, value, currency, strong = false }: { label: string; value: number; currency: string; strong?: boolean }) {
  return <div className={`flex items-center justify-between gap-3 ${strong ? 'font-extrabold text-[#24324A] dark:text-[#F4F6FA]' : 'text-[#737680] dark:text-[#C7D0DD]'}`}><span>{label}</span><span className="shrink-0">{formatCurrency(value, currency)}</span></div>;
}

function ContributionStat({ icon: Icon, label, value }: { icon: typeof Wallet; label: string; value: string }) {
  return <div className="min-w-0 rounded-xl border border-[#E8E8EC] p-3 text-center dark:border-[#303742]"><Icon className="mx-auto h-4 w-4 text-[#7B68EE]" /><p className="mt-2 truncate text-[10px] font-bold uppercase text-[#737680] dark:text-[#98A2B3]">{label}</p><p className="mt-1 text-sm font-extrabold text-[#24324A] dark:text-[#F4F6FA]">{value}</p></div>;
}

function SalaryRecapTab({
  rows,
  year,
  currency,
  selectedRow,
  onSelect,
  onClose,
}: {
  rows: SalaryRecapRow[];
  year: string;
  currency: string;
  selectedRow: SalaryRecapRow | null;
  onSelect: (row: SalaryRecapRow) => void;
  onClose: () => void;
}) {
  const totalIncome = rows.reduce((sum, row) => sum + row.totalIncome, 0);
  const totalHours = rows.reduce((sum, row) => sum + row.totalHours, 0);
  const totalCompleted = rows.reduce((sum, row) => sum + row.totalCompletedTasks, 0);
  const totalProjects = rows.reduce((sum, row) => sum + row.totalHandledProjects, 0);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[#E8E8EC] bg-white p-5 shadow-sm dark:border-[#303742] dark:bg-[#20242C]">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            <h2 className="text-base font-bold text-[#24324A] dark:text-[#F4F6FA]">Rekap gaji per anggota</h2>
            <p className="mt-1 text-xs text-[#737680] dark:text-[#98A2B3]">Ringkasan pendapatan dan performa setiap anggota selama Januari - Desember {year}.</p>
          </div>
          <TrendingUp className="h-5 w-5 shrink-0 text-[#F26B5E]" />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <BusinessStat label="Total pendapatan" value={formatCompactCurrency(totalIncome, currency)} detail="Pembayaran tersimpan atau estimasi" />
          <BusinessStat label="Total jam kerja" value={`${totalHours.toFixed(1)} jam`} detail="Presensi dan time tracked" />
          <BusinessStat label="Task selesai" value={totalCompleted} detail="Task yang terbaca selesai" />
          <BusinessStat label="Project ditangani" value={totalProjects} detail="Akumulasi project per anggota" />
        </div>
        <p className="mt-4 text-[11px] leading-5 text-[#737680] dark:text-[#98A2B3]">KPI dihitung dari task selesai dibagi task terkait pada bulan tersebut. Bulan tanpa pembayaran tersimpan menampilkan estimasi dari gaji minimum dan lembur, sehingga tidak dianggap sudah dibayar.</p>
      </section>

      {rows.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-[#E8E8EC] bg-white px-5 py-14 text-center text-sm text-[#737680] dark:border-[#303742] dark:bg-[#20242C] dark:text-[#98A2B3]">Belum ada anggota yang dapat direkap.</section>
      ) : (
        <section className="grid gap-4 xl:grid-cols-2">
          {rows.map((row) => (
            <button key={row.email} type="button" onClick={() => onSelect(row)} className="rounded-2xl border border-[#E8E8EC] bg-white p-5 text-left shadow-sm transition hover:border-[#F26B5E]/60 hover:shadow-md dark:border-[#303742] dark:bg-[#20242C] dark:hover:border-[#F26B5E]/70">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <img src={row.member.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(row.name)}&background=24324A&color=fff`} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                  <div className="min-w-0"><h3 className="truncate text-sm font-bold text-[#24324A] dark:text-[#F4F6FA]">{row.name}</h3><p className="truncate text-[11px] text-[#737680] dark:text-[#98A2B3]">{row.email}</p></div>
                </div>
                <span className="shrink-0 rounded-lg bg-[#EEF8F3] px-2 py-1 text-[10px] font-extrabold text-[#4F9D78] dark:bg-[#1E392C] dark:text-[#62B58D]">{row.averageKpi}% KPI</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <BusinessStat label="Pendapatan" value={formatCompactCurrency(row.totalIncome, currency)} />
                <BusinessStat label="Jam kerja" value={`${row.totalHours.toFixed(1)} jam`} />
                <BusinessStat label="Task selesai" value={row.totalCompletedTasks} />
                <BusinessStat label="Project" value={row.totalHandledProjects} />
              </div>
              <div className="mt-4"><SalaryChart label="Pendapatan per bulan" months={row.months} getValue={(item) => item.income} formatValue={(value) => formatCurrency(value, currency)} color="bg-[#F26B5E]" compact /></div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-[#737680] dark:text-[#98A2B3]"><span>{row.paidMonths}/12 bulan sudah dibayar</span><span className="font-bold text-[#F26B5E]">Klik untuk detail</span></div>
            </button>
          ))}
        </section>
      )}

      {selectedRow && <SalaryRecapDetail row={selectedRow} year={year} currency={currency} onClose={onClose} />}
    </div>
  );
}

function SalaryRecapDetail({ row, year, currency, onClose }: { row: SalaryRecapRow; year: string; currency: string; onClose: () => void }) {
  return (
    <Modal title={`Detail rekap gaji - ${row.name} (${year})`} onClose={onClose} wide>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <BusinessStat label="Pendapatan" value={formatCompactCurrency(row.totalIncome, currency)} />
        <BusinessStat label="Jam kerja" value={`${row.totalHours.toFixed(1)} jam`} />
        <BusinessStat label="Task selesai" value={row.totalCompletedTasks} />
        <BusinessStat label="Project" value={row.totalHandledProjects} />
        <BusinessStat label="KPI rata-rata" value={`${row.averageKpi}%`} />
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <SalaryChart label="Pendapatan per bulan" months={row.months} getValue={(item) => item.income} formatValue={(value) => formatCurrency(value, currency)} color="bg-[#F26B5E]" />
        <SalaryChart label="Jam kerja per bulan" months={row.months} getValue={(item) => item.hours} formatValue={(value) => `${value.toFixed(1)} jam`} color="bg-[#4F9D78]" />
        <SalaryChart label="Task selesai per bulan" months={row.months} getValue={(item) => item.completedTasks} formatValue={(value) => `${value} task`} color="bg-[#3B82F6]" />
        <SalaryChart label="Project ditangani per bulan" months={row.months} getValue={(item) => item.handledProjects} formatValue={(value) => `${value} project`} color="bg-[#E6A23C]" />
        <div className="lg:col-span-2"><SalaryChart label="KPI completion per bulan" months={row.months} getValue={(item) => item.kpi} formatValue={(value) => `${value}%`} color="bg-[#7B68EE]" maxValue={100} /></div>
      </div>
      <div className="mt-5 overflow-x-auto rounded-xl border border-[#E8E8EC] dark:border-[#303742]">
        <table className="w-full min-w-[720px] text-left text-xs"><thead className="bg-[#F7F7F8] text-[#737680] dark:bg-[#282D36] dark:text-[#98A2B3]"><tr><th className="px-4 py-3 font-bold">Bulan</th><th className="px-4 py-3 text-right font-bold">Pendapatan</th><th className="px-4 py-3 text-right font-bold">Jam</th><th className="px-4 py-3 text-right font-bold">Task selesai / terkait</th><th className="px-4 py-3 text-right font-bold">Project</th><th className="px-4 py-3 text-right font-bold">KPI</th><th className="px-4 py-3 text-right font-bold">Status</th></tr></thead><tbody className="divide-y divide-[#E8E8EC] dark:divide-[#303742]">{row.months.map((item) => <tr key={item.key} className="text-[#24324A] dark:text-[#F4F6FA]"><td className="px-4 py-3 font-semibold">{item.label} {year}</td><td className="px-4 py-3 text-right font-bold">{formatCurrency(item.income, currency)}</td><td className="px-4 py-3 text-right">{item.hours.toFixed(1)}</td><td className="px-4 py-3 text-right">{item.completedTasks} / {item.relatedTasks}</td><td className="px-4 py-3 text-right">{item.handledProjects}</td><td className="px-4 py-3 text-right font-bold">{item.kpi}%</td><td className="px-4 py-3 text-right"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${item.paid ? 'bg-[#EEF8F3] text-[#4F9D78] dark:bg-[#1E392C] dark:text-[#62B58D]' : 'bg-[#FEF3D6] text-[#A56A00] dark:bg-[#3D321F] dark:text-[#F1B852]'}`}>{item.paid ? 'Dibayar' : 'Estimasi'}</span></td></tr>)}</tbody></table>
      </div>
    </Modal>
  );
}

function SalaryChart({ label, months, getValue, formatValue, color, maxValue, compact = false }: { label: string; months: SalaryMonthRecap[]; getValue: (month: SalaryMonthRecap) => number; formatValue: (value: number) => string; color: string; maxValue?: number; compact?: boolean }) {
  const max = maxValue || Math.max(1, ...months.map((month) => getValue(month)));
  return <div className="rounded-xl border border-[#E8E8EC] bg-[#F7F7F8] p-4 dark:border-[#303742] dark:bg-[#282D36]"><div className="flex items-center justify-between gap-3"><h3 className="text-xs font-bold text-[#24324A] dark:text-[#F4F6FA]">{label}</h3><span className="text-[10px] text-[#737680] dark:text-[#98A2B3]">12 bulan</span></div><div className={`mt-3 flex items-end gap-1 ${compact ? 'h-16' : 'h-28'}`}>{months.map((month) => { const value = Math.max(0, getValue(month)); const height = value > 0 ? Math.max(8, (value / max) * 100) : 3; return <div key={month.key} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1"><div className="relative flex h-full w-full items-end justify-center"><div className={`w-full max-w-4 rounded-t-md ${color} opacity-80 transition group-hover:opacity-100`} style={{ height: `${height}%` }} title={`${month.label}: ${formatValue(value)}`} /></div><span className="text-[9px] text-[#737680] dark:text-[#98A2B3]">{month.label}</span></div>; })}</div></div>;
}

function MetricCard({ icon: Icon, label, value, detail, accent, progress }: { icon: typeof Wallet; label: string; value: string; detail: string; accent: 'green' | 'coral' | 'blue' | 'amber'; progress?: number }) {
  const colors = { green: 'text-[#4F9D78] bg-[#EEF8F3] dark:bg-[#1E392C]', coral: 'text-[#F26B5E] bg-[#FFF0ED] dark:bg-[#3B272B]', blue: 'text-[#3B82F6] bg-[#EEF2F7] dark:bg-[#2A3443]', amber: 'text-[#E6A23C] bg-[#FEF3D6] dark:bg-[#3D321F]' };
  return <article className="rounded-2xl border border-[#E8E8EC] bg-white p-5 shadow-sm dark:border-[#303742] dark:bg-[#20242C]"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-wide text-[#737680] dark:text-[#98A2B3]">{label}</p><p className="mt-2 text-2xl font-bold text-[#24324A] dark:text-[#F4F6FA]">{value}</p></div><span className={`rounded-xl p-2 ${colors[accent]}`}><Icon className="h-5 w-5" /></span></div><p className="mt-2 text-[11px] text-[#737680] dark:text-[#98A2B3]">{detail}</p>{progress !== undefined && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#EEF2F7] dark:bg-[#2A3340]"><div className="h-full rounded-full bg-[#F26B5E]" style={{ width: `${progress}%` }} /></div>}</article>;
}

function BusinessStat({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return <div className="rounded-xl border border-[#E8E8EC] bg-[#F7F7F8] p-4 dark:border-[#303742] dark:bg-[#282D36]"><p className="text-[11px] font-bold uppercase tracking-wide text-[#737680] dark:text-[#98A2B3]">{label}</p><p className="mt-2 text-xl font-bold text-[#24324A] dark:text-[#F4F6FA]">{value}</p>{detail && <p className="mt-1 text-[11px] text-[#737680] dark:text-[#98A2B3]">{detail}</p>}</div>;
}

function Modal({ title, children, onClose, wide = false }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#24324A]/45 p-4" role="dialog" aria-modal="true" aria-label={title}>
    <div className={`max-h-[90vh] w-full ${wide ? 'max-w-5xl' : 'max-w-2xl'} overflow-y-auto rounded-2xl border border-[#E8E8EC] bg-white shadow-2xl dark:border-[#303742] dark:bg-[#20242C]`}>
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
