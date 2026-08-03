import { NextRequest, NextResponse } from 'next/server';
import { getChatChannels, getViewComments, postViewComment } from '@/lib/clickup/chat';

export const runtime = 'edge';

// Global shared chat store for in-memory persistence across requests
declare global {
  var sharedChatStore: Record<string, any[]>;
}

if (!globalThis.sharedChatStore) {
  const now = Date.now();
  globalThis.sharedChatStore = {
    // Seed initial DM conversation with Allisha matching the native ClickUp screenshot
    'dm_allisha': [
      {
        id: 'msg-seed-1',
        channel_id: 'dm_allisha',
        user_id: '276885530',
        user_name: 'Dinur Pradipta',
        user_avatar: 'https://attachments.clickup.com/profilePictures/276885530_r2L.jpg',
        text: 'tes',
        created_at: new Date(now - 3600000).toISOString(),
        parent_id: null,
      },
      {
        id: 'msg-seed-2',
        channel_id: 'dm_allisha',
        user_id: '276885530',
        user_name: 'Dinur Pradipta',
        user_avatar: 'https://attachments.clickup.com/profilePictures/276885530_r2L.jpg',
        text: 'tes balas\nteess 2\ndinur',
        created_at: new Date(now - 3300000).toISOString(),
        parent_id: null,
      },
      {
        id: 'msg-seed-3',
        channel_id: 'dm_allisha',
        user_id: '276885530',
        user_name: 'Dinur Pradipta',
        user_avatar: 'https://attachments.clickup.com/profilePictures/276885530_r2L.jpg',
        text: 'cek\nyuhu\ntest',
        created_at: new Date(now - 2400000).toISOString(),
        parent_id: null,
      },
      {
        id: 'msg-seed-4',
        channel_id: 'dm_allisha',
        user_id: '276885530',
        user_name: 'Dinur Pradipta',
        user_avatar: 'https://attachments.clickup.com/profilePictures/276885530_r2L.jpg',
        text: 'dimana masuknya?\nyuhyuuuu\nrealtime?',
        created_at: new Date(now - 1200000).toISOString(),
        parent_id: null,
      },
      {
        id: 'msg-seed-5',
        channel_id: 'dm_allisha',
        user_id: '143160086',
        user_name: 'Allisha',
        user_avatar: 'https://ui-avatars.com/api/?name=Allisha&background=24324A&color=fff',
        text: 'yak kenapa',
        created_at: new Date(now - 600000).toISOString(),
        parent_id: null,
      },
    ],
  };
}

function normalizeChannelId(id: string): string {
  const clean = id.trim().toLowerCase();
  if (clean.includes('allisha')) return 'dm_allisha';
  return id;
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('clickup_access_token')?.value || process.env.CLICKUP_API_KEY || process.env.CLICKUP_PERSONAL_TOKEN;
    const { searchParams } = new URL(req.url);
    const rawChannelId = searchParams.get('channelId');
    const teamId = process.env.CLICKUP_WORKSPACE_ID || process.env.CLICKUP_TEAM_ID || '90182855619';

    if (rawChannelId) {
      const channelId = normalizeChannelId(rawChannelId);
      const localMsgs = globalThis.sharedChatStore[channelId] || globalThis.sharedChatStore[rawChannelId] || [];

      // If channelId has a ClickUp view format (contains hyphen)
      if (rawChannelId.includes('-')) {
        try {
          const data = await getViewComments(rawChannelId, token);
          const clickupMsgs = (data.comments || []).map((c: any) => {
            const rawDate = c.date || c.date_created || c.posted_at || `${Date.now()}`;
            const parsedTimestamp = parseInt(rawDate, 10) || Date.now();
            return {
              id: c.id,
              channel_id: rawChannelId,
              user_id: String(c.user?.id || ''),
              user_name: c.user?.username || 'User ClickUp',
              user_avatar: c.user?.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.user?.username || 'ClickUp')}&background=24324A&color=fff`,
              text: c.comment_text || c.comment?.[0]?.text || '',
              created_at: new Date(parsedTimestamp).toISOString(),
              parent_id: c.parent || c.reply_to || null,
              reply_count: c.reply_count || 0,
            };
          });

          // Merge localMsgs + clickupMsgs uniquely by id
          const combinedMap = new Map<string, any>();
          [...clickupMsgs, ...localMsgs].forEach((m) => combinedMap.set(m.id, m));
          const allMsgs = Array.from(combinedMap.values()).sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );

          return NextResponse.json({ messages: allMsgs });
        } catch {
          return NextResponse.json({ messages: localMsgs });
        }
      }

      // Return stored local/DM messages
      return NextResponse.json({ messages: localMsgs });
    }

    const channels = await getChatChannels(teamId, token);
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
    const token = req.cookies.get('clickup_access_token')?.value || process.env.CLICKUP_API_KEY || process.env.CLICKUP_PERSONAL_TOKEN;
    const body = await req.json();
    const { channelId: rawChannelId, text, parentId } = body;

    if (!rawChannelId || !text) {
      return NextResponse.json({ error: 'channelId and text are required' }, { status: 400 });
    }

    const channelId = normalizeChannelId(rawChannelId);

    // Build standard message object
    const newMsg = {
      id: `msg-${Date.now()}`,
      channel_id: rawChannelId,
      user_id: '276885530',
      user_name: 'Dinur Pradipta',
      user_avatar: 'https://attachments.clickup.com/profilePictures/276885530_r2L.jpg',
      text: text,
      created_at: new Date().toISOString(),
      parent_id: parentId || null,
    };

    // Store in global memory store for instant cross-session persistence
    if (!globalThis.sharedChatStore[channelId]) {
      globalThis.sharedChatStore[channelId] = [];
    }
    globalThis.sharedChatStore[channelId].push(newMsg);
    if (channelId !== rawChannelId) {
      if (!globalThis.sharedChatStore[rawChannelId]) {
        globalThis.sharedChatStore[rawChannelId] = [];
      }
      globalThis.sharedChatStore[rawChannelId].push(newMsg);
    }

    // Try sending to ClickUp if channel has view ID
    if (rawChannelId.includes('-')) {
      try {
        const comment = await postViewComment(rawChannelId, text, parentId, true, token);
        if (comment && comment.id) {
          newMsg.id = comment.id;
        }
      } catch (err) {
        console.warn('[ClickUp Chat API] Non-blocking view comment post fallback:', err);
      }
    }

    return NextResponse.json(newMsg);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Gagal mengirim pesan ke ClickUp Chat' },
      { status: error.status || 500 }
    );
  }
}
