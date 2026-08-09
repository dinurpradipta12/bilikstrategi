import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://spnawjvexcwhhyfavvew.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwbmF3anZleGN3aGh5ZmF2dmV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNjU1NDgsImV4cCI6MjEwMDk0MTU0OH0.IYNTrKH7s5aTBcRREiBgq1SOw5ONBcP0uxWpC_tSznU';

export async function POST(req: NextRequest) {
  try {
    const { mediaId, userId, totalMembers = 7 } = await req.json();

    if (!mediaId || !userId) {
      return NextResponse.json({ error: 'mediaId and userId are required' }, { status: 400 });
    }

    const headers = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    };

    // 1. Fetch current media attachment record
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/app_chat_media_attachments?id=eq.${encodeURIComponent(mediaId)}`,
      { headers },
    );

    if (!res.ok) {
      return NextResponse.json({ message: 'Media record query failed' });
    }

    const records = await res.json();
    const record = records?.[0];

    if (!record) {
      return NextResponse.json({ message: 'Media record not found or already deleted' });
    }

    const currentViews: string[] = Array.isArray(record.viewed_by) ? record.viewed_by : [];
    const userIdStr = String(userId);

    if (!currentViews.includes(userIdStr)) {
      currentViews.push(userIdStr);

      await fetch(
        `${SUPABASE_URL}/rest/v1/app_chat_media_attachments?id=eq.${encodeURIComponent(mediaId)}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ viewed_by: currentViews }),
        },
      );
    }

    // 2. Auto-Cleanup check: If all members opened/viewed this photo, delete from storage & table!
    if (currentViews.length >= totalMembers) {
      if (record.storage_path) {
        await fetch(
          `${SUPABASE_URL}/storage/v1/object/chat-attachments/${record.storage_path}`,
          {
            method: 'DELETE',
            headers,
          },
        );
      }

      await fetch(
        `${SUPABASE_URL}/rest/v1/app_chat_media_attachments?id=eq.${encodeURIComponent(mediaId)}`,
        {
          method: 'DELETE',
          headers,
        },
      );

      return NextResponse.json({ message: 'All members viewed image. Image permanently auto-deleted for privacy.' });
    }

    return NextResponse.json({
      message: 'View recorded',
      viewCount: currentViews.length,
      totalMembers,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
