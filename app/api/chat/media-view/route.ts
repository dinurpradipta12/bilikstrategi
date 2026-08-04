import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const { mediaId, userId, totalMembers = 7 } = await req.json();

    if (!mediaId || !userId) {
      return NextResponse.json({ error: 'mediaId and userId are required' }, { status: 400 });
    }

    // 1. Fetch current media attachment record
    const { data: record, error: fetchErr } = await supabase
      .from('app_chat_media_attachments')
      .select('*')
      .eq('id', mediaId)
      .single();

    if (fetchErr || !record) {
      return NextResponse.json({ message: 'Media record not found or already deleted' });
    }

    const currentViews: string[] = Array.isArray(record.viewed_by) ? record.viewed_by : [];
    const userIdStr = String(userId);

    // If already recorded as viewed by this user
    if (!currentViews.includes(userIdStr)) {
      currentViews.push(userIdStr);

      // Update viewed_by array
      await supabase
        .from('app_chat_media_attachments')
        .update({ viewed_by: currentViews })
        .eq('id', mediaId);
    }

    // 2. Auto-Cleanup check: If all channel members have opened/viewed this photo, delete from storage & table!
    if (currentViews.length >= totalMembers) {
      console.log(`[Media Auto-Cleanup] All ${totalMembers} members viewed ${record.storage_path}. Deleting...`);
      
      // Delete file from Supabase storage
      if (record.storage_path) {
        await supabase.storage.from('chat-attachments').remove([record.storage_path]);
      }

      // Delete record from DB
      await supabase.from('app_chat_media_attachments').delete().eq('id', mediaId);

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
