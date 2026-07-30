import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
import { getChatChannels, getViewComments, postViewComment } from '@/lib/clickup/chat';

export async function GET(req: NextRequest) {
  try {
    const isMock = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';
    if (isMock) {
      return NextResponse.json({ mock: true });
    }

    const { searchParams } = new URL(req.url);
    const channelId = searchParams.get('channelId');
    const teamId = process.env.CLICKUP_TEAM_ID || '90182855619';

    if (channelId) {
      if (channelId.includes('-')) {
        try {
          const data = await getViewComments(channelId);
          const formattedMessages = (data.comments || []).map((c: any) => {
            const rawDate = c.date || c.date_created || c.posted_at || `${Date.now()}`;
            const parsedTimestamp = parseInt(rawDate, 10) || Date.now();
            return {
              id: c.id,
              channel_id: channelId,
              user_id: String(c.user?.id || ''),
              user_name: c.user?.username || 'User ClickUp',
              user_avatar: c.user?.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.user?.username || 'ClickUp')}&background=24324A&color=fff`,
              text: c.comment_text || c.comment?.[0]?.text || '',
              created_at: new Date(parsedTimestamp).toISOString(),
              parent_id: c.parent || c.reply_to || null,
              reply_count: c.reply_count || 0,
            };
          });
          return NextResponse.json({ messages: formattedMessages });
        } catch {
          return NextResponse.json({ messages: [] });
        }
      } else {
        return NextResponse.json({ messages: [] });
      }
    }

    const channels = await getChatChannels(teamId);
    return NextResponse.json({ channels });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Gagal terhubung dengan ClickUp Chat API' },
      { status: error.status || 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { channelId, text, parentId } = body;

    if (!channelId || !text) {
      return NextResponse.json({ error: 'channelId and text are required' }, { status: 400 });
    }

    if (channelId.includes('-')) {
      const comment = await postViewComment(channelId, text, parentId);
      return NextResponse.json({
        id: comment.id,
        channel_id: channelId,
        text: comment.comment_text || text,
        created_at: new Date().toISOString(),
        parent_id: parentId || null,
      });
    }

    return NextResponse.json({
      id: `msg-${Date.now()}`,
      channel_id: channelId,
      text: text,
      created_at: new Date().toISOString(),
      parent_id: parentId || null,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Gagal mengirim pesan ke ClickUp Chat' },
      { status: error.status || 500 }
    );
  }
}
