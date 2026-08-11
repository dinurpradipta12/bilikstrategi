import { NextRequest, NextResponse } from 'next/server';
import { getServerWorkspaceContext } from '@/lib/auth/server-workspace-context';
import { isSupabaseAdminConfigured, supabaseAdminFetch } from '@/lib/supabase/admin-rest-client';
import {
  automationLocalClock,
  automationScheduleReady,
  executeAutomationRule,
} from '@/lib/automations/server';
import type {
  AutomationAudience,
  AutomationRule,
  AutomationTemplate,
  AutomationTriggerType,
} from '@/lib/automations/types';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const TRIGGERS: AutomationTriggerType[] = ['missing_checkout', 'daily_incomplete', 'task_overdue', 'invoice_due', 'kpi_below'];
const AUDIENCES: AutomationAudience[] = ['assignee', 'managers', 'assignee_and_managers'];

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    trigger_type: 'missing_checkout',
    name: 'Pengingat checkout sore',
    description: 'Ingatkan anggota dan manager bila sesi presensi masih aktif setelah jam kerja.',
    conditions: { after_hour: 18 },
    actions: { audience: 'assignee_and_managers' },
    cooldown_minutes: 1440,
  },
  {
    trigger_type: 'daily_incomplete',
    name: 'Daily activity belum lengkap',
    description: 'Ingatkan anggota yang belum mengisi atau menyelesaikan daily activity.',
    conditions: { after_hour: 16, minimum_progress: 100 },
    actions: { audience: 'assignee' },
    cooldown_minutes: 1440,
  },
  {
    trigger_type: 'task_overdue',
    name: 'Task melewati deadline',
    description: 'Kirim pengingat harian untuk task overdue yang belum selesai.',
    conditions: { days_overdue: 0 },
    actions: { audience: 'assignee' },
    cooldown_minutes: 1440,
  },
  {
    trigger_type: 'invoice_due',
    name: 'Invoice segera jatuh tempo',
    description: 'Beri tahu Owner/Admin sebelum invoice sent jatuh tempo.',
    conditions: { days_before: 3 },
    actions: { audience: 'managers' },
    cooldown_minutes: 1440,
  },
  {
    trigger_type: 'kpi_below',
    name: 'KPI harian di bawah target',
    description: 'Ingatkan saat rata-rata progress harian anggota masih di bawah ambang.',
    conditions: { after_hour: 17, threshold: 70 },
    actions: { audience: 'assignee_and_managers' },
    cooldown_minutes: 1440,
  },
];

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

function storageMissing(error: unknown) {
  return /app_automation_(rules|runs)|schema cache|relation .* does not exist/i.test(error instanceof Error ? error.message : String(error));
}

function cleanConditions(trigger: AutomationTriggerType, source: any) {
  const value = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
  if (trigger === 'missing_checkout') return { after_hour: Math.max(0, Math.min(23, number(value.after_hour, 18))) };
  if (trigger === 'daily_incomplete') return { after_hour: Math.max(0, Math.min(23, number(value.after_hour, 16))), minimum_progress: Math.max(0, Math.min(100, number(value.minimum_progress, 100))) };
  if (trigger === 'task_overdue') return { days_overdue: Math.max(0, Math.min(30, number(value.days_overdue, 0))) };
  if (trigger === 'invoice_due') return { days_before: Math.max(0, Math.min(30, number(value.days_before, 3))) };
  return { after_hour: Math.max(0, Math.min(23, number(value.after_hour, 17))), threshold: Math.max(0, Math.min(100, number(value.threshold, 70))) };
}

