'use client';

import React, { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BadgeDollarSign,
  CalendarDays,
  Check,
  ChevronDown,
  Download,
  FileText,
  ImagePlus,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
  Wallet,
  X,
} from 'lucide-react';
import { EditorAccordion } from '@/components/ui/EditorAccordion';
import { isSuperuserEmail } from '@/lib/auth/app-role';

type SalarySetting = {
  user_email: string;
  display_name: string;
  minimum_salary: number;
  monthly_capacity_hours: number;
  hourly_rate: number;
};

type TeamMember = {
  id?: string;
  username?: string;
  email?: string;
  profilePicture?: string;
  role?: string;
  division?: string;
};

type PayrollSource = {
  salaries: SalarySetting[];
  operational: {
    tasks: any[];
    attendanceLogs: any[];
  };
};

type PayrollRow = {
  member: TeamMember;
  email: string;
  name: string;
  profilePicture: string;
  role: string;
  division: string;
  openTasks: number;
  trackedHours: number;
  capacity: number;
  loadIndex: number;
  estimatedSalary: number;
  attendanceDays: number;
  config: SalarySetting;
};

type LineItem = {
  id: string;
  label: string;
  amount: number;
};

type SalarySlipBranding = {
  company_name: string;
  company_address: string;
  company_email: string;
  company_phone: string;
  logo_url: string;
  footer_text: string;
  currency: string;
};

type SalarySlip = {
  id: string;
  month_key: string;
  user_email: string;
  display_name: string;
  employee_role: string;
  department: string;
  slip_number: string;
  base_salary: number;
  attendance_days: number;
  worked_hours: number;
  overtime_hours: number;
  overtime_rate: number;
  allowances: LineItem[];
  deductions: LineItem[];
  status: 'draft' | 'issued' | 'paid';
  payment_date: string;
  notes: string;
};

const DEFAULT_BRANDING: SalarySlipBranding = {
  company_name: 'Bilik Strategi',
  company_address: 'Tuliskan alamat bisnis Anda',
  company_email: 'hello@bilikstrategi.com',
  company_phone: '',
  logo_url: '/landscape.png',
  footer_text: 'Slip gaji ini bersifat rahasia dan hanya ditujukan untuk penerima yang tercantum.',
  currency: 'IDR',
};

function currentMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function toText(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : value == null ? fallback : String(value);
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function memberEmail(member: TeamMember) {
  return toText(member.email).trim().toLowerCase() || `${toText(member.username, 'member').toLowerCase().replace(/\s+/g, '.')}@workspace.local`;
}

function memberName(member: TeamMember) {
  return toText(member.username, member.email?.split('@')[0] || 'Team Member');
}

function isCompletedTask(task: any) {
  const status = toText(task?.status).toLowerCase();
  return status.includes('complete') || status.includes('closed') || status.includes('done');
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

function formatDate(value: string) {
  if (!value) return '-';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
}

function formatMonth(value: string) {
  const date = new Date(`${value}-01T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(date);
}

function generateSlipNumber(month: string, email: string) {
  const suffix = email.split('@')[0].replace(/[^a-z0-9]/gi, '').slice(0, 12).toUpperCase() || 'MEMBER';
  return `SLIP/${month.replace('-', '')}/${suffix}`;
}

function cleanLineItems(value: unknown): LineItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    return {
      id: toText(row.id, `line-${index}-${Date.now()}`),
      label: toText(row.label || row.description),
      amount: Math.max(0, toNumber(row.amount)),
    };
  });
}

function normalizeBranding(value: unknown): SalarySlipBranding {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    company_name: toText(source.company_name, DEFAULT_BRANDING.company_name),
    company_address: toText(source.company_address, DEFAULT_BRANDING.company_address),
    company_email: toText(source.company_email, DEFAULT_BRANDING.company_email),
    company_phone: toText(source.company_phone, DEFAULT_BRANDING.company_phone),
    logo_url: toText(source.logo_url, DEFAULT_BRANDING.logo_url),
    footer_text: toText(source.footer_text, DEFAULT_BRANDING.footer_text),
    currency: toText(source.currency, DEFAULT_BRANDING.currency),
  };
}

function defaultSlip(row: PayrollRow, month: string): SalarySlip {
  return {
    id: '',
    month_key: `${month}-01`,
    user_email: row.email,
    display_name: row.name,
    employee_role: row.role,
    department: row.division,
    slip_number: generateSlipNumber(month, row.email),
    base_salary: Math.max(0, row.config.minimum_salary),
    attendance_days: row.attendanceDays,
    worked_hours: row.trackedHours,
    overtime_hours: Math.max(0, row.trackedHours - row.capacity),
    overtime_rate: Math.max(0, row.config.hourly_rate),
    allowances: [],
    deductions: [],
    status: 'draft',
    payment_date: '',
    notes: '',
  };
}

function normalizeSlip(value: unknown, row: PayrollRow, month: string): SalarySlip {
  const fallback = defaultSlip(row, month);
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const status = toText(source.status);
  return {
    ...fallback,
    id: toText(source.id),
    month_key: toText(source.month_key, fallback.month_key),
    user_email: toText(source.user_email, fallback.user_email).toLowerCase(),
    display_name: toText(source.display_name, fallback.display_name),
    employee_role: toText(source.employee_role, fallback.employee_role),
    department: toText(source.department, fallback.department),
    slip_number: toText(source.slip_number, fallback.slip_number),
    base_salary: Math.max(0, toNumber(source.base_salary, fallback.base_salary)),
    attendance_days: Math.max(0, toNumber(source.attendance_days, fallback.attendance_days)),
    worked_hours: Math.max(0, toNumber(source.worked_hours, fallback.worked_hours)),
    overtime_hours: Math.max(0, toNumber(source.overtime_hours, fallback.overtime_hours)),
    overtime_rate: Math.max(0, toNumber(source.overtime_rate, fallback.overtime_rate)),
    allowances: cleanLineItems(source.allowances),
    deductions: cleanLineItems(source.deductions),
    status: status === 'issued' || status === 'paid' ? status : 'draft',
    payment_date: toText(source.payment_date),
    notes: toText(source.notes),
  };
}

function compressImage(file: File, maxDimension = 900) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('File gambar tidak dapat dibaca.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('File gambar tidak valid.'));
      image.onload = () => {
        const ratio = Math.min(1, maxDimension / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * ratio));
        canvas.height = Math.max(1, Math.round(image.height * ratio));
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Browser tidak mendukung pemrosesan gambar.'));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(file.type === 'image/png' ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.9));
      };
      image.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

function calculatePayrollRows(source: PayrollSource | null, members: TeamMember[], month: string): PayrollRow[] {
  if (!source) return [];
  const combinedMembers = [...members];
  const existingEmails = new Set(combinedMembers.map(memberEmail));
  source.salaries.forEach((salary) => {
    const email = toText(salary.user_email).toLowerCase();
    if (email && !existingEmails.has(email)) {
      combinedMembers.push({ username: salary.display_name, email });
    }
  });
  const saved = new Map(source.salaries.map((salary) => [toText(salary.user_email).toLowerCase(), salary]));

  return combinedMembers.map((member) => {
    const email = memberEmail(member);
    const name = memberName(member);
    const config = saved.get(email) || {
      user_email: email,
      display_name: name,
      minimum_salary: 0,
      monthly_capacity_hours: 160,
      hourly_rate: 0,
    };
    const assignedTasks = source.operational.tasks.filter((task) => {
      const names = Array.isArray(task.assignee_names) ? task.assignee_names.map((value: unknown) => toText(value).toLowerCase()) : [];
      const ids = Array.isArray(task.assignee_ids) ? task.assignee_ids.map((value: unknown) => toText(value)) : [];
      return ids.includes(toText(member.id)) || names.some((value: string) => value.includes(name.toLowerCase()));
    });
    const logs = source.operational.attendanceLogs.filter((log) => {
      if (toText(log.date || log.attendance_date).slice(0, 7) !== month) return false;
      const logName = toText(log.user_name || log.full_name || log.email).toLowerCase();
      return logName.includes(name.toLowerCase()) || logName === email;
    });
    const attendanceHours = logs.reduce(
      (sum, log) => sum + toNumber(log.regular_hours ?? log.hours_worked ?? log.total_hours) + toNumber(log.overtime_hours),
      0,
    );
    const taskHours = assignedTasks.reduce((sum, task) => sum + toNumber(task.time_tracked_hours), 0);
    const trackedHours = attendanceHours || taskHours;
    const capacity = Math.max(1, toNumber(config.monthly_capacity_hours, 160));
    const openTasks = assignedTasks.filter((task) => !isCompletedTask(task)).length;
    const loadIndex = Math.max(trackedHours / capacity, openTasks / 8);
    const overtimeHours = Math.max(0, trackedHours - capacity);

    return {
      member,
      email,
      name,
      profilePicture: toText(member.profilePicture),
      role: toText(member.role, 'Agency Team Member'),
      division: toText(member.division, 'Agency Team'),
      openTasks,
      trackedHours,
      capacity,
      loadIndex,
      estimatedSalary: Math.max(0, toNumber(config.minimum_salary)) + overtimeHours * Math.max(0, toNumber(config.hourly_rate)),
      attendanceDays: new Set(logs.map((log) => toText(log.date || log.attendance_date))).size,
      config,
    };
  });
}

export default function OwnerSalarySlipsPage() {
  const [access, setAccess] = useState<'checking' | 'allowed' | 'denied'>('checking');
  const [month, setMonth] = useState(currentMonth);
  const [source, setSource] = useState<PayrollSource | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [branding, setBranding] = useState<SalarySlipBranding>(DEFAULT_BRANDING);
  const [slips, setSlips] = useState<Record<string, SalarySlip>>({});
  const [selectedEmail, setSelectedEmail] = useState('');
  const [draft, setDraft] = useState<SalarySlip | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const previewRef = useRef<HTMLDivElement>(null);

  const payrollRows = useMemo(() => calculatePayrollRows(source, teamMembers, month), [source, teamMembers, month]);
  const selectedRow = useMemo(() => payrollRows.find((row) => row.email === selectedEmail) || payrollRows[0], [payrollRows, selectedEmail]);

  const loadData = useCallback(async (selectedMonth: string) => {
    setIsLoading(true);
    setError('');
    try {
      const [financeResponse, membersResponse, slipsResponse] = await Promise.all([
        fetch(`/api/owner/finance?month=${encodeURIComponent(selectedMonth)}`, { cache: 'no-store' }),
        fetch('/api/clickup/teams', { cache: 'no-store' }).catch(() => null),
        fetch(`/api/owner/salary-slips?month=${encodeURIComponent(selectedMonth)}`, { cache: 'no-store' }),
      ]);
      const financePayload = await financeResponse.json().catch(() => ({}));
      const slipsPayload = await slipsResponse.json().catch(() => ({}));
      if (financeResponse.status === 403 || slipsResponse.status === 403) {
        setAccess('denied');
        return;
      }
      if (!financeResponse.ok) throw new Error(financePayload.error || 'Data payroll belum dapat dibaca.');
      if (!slipsResponse.ok) throw new Error(slipsPayload.error || 'Data slip gaji belum dapat dibaca. Jalankan migration-nya di Supabase.');

      const membersPayload = membersResponse?.ok ? await membersResponse.json().catch(() => ({})) : {};
      const members = Array.isArray(membersPayload.members) ? membersPayload.members : [];
      const nextSource: PayrollSource = {
        salaries: Array.isArray(financePayload.salaries) ? financePayload.salaries : [],
        operational: {
          tasks: Array.isArray(financePayload.operational?.tasks) ? financePayload.operational.tasks : [],
          attendanceLogs: Array.isArray(financePayload.operational?.attendanceLogs) ? financePayload.operational.attendanceLogs : [],
        },
      };
      const nextSlips: Record<string, SalarySlip> = {};
      (Array.isArray(slipsPayload.slips) ? slipsPayload.slips : []).forEach((slip: unknown) => {
        const email = toText((slip as any)?.user_email).toLowerCase();
        if (email) nextSlips[email] = slip as SalarySlip;
      });
      setSource(nextSource);
      setTeamMembers(members);
      setBranding(normalizeBranding(slipsPayload.branding));
      setSlips(nextSlips);
      setSelectedEmail((current) => current || Object.keys(nextSlips)[0] || '');
      setAccess('allowed');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Data slip gaji gagal dimuat.');
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
        if (!cancelled) setAccess(isSuperuserEmail(email) && email === 'snllabsarchive@gmail.com' ? 'allowed' : 'denied');
      } catch {
        if (!cancelled) setAccess('denied');
      }
    }
    authorize();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (access === 'allowed') loadData(month);
  }, [access, loadData, month]);

  useEffect(() => {
    if (!selectedRow) {
      setDraft(null);
      return;
    }
    setSelectedEmail(selectedRow.email);
    setDraft(normalizeSlip(slips[selectedRow.email], selectedRow, month));
  }, [month, selectedRow, slips]);

  const totals = useMemo(() => {
    const current = draft || (selectedRow ? defaultSlip(selectedRow, month) : null);
    if (!current) return { allowances: 0, deductions: 0, overtime: 0, gross: 0, net: 0 };
    const allowances = current.allowances.reduce((sum, item) => sum + Math.max(0, toNumber(item.amount)), 0);
    const deductions = current.deductions.reduce((sum, item) => sum + Math.max(0, toNumber(item.amount)), 0);
    const overtime = Math.max(0, current.overtime_hours) * Math.max(0, current.overtime_rate);
    const gross = Math.max(0, current.base_salary) + overtime + allowances;
    return { allowances, deductions, overtime, gross, net: Math.max(0, gross - deductions) };
  }, [draft, month, selectedRow]);

  const updateDraft = <K extends keyof SalarySlip>(field: K, value: SalarySlip[K]) => {
    setDraft((current) => current ? { ...current, [field]: value } : current);
  };

  const updateLine = (type: 'allowances' | 'deductions', id: string, field: keyof LineItem, value: string) => {
    setDraft((current) => current ? {
      ...current,
      [type]: current[type].map((item) => item.id === id ? { ...item, [field]: field === 'amount' ? Math.max(0, toNumber(value)) : value } : item),
    } : current);
  };

  const addLine = (type: 'allowances' | 'deductions') => {
    setDraft((current) => current ? {
      ...current,
      [type]: [...current[type], { id: `line-${Date.now()}`, label: type === 'allowances' ? 'Tunjangan baru' : 'Potongan baru', amount: 0 }],
    } : current);
  };

  const removeLine = (type: 'allowances' | 'deductions', id: string) => {
    setDraft((current) => current ? { ...current, [type]: current[type].filter((item) => item.id !== id) } : current);
  };

  const post = async (body: Record<string, unknown>, successMessage: string) => {
    setIsSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/owner/salary-slips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 403) {
        setAccess('denied');
        throw new Error('Sesi owner tidak valid. Silakan login kembali.');
      }
      if (!response.ok) throw new Error(payload.error || 'Data slip gagal disimpan.');
      setNotice(successMessage);
      await loadData(month);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Data slip gagal disimpan.');
    } finally {
      setIsSaving(false);
    }
  };

  const saveBranding = () => post({ action: 'save_branding', ...branding }, 'Branding slip gaji tersimpan.');

  const saveSlip = () => {
    if (!draft || !selectedRow) return;
    post({ action: 'save_slip', month, ...draft, user_email: selectedRow.email, display_name: selectedRow.name }, `Slip gaji ${selectedRow.name} tersimpan.`);
  };

  const handleLogoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Logo harus berupa file gambar.');
      return;
    }
    setIsUploading(true);
    setError('');
    try {
      const logoUrl = await compressImage(file);
      setBranding((current) => ({ ...current, logo_url: logoUrl }));
      setNotice('Logo siap digunakan. Klik Simpan branding agar tersimpan.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Logo gagal diproses.');
    } finally {
      setIsUploading(false);
    }
  };

  const exportPdf = async () => {
    const element = previewRef.current;
    if (!element || !draft || !selectedRow) return;
    setIsExporting(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
      const canvas = await html2canvas(element, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#FFFFFF',
        logging: false,
        width: element.scrollWidth,
        height: element.scrollHeight,
        windowWidth: element.scrollWidth,
      });
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
      const imageWidth = canvas.width * ratio;
      const imageHeight = canvas.height * ratio;
      pdf.addImage(canvas.toDataURL('image/png', 1), 'PNG', (pageWidth - imageWidth) / 2, 0, imageWidth, imageHeight, undefined, 'FAST');
      pdf.save(`${draft.slip_number || `slip-gaji-${month}`}.pdf`);
      setNotice('PDF slip gaji HD berhasil dibuat.');
    } catch (exportError) {
      console.error('[SalarySlips] PDF export failed:', exportError);
      window.print();
      setNotice('Export HD tidak tersedia di browser ini. Dialog cetak dibuka sebagai fallback PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  if (access === 'checking') {
    return <main className="flex min-h-full items-center justify-center p-8 text-[#737680]"><Loader2 className="h-6 w-6 animate-spin" /></main>;
  }

  if (access === 'denied') {
    return (
      <main className="flex min-h-full items-center justify-center bg-[#F7F7F8] p-6 dark:bg-[#171A20]">
        <section className="w-full max-w-lg rounded-2xl border border-[#E8E8EC] bg-white p-8 text-center shadow-sm dark:border-[#303742] dark:bg-[#20242C]">
          <ShieldCheck className="mx-auto mb-4 h-10 w-10 text-[#F26B5E]" />
          <h1 className="text-xl font-bold text-[#24324A] dark:text-[#F4F6FA]">Halaman Owner</h1>
          <p className="mt-2 text-sm leading-6 text-[#737680] dark:text-[#98A2B3]">Slip gaji hanya tersedia untuk owner utama.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-full bg-[#F7F7F8] px-4 py-5 dark:bg-[#171A20] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <header className="flex flex-col gap-4 border-b border-[#E8E8EC] pb-5 dark:border-[#303742] lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.16em] text-[#F26B5E]"><BadgeDollarSign className="h-4 w-4" /> Owner Payroll</div>
            <h1 className="mt-2 text-2xl font-bold text-[#24324A] dark:text-[#F4F6FA] sm:text-3xl">Slip Gaji</h1>
            <p className="mt-1 max-w-2xl text-sm text-[#737680] dark:text-[#98A2B3]">Buat slip gaji otomatis per anggota berdasarkan payroll, jam kerja, dan penyesuaian owner.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-bold text-[#737680] dark:text-[#98A2B3]" htmlFor="salary-month">Periode</label>
            <input id="salary-month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="rounded-xl border border-[#E8E8EC] bg-white px-3 py-2 text-sm text-[#24324A] dark:border-[#303742] dark:bg-[#20242C] dark:text-[#F4F6FA]" />
            <button type="button" onClick={() => loadData(month)} title="Muat ulang slip gaji" className="inline-flex items-center gap-2 rounded-xl border border-[#E8E8EC] bg-white px-3 py-2 text-xs font-bold text-[#24324A] hover:border-[#F26B5E] dark:border-[#303742] dark:bg-[#20242C] dark:text-[#F4F6FA]"><RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh</button>
            <button type="button" onClick={exportPdf} disabled={!draft || isExporting} title="Export slip gaji PDF HD" className="inline-flex items-center gap-2 rounded-xl bg-[#F26B5E] px-3.5 py-2 text-xs font-extrabold text-white hover:opacity-90 disabled:opacity-50"><Download className="h-4 w-4" />{isExporting ? 'Membuat PDF...' : 'Export PDF HD'}</button>
          </div>
        </header>

        {error && <div className="rounded-xl border border-[#F26B5E]/30 bg-[#FFF0ED] px-4 py-3 text-sm text-[#B5473D] dark:border-[#F26B5E]/40 dark:bg-[#3B272B] dark:text-[#EF7373]">{error}</div>}
        {notice && <div className="rounded-xl border border-[#4F9D78]/30 bg-[#EEF8F3] px-4 py-3 text-sm text-[#317A58] dark:border-[#4F9D78]/40 dark:bg-[#1E392C] dark:text-[#62B58D]">{notice}</div>}

        {isLoading && !source ? (
          <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-[#E8E8EC] bg-white dark:border-[#303742] dark:bg-[#20242C]"><Loader2 className="h-7 w-7 animate-spin text-[#F26B5E]" /></div>
        ) : (
          <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(360px,520px)_minmax(640px,1fr)]">
            <section className="salary-slip-editor min-w-0 self-start rounded-xl border border-[#E8E8EC] bg-white shadow-sm dark:border-[#303742] dark:bg-[#20242C]">
              <div className="flex items-center justify-between border-b border-[#E8E8EC] px-5 py-4 dark:border-[#303742]"><div><h2 className="text-sm font-extrabold text-[#24324A] dark:text-[#F4F6FA]">Editor Slip Gaji</h2><p className="mt-0.5 text-[11px] text-[#737680] dark:text-[#98A2B3]">Semua perubahan tampil langsung pada preview.</p></div><Wallet className="h-5 w-5 text-[#F26B5E]" /></div>
              <div className="max-h-[calc(100vh-220px)] space-y-6 overflow-y-auto p-5 pb-12">
                <EditorAccordion title="Anggota & Periode" icon={<UserRound className="h-4 w-4 text-[#F26B5E]" />} defaultOpen>
                  {payrollRows.length === 0 ? <p className="rounded-lg bg-[#F7F7F8] p-3 text-xs text-[#737680] dark:bg-[#282D36] dark:text-[#98A2B3]">Belum ada anggota payroll yang terbaca.</p> : <>
                    <label className="block"><span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[#737680] dark:text-[#98A2B3]">Pilih anggota</span><div className="relative"><select value={selectedRow?.email || ''} onChange={(event) => setSelectedEmail(event.target.value)} className="w-full appearance-none rounded-xl border border-[#E8E8EC] bg-white px-3 py-2.5 pr-9 text-sm text-[#24324A] outline-none focus:border-[#F26B5E] dark:border-[#303742] dark:bg-[#171A20] dark:text-[#F4F6FA]"><option value="" disabled>Pilih anggota</option>{payrollRows.map((row) => <option key={row.email} value={row.email}>{row.name} - {row.email}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-[#737680]" /></div></label>
                    {selectedRow && <div className="flex items-center gap-3 rounded-xl border border-[#E8E8EC] bg-[#F7F7F8] p-3 dark:border-[#303742] dark:bg-[#282D36]">{selectedRow.profilePicture ? <img src={selectedRow.profilePicture} alt="" className="h-10 w-10 rounded-full object-cover" /> : <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#24324A] text-sm font-bold text-white">{selectedRow.name.slice(0, 2).toUpperCase()}</div>}<div className="min-w-0"><p className="truncate text-sm font-bold text-[#24324A] dark:text-[#F4F6FA]">{selectedRow.name}</p><p className="truncate text-[11px] text-[#737680] dark:text-[#98A2B3]">{selectedRow.role} · {selectedRow.division}</p></div><span className="ml-auto rounded-full bg-[#EEF8F3] px-2 py-1 text-[10px] font-bold text-[#317A58]">{formatMonth(month)}</span></div>}
                  </>}
                </EditorAccordion>

                <EditorAccordion title="Branding Slip" icon={<ImagePlus className="h-4 w-4 text-[#F26B5E]" />} action={<button type="button" onClick={saveBranding} disabled={isSaving} className="inline-flex shrink-0 items-center gap-1 rounded-md py-1 text-[11px] font-bold text-[#F26B5E] hover:text-[#B5473D] disabled:opacity-50"><Save className="h-3.5 w-3.5" /> Simpan</button>}>
                  <div className="flex items-center gap-3 rounded-lg border border-dashed border-[#CBD3DE] p-3 dark:border-[#46515F]">{branding.logo_url ? <img src={branding.logo_url} alt="Logo slip gaji" className="h-12 w-24 rounded object-contain" /> : <div className="flex h-12 w-24 items-center justify-center rounded bg-[#F7F7F8] text-[#737680] dark:bg-[#282D36]"><ImagePlus className="h-5 w-5" /></div>}<div className="min-w-0 flex-1"><p className="text-xs font-bold text-[#24324A] dark:text-[#F4F6FA]">Logo Bilik Strategi</p><p className="mt-0.5 text-[10px] text-[#737680] dark:text-[#98A2B3]">PNG transparan akan dipertahankan.</p></div><label className="cursor-pointer rounded-lg bg-[#EEF2F7] px-3 py-2 text-[11px] font-bold text-[#24324A] hover:bg-[#E2E9F2] dark:bg-[#2A3340] dark:text-[#F4F6FA]">{isUploading ? 'Proses...' : 'Upload'}<Upload className="ml-1 inline h-3.5 w-3.5" /><input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleLogoUpload} /></label>{branding.logo_url && branding.logo_url !== DEFAULT_BRANDING.logo_url && <button type="button" onClick={() => setBranding((current) => ({ ...current, logo_url: DEFAULT_BRANDING.logo_url }))} title="Gunakan logo default" className="rounded-lg p-2 text-[#D95858] hover:bg-[#FFF0ED]"><X className="h-4 w-4" /></button>}</div>
                  <div className="grid gap-3 sm:grid-cols-2"><Field label="Nama bisnis"><input value={branding.company_name} onChange={(event) => setBranding((current) => ({ ...current, company_name: event.target.value }))} /></Field><Field label="Email bisnis"><input type="email" value={branding.company_email} onChange={(event) => setBranding((current) => ({ ...current, company_email: event.target.value }))} /></Field><Field label="Alamat bisnis" className="sm:col-span-2"><textarea className="min-h-16 resize-y" value={branding.company_address} onChange={(event) => setBranding((current) => ({ ...current, company_address: event.target.value }))} /></Field><Field label="Telepon bisnis"><input value={branding.company_phone} onChange={(event) => setBranding((current) => ({ ...current, company_phone: event.target.value }))} /></Field><Field label="Mata uang"><select value={branding.currency} onChange={(event) => setBranding((current) => ({ ...current, currency: event.target.value }))}><option value="IDR">IDR - Rupiah</option><option value="USD">USD - Dollar</option><option value="SGD">SGD - Singapore Dollar</option><option value="MYR">MYR - Ringgit</option></select></Field><Field label="Footer slip" className="sm:col-span-2"><textarea className="min-h-16 resize-y" value={branding.footer_text} onChange={(event) => setBranding((current) => ({ ...current, footer_text: event.target.value }))} /></Field></div>
                </EditorAccordion>

                <EditorAccordion title="Pendapatan & Kehadiran" icon={<CalendarDays className="h-4 w-4 text-[#F26B5E]" />}>
                  <div className="grid gap-3 sm:grid-cols-2"><Field label="Nomor slip"><input value={draft?.slip_number || ''} onChange={(event) => updateDraft('slip_number', event.target.value)} /></Field><Field label="Status"><select value={draft?.status || 'draft'} onChange={(event) => updateDraft('status', event.target.value as SalarySlip['status'])}><option value="draft">Draft</option><option value="issued">Diterbitkan</option><option value="paid">Dibayar</option></select></Field><Field label="Gaji pokok"><input type="number" min="0" value={draft?.base_salary || 0} onChange={(event) => updateDraft('base_salary', toNumber(event.target.value))} /></Field><Field label="Hari hadir"><input type="number" min="0" step="0.5" value={draft?.attendance_days || 0} onChange={(event) => updateDraft('attendance_days', toNumber(event.target.value))} /></Field><Field label="Jam kerja"><input type="number" min="0" step="0.1" value={draft?.worked_hours || 0} onChange={(event) => updateDraft('worked_hours', toNumber(event.target.value))} /></Field><Field label="Tanggal pembayaran"><input type="date" value={draft?.payment_date || ''} onChange={(event) => updateDraft('payment_date', event.target.value)} /></Field></div>
                  <div className="grid gap-3 sm:grid-cols-2"><Field label="Jam lembur"><input type="number" min="0" step="0.1" value={draft?.overtime_hours || 0} onChange={(event) => updateDraft('overtime_hours', toNumber(event.target.value))} /></Field><Field label="Rate lembur / jam"><input type="number" min="0" value={draft?.overtime_rate || 0} onChange={(event) => updateDraft('overtime_rate', toNumber(event.target.value))} /></Field></div>
                </EditorAccordion>

                <EditorAccordion title="Tunjangan" icon={<Plus className="h-4 w-4 text-[#4F9D78]" />} action={<button type="button" onClick={() => addLine('allowances')} className="inline-flex shrink-0 items-center gap-1 rounded-md py-1 text-[11px] font-bold text-[#4F9D78]"><Plus className="h-3.5 w-3.5" /> Tambah</button>}>
                  <LineItems items={draft?.allowances || []} type="allowances" onChange={updateLine} onRemove={removeLine} />
                </EditorAccordion>

                <EditorAccordion title="Potongan" icon={<Minus className="h-4 w-4 text-[#D95858]" />} action={<button type="button" onClick={() => addLine('deductions')} className="inline-flex shrink-0 items-center gap-1 rounded-md py-1 text-[11px] font-bold text-[#D95858]"><Plus className="h-3.5 w-3.5" /> Tambah</button>}>
                  <LineItems items={draft?.deductions || []} type="deductions" onChange={updateLine} onRemove={removeLine} />
                </EditorAccordion>

                <EditorAccordion title="Catatan & Penutupan" icon={<FileText className="h-4 w-4 text-[#F26B5E]" />}>
                  <Field label="Catatan slip"><textarea className="min-h-24 resize-y" value={draft?.notes || ''} onChange={(event) => updateDraft('notes', event.target.value)} placeholder="Catatan tambahan untuk penerima slip..." /></Field>
                </EditorAccordion>

                <button type="button" onClick={saveSlip} disabled={!draft || isSaving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#24324A] px-4 py-3 text-sm font-extrabold text-white hover:opacity-90 disabled:opacity-50 dark:bg-[#F26B5E]"><Save className="h-4 w-4" /> Simpan Slip Gaji</button>
              </div>
            </section>

            <section className="min-w-0 rounded-xl border border-[#E8E8EC] bg-[#EEF2F7] p-3 shadow-sm dark:border-[#303742] dark:bg-[#20242C]">
              <div className="mb-3 flex items-center justify-between px-1"><div><h2 className="text-sm font-extrabold text-[#24324A] dark:text-[#F4F6FA]">Preview A4</h2><p className="text-[11px] text-[#737680] dark:text-[#98A2B3]">Format siap cetak dan export PDF HD.</p></div><span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[#4F9D78]"><Check className="mr-1 inline h-3 w-3" /> Live preview</span></div>
              <div className="overflow-x-auto rounded-lg border border-[#D7DEE8] bg-[#DDE4ED] p-3 dark:border-[#303742] dark:bg-[#282D36]"><div ref={previewRef} className="salary-slip-print-target mx-auto min-h-[1123px] w-[794px] overflow-hidden bg-white shadow-xl" style={{ color: '#24324A' }}>
                {draft && selectedRow ? <div className="flex min-h-[1123px] flex-col p-[64px]" style={{ fontFamily: 'Inter, Arial, sans-serif' }}>
                  <div className="flex items-start justify-between gap-8 border-b-2 border-[#F26B5E] pb-7"><div className="flex min-w-0 items-start gap-2"><div className="flex h-16 w-16 shrink-0 items-center justify-start">{branding.logo_url ? <img src={branding.logo_url} alt="Logo Bilik Strategi" className="max-h-full max-w-full object-contain object-left" /> : <span className="text-xs font-bold uppercase tracking-widest opacity-30">Logo</span>}</div><div className="min-w-0"><h3 className="text-xl font-extrabold">{branding.company_name || 'Bilik Strategi'}</h3><p className="mt-2 whitespace-pre-line text-[11px] leading-5 opacity-70">{branding.company_address}</p><p className="text-[11px] opacity-70">{branding.company_email}{branding.company_phone ? ` | ${branding.company_phone}` : ''}</p></div></div><div className="shrink-0 text-right"><h1 className="text-3xl font-black tracking-tight text-[#F26B5E]">SLIP GAJI</h1><p className="mt-2 font-mono text-[11px] font-bold">{draft.slip_number}</p><p className="mt-1 text-[11px] opacity-70">Periode: {formatMonth(month)}</p><p className="text-[11px] opacity-70">Status: {draft.status === 'paid' ? 'Dibayar' : draft.status === 'issued' ? 'Diterbitkan' : 'Draft'}</p></div></div>
                  <div className="mt-9 grid grid-cols-2 gap-8"><div><p className="text-[10px] font-bold uppercase tracking-widest text-[#737680]">Dibayarkan kepada</p><p className="mt-2 text-base font-extrabold">{draft.display_name || selectedRow.name}</p><p className="mt-1 text-[11px] opacity-70">{draft.employee_role || selectedRow.role}</p><p className="text-[11px] opacity-70">{draft.department || selectedRow.division}</p><p className="text-[11px] opacity-70">{draft.user_email}</p></div><div className="text-right"><p className="text-[10px] font-bold uppercase tracking-widest text-[#737680]">Total diterima</p><p className="mt-2 text-2xl font-black text-[#F26B5E]">{formatCurrency(totals.net, branding.currency)}</p><p className="mt-1 text-[11px] opacity-70">{draft.attendance_days} hari hadir · {draft.worked_hours.toFixed(1)} jam</p></div></div>
                  <div className="mt-10"><table className="w-full border-collapse text-left"><thead><tr className="bg-[#FFF0ED]"><th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Komponen</th><th className="w-44 px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider">Nominal</th></tr></thead><tbody><tr className="border-b border-[#E8E8EC]"><td className="px-4 py-4 text-[12px]">Gaji pokok</td><td className="px-4 py-4 text-right text-[12px] font-bold">{formatCurrency(draft.base_salary, branding.currency)}</td></tr><tr className="border-b border-[#E8E8EC]"><td className="px-4 py-4 text-[12px]">Lembur ({draft.overtime_hours} jam × {formatCurrency(draft.overtime_rate, branding.currency)})</td><td className="px-4 py-4 text-right text-[12px] font-bold">{formatCurrency(totals.overtime, branding.currency)}</td></tr>{draft.allowances.map((item) => <tr key={`allowance-${item.id}`} className="border-b border-[#E8E8EC]"><td className="px-4 py-4 text-[12px]">{item.label || 'Tunjangan'}</td><td className="px-4 py-4 text-right text-[12px] font-bold text-[#4F9D78]">+ {formatCurrency(item.amount, branding.currency)}</td></tr>)}{draft.deductions.map((item) => <tr key={`deduction-${item.id}`} className="border-b border-[#E8E8EC]"><td className="px-4 py-4 text-[12px]">{item.label || 'Potongan'}</td><td className="px-4 py-4 text-right text-[12px] font-bold text-[#D95858]">- {formatCurrency(item.amount, branding.currency)}</td></tr>)}</tbody></table></div>
                  <div className="mt-6 flex justify-end"><div className="w-72 space-y-2 text-[11px]"><div className="flex justify-between"><span className="opacity-70">Total pendapatan</span><span>{formatCurrency(totals.gross, branding.currency)}</span></div><div className="flex justify-between"><span className="opacity-70">Total potongan</span><span>- {formatCurrency(totals.deductions, branding.currency)}</span></div><div className="flex justify-between border-t-2 border-[#F26B5E] pt-3 text-base font-black"><span>Take home pay</span><span className="text-[#F26B5E]">{formatCurrency(totals.net, branding.currency)}</span></div></div></div>
                  <div className="mt-auto border-t border-[#E8E8EC] pt-8 text-[11px] leading-5"><div className="flex justify-between gap-8"><div><p className="font-bold">Catatan</p><p className="mt-2 whitespace-pre-line opacity-70">{draft.notes || 'Tidak ada catatan tambahan.'}</p></div><div className="text-right"><p>{draft.payment_date ? `Dibayar pada ${formatDate(draft.payment_date)}` : `Diterbitkan ${formatDate(today())}`}</p><p className="mt-2 font-bold">{branding.company_name}</p></div></div><p className="mt-8 text-center text-[9px] opacity-50">{branding.footer_text}</p></div>
                </div> : <div className="flex min-h-[1123px] items-center justify-center text-sm text-[#737680]">Pilih anggota untuk menampilkan slip gaji.</div>}
              </div></div>
            </section>
          </div>
        )}
      </div>

      <style jsx global>{`@media print { body * { visibility: hidden !important; } .salary-slip-print-target, .salary-slip-print-target * { visibility: visible !important; } .salary-slip-print-target { position: absolute !important; left: 0 !important; top: 0 !important; width: 210mm !important; min-height: 297mm !important; box-shadow: none !important; } }`}</style>
    </main>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  const controlClass = 'w-full rounded-xl border border-[#E8E8EC] bg-white px-3 py-2.5 text-sm text-[#24324A] outline-none focus:border-[#F26B5E] dark:border-[#303742] dark:bg-[#171A20] dark:text-[#F4F6FA]';
  const child = React.isValidElement(children) ? children as React.ReactElement<{ className?: string }> : null;
  const control = child ? React.cloneElement(child, { className: `${controlClass} ${child.props.className || ''}` }) : children;
  return <label className={`block ${className}`}><span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[#737680] dark:text-[#98A2B3]">{label}</span>{control}</label>;
}

function LineItems({ items, type, onChange, onRemove }: { items: LineItem[]; type: 'allowances' | 'deductions'; onChange: (type: 'allowances' | 'deductions', id: string, field: keyof LineItem, value: string) => void; onRemove: (type: 'allowances' | 'deductions', id: string) => void }) {
  if (items.length === 0) return <p className="rounded-lg bg-[#F7F7F8] p-3 text-xs text-[#737680] dark:bg-[#282D36] dark:text-[#98A2B3]">Belum ada komponen {type === 'allowances' ? 'tunjangan' : 'potongan'}.</p>;
  return <div className="space-y-2">{items.map((item) => <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_130px_34px] items-end gap-2 rounded-lg bg-[#F7F7F8] p-2 dark:bg-[#282D36]"><Field label="Keterangan"><input value={item.label} onChange={(event) => onChange(type, item.id, 'label', event.target.value)} /></Field><Field label="Nominal"><input type="number" min="0" value={item.amount} onChange={(event) => onChange(type, item.id, 'amount', event.target.value)} /></Field><button type="button" onClick={() => onRemove(type, item.id)} title="Hapus komponen" className="mb-0.5 rounded-lg p-2 text-[#D95858] hover:bg-[#FFF0ED]"><Trash2 className="h-4 w-4" /></button></div>)}</div>;
}
