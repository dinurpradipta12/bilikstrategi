import { NextRequest, NextResponse } from 'next/server';
import { getChatChannels, getViewComments, postViewComment } from '@/lib/clickup/chat';
import { getWorkspaceMembers } from '@/lib/clickup/users';
import { supabaseRest as supabase } from '@/lib/supabase/rest-client';

export const runtime = 'edge';

const REPLY_PREFIX = '↪ Membalas ';
const APP_META_PREFIX = '<!--BSCHAT:';
const APP_META_SUFFIX = '-->';

type AppChatSender = {
  id?: string | number;
  name?: string;
  email?: string;
  avatar?: string;
};

type AppChatMeta = {
  sender?: AppChatSender;
  reply?: {
    author?: string;
    text?: string;
  } | null;
};

type Participant = {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
};

type StoredChatMessage = {
  id: string;
  channel_id: string;
  user_id: string;
  user_name: string;
  user_avatar: string;
  text: string;
  created_at: string;
  parent_id: string | null;
  reply_count: number;
  reply_author: string | null;
  reply_text: string | null;
  clickup_sync_warning?: string | null;
};

declare global {
  var sharedChatStore: Record<string, any[]>;
}

if (!globalThis.sharedChatStore) {
  globalThis.sharedChatStore = {};
}

function normalizeChannelId(id: string): string {
  const clean = id.trim().toLowerCase();
  if (clean === 'dm_pair_allisha_dinur') return 'dm_pair_allisha_dinur';
  if (clean === 'dm_dinur') return 'dm_dinur';
  if (clean === 'dm_allisha') return 'dm_allisha';
  if (clean.includes('allisha')) return 'dm_allisha';
  if (clean.includes('dinur')) return 'dm_dinur';
  return id;
}

function normalizeStoredChannelId(id: string): string {
  const channelId = normalizeChannelId(id);
  if (channelId === 'dm_allisha' || channelId === 'dm_dinur') {
    return 'dm_pair_allisha_dinur';
  }
  return channelId;
}

function getChannelAliases(rawId: string) {
  const normalized = normalizeChannelId(rawId);
  const stored = normalizeStoredChannelId(rawId);
  const aliases = new Set([rawId, normalized, stored].filter(Boolean));
  if (stored === 'dm_pair_allisha_dinur') {
    aliases.add('dm_allisha');
    aliases.add('dm_dinur');
  }
  return Array.from(aliases);
}

function getUserClickUpToken(req: NextRequest) {
  return req.cookies.get('clickup_access_token')?.value || '';
}

function getWorkspaceClickUpToken() {
  return process.env.CLICKUP_API_KEY || process.env.CLICKUP_PERSONAL_TOKEN || '';
}

function getClickUpReadToken(req: NextRequest) {
  return getUserClickUpToken(req) || getWorkspaceClickUpToken();
}

function getRequestSender(req: NextRequest, sender?: AppChatSender | null): AppChatSender {
  if (sender?.name || sender?.id || sender?.email || sender?.avatar) {
    return sender;
  }

  const name = req.cookies.get('clickup_user_name')?.value || '';
  const email = req.cookies.get('clickup_user_email')?.value || '';
  const avatar = req.cookies.get('clickup_user_avatar')?.value || '';
  const id = req.cookies.get('clickup_user_id')?.value || '';
  const fallbackName = name || email || 'Pengguna';

  return {
    id,
    name: fallbackName,
    email,
    avatar: avatar || fallbackAvatar(fallbackName),
  };
}

