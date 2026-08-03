import { clickUpFetch } from './client';
import { ClickUpList } from './types';

export async function getFolderLists(folderId: string, token?: string): Promise<{ lists: ClickUpList[] }> {
  return await clickUpFetch<{ lists: ClickUpList[] }>(`/folder/${folderId}/list`, { token });
}

export async function getFolderlessLists(spaceId: string, token?: string): Promise<{ lists: ClickUpList[] }> {
  return await clickUpFetch<{ lists: ClickUpList[] }>(`/space/${spaceId}/list`, { token });
}

export async function getListById(listId: string, token?: string): Promise<ClickUpList> {
  return await clickUpFetch<ClickUpList>(`/list/${listId}`, { token });
}

export async function createList(
  spaceId: string,
  input: { name: string; content?: string; due_date?: number; priority?: number },
  token?: string
): Promise<ClickUpList> {
  return await clickUpFetch<ClickUpList>(`/space/${spaceId}/list`, {
    method: 'POST',
    body: JSON.stringify(input),
    token,
  });
}

export async function deleteList(listId: string, token?: string): Promise<void> {
  await clickUpFetch<void>(`/list/${listId}`, {
    method: 'DELETE',
    token,
  });
}
