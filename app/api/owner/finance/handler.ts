import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/clickup/users';
import { isSuperuserEmail, normalizeIdentityEmail } from '@/lib/auth/app-role';
import { isSupabaseAdminConfigured, supabaseAdminFetch } from '@/lib/supabase/admin-rest-client';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const WORKSPACE_ID = 'bilik-strategi';
const OWNER_EMAIL = 'snllabsarchive@gmail.com';

type RequestIdentity = { email: string; name: string };

function decodeCookie(value: string | undefined) {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function text(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : value == null ? fallback : String(value).trim();
}

function number(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function percent(value: unknown, fallback = 0) {
  return Math.min(100, Math.max(0, number(value, fallback)));
}

function nullableMoney(value: unknown) {
  if (value === null || value === undefined || text(value) === '') return null;
  return Math.max(0, number(value));
}

function memberShares(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, share]) => [key.trim().toLowerCase().slice(0, 240), percent(share)] as const)
      .filter(([key]) => Boolean(key))
  );
}

function dateOnly(value: unknown, fallback = new Date().toISOString().slice(0, 10)) {
  const candidate = text(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : fallback;
}

async function getRequestIdentity(req: NextRequest): Promise<RequestIdentity> {
  const cookieEmail = normalizeIdentityEmail(decodeCookie(req.cookies.get('clickup_user_email')?.value));
  const cookieName = decodeCookie(req.cookies.get('clickup_user_name')?.value);
  if (cookieEmail) return { email: cookieEmail, name: cookieName || cookieEmail.split('@')[0] };

  const accessToken = req.cookies.get('clickup_access_token')?.value;
  if (accessToken) {
    try {
      const authenticated = await getAuthenticatedUser(accessToken);
      const user = authenticated?.user || {};
      const email = normalizeIdentityEmail(user.email);
      if (email) return { email, name: text(user.username, email.split('@')[0]) };
    } catch {
      // The app session remains the fallback when ClickUp has expired.
    }
  }

  return { email: '', name: cookieName || 'Pengguna' };
}

async function requireOwner(req: NextRequest) {
  const identity = await getRequestIdentity(req);
  const allowed = isSuperuserEmail(identity.email) && identity.email === OWNER_EMAIL;
  return { identity, allowed };
}

function errorResponse(error: unknown, fallback: string, status = 500) {
  const message = error instanceof Error ? error.message : text(error, fallback);
  return NextResponse.json({ error: message || fallback }, { status });
}

async function readRows(path: string) {
  const response = await supabaseAdminFetch(path);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Supabase REST error ${response.status}`);
  }
  const rows = await response.json().catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

async function readOptionalRows(path: string) {
  try {
    return await readRows(path);
  } catch (error) {
    return { rows: [] as any[], warning: error instanceof Error ? error.message : String(error) };
  }
}

async function writeRow(path: string, body: Record<string, unknown>, method = 'POST') {
  const response = await supabaseAdminFetch(path, {
    method,
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Supabase REST error ${response.status}`);
  }
  return response.json().catch(() => []);
}

function monthKey(value: string | null) {
  const candidate = value && /^\d{4}-\d{2}$/.test(value) ? value : new Date().toISOString().slice(0, 7);
  return `${candidate}-01`;
}

