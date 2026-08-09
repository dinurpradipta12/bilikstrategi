import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
import { getAuthorizedTeams } from '@/lib/clickup/teams';
import { getWorkspaceMembers } from '@/lib/clickup/users';

export async function GET(req: NextRequest) {
  try {
    const isMock = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';
    if (isMock) {
      return NextResponse.json({ mock: true });
    }

    const cookieToken = req.cookies.get('clickup_access_token')?.value || '';
    const workspaceToken = process.env.CLICKUP_API_KEY || process.env.CLICKUP_PERSONAL_TOKEN || '';
    const tokenCandidates = Array.from(new Set([workspaceToken, cookieToken].filter(Boolean)));
    const teamId = process.env.CLICKUP_WORKSPACE_ID || process.env.CLICKUP_TEAM_ID || '90182855619';

    let lastError: any = null;
    for (const token of tokenCandidates) {
      try {
        const teamsData = await getAuthorizedTeams(token);
        const members = await getWorkspaceMembers(teamId, token);

        if (members.length > 0 || teamsData.teams?.length > 0) {
          return NextResponse.json({
            teams: teamsData.teams || [],
            members: members || [],
            source: token === workspaceToken ? 'workspace_token' : 'user_cookie',
          });
        }
      } catch (err) {
        lastError = err;
      }
    }

    if (lastError) throw lastError;
    return NextResponse.json({ teams: [], members: [], source: 'empty' });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Gagal mengambil data tim dari ClickUp' },
      { status: error.status || 500 }
    );
  }
}
