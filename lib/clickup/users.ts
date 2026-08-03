import { clickUpFetch } from './client';
import { ClickUpUser } from './types';
import { getAuthorizedTeams } from './teams';

export async function getAuthenticatedUser(token?: string): Promise<{ user: ClickUpUser }> {
  return await clickUpFetch<{ user: ClickUpUser }>('/user', { token });
}

export async function getWorkspaceMembers(teamId: string, token?: string): Promise<ClickUpUser[]> {
  const data = await getAuthorizedTeams(token);
  const team = data.teams.find((t) => t.id === teamId) || data.teams[0];
  if (!team) return [];
  return team.members.map((m) => m.user);
}
