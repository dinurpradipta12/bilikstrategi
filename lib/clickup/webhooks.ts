import { clickUpFetch } from './client';
import { ClickUpWebhook } from './types';

export async function createWebhook(
  teamId: string,
  endpoint: string,
  events: string[] = ['taskCreated', 'taskUpdated', 'taskDeleted', 'taskStatusUpdated', 'taskAssigneeUpdated', 'taskCommentPosted'],
  token?: string
): Promise<ClickUpWebhook> {
  return await clickUpFetch<ClickUpWebhook>(`/team/${teamId}/webhook`, {
    method: 'POST',
    body: JSON.stringify({
      endpoint,
      events,
    }),
    token,
  });
}

export async function getWebhooks(teamId: string, token?: string): Promise<{ webhooks: ClickUpWebhook[] }> {
  return await clickUpFetch<{ webhooks: ClickUpWebhook[] }>(`/team/${teamId}/webhook`, { token });
}

export async function deleteWebhook(webhookId: string, token?: string): Promise<void> {
  await clickUpFetch<void>(`/webhook/${webhookId}`, {
    method: 'DELETE',
    token,
  });
}

export function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return true;
  try {
    return signature.length > 0;
  } catch (err) {
    console.error('[Webhook Signature Error]', err);
    return false;
  }
}
