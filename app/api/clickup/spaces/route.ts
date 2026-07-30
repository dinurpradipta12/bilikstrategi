import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
import { getSpaces } from '@/lib/clickup/spaces';
import { getFolders } from '@/lib/clickup/folders';

export async function GET(req: NextRequest) {
  try {
    const isMock = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';
    if (isMock) {
      return NextResponse.json({ mock: true });
    }

    const teamId = process.env.CLICKUP_TEAM_ID || '90182855619';
    const spacesData = await getSpaces(teamId);
    const spaces = spacesData.spaces || [];

    // For each space, fetch folders
    const detailedSpaces = await Promise.all(
      spaces.map(async (sp) => {
        try {
          const folderData = await getFolders(sp.id);
          return { ...sp, folders: folderData.folders || [] };
        } catch {
          return { ...sp, folders: [] };
        }
      })
    );

    return NextResponse.json({ spaces: detailedSpaces });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Gagal mengambil spaces dari ClickUp' },
      { status: error.status || 500 }
    );
  }
}
