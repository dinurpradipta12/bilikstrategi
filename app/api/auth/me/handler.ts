import { NextRequest, NextResponse } from 'next/server';
import { getServerWorkspaceContext, toCurrentUserPayload } from '@/lib/auth/server-workspace-context';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const context = await getServerWorkspaceContext(req);
  if (!context.identity.id) {
    return NextResponse.json({ error: 'Sesi tidak ditemukan.' }, { status: 401 });
  }
  if (!context.isActive) {
    return NextResponse.json({ error: 'Akun ini tidak aktif. Hubungi admin workspace.' }, { status: 403 });
  }

  return NextResponse.json(
    { user: toCurrentUserPayload(context), workspace_id: context.workspaceId },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}
