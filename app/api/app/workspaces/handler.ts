import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_APP_WORKSPACE_ID } from '@/lib/auth/server-workspace-context';
import { readTeamBranding } from '@/lib/branding/server';

export async function GET() {
  const branding = await readTeamBranding();
  const workspace = { id: DEFAULT_APP_WORKSPACE_ID, name: branding.name, slug: 'team' };
  return NextResponse.json({ workspaces: [workspace], current_workspace_id: workspace.id }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (body.workspace_id !== DEFAULT_APP_WORKSPACE_ID) {
    return NextResponse.json({ error: 'Workspace tidak ditemukan pada aplikasi tim ini.' }, { status: 404 });
  }
  return NextResponse.json({ success: true, current_workspace_id: DEFAULT_APP_WORKSPACE_ID });
}
