import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizedTeams } from '@/lib/clickup/teams';
import { getWorkspaceMembers } from '@/lib/clickup/users';

export async function GET(req: NextRequest) {
  try {
    const isMock = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';
    if (isMock) {
      return NextResponse.json({ mock: true });
    }

    const teamId = process.env.CLICKUP_TEAM_ID || '90182855619';
    const teamsData = await getAuthorizedTeams();
    const members = await getWorkspaceMembers(teamId);

    return NextResponse.json({
      teams: teamsData.teams || [],
      members: members || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Gagal mengambil data tim dari ClickUp' },
      { status: error.status || 500 }
    );
  }
}
