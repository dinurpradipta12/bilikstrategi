import { NextRequest } from 'next/server';
import { normalizeIdentityEmail } from '@/lib/auth/app-role';
import { publishNotification } from '@/lib/notifications/server';
import { isSupabaseAdminConfigured, supabaseAdminFetch } from '@/lib/supabase/admin-rest-client';
import { getWorkspaceManagerEmails, type ServerWorkspaceContext } from '@/lib/auth/server-workspace-context';

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

export async function syncDailyActivityApproval(input: {
  req: NextRequest;
  context: Pick<ServerWorkspaceContext, 'identity' | 'workspaceId'>;
  update: Record<string, any>;
  requestedByName?: string;
}) {
  if (!isSupabaseAdminConfigured() || !input.update?.id) return null;

  const userEmail = normalizeIdentityEmail(input.update.user_email);
  const requesterName = String(
    input.requestedByName ||
    (userEmail === input.context.identity.email ? input.context.identity.name : userEmail.split('@')[0]) ||
    'Pengguna'
  ).trim();
  const now = new Date().toISOString();
  const payload = {
    workspace_id: input.context.workspaceId,
    request_type: 'daily_activity',
    source_type: 'performance_update',
    source_id: String(input.update.id),
    requested_by_email: userEmail,
    requested_by_name: requesterName,
    requested_by_avatar: userEmail === input.context.identity.email ? input.context.identity.avatarUrl || null : null,
    title: String(input.update.title || 'Daily Activity').slice(0, 300),
    description: String(input.update.details || '').slice(0, 5000),
    metadata: {
      activity_date: input.update.activity_date || null,
      progress: Number(input.update.progress || 0),
      activity_status: input.update.status || 'todo',
      evidence_url: input.update.evidence_url || null,
      blocker_note: input.update.blocker_note || null,
      item_id: input.update.item_id || null,
    },
    status: 'pending',
    reviewer_email: null,
    reviewer_name: null,
    reviewer_note: '',
    reviewed_at: null,
    submitted_at: now,
    updated_at: now,
  };

  const saved = await adminJson(
    'app_approval_requests?on_conflict=workspace_id,source_type,source_id',
    {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(payload),
    }
  );
  const approval = Array.isArray(saved) ? saved[0] : saved;
  if (!approval?.id) return approval || null;

  const managerEmails = (await getWorkspaceManagerEmails(input.context.workspaceId))
    .filter((email) => email !== userEmail);
  await publishNotification({
    req: input.req,
    workspaceId: input.context.workspaceId,
    actor: {
      email: userEmail,
      name: requesterName,
      avatar: input.context.identity.avatarUrl,
    },
    recipientEmails: managerEmails,
    audience: 'explicit',
    type: 'approval_submitted',
    title: 'Daily activity menunggu approval',
    message: `${requesterName} mengirim progres "${payload.title}" untuk ditinjau.`,
    entityType: 'approval',
    entityId: String(approval.id),
    entityUrl: '/approvals',
    payload: { approval_id: approval.id, request_type: 'daily_activity' },
    dedupeKey: `approval:${approval.id}:submitted:${now}`,
  });

  return approval;
}