async function clickUpV3Fetch<T>(endpoint: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`https://api.clickup.com/api/v3${endpoint}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: token,
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    let errorMessage = `ClickUp Chat API Error (${response.status})`;
    try {
      const body = await response.json();
      errorMessage = body.err || body.message || errorMessage;
    } catch {
      // ignore non-JSON error body
    }
    throw new Error(errorMessage);
  }

  if (response.status === 204) return {} as T;
  return await response.json();
}

function decodeAppMeta(rawText: string): { text: string; meta: AppChatMeta | null } {
  const markerStart = rawText.lastIndexOf(APP_META_PREFIX);
  if (markerStart === -1) return { text: rawText, meta: null };

  const markerEnd = rawText.indexOf(APP_META_SUFFIX, markerStart);
  if (markerEnd === -1) return { text: rawText, meta: null };

  const encoded = rawText.slice(markerStart + APP_META_PREFIX.length, markerEnd);
  try {
    const meta = JSON.parse(decodeURIComponent(encoded));
    const before = rawText.slice(0, markerStart).trimEnd();
    const after = rawText.slice(markerEnd + APP_META_SUFFIX.length).trimStart();
    return { text: `${before}${after ? `\n${after}` : ''}`, meta };
  } catch {
    return { text: rawText, meta: null };
  }
}

function parseAppChatText(rawText: string) {
  const decoded = decodeAppMeta(rawText || '');
  const match = decoded.text.match(/^↪ Membalas ([^:]+): "([\s\S]*?)"\n([\s\S]*)$/);
  if (!match) {
    return {
      text: decoded.text,
      reply_author: decoded.meta?.reply?.author || null,
      reply_text: decoded.meta?.reply?.text || null,
      sender: decoded.meta?.sender || null,
    };
  }

  return {
    text: match[3] || '',
    reply_author: decoded.meta?.reply?.author || match[1] || null,
    reply_text: decoded.meta?.reply?.text || match[2] || null,
    sender: decoded.meta?.sender || null,
  };
}

function buildClickUpChatText(
  text: string,
  replyTo?: { author?: string; text?: string } | null
) {
  if (replyTo?.text) {
    const author = (replyTo.author || 'Pesan').trim();
    const snippet = replyTo.text.replace(/\s+/g, ' ').trim().slice(0, 160).replace(/"/g, "'");
    return `${REPLY_PREFIX}${author}: "${snippet}"\n${text}`;
  }

  return text;
}

function fallbackAvatar(name: string) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=24324A&color=fff`;
}

function getMessageText(message: any) {
  return (
    message.content ||
    message.text ||
    message.comment_text ||
    message.comment?.[0]?.text ||
    message.body ||
    ''
  );
}

function getMessageAuthor(message: any) {
  return (
    message.user ||
    message.creator ||
    message.creator?.user ||
    message.author ||
    message.author?.user ||
    message.created_by ||
    message.created_by?.user ||
    message.sender ||
    message.sender?.user ||
    message.posted_by ||
    message.posted_by?.user ||
    {}
  );
}

