import { NextRequest } from 'next/server';
import { normalizeIdentityEmail } from '@/lib/auth/app-role';
import { supabaseRest } from '@/lib/supabase/rest-client';
import {
  isSupabaseAdminConfigured,
  supabaseAdminFetch,
} from '@/lib/supabase/admin-rest-client';

export const DEFAULT_NOTIFICATION_WORKSPACE = 'bilik-strategi';

export type NotificationActor = {
  id?: string;
  name: string;
  email: string;
  clickupId?: string;
  avatar?: string;
};

export type PublishNotificationInput = {
  req?: NextRequest;
  workspaceId?: string;
  actor?: NotificationActor;
  recipientEmails?: string[];
  excludeRecipientEmails?: string[];
  audience?: 'all' | 'explicit';
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  entityUrl?: string;
  payload?: Record<string, unknown>;
  dedupeKey: string;
};

export type AppNotification = {
  id: string;
  workspace_id: string;
  recipient_email: string;
  recipient_clickup_id?: string | null;
  actor_email?: string | null;
  actor_name?: string | null;
  type: string;
  title: string;
  message: string;
  entity_type?: string | null;
  entity_id?: string | null;
  entity_url?: string | null;
  payload?: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
  read_at?: string | null;
  dedupe_key?: string | null;
};

function decodeCookie(value: string | undefined) {
  if (!value) return '';
  let decoded = value;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }
  return decoded;
}

function normalizeEmail(value: unknown) {
  return normalizeIdentityEmail(value);
}

export function getNotificationActor(req?: NextRequest): NotificationActor {
  const email = normalizeEmail(decodeCookie(req?.cookies.get('clickup_user_email')?.value));
  const name = decodeCookie(req?.cookies.get('clickup_user_name')?.value) || email.split('@')[0] || 'Pengguna';
  const clickupId = decodeCookie(req?.cookies.get('clickup_user_id')?.value);
  const avatar = decodeCookie(req?.cookies.get('clickup_user_avatar')?.value);
  return { email, name, clickupId, avatar };
}

export function getNotificationWorkspaceId(req?: NextRequest) {
  return decodeCookie(req?.cookies.get('app_workspace_id')?.value) || DEFAULT_NOTIFICATION_WORKSPACE;
}

async function readRows(table: string, select: string, filters: string) {
  if (isSupabaseAdminConfigured()) {
    const response = await supabaseAdminFetch(`${table}?select=${encodeURIComponent(select)}${filters}`);
    if (!response.ok) throw new Error(await response.text());
    const rows = await response.json().catch(() => []);
    return Array.isArray(rows) ? rows : [];
  }

  const query = supabaseRest.from(table).select(select);
  if (table === 'app_user_roles') {
    const result = await query.eq('status', 'active');
    if (result.error) throw result.error;
    return Array.isArray(result.data) ? result.data : [];
  }

  const result = await query.eq('status', 'active');
  if (result.error) throw result.error;
  return Array.isArray(result.data) ? result.data : [];
}

function uniqueEmails(values: unknown[]) {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeEmail(value))
        .filter(Boolean)
    )
  );
}

async function getWorkspaceRecipients(workspaceId: string, extraEmails: string[] = []) {
  const emails: string[] = [...extraEmails];

  try {
    const roles = await readRows('app_user_roles', 'email', '&status=eq.active');
    emails.push(...roles.map((row: any) => row.email));
  } catch (error) {
    console.warn('[Notifications] Could not read app_user_roles:', error);
  }

  try {
    const members = await readRows(
      'app_workspace_members',
      'user_email',
      `&workspace_id=eq.${encodeURIComponent(workspaceId)}&status=eq.active`
    );
    emails.push(...members.map((row: any) => row.user_email));
  } catch (error) {
    console.warn('[Notifications] Could not read workspace members:', error);
  }

  try {
    const profiles = await readRows('profiles', 'email', '&status=eq.active');
    emails.push(...profiles.map((row: any) => row.email));
  } catch {
    // Some installations do not expose profiles to the app session.
  }

  return uniqueEmails(emails);
}

export async function publishNotification(input: PublishNotificationInput) {
  if (!isSupabaseAdminConfigured()) {
    console.warn('[Notifications] SUPABASE_SERVICE_ROLE_KEY is not configured; event was not persisted.');
    return { persisted: false, reason: 'service_role_missing' };
  }

  const workspaceId = input.workspaceId || getNotificationWorkspaceId(input.req);
  const actor = input.actor || getNotificationActor(input.req);
  const requestedRecipients = uniqueEmails(input.recipientEmails || []);
  const excludedRecipients = new Set(uniqueEmails(input.excludeRecipientEmails || []));
  const recipientEmails = (input.audience === 'explicit'
    ? requestedRecipients
    : await getWorkspaceRecipients(workspaceId, requestedRecipients)
  ).filter((email) => !excludedRecipients.has(email));

  if (recipientEmails.length === 0) {
    return { persisted: false, reason: 'no_recipients' };
  }

  const createdAt = new Date().toISOString();
  const rows = recipientEmails.map((recipientEmail) => ({
    workspace_id: workspaceId,
    recipient_email: recipientEmail,
    actor_email: actor.email || null,
    actor_name: actor.name || null,
    type: input.type,
    title: input.title,
    message: input.message,
    entity_type: input.entityType || null,
    entity_id: input.entityId || null,
    entity_url: input.entityUrl || null,
    payload: input.payload || {},
    is_read: false,
    created_at: createdAt,
    dedupe_key: input.dedupeKey.slice(0, 500),
  }));

  const response = await supabaseAdminFetch(
    'app_notifications?on_conflict=workspace_id,recipient_email,dedupe_key',
    {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify(rows),
    }
  );

  if (!response.ok) {
    console.warn('[Notifications] Failed to persist event:', await response.text());
    return { persisted: false, reason: 'database_write_failed' };
  }

  return { persisted: true, recipientCount: recipientEmails.length };
}

