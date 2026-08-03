import { clickUpFetch } from './client';
import { ClickUpComment } from './types';

export async function getTaskComments(taskId: string, token?: string): Promise<{ comments: ClickUpComment[] }> {
  return await clickUpFetch<{ comments: ClickUpComment[] }>(`/task/${taskId}/comment`, { token });
}

export async function createTaskComment(
  taskId: string,
  commentText: string,
  notifyAll: boolean = true,
  token?: string
): Promise<ClickUpComment> {
  return await clickUpFetch<ClickUpComment>(`/task/${taskId}/comment`, {
    method: 'POST',
    body: JSON.stringify({
      comment_text: commentText,
      notify_all: notifyAll,
    }),
    token,
  });
}