export async function GET(req: NextRequest) {
  try {
    const owner = await requireOwner(req);
    if (!owner.allowed) {
      return NextResponse.json({ error: 'Halaman ini hanya dapat dibuka oleh Owner utama workspace.' }, { status: 403 });
    }
    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi di environment server.' }, { status: 503 });
    }

    const selectedMonth = monthKey(new URL(req.url).searchParams.get('month'));
    const workspace = encodeURIComponent(WORKSPACE_ID);
    const month = encodeURIComponent(selectedMonth);
    const selectedYear = selectedMonth.slice(0, 4);
    const nextYear = String(Number(selectedYear) + 1);
    const yearStart = encodeURIComponent(`${selectedYear}-01-01`);
    const nextYearStart = encodeURIComponent(`${nextYear}-01-01`);

    const [settings, entries, salaries, salaryPayments, profitShareSettings, profitabilitySettings, clients, projects, tasks, invoices, quotes, attendanceLogs, activeSessions, projectMeta] = await Promise.all([
      readRows(`app_owner_finance_settings?workspace_id=eq.${workspace}&month_key=eq.${month}&select=*`),
      readRows(`app_owner_finance_entries?workspace_id=eq.${workspace}&order=entry_date.desc,created_at.desc&limit=500&select=*`),
      readRows(`app_owner_salary_settings?workspace_id=eq.${workspace}&order=display_name.asc&select=*`),
      readOptionalRows(`app_owner_salary_payments?workspace_id=eq.${workspace}&month_key=gte.${yearStart}&month_key=lt.${nextYearStart}&order=month_key.desc,paid_date.desc&select=*`),
      readOptionalRows(`app_project_profit_share_settings?workspace_id=eq.${workspace}&month_key=eq.${month}&order=project_name.asc&select=*,allocation_mode,member_share_overrides`),
      readOptionalRows(`app_project_profitability_settings?workspace_id=eq.${workspace}&month_key=eq.${month}&order=project_name.asc&select=*`),
      readOptionalRows('clients?select=*'),
      readOptionalRows('projects?select=*'),
      readOptionalRows('task_cache?select=*&limit=5000'),
      readOptionalRows(`app_invoices?workspace_id=eq.${workspace}&limit=500&select=*`),
      readOptionalRows(`app_quotes?workspace_id=eq.${workspace}&limit=500&select=*`),
      readOptionalRows('attendance_logs?select=*&limit=5000'),
      readOptionalRows('active_sessions?select=*&limit=500'),
      readOptionalRows('project_meta?select=project_id,meta,updated_at&limit=1000'),
    ]);

    const optional = [salaryPayments, profitShareSettings, profitabilitySettings, clients, projects, tasks, invoices, quotes, attendanceLogs, activeSessions, projectMeta];
    const warnings = optional
      .filter((result): result is { rows: any[]; warning: string } => !Array.isArray(result))
      .map((result) => result.warning)
      .filter(Boolean);

    return NextResponse.json(
      {
        workspaceId: WORKSPACE_ID,
        monthKey: selectedMonth,
        settings: settings[0] || {
          workspace_id: WORKSPACE_ID,
          month_key: selectedMonth,
          monthly_revenue_target: 0,
          operational_budget: 0,
          currency: 'IDR',
        },
        entries,
        salaries,
        salaryPayments: Array.isArray(salaryPayments) ? salaryPayments : salaryPayments.rows,
        profitShareSettings: Array.isArray(profitShareSettings) ? profitShareSettings : profitShareSettings.rows,
        profitShareStorageReady: Array.isArray(profitShareSettings),
        operational: {
          clients: Array.isArray(clients) ? clients : clients.rows,
          projects: Array.isArray(projects) ? projects : projects.rows,
          tasks: Array.isArray(tasks) ? tasks : tasks.rows,
          invoices: Array.isArray(invoices) ? invoices : invoices.rows,
          quotes: Array.isArray(quotes) ? quotes : quotes.rows,
          attendanceLogs: Array.isArray(attendanceLogs) ? attendanceLogs : attendanceLogs.rows,
          activeSessions: Array.isArray(activeSessions) ? activeSessions : activeSessions.rows,
          profitabilitySettings: Array.isArray(profitabilitySettings) ? profitabilitySettings : profitabilitySettings.rows,
          projectMeta: Array.isArray(projectMeta) ? projectMeta : projectMeta.rows,
        },
        warnings,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return errorResponse(error, 'Gagal mengambil data finance. Jalankan migration owner finance terlebih dahulu.', 503);
  }
}

export async function POST(req: NextRequest) {
  try {
    const owner = await requireOwner(req);
    if (!owner.allowed) {
      return NextResponse.json({ error: 'Hanya Owner utama yang dapat mengubah data finance dan payroll.' }, { status: 403 });
    }
    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi di environment server.' }, { status: 503 });
    }

    const body = await req.json().catch(() => ({}));
    const action = text(body.action);
    const now = new Date().toISOString();

    if (action === 'save_settings') {
      const month = monthKey(text(body.month));
      const payload = {
        workspace_id: WORKSPACE_ID,
        month_key: month,
        monthly_revenue_target: Math.max(0, number(body.monthly_revenue_target)),
        operational_budget: Math.max(0, number(body.operational_budget)),
        currency: text(body.currency, 'IDR').slice(0, 8),
        created_by_email: owner.identity.email,
        updated_at: now,
      };
      const saved = await writeRow('app_owner_finance_settings?on_conflict=workspace_id,month_key', payload);
      return NextResponse.json({ success: true, settings: Array.isArray(saved) ? saved[0] : saved });
    }

    if (action === 'save_entry') {
      const entryType = text(body.entry_type) === 'expense' ? 'expense' : 'revenue';
      const allowedStatuses = new Set(['deal', 'pending', 'paid', 'cancelled']);
      const status = allowedStatuses.has(text(body.status)) ? text(body.status) : 'pending';
      const payload = {
        ...(text(body.id) ? { id: text(body.id) } : { id: crypto.randomUUID() }),
        workspace_id: WORKSPACE_ID,
        entry_type: entryType,
        status,
        customer_name: text(body.customer_name),
        project_name: text(body.project_name),
        category: text(body.category),
        amount: Math.max(0, number(body.amount)),
        entry_date: dateOnly(body.entry_date),
        notes: text(body.notes),
        created_by_email: owner.identity.email,
        updated_at: now,
      };
      const saved = await writeRow('app_owner_finance_entries?on_conflict=id', payload);
      return NextResponse.json({ success: true, entry: Array.isArray(saved) ? saved[0] : saved });
    }

    if (action === 'save_profit_share_setting') {
      const projectKey = text(body.project_key);
      const projectName = text(body.project_name);
      if (!projectKey || !projectName) {
        return NextResponse.json({ error: 'Project wajib dipilih sebelum menyimpan pembagian profit.' }, { status: 400 });
      }
      const allocationMode = text(body.allocation_mode) === 'manual' ? 'manual' : 'automatic';
      const shareOverrides = memberShares(body.member_share_overrides);
      const shareTotal = Object.values(shareOverrides).reduce((sum, share) => sum + share, 0);
      if (allocationMode === 'manual' && (Object.keys(shareOverrides).length === 0 || Math.abs(shareTotal - 100) > 0.01)) {
        return NextResponse.json({ error: 'Pembagian manual wajib mencantumkan seluruh anggota project dengan total tepat 100%.' }, { status: 400 });
      }
      const payload = {
        workspace_id: WORKSPACE_ID,
        project_key: projectKey.slice(0, 240),
        month_key: monthKey(text(body.month || body.month_key).slice(0, 7)),
        project_name: projectName.slice(0, 240),
        client_name: text(body.client_name).slice(0, 240),
        agreed_service_value: nullableMoney(body.agreed_service_value),
        operational_deduction_percent: percent(body.operational_deduction_percent),
        tax_percent: percent(body.tax_percent),
        other_deduction_amount: Math.max(0, number(body.other_deduction_amount)),
        team_share_percent: percent(body.team_share_percent, 30),
        task_weight_percent: percent(body.task_weight_percent, 40),
        completion_weight_percent: percent(body.completion_weight_percent, 30),
        hours_weight_percent: percent(body.hours_weight_percent, 30),
        allocation_mode: allocationMode,
        member_share_overrides: allocationMode === 'manual' ? shareOverrides : {},
        notes: text(body.notes).slice(0, 2000),
        updated_by_email: owner.identity.email,
        updated_at: now,
      };
      const saved = await writeRow(
        'app_project_profit_share_settings?on_conflict=workspace_id,project_key,month_key',
        payload
      );
      return NextResponse.json({ success: true, setting: Array.isArray(saved) ? saved[0] : saved });
    }

    if (action === 'delete_entry') {
      const id = text(body.id);
      if (!id) return NextResponse.json({ error: 'ID transaksi wajib diisi.' }, { status: 400 });
      const response = await supabaseAdminFetch(`app_owner_finance_entries?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await response.text());
      return NextResponse.json({ success: true });
    }

    if (action === 'save_salary') {
      const email = normalizeIdentityEmail(body.user_email);
      if (!email) return NextResponse.json({ error: 'Email user wajib diisi.' }, { status: 400 });
      const payload = {
        workspace_id: WORKSPACE_ID,
        user_email: email,
        display_name: text(body.display_name, email.split('@')[0]),
        minimum_salary: Math.max(0, number(body.minimum_salary)),
        monthly_capacity_hours: Math.max(1, number(body.monthly_capacity_hours, 160)),
        hourly_rate: Math.max(0, number(body.hourly_rate)),
        updated_at: now,
      };
      const saved = await writeRow('app_owner_salary_settings?on_conflict=workspace_id,user_email', payload);
      return NextResponse.json({ success: true, salary: Array.isArray(saved) ? saved[0] : saved });
    }

    if (action === 'save_salary_payment') {
      const email = normalizeIdentityEmail(body.user_email);
      if (!email) return NextResponse.json({ error: 'Email user wajib diisi.' }, { status: 400 });
      const payload = {
        ...(text(body.id) ? { id: text(body.id) } : { id: crypto.randomUUID() }),
        workspace_id: WORKSPACE_ID,
        month_key: monthKey(text(body.month)),
        user_email: email,
        amount: Math.max(0, number(body.amount)),
        paid_date: dateOnly(body.paid_date),
        payment_method: text(body.payment_method, 'Bank transfer').slice(0, 80),
        bank_name: text(body.bank_name).slice(0, 120),
        account_number: text(body.account_number).slice(0, 80),
        reference_number: text(body.reference_number).slice(0, 120),
        notes: text(body.notes).slice(0, 1000),
        status: 'paid',
        created_by_email: owner.identity.email,
        updated_at: now,
      };
      const saved = await writeRow('app_owner_salary_payments?on_conflict=workspace_id,month_key,user_email', payload);
      return NextResponse.json({ success: true, payment: Array.isArray(saved) ? saved[0] : saved });
    }

    return NextResponse.json({ error: 'Aksi finance tidak dikenali.' }, { status: 400 });
  } catch (error) {
    return errorResponse(error, 'Gagal menyimpan data finance.', 500);
  }
}