function rulePayload(body: any, context: Awaited<ReturnType<typeof getServerWorkspaceContext>>) {
  const trigger: AutomationTriggerType = TRIGGERS.includes(body.trigger_type) ? body.trigger_type : 'daily_incomplete';
  const audience: AutomationAudience = AUDIENCES.includes(body?.actions?.audience) ? body.actions.audience : 'assignee';
  const name = text(body.name).slice(0, 200);
  if (!name) throw new Error('Nama automation wajib diisi.');
  return {
    workspace_id: context.workspaceId,
    name,
    description: text(body.description).slice(0, 1000),
    trigger_type: trigger,
    conditions: cleanConditions(trigger, body.conditions),
    actions: { audience },
    enabled: body.enabled === true,
    cooldown_minutes: Math.round(Math.max(5, Math.min(10080, number(body.cooldown_minutes, 1440)))),
    created_by_email: context.identity.email,
    updated_at: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const context = await getServerWorkspaceContext(req);
  if (!context.identity.email) return json({ error: 'Sesi pengguna tidak memiliki identitas email.' }, { status: 401 });
  if (!context.canManage) return json({ error: 'Automation Center hanya dapat dibuka oleh Owner atau Admin.' }, { status: 403 });
  if (!isSupabaseAdminConfigured()) return json({ error: 'SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi di server.' }, { status: 503 });

  try {
    const workspace = encodeURIComponent(context.workspaceId);
    const [rules, runs] = await Promise.all([
      adminJson(`app_automation_rules?workspace_id=eq.${workspace}&select=*&order=created_at.asc`),
      adminJson(`app_automation_runs?workspace_id=eq.${workspace}&select=*&order=created_at.desc&limit=100`),
    ]);
    return json({
      storage_ready: true,
      viewer: { email: context.identity.email, name: context.identity.name, role: context.appRole, can_manage: context.canManage },
      templates: AUTOMATION_TEMPLATES,
      rules: Array.isArray(rules) ? rules : [],
      runs: Array.isArray(runs) ? runs : [],
      runner: { mode: 'active_app', interval_seconds: 60, timezone: 'Asia/Makassar' },
    });
  } catch (error) {
    if (storageMissing(error)) {
      return json({
        storage_ready: false,
        viewer: { email: context.identity.email, name: context.identity.name, role: context.appRole, can_manage: context.canManage },
        templates: AUTOMATION_TEMPLATES,
        rules: [],
        runs: [],
        runner: { mode: 'active_app', interval_seconds: 60, timezone: 'Asia/Makassar' },
        error: 'Migration Automation Center belum dijalankan.',
      });
    }
    return json({ error: error instanceof Error ? error.message : 'Gagal memuat Automation Center.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const context = await getServerWorkspaceContext(req);
  if (!context.identity.email) return json({ error: 'Sesi pengguna tidak memiliki identitas email.' }, { status: 401 });
  if (!isSupabaseAdminConfigured()) return json({ error: 'SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi di server.' }, { status: 503 });

  try {
    const body = await req.json().catch(() => ({}));
    const action = text(body.action);
    const workspace = encodeURIComponent(context.workspaceId);

    if (action === 'run_due') {
      const rows = await adminJson(`app_automation_rules?workspace_id=eq.${workspace}&enabled=eq.true&select=*`);
      const rules: AutomationRule[] = Array.isArray(rows) ? rows : [];
      const clock = automationLocalClock();
      const results: any[] = [];
      for (const rule of rules) {
        if (!automationScheduleReady(rule)) {
          results.push({ rule_id: rule.id, skipped: true, reason: 'before_schedule' });
          continue;
        }
        try {
          results.push({ rule_id: rule.id, ...(await executeAutomationRule({ req, context, rule, runKey: clock.date })) });
        } catch (error) {
          results.push({ rule_id: rule.id, error: error instanceof Error ? error.message : String(error) });
        }
      }
      return json({ success: true, checked: rules.length, results });
    }

    if (!context.canManage) return json({ error: 'Hanya Owner atau Admin yang dapat mengatur automation.' }, { status: 403 });

    if (action === 'create_template') {
      const template = AUTOMATION_TEMPLATES.find((item) => item.trigger_type === body.trigger_type);
      if (!template) return json({ error: 'Template automation tidak ditemukan.' }, { status: 404 });
      const payload = rulePayload({ ...template, enabled: false }, context);
      const existing = await adminJson(`app_automation_rules?workspace_id=eq.${workspace}&trigger_type=eq.${encodeURIComponent(template.trigger_type)}&select=*&limit=1`);
      if (Array.isArray(existing) && existing[0]) return json({ error: 'Template untuk trigger ini sudah ditambahkan.' }, { status: 409 });
      const saved = await adminJson('app_automation_rules', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload) });
      return json({ success: true, rule: Array.isArray(saved) ? saved[0] : saved });
    }

    if (action === 'save_rule') {
      const payload = rulePayload(body, context);
      const id = text(body.id);
      const saved = id
        ? await adminJson(`app_automation_rules?id=eq.${encodeURIComponent(id)}&workspace_id=eq.${workspace}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload) })
        : await adminJson('app_automation_rules', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload) });
      return json({ success: true, rule: Array.isArray(saved) ? saved[0] : saved });
    }

    if (action === 'toggle') {
      const id = text(body.id);
      if (!id) throw new Error('ID automation tidak ditemukan.');
      const saved = await adminJson(`app_automation_rules?id=eq.${encodeURIComponent(id)}&workspace_id=eq.${workspace}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ enabled: body.enabled === true, updated_at: new Date().toISOString() }) });
      return json({ success: true, rule: Array.isArray(saved) ? saved[0] : saved });
    }

    if (action === 'delete') {
      const id = text(body.id);
      if (!id) throw new Error('ID automation tidak ditemukan.');
      await adminJson(`app_automation_rules?id=eq.${encodeURIComponent(id)}&workspace_id=eq.${workspace}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      return json({ success: true });
    }

    if (action === 'run_now') {
      const id = text(body.id);
      const rows = await adminJson(`app_automation_rules?id=eq.${encodeURIComponent(id)}&workspace_id=eq.${workspace}&select=*&limit=1`);
      const rule: AutomationRule | undefined = Array.isArray(rows) ? rows[0] : rows;
      if (!rule) return json({ error: 'Automation tidak ditemukan.' }, { status: 404 });
      const result = await executeAutomationRule({ req, context, rule, runKey: `manual:${Date.now()}` });
      return json({ success: true, result });
    }

    return json({ error: 'Aksi automation tidak dikenali.' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal memproses automation.';
    return json({ error: message }, { status: storageMissing(error) ? 503 : 400 });
  }
}
