import { NextRequest } from 'next/server';
import { normalizeIdentityEmail } from '@/lib/auth/app-role';
import { getWorkspaceManagerEmails, type ServerWorkspaceContext } from '@/lib/auth/server-workspace-context';
import { publishNotification } from '@/lib/notifications/server';
import { supabaseAdminFetch } from '@/lib/supabase/admin-rest-client';
import type { AutomationAudience, AutomationRule } from '@/lib/automations/types';

type Match = {
  key: string;
  recipientEmails: string[];
  title: string;
  message: string;
  entityType: string;
  entityId?: string;
  entityUrl: string;
  payload?: Record<string, unknown>;
};

function text(value: unknown, fallback = '') {
  return String(value ?? fallback).trim();
}

function number(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanEmails(values: unknown[]) {
  return Array.from(new Set(values.map(normalizeIdentityEmail).filter(Boolean)));
}

function completedStatus(value: unknown) {
  const status = text(typeof value === 'object' && value ? (value as any).status : value).toLowerCase();
  return status.includes('complete') || status.includes('closed') || status.includes('done') || status === 'selesai';
}

async function adminJson(path: string, init: RequestInit = {}) {
  const response = await supabaseAdminFetch(path, init);
  const raw = await response.text();
  let parsed: any = null;
  if (raw) {
    try { parsed = JSON.parse(raw); } catch { parsed = raw; }
  }
  if (!response.ok) throw new Error(typeof parsed === 'string' ? parsed : parsed?.message || `Supabase REST error ${response.status}`);
  return parsed;
}

async function optionalRows(path: string) {
  try {
    const rows = await adminJson(path);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export function automationLocalClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Makassar',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return { date: `${value('year')}-${value('month')}-${value('day')}`, hour: Number(value('hour') || 0) };
}

export function automationScheduleReady(rule: AutomationRule, now = new Date()) {
  const clock = automationLocalClock(now);
  const afterHour = Math.max(0, Math.min(23, number(rule.conditions?.after_hour, 0)));
  if (['missing_checkout', 'daily_incomplete', 'kpi_below'].includes(rule.trigger_type) && clock.hour < afterHour) return false;
  return true;
}

function audienceEmails(audience: AutomationAudience, assignees: string[], managers: string[]) {
  if (audience === 'managers') return cleanEmails(managers);
  if (audience === 'assignee_and_managers') return cleanEmails([...assignees, ...managers]);
  return cleanEmails(assignees.length ? assignees : managers);
}

async function peopleDirectory(workspaceId: string) {
  const [profiles, roles] = await Promise.all([
    optionalRows(`app_performance_profiles?workspace_id=eq.${encodeURIComponent(workspaceId)}&active=eq.true&select=user_email,display_name,role_title`),
    optionalRows('app_user_roles?status=eq.active&select=email,display_name,role'),
  ]);
  const values = [...profiles.map((row: any) => ({ email: row.user_email, name: row.display_name, role: row.role_title })), ...roles.map((row: any) => ({ email: row.email, name: row.display_name, role: row.role }))];
  const unique = new Map<string, { email: string; name: string; role: string }>();
  values.forEach((person) => {
    const email = normalizeIdentityEmail(person.email);
    if (email && !unique.has(email)) unique.set(email, { email, name: text(person.name, email.split('@')[0]), role: text(person.role) });
  });
  return Array.from(unique.values());
}

function findPerson(value: unknown, people: Awaited<ReturnType<typeof peopleDirectory>>) {
  const candidate = text(value).toLowerCase();
  if (!candidate) return undefined;
  return people.find((person) => person.email === normalizeIdentityEmail(candidate) || person.name.toLowerCase() === candidate || (person.name.length >= 4 && candidate.includes(person.name.toLowerCase())));
}

async function evaluateMissingCheckout(rule: AutomationRule, workspaceId: string, managers: string[]) {
  const [sessions, people] = await Promise.all([
    optionalRows('active_sessions?select=*&limit=1000'),
    peopleDirectory(workspaceId),
  ]);
  const audience = (rule.actions?.audience || 'assignee_and_managers') as AutomationAudience;
  return sessions.map((session: any): Match => {
    const person = findPerson(session?.user_name || session?.email, people);
    const assignees = person?.email ? [person.email] : [];
    return {
      key: `session:${text(session?.user_name || person?.email)}`,
      recipientEmails: audienceEmails(audience, assignees, managers),
      title: 'Checkout belum dilakukan',
      message: `${person?.name || text(session?.user_name, 'Anggota tim')} masih memiliki sesi presensi aktif. Mohon checkout atau perbarui status kerja.`,
      entityType: 'attendance',
      entityId: text(session?.user_name || person?.email),
      entityUrl: '/attendance',
      payload: { trigger: rule.trigger_type, user_email: person?.email || null },
    };
  }).filter((match: Match) => match.recipientEmails.length > 0);
}

async function evaluateDaily(rule: AutomationRule, workspaceId: string, managers: string[], kpiMode: boolean) {
  const clock = automationLocalClock();
  const [people, updates] = await Promise.all([
    peopleDirectory(workspaceId),
    optionalRows(`app_performance_updates?workspace_id=eq.${encodeURIComponent(workspaceId)}&activity_date=eq.${clock.date}&select=user_email,progress,status,title`),
  ]);
  const threshold = Math.max(0, Math.min(100, number(rule.conditions?.threshold ?? rule.conditions?.minimum_progress, kpiMode ? 70 : 100)));
  const audience = (rule.actions?.audience || 'assignee') as AutomationAudience;
  return people.flatMap((person): Match[] => {
    if (person.role.toLowerCase() === 'client') return [];
    const own = updates.filter((update: any) => normalizeIdentityEmail(update?.user_email) === person.email);
    const average = own.length ? own.reduce((sum: number, update: any) => sum + Math.max(0, Math.min(100, number(update?.progress))), 0) / own.length : 0;
    const incomplete = own.length === 0 || average < threshold || (!kpiMode && own.some((update: any) => !completedStatus(update?.status) && number(update?.progress) < threshold));
    if (!incomplete) return [];
    return [{
      key: `${kpiMode ? 'kpi' : 'daily'}:${person.email}`,
      recipientEmails: audienceEmails(audience, [person.email], managers),
      title: kpiMode ? 'KPI harian di bawah target' : 'Daily activity belum lengkap',
      message: kpiMode
        ? `${person.name} memiliki rata-rata progress ${Math.round(average)}%, di bawah target ${threshold}%.`
        : own.length === 0
          ? `${person.name} belum mengisi daily activity hari ini.`
          : `${person.name} baru mencapai ${Math.round(average)}% dari target daily activity hari ini.`,
      entityType: 'performance',
      entityId: person.email,
      entityUrl: '/performance',
      payload: { trigger: rule.trigger_type, user_email: person.email, progress: average, threshold },
    }];
  });
}

async function evaluateOverdueTasks(rule: AutomationRule, workspaceId: string, managers: string[]) {
  const tasks = await optionalRows('task_cache?select=*&limit=5000');
  const audience = (rule.actions?.audience || 'assignee') as AutomationAudience;
  const now = Date.now();
  const daysOverdue = Math.max(0, number(rule.conditions?.days_overdue, 0));
  return tasks.flatMap((task: any): Match[] => {
    const raw = task?.raw_data || {};
    const due = new Date(task?.due_date || raw?.due_date || 0).getTime();
    if (!due || completedStatus(task?.status || raw?.status) || due + daysOverdue * 86400000 >= now) return [];
    const assignees = cleanEmails([
      ...(Array.isArray(task?.assignee_emails) ? task.assignee_emails : []),
      ...(Array.isArray(raw?.assignee_emails) ? raw.assignee_emails : []),
      ...(Array.isArray(raw?.assignees) ? raw.assignees.map((person: any) => person?.email) : []),
    ]);
    const id = text(task?.clickup_task_id || task?.id);
    return [{
      key: `task:${id}`,
      recipientEmails: audienceEmails(audience, assignees, managers),
      title: 'Task melewati deadline',
      message: `Task "${text(task?.task_name || raw?.name, 'Tanpa nama')}" sudah melewati deadline dan belum selesai.`,
      entityType: 'task',
      entityId: id,
      entityUrl: '/tasks',
      payload: { trigger: rule.trigger_type, due_date: task?.due_date || raw?.due_date || null },
    }];
  }).filter((match: Match) => match.recipientEmails.length > 0);
}

async function evaluateInvoiceDue(rule: AutomationRule, workspaceId: string, managers: string[]) {
  const invoices = await optionalRows(`app_invoices?workspace_id=eq.${encodeURIComponent(workspaceId)}&select=*&limit=1000`);
  const daysBefore = Math.max(0, number(rule.conditions?.days_before, 3));
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const deadline = now.getTime() + daysBefore * 86400000;
  return invoices.flatMap((invoice: any): Match[] => {
    if (!['sent'].includes(text(invoice?.status).toLowerCase())) return [];
    const dueValue = text(invoice?.data?.dueDate || invoice?.data?.due_date);
    const due = new Date(`${dueValue}T00:00:00`).getTime();
    if (!due || due > deadline) return [];
    const id = text(invoice?.id || invoice?.invoice_number);
    const overdue = due < now.getTime();
    return [{
      key: `invoice:${id}`,
      recipientEmails: cleanEmails(managers),
      title: overdue ? 'Invoice melewati jatuh tempo' : 'Invoice segera jatuh tempo',
      message: `${text(invoice?.invoice_number, 'Invoice')} untuk ${text(invoice?.data?.clientName, 'client')} ${overdue ? 'sudah melewati' : 'mendekati'} jatuh tempo ${dueValue}.`,
      entityType: 'invoice',
      entityId: id,
      entityUrl: '/invoices',
      payload: { trigger: rule.trigger_type, due_date: dueValue, overdue },
    }];
  });
}

async function evaluateRule(rule: AutomationRule, workspaceId: string, managers: string[]) {
  if (rule.trigger_type === 'missing_checkout') return evaluateMissingCheckout(rule, workspaceId, managers);
  if (rule.trigger_type === 'daily_incomplete') return evaluateDaily(rule, workspaceId, managers, false);
  if (rule.trigger_type === 'task_overdue') return evaluateOverdueTasks(rule, workspaceId, managers);
  if (rule.trigger_type === 'invoice_due') return evaluateInvoiceDue(rule, workspaceId, managers);
  if (rule.trigger_type === 'kpi_below') return evaluateDaily(rule, workspaceId, managers, true);
  return [];
}

export async function executeAutomationRule(input: {
  req: NextRequest;
  context: Pick<ServerWorkspaceContext, 'workspaceId' | 'identity'>;
  rule: AutomationRule;
  runKey: string;
}) {
  const existing = await optionalRows(`app_automation_runs?rule_id=eq.${encodeURIComponent(input.rule.id)}&run_key=eq.${encodeURIComponent(input.runKey)}&select=id,status&limit=1`);
  if (existing.length > 0) return { skipped: true, reason: 'already_run', run: existing[0] };

  const startedAt = new Date().toISOString();
  const inserted = await adminJson('app_automation_runs', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      rule_id: input.rule.id,
      workspace_id: input.context.workspaceId,
      run_key: input.runKey,
      status: 'running',
      started_at: startedAt,
    }),
  });
  const run = Array.isArray(inserted) ? inserted[0] : inserted;

  try {
    const managers = await getWorkspaceManagerEmails(input.context.workspaceId);
    const matches = await evaluateRule(input.rule, input.context.workspaceId, managers);
    let notifiedCount = 0;
    for (const match of matches) {
      if (match.recipientEmails.length === 0) continue;
      const result = await publishNotification({
        req: input.req,
        workspaceId: input.context.workspaceId,
        actor: { email: input.context.identity.email, name: 'Automation Center' },
        recipientEmails: match.recipientEmails,
        audience: 'explicit',
        type: `automation_${input.rule.trigger_type}`,
        title: match.title,
        message: match.message,
        entityType: match.entityType,
        entityId: match.entityId,
        entityUrl: match.entityUrl,
        payload: { rule_id: input.rule.id, rule_name: input.rule.name, ...(match.payload || {}) },
        dedupeKey: `automation:${input.rule.id}:${input.runKey}:${match.key}`,
      });
      if (result.persisted) notifiedCount += Number(result.recipientCount || 0);
    }
    const completedAt = new Date().toISOString();
    const result = { status: 'success', matched_count: matches.length, notified_count: notifiedCount, completed_at: completedAt, details: { matches: matches.slice(0, 50).map((match) => ({ key: match.key, title: match.title, recipients: match.recipientEmails })) } };
    await adminJson(`app_automation_runs?id=eq.${encodeURIComponent(run.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(result) });
    await adminJson(`app_automation_rules?id=eq.${encodeURIComponent(input.rule.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ last_run_at: completedAt, last_result: result, updated_at: completedAt }) });
    return { skipped: false, run: { ...run, ...result } };
  } catch (error) {
    const completedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message : String(error);
    await adminJson(`app_automation_runs?id=eq.${encodeURIComponent(run.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'failed', completed_at: completedAt, details: { error: message } }) }).catch(() => null);
    await adminJson(`app_automation_rules?id=eq.${encodeURIComponent(input.rule.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ last_run_at: completedAt, last_result: { status: 'failed', error: message }, updated_at: completedAt }) }).catch(() => null);
    throw error;
  }
}
