import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { DEFAULT_APP_WORKSPACE_ID, getServerWorkspaceContext } from '@/lib/auth/server-workspace-context';

export async function GET(req: NextRequest) {
  const admin = createSupabaseAdminClient();
  const channelId = new URL(req.url).searchParams.get('channelId');
  if (!channelId) return NextResponse.json({ channels: [{ id: 'general', name: 'Diskusi Tim' }] });
  if (channelId !== 'general') return NextResponse.json({ error: 'Channel tidak ditemukan.' }, { status: 404 });

  const { data, error } = await admin.from('app_chat_messages')
    .select('id,channel_id,user_id,user_name,user_avatar,text,created_at,parent_id,reply_count,reply_author,reply_text')
    .eq('workspace_id', DEFAULT_APP_WORKSPACE_ID)
    .eq('normalized_channel_id', channelId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 503 });
  return NextResponse.json({ messages: data || [] }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const context = await getServerWorkspaceContext(req);
  if (!context.identity.id || !context.isActive) return NextResponse.json({ error: 'Sesi tidak ditemukan.' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const channelId = String(body.channelId || 'general');
  const message = String(body.text || '').trim();
  if (channelId !== 'general' || !message || message.length > 4000) {
    return NextResponse.json({ error: 'Pesan atau channel tidak valid.' }, { status: 400 });
  }
  const row = {
    id: crypto.randomUUID(),
    workspace_id: DEFAULT_APP_WORKSPACE_ID,
    channel_id: channelId,
    normalized_channel_id: channelId,
    user_id: context.identity.id,
    user_name: context.identity.name,
    user_avatar: context.identity.avatarUrl,
    text: message,
    reply_author: typeof body.replyTo?.author === 'string' ? body.replyTo.author.slice(0, 180) : null,
    reply_text: typeof body.replyTo?.text === 'string' ? body.replyTo.text.slice(0, 500) : null,
  };
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from('app_chat_messages').insert(row).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 503 });
  return NextResponse.json(data, { status: 201 });
}
