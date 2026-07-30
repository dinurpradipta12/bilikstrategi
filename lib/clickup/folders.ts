import { clickUpFetch } from './client';
import { ClickUpFolder } from './types';

export async function getFolders(spaceId: string, token?: string): Promise<{ folders: ClickUpFolder[] }> {
  return await clickUpFetch<{ folders: ClickUpFolder[] }>(`/space/${spaceId}/folder`, { token });
}

export async function getFolderById(folderId: string, token?: string): Promise<ClickUpFolder> {
  return await clickUpFetch<ClickUpFolder>(`/folder/${folderId}`, { token });
}
