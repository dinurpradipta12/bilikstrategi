import { clickUpFetch } from './client';
import { ClickUpSpace } from './types';

export async function getSpaces(teamId: string, token?: string): Promise<{ spaces: ClickUpSpace[] }> {
  return await clickUpFetch<{ spaces: ClickUpSpace[] }>(`/team/${teamId}/space`, { token });
}

export async function getSpaceById(spaceId: string, token?: string): Promise<ClickUpSpace> {
  return await clickUpFetch<ClickUpSpace>(`/space/${spaceId}`, { token });
}
