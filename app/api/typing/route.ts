import { NextResponse } from 'next/server';

export const runtime = 'edge';

interface TypingStatus {
  channelId: string;
  userId: number | string;
  username: string;
  timestamp: number;
}

// In-memory store for active typing status across users of this app instance
let typingStore: TypingStatus[] = [];

const cleanup = () => {
  const now = Date.now();
  typingStore = typingStore.filter((item) => now - item.timestamp < 3000);
};

export async function GET(request: Request) {
  cleanup();
  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get('channel_id');

  const activeTyping = typingStore.filter(
    (item) => !channelId || item.channelId === channelId
  );

  return NextResponse.json({ typingUsers: activeTyping });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { channelId, userId, username, isTyping } = body;

    cleanup();

    // Remove existing entry for this user in this channel
    typingStore = typingStore.filter(
      (item) => !(item.channelId === channelId && String(item.userId) === String(userId))
    );

    if (isTyping !== false) {
      typingStore.push({
        channelId,
        userId,
        username: username || 'Seseorang',
        timestamp: Date.now(),
      });
    }

    const currentChannelTyping = typingStore.filter((i) => i.channelId === channelId);
    return NextResponse.json({ success: true, typingUsers: currentChannelTyping });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update typing status' }, { status: 500 });
  }
}