function getAuthorIdCandidates(message: any, author: any) {
  return [
    author?.id,
    author?.user_id,
    author?.userid,
    message.user_id,
    message.userid,
    message.creator_id,
    message.created_by_id,
    message.author_id,
    message.sender_id,
    message.posted_by_id,
    message.owner_id,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
}

function getMemberFromMap(memberMap: Map<string, Participant>, message: any, author: any) {
  const candidates = [
    ...getAuthorIdCandidates(message, author),
    author?.email,
    author?.username,
    author?.name,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  for (const key of candidates) {
    const member = memberMap.get(key);
    if (member) return member;
  }
  return null;
}

function extractAttachmentsText(item: any): string {
  if (!item) return '';
  const urls: string[] = [];
  if (Array.isArray(item.attachments)) {
    item.attachments.forEach((att: any) => {
      const url = att?.url || att?.thumbnail_large || att?.thumbnail_small;
      if (url) urls.push(url);
    });
  }
  if (Array.isArray(item.comment)) {
    item.comment.forEach((part: any) => {
      const url = part?.attachment?.url || part?.attachment?.thumbnail_large;
      if (url) urls.push(url);
    });
  }
  if (urls.length === 0) return '';
  return '\n' + urls.map((u) => `![Gambar](${u})`).join('\n');
}

function formatChatApiMessage(
  message: any,
  channelId: string,
  memberMap = new Map<string, Participant>(),
  fallbackParticipant?: Participant | null
) {
  const rawTimestamp = message.created_at || message.date_created || message.date || message.posted_at || `${Date.now()}`;
  const parsedTimestamp = Number(rawTimestamp) || Date.parse(rawTimestamp) || Date.now();
  const parsed = parseAppChatText(getMessageText(message));
  const appSender = parsed.sender;
  const author = getMessageAuthor(message);
  const mappedMember = getMemberFromMap(memberMap, message, author);
  const authorName = mappedMember?.name || author.username || author.name || author.email || fallbackParticipant?.name || 'User ClickUp';
  const userName = appSender?.name || authorName;
  const userAvatar =
    appSender?.avatar ||
    mappedMember?.avatar ||
    author.profilePicture ||
    author.profile_picture ||
    author.avatar ||
    fallbackParticipant?.avatar ||
    fallbackAvatar(userName);

  const fullText = (parsed.text || '') + extractAttachmentsText(message);

  return {
    id: String(message.id || `msg-${parsedTimestamp}`),
    channel_id: channelId,
    user_id: String(appSender?.id || mappedMember?.id || author.id || author.user_id || fallbackParticipant?.id || ''),
    user_name: userName,
    user_avatar: userAvatar,
    text: fullText,
    created_at: new Date(parsedTimestamp).toISOString(),
    parent_id: null,
    reply_count: 0,
    reply_author: parsed.reply_author,
    reply_text: parsed.reply_text,
  };
}

function formatClickUpComment(c: any, channelId: string) {
  const rawDate = c.date || c.date_created || c.posted_at || `${Date.now()}`;
  const parsedTimestamp = parseInt(rawDate, 10) || Date.now();
  const parsed = parseAppChatText(c.comment_text || c.comment?.[0]?.text || '');
  const appSender = parsed.sender;
  const clickUpName = c.user?.username || 'User ClickUp';
  const userName = appSender?.name || clickUpName;
  const userAvatar = appSender?.avatar || c.user?.profilePicture || fallbackAvatar(userName);

  const fullText = (parsed.text || '') + extractAttachmentsText(c);

  return {
    id: c.id,
    channel_id: channelId,
    user_id: String(appSender?.id || c.user?.id || ''),
    user_name: userName,
    user_avatar: userAvatar,
    text: fullText,
    created_at: new Date(parsedTimestamp).toISOString(),
    parent_id: null,
    reply_count: 0,
    reply_author: parsed.reply_author,
    reply_text: parsed.reply_text,
  };
}

function rowToStoredMessage(row: any): StoredChatMessage {
  const raw = row.raw_data || {};
  return {
    id: String(row.id || raw.id),
    channel_id: raw.channel_id || row.channel_id,
    user_id: String(row.user_id || raw.user_id || ''),
    user_name: row.user_name || raw.user_name || 'Pengguna',
    user_avatar: row.user_avatar || raw.user_avatar || fallbackAvatar(row.user_name || raw.user_name || 'Pengguna'),
    text: row.text || raw.text || '',
    created_at: row.created_at || raw.created_at || new Date().toISOString(),
    parent_id: row.parent_id || raw.parent_id || null,
    reply_count: row.reply_count ?? raw.reply_count ?? 0,
    reply_author: row.reply_author || raw.reply_author || null,
    reply_text: row.reply_text || raw.reply_text || null,
    clickup_sync_warning: row.clickup_sync_warning || raw.clickup_sync_warning || null,
  };
}

function mergeChatMessages(messages: StoredChatMessage[]) {
  const map = new Map<string, StoredChatMessage>();
  messages.forEach((message) => {
    if (!message?.id) return;
    map.set(message.id, message);
  });
  return Array.from(map.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

function replaceMemoryChatMessage(oldId: string, message: StoredChatMessage, rawChannelId: string) {
  for (const id of getChannelAliases(rawChannelId)) {
    const current = globalThis.sharedChatStore[id] || [];
    const withoutOld = current.filter((item) => item?.id !== oldId && item?.id !== message.id);
    globalThis.sharedChatStore[id] = [...withoutOld, { ...message, channel_id: id }];
  }
}

async function getStoredChatMessages(channelId: string, rawChannelId: string) {
  const ids = Array.from(new Set([...getChannelAliases(rawChannelId), channelId].filter(Boolean)));
  try {
    const { data, error } = await supabase
      .from('app_chat_messages')
      .select('*')
      .in('normalized_channel_id', ids)
      .order('created_at', { ascending: true });

    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    return rows.map(rowToStoredMessage);
  } catch (err) {
    console.warn('[App Chat DB] Fallback to memory store:', err);
    return [];
  }
}

async function persistChatMessage(message: StoredChatMessage, normalizedChannelId: string, clickupSynced = false) {
  try {
    const { error } = await supabase.from('app_chat_messages').upsert(
      {
        id: message.id,
        channel_id: message.channel_id,
        normalized_channel_id: normalizedChannelId,
        user_id: message.user_id,
        user_name: message.user_name,
        user_avatar: message.user_avatar,
        text: message.text,
        parent_id: message.parent_id,
        reply_count: message.reply_count || 0,
        reply_author: message.reply_author || null,
        reply_text: message.reply_text || null,
        clickup_message_id: clickupSynced ? message.id : null,
        clickup_synced: clickupSynced,
        clickup_sync_warning: message.clickup_sync_warning || null,
        created_at: message.created_at,
        updated_at: new Date().toISOString(),
        raw_data: message,
      },
      { onConflict: 'id' }
    );

    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('[App Chat DB] Failed to persist message, memory fallback only:', err);
    return false;
  }
}

async function replaceStoredChatMessageId(oldId: string, message: StoredChatMessage, normalizedChannelId: string) {
  if (oldId === message.id) {
    await persistChatMessage(message, normalizedChannelId, true);
    return;
  }

  await persistChatMessage(message, normalizedChannelId, true);
  try {
    await supabase.from('app_chat_messages').delete().eq('id', oldId);
  } catch {
    // Non-blocking cleanup only.
  }
}

async function enqueueClickUpSyncJob(message: StoredChatMessage, normalizedChannelId: string, rawChannelId: string) {
  try {
    await supabase.from('app_chat_sync_jobs').insert({
      workspace_id: 'bilik-strategi',
      room_id: normalizedChannelId,
      message_id: message.id,
      provider: 'clickup',
      action: 'send_message',
      status: 'pending',
      payload: {
        channel_id: rawChannelId,
        normalized_channel_id: normalizedChannelId,
        text: message.text,
        sender: {
          id: message.user_id,
          name: message.user_name,
          avatar: message.user_avatar,
        },
        reply: {
          author: message.reply_author,
          text: message.reply_text,
        },
      },
    });
  } catch (err) {
    console.warn('[App Chat Sync Queue] ClickUp sync job skipped:', err);
  }
}

function extractItems(payload: any) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.messages)) return payload.messages;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

function buildMemberMap(members: any[]) {
  const map = new Map<string, Participant>();
  members.forEach((member) => {
    const participant: Participant = {
      id: String(member.id || ''),
      name: member.username || member.email || 'User ClickUp',
      email: member.email || '',
      avatar: member.profilePicture || undefined,
    };

    [participant.id, participant.email, participant.name]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase())
      .forEach((key) => map.set(key, participant));
  });
  return map;
}

function getChannelId(payload: any) {
  return payload?.id || payload?.data?.id || payload?.channel?.id || payload?.data?.channel?.id;
}

function dmSlug(channelId: string) {
  return channelId.replace(/^dm_/, '').toLowerCase();
}

function getDmTargetSlug(channelId: string, sender?: AppChatSender | null) {
  const slug = dmSlug(channelId);
  if (slug !== 'pair_allisha_dinur') return slug;
  const identity = `${sender?.name || ''} ${sender?.email || ''}`.toLowerCase();
  return identity.includes('allisha') || identity.includes('contact.dinurpradipta') ? 'dinur' : 'allisha';
}

async function resolveDmTargetUserId(channelId: string, teamId: string, token: string, sender?: AppChatSender | null) {
  const slug = getDmTargetSlug(channelId, sender);
  const members = await getWorkspaceMembers(teamId, token);
  const match = members.find((member) => {
    const name = (member.username || '').toLowerCase();
    const email = (member.email || '').toLowerCase();
    if (slug === 'dinur') return name.includes('dinur pradipta') || email.includes('snllabsarchive');
    if (slug === 'allisha') return name.includes('allisha') || email.includes('contact.dinurpradipta');
    if (slug === 'bayu') return name.includes('nuris') || name.includes('bayu');
    return name.includes(slug) || email.includes(slug);
  });

  return match?.id ? String(match.id) : null;
}

async function resolveDmTargetParticipant(channelId: string, teamId: string, token: string, sender?: AppChatSender | null) {
  const slug = getDmTargetSlug(channelId, sender);
  const members = await getWorkspaceMembers(teamId, token);
  const match = members.find((member) => {
    const name = (member.username || '').toLowerCase();
    const email = (member.email || '').toLowerCase();
    if (slug === 'dinur') return name.includes('dinur pradipta') || email.includes('snllabsarchive');
    if (slug === 'allisha') return name.includes('allisha') || email.includes('contact.dinurpradipta');
    if (slug === 'bayu') return name.includes('nuris') || name.includes('bayu');
    return name.includes(slug) || email.includes(slug);
  });

  return {
    participant: match
      ? {
          id: String(match.id),
          name: match.username || match.email || 'User ClickUp',
          email: match.email || '',
          avatar: match.profilePicture || undefined,
        }
      : null,
    members,
  };
}

async function getOrCreateDmChannel(teamId: string, targetUserId: string, token: string) {
  const direct = await clickUpV3Fetch<any>(`/workspaces/${teamId}/chat/channels/direct_message`, token, {
    method: 'POST',
    body: JSON.stringify({ user_ids: [targetUserId] }),
  });
  const channelId = getChannelId(direct);
  if (!channelId) throw new Error('Direct Message ClickUp tidak mengembalikan channel id');
  return channelId;
}

async function getDmMessages(rawChannelId: string, teamId: string, token: string, sender?: AppChatSender | null) {
  const channelId = normalizeChannelId(rawChannelId);
  const { participant, members } = await resolveDmTargetParticipant(channelId, teamId, token, sender);
  const targetUserId = participant?.id || null;
  if (!targetUserId) return [];

  const clickUpDmChannelId = await getOrCreateDmChannel(teamId, targetUserId, token);
  const data = await clickUpV3Fetch<any>(
    `/workspaces/${teamId}/chat/channels/${clickUpDmChannelId}/messages?limit=100&content_format=text/plain`,
    token
  );

  const memberMap = buildMemberMap(members);
  return extractItems(data).map((message: any) => formatChatApiMessage(message, rawChannelId, memberMap, participant));
}

async function postDmMessage(rawChannelId: string, text: string, sender: AppChatSender | null, replyTo: AppChatMeta['reply'], teamId: string, token: string) {
  const channelId = normalizeChannelId(rawChannelId);
  const targetUserId = await resolveDmTargetUserId(channelId, teamId, token, sender);
  if (!targetUserId) throw new Error('Target Direct Message ClickUp tidak ditemukan');

  const clickUpDmChannelId = await getOrCreateDmChannel(teamId, targetUserId, token);
  const outboundText = buildClickUpChatText(text, replyTo || null);
  const message = await clickUpV3Fetch<any>(`/workspaces/${teamId}/chat/channels/${clickUpDmChannelId}/messages`, token, {
    method: 'POST',
    body: JSON.stringify({
      type: 'message',
      content: outboundText,
      content_format: 'text/plain',
    }),
  });

  return formatChatApiMessage(message?.data || message, rawChannelId);
}

export async function GET(req: NextRequest) {
  try {
    const token = getClickUpReadToken(req);
    const { searchParams } = new URL(req.url);
    const rawChannelId = searchParams.get('channelId');
    const teamId = process.env.CLICKUP_WORKSPACE_ID || process.env.CLICKUP_TEAM_ID || '90182855619';

    if (rawChannelId) {
      const channelId = normalizeChannelId(rawChannelId);
      const memoryMsgs = mergeChatMessages(getChannelAliases(rawChannelId).flatMap((id) => globalThis.sharedChatStore[id] || []));
      const storedMsgs = await getStoredChatMessages(channelId, rawChannelId);
      const localMsgs = mergeChatMessages([...storedMsgs, ...memoryMsgs]);

      // If channelId has a ClickUp view format (contains hyphen)
      if (rawChannelId.includes('-')) {
        try {
          const data = await getViewComments(rawChannelId, token);
          const clickupMsgs = (data.comments || []).map((c: any) => formatClickUpComment(c, rawChannelId));

          // Merge localMsgs + clickupMsgs uniquely by id
          const allMsgs = mergeChatMessages([...clickupMsgs, ...localMsgs]);

          return NextResponse.json({ messages: allMsgs });
        } catch {
          return NextResponse.json({ messages: localMsgs });
        }
      }

      if (channelId.startsWith('dm_')) {
        try {
          const clickupMsgs = await getDmMessages(channelId, teamId, token, getRequestSender(req));
          const allMsgs = mergeChatMessages([...clickupMsgs, ...localMsgs]);

          return NextResponse.json({ messages: allMsgs });
        } catch (err) {
          console.warn('[ClickUp Chat API] Non-blocking direct message fetch fallback:', err);
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
    const userToken = getUserClickUpToken(req);
    const body = await req.json();
    const { channelId: rawChannelId, text, sender, replyTo, clientMessageId } = body;
    const teamId = process.env.CLICKUP_WORKSPACE_ID || process.env.CLICKUP_TEAM_ID || '90182855619';
    const syncClickUpInline = process.env.CLICKUP_CHAT_INLINE_SYNC === 'true';

    if (!rawChannelId || !text) {
      return NextResponse.json({ error: 'channelId and text are required' }, { status: 400 });
    }

    const channelId = normalizeChannelId(rawChannelId);
    const storedChannelId = normalizeStoredChannelId(rawChannelId);
    const appSender = getRequestSender(req, sender || null);
    const senderName = appSender.name || appSender.email || 'Pengguna';
    const outboundText = buildClickUpChatText(text, replyTo || null);

    const newMsg: StoredChatMessage = {
      id: clientMessageId || `msg-${Date.now()}`,
      channel_id: rawChannelId,
      user_id: String(appSender.id || ''),
      user_name: senderName,
      user_avatar: appSender.avatar || fallbackAvatar(senderName),
      text,
      created_at: new Date().toISOString(),
      parent_id: null,
      reply_count: 0,
      reply_author: replyTo?.author || null,
      reply_text: replyTo?.text || null,
      clickup_sync_warning: null,
    };

    // Store in global memory store for instant cross-session persistence
    for (const id of getChannelAliases(rawChannelId)) {
      if (!globalThis.sharedChatStore[id]) {
        globalThis.sharedChatStore[id] = [];
      }
      globalThis.sharedChatStore[id].push({ ...newMsg, channel_id: id });
    }

    await persistChatMessage(newMsg, storedChannelId, false);
    await enqueueClickUpSyncJob(newMsg, storedChannelId, rawChannelId);

    if (syncClickUpInline && channelId.startsWith('dm_') && userToken) {
      try {
        const previousId = newMsg.id;
        const clickUpMsg = await postDmMessage(channelId, text, appSender, replyTo || null, teamId, userToken);
        newMsg.id = clickUpMsg.id;
        newMsg.created_at = clickUpMsg.created_at;
        newMsg.clickup_sync_warning = null;
        replaceMemoryChatMessage(previousId, newMsg, rawChannelId);
        await replaceStoredChatMessageId(previousId, newMsg, storedChannelId);
      } catch (err) {
        console.warn('[ClickUp Chat API] Non-blocking direct message post fallback:', err);
      }
    }

    if (syncClickUpInline && rawChannelId.includes('-') && userToken) {
      try {
        const previousId = newMsg.id;
        const comment = await postViewComment(rawChannelId, outboundText, undefined, true, userToken);
        if (comment && comment.id) {
          newMsg.id = comment.id;
        }
        newMsg.clickup_sync_warning = null;
        replaceMemoryChatMessage(previousId, newMsg, rawChannelId);
        await replaceStoredChatMessageId(previousId, newMsg, storedChannelId);
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