function taskName(task: any) {
  return String(task?.task_name || task?.name || 'Task');
}

function taskId(task: any) {
  return String(task?.id || task?.clickup_task_id || '');
}

function taskAssigneeEmails(task: any) {
  return uniqueEmails([
    ...(Array.isArray(task?.assignee_emails) ? task.assignee_emails : []),
    ...(Array.isArray(task?.raw_data?.assignee_emails) ? task.raw_data.assignee_emails : []),
  ]);
}

export async function publishTaskCreated(req: NextRequest, task: any) {
  const id = taskId(task);
  if (!id) return;
  const name = taskName(task);
  const project = String(task?.project_name || task?.project_id || 'project aplikasi');
  const actor = getNotificationActor(req);
  const assignees = taskAssigneeEmails(task).filter((email) => email !== actor.email);
  const eventKey = `task:${id}:created`;

  await publishNotification({
    req,
    actor,
    excludeRecipientEmails: [actor.email, ...assignees],
    type: 'task_created',
    title: 'Task baru dibuat',
    message: `${actor.name} membuat task "${name}" pada ${project}.`,
    entityType: 'task',
    entityId: id,
    entityUrl: '/tasks',
    payload: { task_id: id, project_id: task?.project_id || null },
    dedupeKey: eventKey,
  });

  if (assignees.length > 0) {
    await publishNotification({
      req,
      actor,
      recipientEmails: assignees,
      audience: 'explicit',
      type: 'task_assigned',
      title: 'Anda ditambahkan ke task',
      message: `${actor.name} menambahkan Anda ke task "${name}" pada ${project}.`,
      entityType: 'task',
      entityId: id,
      entityUrl: '/my-tasks',
      payload: { task_id: id, project_id: task?.project_id || null },
      dedupeKey: `${eventKey}:assigned`,
    });
  }
}

export async function publishTaskUpdated(req: NextRequest, task: any, previous?: any) {
  const id = taskId(task);
  if (!id) return;
  const name = taskName(task);
  const previousSignature = JSON.stringify({
    name: taskName(previous),
    status: previous?.status,
    priority: previous?.priority,
    due: previous?.due_date,
    assignees: previous?.assignee_ids,
    assigneeEmails: taskAssigneeEmails(previous),
    comments: previous?.comments_count,
    subtasks: previous?.subtask_count,
  });
  const currentSignature = JSON.stringify({
    name,
    status: task?.status,
    priority: task?.priority,
    due: task?.due_date,
    assignees: task?.assignee_ids,
    assigneeEmails: taskAssigneeEmails(task),
    comments: task?.comments_count,
    subtasks: task?.subtask_count,
  });
  if (previous && previousSignature === currentSignature) return;

  const token = String(task?.clickup_updated_at || task?.updated_at || task?.last_synced_at || Date.now());
  const actor = getNotificationActor(req);
  const project = String(task?.project_name || task?.project_id || 'project aplikasi');
  const previousAssignees = new Set(taskAssigneeEmails(previous));
  const assignees = taskAssigneeEmails(task).filter((email) => email !== actor.email);
  const newlyAssigned = assignees.filter((email) => !previousAssignees.has(email));
  const commentsChanged = Number(task?.comments_count || 0) > Number(previous?.comments_count || 0);
  const subtasksChanged = Number(task?.subtask_count || 0) !== Number(previous?.subtask_count || 0);
  const notificationType = commentsChanged ? 'task_commented' : subtasksChanged ? 'task_subtask_updated' : 'task_updated';
  const notificationTitle = commentsChanged ? 'Komentar baru di task' : subtasksChanged ? 'Subtask diperbarui' : 'Task diperbarui';
  const notificationMessage = commentsChanged
    ? `${actor.name} menambahkan komentar pada task "${name}" di ${project}.`
    : subtasksChanged
      ? `${actor.name} memperbarui subtask pada task "${name}" di ${project}.`
      : `${actor.name} memperbarui task "${name}" pada ${project}.`;
  await publishNotification({
    req,
    actor,
    excludeRecipientEmails: [actor.email, ...newlyAssigned],
    type: notificationType,
    title: notificationTitle,
    message: notificationMessage,
    entityType: 'task',
    entityId: id,
    entityUrl: '/tasks',
    payload: { task_id: id, project_id: task?.project_id || null },
    dedupeKey: `task:${id}:updated:${token}`,
  });

  if (newlyAssigned.length > 0) {
    await publishNotification({
      req,
      actor,
      recipientEmails: newlyAssigned,
      audience: 'explicit',
      type: 'task_assigned',
      title: 'Anda ditambahkan ke task',
      message: `${actor.name} menambahkan Anda ke task "${name}" pada ${project}.`,
      entityType: 'task',
      entityId: id,
      entityUrl: '/my-tasks',
      payload: { task_id: id, project_id: task?.project_id || null },
      dedupeKey: `task:${id}:assigned:${token}`,
    });
  }
}

