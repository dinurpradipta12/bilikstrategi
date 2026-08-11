import { NextRequest, NextResponse } from 'next/server';
import { normalizeIdentityEmail } from '@/lib/auth/app-role';
import {
  getServerWorkspaceContext,
  getWorkspaceManagerEmails,
} from '@/lib/auth/server-workspace-context';
import { publishNotification } from '@/lib/notifications/server';
import { isSupabaseAdminConfigured, supabaseAdminFetch } from '@/lib/supabase/admin-rest-client';
import type { ApprovalRequestType, ApprovalStatus } from '@/lib/approvals/types';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const REQUEST_TYPES: ApprovalRequestType[] = ['daily_activity', 'leave', 'overtime', 'deliverable', 'kpi', 'general'];
const REVIEW_STATUSES: ApprovalStatus[] = ['approved', 'revision', 'rejected'];

function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  return NextResponse.json(data, { ...init, headers });
}

function cleanText(value: unknown, fallback = '', maxLength = 5000) {
  return String(value ?? fallback).trim().slice(0, maxLength);
}

function cleanEmail(value: unknown) {
  return normalizeIdentityEmail(value).slice(0, 320);
}

async function adminJson(path: string, init: RequestInit = {}) {
  const response = await supabaseAdminFetch(path, init);
  const text = await response.text();
  let parsed: any = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  if (!response.ok) {
    const message = typeof parsed === 'string'
      ? parsed
      : parsed?.message || parsed?.error_description || parsed?.hint || `Supabase REST error ${response.status}`;
    throw new Error(message);
  }
  return parsed;
}

function storageUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  return /app_approval_requests|schema cache|relation .* does not exist|service_role/i.test(message);
}

