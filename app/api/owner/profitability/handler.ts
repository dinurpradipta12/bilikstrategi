import { NextRequest, NextResponse } from 'next/server';
import { getServerWorkspaceContext } from '@/lib/auth/server-workspace-context';
import { isSupabaseAdminConfigured, supabaseAdminFetch } from '@/lib/supabase/admin-rest-client';
import type { ProjectProfitabilityRow } from '@/lib/profitability/types';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  return NextResponse.json(data, { ...init, headers });
}

function text(value: unknown, fallback = '') {
  return String(value ?? fallback).trim();
}

function number(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function monthValue(value: unknown) {
  const candidate = text(value);
  return /^\d{4}-\d{2}$/.test(candidate) ? candidate : new Date().toISOString().slice(0, 7);
}

function dateValue(value: unknown) {
  const candidate = text(value);
  const match = candidate.match(/^(\d{4}-\d{2})/);
  return match?.[1] || '';
}

function normalizeKey(value: unknown) {
  return text(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function looseMatch(left: unknown, right: unknown) {
  const a = normalizeKey(left);
  const b = normalizeKey(right);
  return Boolean(a && b && (a === b || (a.length >= 5 && b.includes(a)) || (b.length >= 5 && a.includes(b))));
}

function completedTask(task: any) {
  const status = text(task?.status || task?.raw_data?.status?.status || task?.raw_data?.status).toLowerCase();
  return status.includes('complete') || status.includes('closed') || status.includes('done') || status === 'selesai';
}

function taskProjectValues(task: any) {
  const raw = task?.raw_data || {};
  return [
    task?.project_id,
    task?.project_name,
    raw?.project_id,
    raw?.project_name,
    raw?.list?.id,
    raw?.list?.name,
    raw?.folder?.id,
    raw?.folder?.name,
    raw?.space?.id,
    raw?.space?.name,
  ].filter(Boolean);
}

function invoiceTotal(invoice: any) {
  const data = invoice?.data || {};
  if (Number.isFinite(Number(data.total))) return Math.max(0, Number(data.total));
  const items = Array.isArray(data.items) ? data.items : [];
  const subtotal = items.reduce((sum: number, item: any) => {
    return sum + Math.max(0, number(item?.quantity, 1)) * Math.max(0, number(item?.unitPrice ?? item?.unit_price));
  }, 0);
  const discount = subtotal * Math.max(0, number(data.discountPercent ?? data.discount_percent)) / 100;
  const taxable = Math.max(0, subtotal - discount);
  const tax = taxable * Math.max(0, number(data.taxPercent ?? data.tax_percent)) / 100;
  return Math.max(0, taxable + tax);
}

function invoiceMonth(invoice: any) {
  return dateValue(invoice?.data?.invoiceDate || invoice?.data?.issueDate || invoice?.created_at);
}

function attendanceHours(log: any) {
  const direct = number(log?.regular_hours ?? log?.hours_worked ?? log?.total_hours ?? log?.duration_hours);
  return Math.max(0, direct + number(log?.overtime_hours));
}

async function readRows(path: string) {
  const response = await supabaseAdminFetch(path);
  if (!response.ok) throw new Error((await response.text()) || `Supabase REST error ${response.status}`);
  const rows = await response.json().catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

async function readOptional(path: string, label: string) {
  try {
    return { rows: await readRows(path), warning: '' };
  } catch (error) {
    return { rows: [] as any[], warning: `${label}: ${error instanceof Error ? error.message : String(error)}` };
  }
}

function projectFromSources(project: any, clients: Map<string, any>) {
  const client = clients.get(text(project?.client_id));
  return {
    id: text(project?.id || project?.project_id || project?.clickup_list_id || project?.name),
    name: text(project?.name || project?.project_name, 'Project tanpa nama'),
    clientName: text(project?.client_name || client?.company_name || client?.name, 'Internal / belum diatur'),
    status: text(project?.status, 'active'),
  };
}

export async function GET(req: NextRequest) {
  const context = await getServerWorkspaceContext(req);
  if (!context.identity.email) return json({ error: 'Sesi pengguna tidak memiliki identitas email.' }, { status: 401 });
  if (!context.canManage) return json({ error: 'Project Profitability hanya dapat dibuka oleh Owner atau Admin.' }, { status: 403 });
  if (!isSupabaseAdminConfigured()) return json({ error: 'SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi di server.' }, { status: 503 });

  const month = monthValue(new URL(req.url).searchParams.get('month'));
  const workspace = encodeURIComponent(context.workspaceId);
  const monthStart = `${month}-01`;
  const [year, monthNumber] = month.split('-').map(Number);
  const nextMonth = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10);

  try {
    const [settingsResult, projectsResult, clientsResult, tasksResult, invoicesResult, entriesResult, salariesResult, attendanceResult, financeSettingsResult] = await Promise.all([
      readOptional(`app_project_profitability_settings?workspace_id=eq.${workspace}&month_key=eq.${encodeURIComponent(monthStart)}&select=*`, 'Pengaturan profitability'),
      readOptional('projects?select=*&limit=1000', 'Project'),
      readOptional('clients?select=*&limit=1000', 'Client'),
      readOptional('task_cache?select=*&limit=5000', 'Task'),
      readOptional(`app_invoices?workspace_id=eq.${workspace}&select=*&limit=1000`, 'Invoice'),
      readOptional(`app_owner_finance_entries?workspace_id=eq.${workspace}&entry_date=gte.${monthStart}&entry_date=lt.${nextMonth}&select=*&limit=2000`, 'Finance'),
      readOptional(`app_owner_salary_settings?workspace_id=eq.${workspace}&select=*&limit=1000`, 'Rate anggota'),
      readOptional(`attendance_logs?date=gte.${monthStart}&date=lt.${nextMonth}&select=*&limit=5000`, 'Presensi'),
      readOptional(`app_owner_finance_settings?workspace_id=eq.${workspace}&month_key=eq.${encodeURIComponent(monthStart)}&select=*&limit=1`, 'Mata uang'),
    ]);

    const warnings = [settingsResult, projectsResult, clientsResult, tasksResult, invoicesResult, entriesResult, salariesResult, attendanceResult, financeSettingsResult]
      .map((result) => result.warning).filter(Boolean);
    const settingsMissing = settingsResult.warning.includes('app_project_profitability_settings') || /schema cache|does not exist/i.test(settingsResult.warning);
    const clients = new Map(clientsResult.rows.map((client: any) => [text(client?.id), client]));
    const projectMap = new Map<string, ReturnType<typeof projectFromSources>>();

    for (const project of projectsResult.rows) {
      const normalized = projectFromSources(project, clients);
      if (normalized.id) projectMap.set(normalized.id, normalized);
    }
    for (const setting of settingsResult.rows) {
      const id = text(setting?.project_id || setting?.project_name);
      if (id && !projectMap.has(id)) {
        projectMap.set(id, {
          id,
          name: text(setting?.project_name, 'Project tanpa nama'),
          clientName: text(setting?.client_name, 'Internal / belum diatur'),
          status: 'active',
        });
      }
    }
    for (const source of [...entriesResult.rows, ...attendanceResult.rows]) {
      const name = text(source?.project_name || source?.selected_project);
      if (!name || normalizeKey(name) === normalizeKey('Bilik Strategi Workspace')) continue;
      const exists = Array.from(projectMap.values()).some((project) => looseMatch(project.name, name));
      if (!exists) projectMap.set(`name:${normalizeKey(name)}`, { id: `name:${normalizeKey(name)}`, name, clientName: text(source?.customer_name, 'Internal / belum diatur'), status: 'active' });
    }

    const projects = Array.from(projectMap.values());
    const settingsByProject = new Map(settingsResult.rows.map((setting: any) => [text(setting?.project_id), setting]));
    const salaryRates = salariesResult.rows.map((salary: any) => ({
      email: normalizeKey(salary?.user_email),
      name: normalizeKey(salary?.display_name),
      rate: number(salary?.hourly_rate) > 0
        ? number(salary?.hourly_rate)
        : Math.max(0, number(salary?.minimum_salary) / Math.max(1, number(salary?.monthly_capacity_hours, 160))),
    }));

    const invoiceAssignments = new Map<string, string>();
    for (const invoice of invoicesResult.rows.filter((item: any) => invoiceMonth(item) === month && ['sent', 'paid'].includes(text(item?.status).toLowerCase()))) {
      const data = invoice?.data || {};
      const projectHint = text(data.projectName || data.project_name || data.project);
      let match = projectHint ? projects.find((project) => looseMatch(project.id, projectHint) || looseMatch(project.name, projectHint)) : undefined;
      if (!match) {
        const clientName = text(data.clientName || data.client_name);
        const clientMatches = projects.filter((project) => looseMatch(project.clientName, clientName));
        if (clientMatches.length === 1) match = clientMatches[0];
      }
      if (match) invoiceAssignments.set(text(invoice?.id || invoice?.invoice_number), match.id);
    }

    const today = new Date().toISOString();
    const rows: ProjectProfitabilityRow[] = projects.map((project) => {
      const setting = settingsByProject.get(project.id) || {};
      const projectEntries = entriesResult.rows.filter((entry: any) => looseMatch(entry?.project_name, project.name) || looseMatch(entry?.project_name, project.id));
      const financeRevenue = projectEntries.filter((entry: any) => entry?.entry_type === 'revenue' && entry?.status !== 'cancelled').reduce((sum: number, entry: any) => sum + Math.max(0, number(entry?.amount)), 0);
      const financeExpense = projectEntries.filter((entry: any) => entry?.entry_type === 'expense' && entry?.status !== 'cancelled').reduce((sum: number, entry: any) => sum + Math.max(0, number(entry?.amount)), 0);
      const invoiceRevenue = invoicesResult.rows
        .filter((invoice: any) => invoiceMonth(invoice) === month && text(invoice?.status).toLowerCase() === 'paid' && invoiceAssignments.get(text(invoice?.id || invoice?.invoice_number)) === project.id)
        .reduce((sum: number, invoice: any) => sum + invoiceTotal(invoice), 0);
      const hasRevenueOverride = setting?.revenue_override !== null && setting?.revenue_override !== undefined;
      const revenue = hasRevenueOverride ? Math.max(0, number(setting.revenue_override)) : financeRevenue > 0 ? financeRevenue : invoiceRevenue;
      const revenueSource: ProjectProfitabilityRow['revenue_source'] = hasRevenueOverride ? 'override' : financeRevenue > 0 ? 'finance' : invoiceRevenue > 0 ? 'invoice' : 'none';

      const attendance = attendanceResult.rows.filter((log: any) => looseMatch(log?.project_name || log?.selected_project, project.name) || looseMatch(log?.project_name, project.id));
      let laborHours = 0;
      let laborCostCalculated = 0;
      for (const log of attendance) {
        const hours = attendanceHours(log);
        const identity = normalizeKey(log?.email || log?.user_email || log?.user_name || log?.full_name);
        const salary = salaryRates.find((item) => item.email === identity || item.name === identity || (item.name.length >= 4 && identity.includes(item.name)));
        laborHours += hours;
        laborCostCalculated += hours * (salary?.rate || 0);
      }
      const hasLaborOverride = setting?.labor_cost_override !== null && setting?.labor_cost_override !== undefined;
      const laborCost = hasLaborOverride ? Math.max(0, number(setting.labor_cost_override)) : laborCostCalculated;
      const externalCost = Math.max(0, number(setting?.external_cost));
      const totalCost = laborCost + externalCost + financeExpense;
      const profit = revenue - totalCost;
      const margin = revenue > 0 ? (profit / revenue) * 100 : totalCost > 0 ? -100 : 0;
      const budget = Math.max(0, number(setting?.budget));
      const projectTasks = tasksResult.rows.filter((task: any) => taskProjectValues(task).some((value) => looseMatch(value, project.id) || looseMatch(value, project.name)));
      const tasksCompleted = projectTasks.filter(completedTask).length;
      const tasksOverdue = projectTasks.filter((task: any) => !completedTask(task) && text(task?.due_date) && text(task?.due_date) < today).length;
      const completion = projectTasks.length ? (tasksCompleted / projectTasks.length) * 100 : 0;
      const health: ProjectProfitabilityRow['health'] = revenue === 0 && totalCost === 0 ? 'watch' : margin >= 30 ? 'healthy' : margin >= 10 ? 'watch' : 'loss';

      return {
        project_id: project.id,
        project_name: project.name,
        client_name: text(setting?.client_name || project.clientName, 'Internal / belum diatur'),
        project_status: project.status,
        budget,
        revenue,
        revenue_override: hasRevenueOverride ? Math.max(0, number(setting.revenue_override)) : null,
        revenue_source: revenueSource,
        invoice_revenue: invoiceRevenue,
        finance_revenue: financeRevenue,
        labor_hours: laborHours,
        labor_cost: laborCost,
        labor_cost_override: hasLaborOverride ? Math.max(0, number(setting.labor_cost_override)) : null,
        labor_cost_calculated: laborCostCalculated,
        external_cost: externalCost,
        finance_expense: financeExpense,
        total_cost: totalCost,
        profit,
        margin_percent: margin,
        budget_variance: budget > 0 ? budget - totalCost : 0,
        tasks_total: projectTasks.length,
        tasks_completed: tasksCompleted,
        tasks_overdue: tasksOverdue,
        completion_percent: completion,
        health,
        notes: text(setting?.notes),
        has_override: hasRevenueOverride || hasLaborOverride || externalCost > 0 || budget > 0,
      };
    }).sort((a, b) => b.revenue - a.revenue || a.project_name.localeCompare(b.project_name));

    const totalRevenue = rows.reduce((sum, row) => sum + row.revenue, 0);
    const totalCost = rows.reduce((sum, row) => sum + row.total_cost, 0);
    const totalProfit = totalRevenue - totalCost;
    return json({
      storage_ready: !settingsMissing,
      month,
      currency: text(financeSettingsResult.rows[0]?.currency, 'IDR'),
      viewer: { email: context.identity.email, name: context.identity.name, role: context.appRole, can_manage: context.canManage },
      summary: {
        revenue: totalRevenue,
        cost: totalCost,
        profit: totalProfit,
        margin_percent: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : totalCost > 0 ? -100 : 0,
        labor_hours: rows.reduce((sum, row) => sum + row.labor_hours, 0),
        healthy_projects: rows.filter((row) => row.health === 'healthy').length,
        at_risk_projects: rows.filter((row) => row.health === 'loss').length,
      },
      projects: rows,
      warnings,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Gagal menghitung profitability.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const context = await getServerWorkspaceContext(req);
  if (!context.identity.email) return json({ error: 'Sesi pengguna tidak memiliki identitas email.' }, { status: 401 });
  if (!context.canManage) return json({ error: 'Hanya Owner atau Admin yang dapat mengubah profitability.' }, { status: 403 });
  if (!isSupabaseAdminConfigured()) return json({ error: 'SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi di server.' }, { status: 503 });

  try {
    const body = await req.json().catch(() => ({}));
    if (text(body.action) !== 'save_settings') return json({ error: 'Aksi profitability tidak dikenali.' }, { status: 400 });
    const projectId = text(body.project_id).slice(0, 240);
    const projectName = text(body.project_name).slice(0, 300);
    if (!projectId || !projectName) return json({ error: 'Project wajib dipilih.' }, { status: 400 });
    const month = monthValue(body.month);
    const nullableNumber = (value: unknown) => value === '' || value === null || value === undefined ? null : Math.max(0, number(value));
    const payload = {
      workspace_id: context.workspaceId,
      project_id: projectId,
      month_key: `${month}-01`,
      project_name: projectName,
      client_name: text(body.client_name).slice(0, 300),
      budget: Math.max(0, number(body.budget)),
      revenue_override: nullableNumber(body.revenue_override),
      labor_cost_override: nullableNumber(body.labor_cost_override),
      external_cost: Math.max(0, number(body.external_cost)),
      notes: text(body.notes).slice(0, 5000),
      updated_by_email: context.identity.email,
      updated_at: new Date().toISOString(),
    };
    const response = await supabaseAdminFetch(
      'app_project_profitability_settings?on_conflict=workspace_id,project_id,month_key',
      {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(payload),
      }
    );
    if (!response.ok) throw new Error(await response.text());
    const rows = await response.json().catch(() => []);
    return json({ success: true, setting: Array.isArray(rows) ? rows[0] : rows });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Gagal menyimpan pengaturan project.' }, { status: 400 });
  }
}
