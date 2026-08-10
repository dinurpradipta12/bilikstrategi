import { NextRequest, NextResponse } from 'next/server';
import { listNotifications, markNotificationsRead } from '@/lib/notifications/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const result = await listNotifications(req, Number(new URL(req.url).searchParams.get('limit') || 50));
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    return NextResponse.json(
      { notifications: [], unreadCount: 0, storageReady: false, warning: error?.message || 'Gagal mengambil notifikasi' },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const result = await markNotificationsRead(req, await req.json().catch(() => ({})));
    return NextResponse.json({ success: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Gagal memperbarui status notifikasi' }, { status: 500 });
  }
}