export async function GET(req: NextRequest) {
  const context = await getServerWorkspaceContext(req);
  if (!context.identity.email) return json({ error: 'Sesi pengguna tidak memiliki identitas email.' }, { status: 401 });
  if (!isSupabaseAdminConfigured()) {
    return json({
      storage_ready: false,
      viewer: { email: context.identity.email, name: context.identity.name, role: context.appRole, can_manage: context.canManage },
      requests: [],
      error: 'SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi di server.',
    });
  }

  try {
    const workspace = encodeURIComponent(context.workspaceId);
    const ownership = context.canManage ? '' : `&requested_by_email=eq.${encodeURIComponent(context.identity.email)}`;
    const rows = await adminJson(
      `app_approval_requests?select=*&workspace_id=eq.${workspace}${ownership}&order=submitted_at.desc&limit=500`
    );
    return json({
      storage_ready: true,
      viewer: { email: context.identity.email, name: context.identity.name, role: context.appRole, can_manage: context.canManage },
      requests: Array.isArray(rows) ? rows : [],
    });
  } catch (error) {
    if (storageUnavailable(error)) {
      return json({
        storage_ready: false,
        viewer: { email: context.identity.email, name: context.identity.name, role: context.appRole, can_manage: context.canManage },
        requests: [],
        error: 'Migration Approval Center belum dijalankan.',
      });
    }
    return json({ error: error instanceof Error ? error.message : 'Gagal memuat approval.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const context = await getServerWorkspaceContext(req);
  if (!context.identity.email) return json({ error: 'Sesi pengguna tidak memiliki identitas email.' }, { status: 401 });
  if (!isSupabaseAdminConfigured()) return json({ error: 'SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi di server.' }, { status: 503 });

  try {
    const body = await req.json().catch(() => ({}));
    const action = cleanText(body.action, '', 80);
    const now = new Date().toISOString();
    const workspace = encodeURIComponent(context.workspaceId);

    if (action === 'submit') {
      const requestType = REQUEST_TYPES.includes(body.request_type) ? body.request_type : 'general';
      const title = cleanText(body.title, '', 300);
      if (!title) throw new Error('Judul permintaan wajib diisi.');
      const requestedEmail = context.canManage && body.requested_by_email
        ? cleanEmail(body.requested_by_email)
        : context.identity.email;
      const payload = {
        workspace_id: context.workspaceId,
        request_type: requestType,
        source_type: null,
        source_id: null,
        requested_by_email: requestedEmail,
        requested_by_name: requestedEmail === context.identity.email
          ? context.identity.name
          : cleanText(body.requested_by_name, requestedEmail.split('@')[0], 160),
        requested_by_avatar: requestedEmail === context.identity.email ? context.identity.avatarUrl || null : null,
        title,
        description: cleanText(body.description, '', 5000),
        metadata: body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata) ? body.metadata : {},
        status: 'pending',
        submitted_at: now,
        updated_at: now,
      };
      const saved = await adminJson('app_approval_requests', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(payload),
      });
      const approval = Array.isArray(saved) ? saved[0] : saved;
      const managers = (await getWorkspaceManagerEmails(context.workspaceId)).filter((email) => email !== requestedEmail);
      await publishNotification({
        req,
        workspaceId: context.workspaceId,
        actor: { email: requestedEmail, name: payload.requested_by_name, avatar: payload.requested_by_avatar || undefined },
        recipientEmails: managers,
        audience: 'explicit',
        type: 'approval_submitted',
        title: 'Permintaan approval baru',
        message: `${payload.requested_by_name} mengirim "${title}" untuk ditinjau.`,
        entityType: 'approval',
        entityId: approval?.id,
        entityUrl: '/approvals',
        payload: { approval_id: approval?.id, request_type: requestType },
        dedupeKey: `approval:${approval?.id || now}:submitted`,
      });
      return json({ success: true, request: approval });
    }

    if (action === 'review') {
      if (!context.canManage) return json({ error: 'Hanya Owner atau Admin yang dapat meninjau approval.' }, { status: 403 });
      const id = cleanText(body.id, '', 80);
      const status: ApprovalStatus = REVIEW_STATUSES.includes(body.status) ? body.status : 'revision';
      if (!id) throw new Error('ID approval tidak ditemukan.');
      const existingRows = await adminJson(
        `app_approval_requests?select=*&id=eq.${encodeURIComponent(id)}&workspace_id=eq.${workspace}&limit=1`
      );
      const existing = Array.isArray(existingRows) ? existingRows[0] : existingRows;
      if (!existing) return json({ error: 'Approval tidak ditemukan.' }, { status: 404 });

      const saved = await adminJson(
        `app_approval_requests?id=eq.${encodeURIComponent(id)}&workspace_id=eq.${workspace}`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({
            status,
            reviewer_email: context.identity.email,
            reviewer_name: context.identity.name,
            reviewer_note: cleanText(body.reviewer_note, '', 5000),
            reviewed_at: now,
            updated_at: now,
          }),
        }
      );
      const approval = Array.isArray(saved) ? saved[0] : saved;
      const statusLabel = status === 'approved' ? 'disetujui' : status === 'rejected' ? 'ditolak' : 'perlu direvisi';
      await publishNotification({
        req,
        workspaceId: context.workspaceId,
        recipientEmails: [existing.requested_by_email],
        audience: 'explicit',
        type: `approval_${status}`,
        title: `Permintaan ${statusLabel}`,
        message: `${context.identity.name} meninjau "${existing.title}": ${statusLabel}.`,
        entityType: 'approval',
        entityId: id,
        entityUrl: '/approvals',
        payload: { approval_id: id, status },
        dedupeKey: `approval:${id}:${status}:${now}`,
      });
      return json({ success: true, request: approval });
    }

    if (action === 'resubmit') {
      const id = cleanText(body.id, '', 80);
      if (!id) throw new Error('ID approval tidak ditemukan.');
      const ownership = context.canManage ? '' : `&requested_by_email=eq.${encodeURIComponent(context.identity.email)}`;
      const saved = await adminJson(
        `app_approval_requests?id=eq.${encodeURIComponent(id)}&workspace_id=eq.${workspace}${ownership}&status=eq.revision`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({
            title: cleanText(body.title, '', 300),
            description: cleanText(body.description, '', 5000),
            status: 'pending',
            reviewer_email: null,
            reviewer_name: null,
            reviewer_note: '',
            reviewed_at: null,
            submitted_at: now,
            updated_at: now,
          }),
        }
      );
      const approval = Array.isArray(saved) ? saved[0] : saved;
      if (!approval) return json({ error: 'Permintaan revisi tidak ditemukan.' }, { status: 404 });
      const managers = (await getWorkspaceManagerEmails(context.workspaceId)).filter((email) => email !== approval.requested_by_email);
      await publishNotification({
        req,
        workspaceId: context.workspaceId,
        recipientEmails: managers,
        audience: 'explicit',
        type: 'approval_resubmitted',
        title: 'Revisi approval dikirim ulang',
        message: `${approval.requested_by_name} mengirim ulang "${approval.title}".`,
        entityType: 'approval',
        entityId: id,
        entityUrl: '/approvals',
        dedupeKey: `approval:${id}:resubmitted:${now}`,
      });
      return json({ success: true, request: approval });
    }

    if (action === 'cancel') {
      const id = cleanText(body.id, '', 80);
      if (!id) throw new Error('ID approval tidak ditemukan.');
      const ownership = context.canManage ? '' : `&requested_by_email=eq.${encodeURIComponent(context.identity.email)}`;
      const saved = await adminJson(
        `app_approval_requests?id=eq.${encodeURIComponent(id)}&workspace_id=eq.${workspace}${ownership}&status=in.(pending,revision)`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({ status: 'cancelled', updated_at: now }),
        }
      );
      const approval = Array.isArray(saved) ? saved[0] : saved;
      if (!approval) return json({ error: 'Permintaan tidak dapat dibatalkan.' }, { status: 404 });
      return json({ success: true, request: approval });
    }

    return json({ error: 'Aksi approval tidak dikenali.' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal memproses approval.';
    const status = /app_approval_requests|schema cache|relation .* does not exist/i.test(message) ? 503 : 400;
    return json({ error: message }, { status });
  }
}
