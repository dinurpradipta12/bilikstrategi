import { NextRequest, NextResponse } from 'next/server';
import { getServerWorkspaceContext, toCurrentUserPayload } from '@/lib/auth/server-workspace-context';

export async function GET(req: NextRequest) {
  const context = await getServerWorkspaceContext(req);
  if (!context.identity.id || !context.isActive) return NextResponse.json({ error: 'Sesi tidak ditemukan.' }, { status: 401 });
  return NextResponse.json({ user: toCurrentUserPayload(context) }, { headers: { 'Cache-Control': 'no-store' } });
}