export async function publishTaskDeleted(req: NextRequest, task: any) {
  const id = taskId(task);
  if (!id) return;
  const actor = getNotificationActor(req);
  await publishNotification({
    req,
    actor,
    excludeRecipientEmails: [actor.email],
    type: 'task_deleted',
    title: 'Task dihapus',
    message: `${actor.name} menghapus task "${taskName(task)}".`,
    entityType: 'task',
    entityId: id,
    entityUrl: '/tasks',
    payload: { task_id: id },
    dedupeKey: `task:${id}:deleted:${String(task?.clickup_updated_at || Date.now())}`,
  });
}

export async function publishProjectEvent(
  req: NextRequest,
  input: {
    type: string;
    title: string;
    message: string;
    projectId: string;
    projectName: string;
    token: string;
    payload?: Record<string, unknown>;
    excludeRecipientEmails?: string[];
  }
) {
  const actor = getNotificationActor(req);
  await publishNotification({
    req,
    actor,
    excludeRecipientEmails: [actor.email, ...(input.excludeRecipientEmails || [])],
    type: input.type,
    title: input.title,
    message: input.message,
    entityType: 'project',
    entityId: input.projectId,
    entityUrl: `/projects/${encodeURIComponent(input.projectId)}`,
    payload: { project_id: input.projectId, ...(input.payload || {}) },
    dedupeKey: `project:${input.projectId}:${input.type}:${input.token}`,
  });
}

export async function publishProjectAssignments(
  req: NextRequest,
  input: { projectId: string; projectName: string; recipientEmails: string[] }
) {
  const actor = getNotificationActor(req);
  const recipients = uniqueEmails(input.recipientEmails).filter((email) => email !== actor.email);
  if (recipients.length === 0) return;

  await publishNotification({
    req,
    actor,
    recipientEmails: recipients,
    audience: 'explicit',
    type: 'project_assigned',
    title: 'Anda ditambahkan ke project',
    message: `${actor.name} menambahkan Anda ke project "${input.projectName}".`,
    entityType: 'project',
    entityId: input.projectId,
    entityUrl: `/projects/${encodeURIComponent(input.projectId)}`,
    payload: { project_id: input.projectId },
    // Stable per-project key prevents the same member from receiving a new
    // assignment notification on every metadata save.
    dedupeKey: `project:${input.projectId}:member-assigned`,
  });
}

export async function listNotifications(req: NextRequest, limit = 50) {
  const actor = getNotificationActor(req);
  if (!actor.email || !isSupabaseAdminConfigured()) {
    return { notifications: [] as AppNotification[], unreadCount: 0, storageReady: isSupabaseAdminConfigured() };
  }

  const workspaceId = getNotificationWorkspaceId(req);
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const response = await supabaseAdminFetch(
    `app_notifications?select=*&workspace_id=eq.${encodeURIComponent(workspaceId)}&recipient_email=eq.${encodeURIComponent(actor.email)}&order=created_at.desc&limit=${safeLimit}`
  );
  if (!response.ok) throw new Error(await response.text());
  const notifications = await response.json().catch(() => []);
  const rows = Array.isArray(notifications) ? notifications : [];
  return {
    notifications: rows as AppNotification[],
    unreadCount: rows.filter((notification: AppNotification) => !notification.is_read).length,
    storageReady: true,
  };
}

export async function markNotificationsRead(req: NextRequest, body: any) {
  const actor = getNotificationActor(req);
  if (!actor.email || !isSupabaseAdminConfigured()) return { storageReady: false };

  const workspaceId = getNotificationWorkspaceId(req);
  const id = String(body?.id || '').trim();
  const query = id
    ? `app_notifications?workspace_id=eq.${encodeURIComponent(workspaceId)}&recipient_email=eq.${encodeURIComponent(actor.email)}&id=eq.${encodeURIComponent(id)}`
    : `app_notifications?workspace_id=eq.${encodeURIComponent(workspaceId)}&recipient_email=eq.${encodeURIComponent(actor.email)}&is_read=eq.false`;
  const response = await supabaseAdminFetch(query, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ is_read: true, read_at: new Date().toISOString() }),
  });
  if (!response.ok) throw new Error(await response.text());
  return { storageReady: true };
}
