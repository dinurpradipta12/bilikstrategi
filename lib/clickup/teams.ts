import { clickUpFetch } from './client';
import { ClickUpTeam } from './types';

export async function getAuthorizedTeams(token?: string): Promise<{ teams: ClickUpTeam[] }> {
  return await clickUpFetch<{ teams: ClickUpTeam[] }>('/team', { token });
}
