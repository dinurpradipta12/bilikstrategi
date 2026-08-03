'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronRight, Hash, LoaderCircle, MessageCircle, Send, X } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import {
  CHAT_NOTIFICATION_EVENT,
  getChatChannelAliases,
  getChatUnreadTotal,
  getChatUnreadForChannel,
  incrementChatUnread,
  normalizeChatChannelId,
  publishChatNotification,
  readChatNotifications,
  readChatUnreadMap,
  type ChatNotification,
} from '@/lib/chat/notification-store';

type FloatingChannel = {
  id: string;
  name: string;
  avatar?: string;
};

type FloatingUser = {
  id: string;
  name: string;
  email: string;
  avatar: string;
};

type FloatingTab = {
  channelId: string;
  channelName: string;
  unread: number;
  latest: ChatNotification | null;
};

function fallbackAvatar(name: string) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=24324A&color=fff`;
}

function channelLabel(channelId: string) {
  const knownNames: Record<string, string> = {
    allisha: 'Allisha',
    dinur: 'Dinur Pradipta',
    doni: 'Doni Setiawan',
    amalia: 'Amalia Fitriani',
    bayu: 'Mohammad Nuris Bayu Samodro',
    mei: 'Mei Indraningrum',
    syaiful: 'Syaiful Akhsin',
  };
  if (channelId === 'dm_pair_allisha_dinur') return 'DM: Allisha & Dinur';
  const dmSlug = channelId.match(/^dm_(.+)$/i)?.[1]?.toLowerCase();
  if (dmSlug) return `DM: ${knownNames[dmSlug] || dmSlug.replace(/[-_]/g, ' ')}`;
  return channelId || 'Agency Chat';
}

function readStoredUser() {
  if (typeof window === 'undefined') return { id: '', name: '', email: '', avatar: '' };
  try {
    const parsed = JSON.parse(localStorage.getItem('bilik_current_user') || '{}');
    return {
      id: String(parsed.id || parsed.user_id || ''),
      name: parsed.username || parsed.name || '',
      email: parsed.email || '',
      avatar: parsed.avatar || '',
    };
  } catch {
    return { id: '', name: '', email: '', avatar: '' };
  }
}

function isOwnMessage(message: Pick<ChatNotification, 'senderName'> & { userId?: string }, currentUser: { id: string; name: string }) {
  if (message.userId && currentUser.id && message.userId === currentUser.id) return true;
  return Boolean(
    message.senderName &&
    currentUser.name &&
    message.senderName.toLowerCase().trim() === currentUser.name.toLowerCase().trim()
  );
}

export default function FloatingChat() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<ChatNotification[]>(() => readChatNotifications());
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>(() => readChatUnreadMap());
  const [channels, setChannels] = useState<FloatingChannel[]>([]);
  const [currentUser, setCurrentUser] = useState<FloatingUser>(readStoredUser);
  const [replyText, setReplyText] = useState('');
  const [replySending, setReplySending] = useState(false);
  const [replyError, setReplyError] = useState('');
  const [sentReply, setSentReply] = useState<ChatNotification | null>(null);
  const currentUserRef = useRef(currentUser);
  const channelsRef = useRef<FloatingChannel[]>([]);
  const seenMessageIdsRef = useRef<Set<string>>(new Set(notifications.map((item) => item.id)));

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    channelsRef.current = channels;
  }, [channels]);

  useEffect(() => {
    fetch('/api/clickup/user', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        if (!data.user) return;
        setCurrentUser({
          id: String(data.user.id || ''),
          name: data.user.username || data.user.email || '',
          email: data.user.email || '',
          avatar: data.user.profilePicture || data.user.avatar || '',
        });
      })
      .catch(() => {
        // The floating inbox can still show persisted notifications.
      });
  }, []);

  useEffect(() => {
    if (pathname.startsWith('/chat')) return;

    fetch('/api/clickup/chat', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        const nextChannels = Array.isArray(data.channels)
          ? data.channels.map((channel: any) => ({
              id: String(channel.id || ''),
              name: String(channel.name || channel.id || 'Agency Chat'),
              avatar: channel.avatar || channel.image || undefined,
            })).filter((channel: FloatingChannel) => channel.id)
          : [];
        setChannels(nextChannels);
      })
      .catch(() => {
        // Channel labels fall back to the stored channel id.
      });
  }, [pathname]);

  useEffect(() => {
    const handleStoredNotifications = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (Array.isArray(detail?.notifications)) setNotifications(detail.notifications);
      if (typeof detail?.count === 'number') {
        const current = readChatUnreadMap();
        setUnreadMap(current);
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'bilik_chat_notifications') setNotifications(readChatNotifications());
      if (event.key === 'bilik_chat_unread_map' || event.key === 'bilik_chat_unread_count') {
        setUnreadMap(readChatUnreadMap());
      }
    };

    window.addEventListener(CHAT_NOTIFICATION_EVENT, handleStoredNotifications);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(CHAT_NOTIFICATION_EVENT, handleStoredNotifications);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  useEffect(() => {
    if (pathname.startsWith('/chat') || !isSupabaseConfigured) return;

    const subscription = supabase
      .channel('floating-chat-messages-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'app_chat_messages' },
        (payload) => {
          const row = payload.new as any;
          const raw = row.raw_data || {};
          const messageId = String(row.id || raw.id || '');
          const rawChannelId = String(row.channel_id || raw.channel_id || row.normalized_channel_id || '');
          const channelId = normalizeChatChannelId(rawChannelId) || rawChannelId;
          if (!messageId || !channelId || seenMessageIdsRef.current.has(messageId)) return;

          const senderName = row.user_name || raw.user_name || 'Pengguna';
          if (isOwnMessage({ senderName, userId: String(row.user_id || raw.user_id || '') }, currentUserRef.current)) {
            seenMessageIdsRef.current.add(messageId);
            return;
          }

          seenMessageIdsRef.current.add(messageId);
          const matchedChannel = channelsRef.current.find((channel) => channel.id === channelId);
          const notification: ChatNotification = {
            id: messageId,
            senderName,
            senderAvatar: row.user_avatar || raw.user_avatar || fallbackAvatar(senderName),
            channelName: matchedChannel?.name || channelLabel(channelId),
            channelId,
            text: row.text || raw.text || '',
            createdAt: row.created_at || raw.created_at || new Date().toISOString(),
          };
          const currentUnread = readChatUnreadMap();
          const nextUnread = incrementChatUnread(currentUnread, channelId);
          const accepted = publishChatNotification(notification, nextUnread);
          if (!accepted) return;
          setUnreadMap(nextUnread);
          setNotifications((previous) => [notification, ...previous.filter((item) => item.id !== messageId)].slice(0, 30));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [pathname]);

  const tabs = useMemo<FloatingTab[]>(() => {
    const tabMap = new Map<string, FloatingTab>();
    notifications.forEach((notification) => {
      const existing = tabMap.get(notification.channelId);
      if (!existing || new Date(notification.createdAt).getTime() > new Date(existing.latest?.createdAt || 0).getTime()) {
        tabMap.set(notification.channelId, {
          channelId: notification.channelId,
          channelName: notification.channelName,
          unread: getChatUnreadForChannel(unreadMap, notification.channelId),
          latest: notification,
        });
      }
    });
    Object.entries(unreadMap).forEach(([channelId, unread]) => {
      if (!tabMap.has(channelId)) {
        const knownChannel = channels.find((channel) => channel.id === channelId);
        tabMap.set(channelId, {
          channelId,
          channelName: knownChannel?.name || channelLabel(channelId),
          unread,
          latest: null,
        });
      }
    });
    return Array.from(tabMap.values()).sort((a, b) => {
      const aTime = a.latest ? new Date(a.latest.createdAt).getTime() : 0;
      const bTime = b.latest ? new Date(b.latest.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [channels, notifications, unreadMap]);

  useEffect(() => {
    if (!selectedChannelId || !tabs.some((tab) => tab.channelId === selectedChannelId)) {
      setSelectedChannelId(tabs[0]?.channelId || null);
    }
  }, [selectedChannelId, tabs]);

  if (pathname.startsWith('/chat')) return null;

  const totalUnread = getChatUnreadTotal(unreadMap);
  const selectedTab = tabs.find((tab) => tab.channelId === selectedChannelId) || tabs[0] || null;
  const latestForSelectedTab = selectedTab
    ? [selectedTab.latest, sentReply?.channelId === selectedTab.channelId ? sentReply : null]
      .filter((message): message is ChatNotification => Boolean(message))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null
    : null;

  const resolveReplyChannelId = (channelId: string) => {
    const aliases = new Set(getChatChannelAliases(channelId));
    const matchingChannels = channels.filter((channel) =>
      getChatChannelAliases(channel.id).some((alias) => aliases.has(alias))
    );
    if (matchingChannels.length === 0) return channelId;
    if (matchingChannels.length === 1) return matchingChannels[0].id;

    const selfTokens = [
      currentUser.name.toLowerCase().trim().split(/\s+/)[0],
      currentUser.email.toLowerCase().trim().split('@')[0].split(/[._-]/)[0],
    ].filter((token) => token.length > 2);
    return matchingChannels.find((channel) => {
      const channelIdentity = channel.name.toLowerCase();
      return !selfTokens.some((token) => channelIdentity.includes(token));
    })?.id || matchingChannels[0].id;
  };

  const handleQuickReply = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = replyText.trim();
    if (!text || !selectedTab || replySending) return;

    setReplySending(true);
    setReplyError('');
    const clientMessageId = `floating-msg-${Date.now()}`;
    const replyChannelId = resolveReplyChannelId(selectedTab.channelId);
    const sender = {
      id: currentUser.id,
      name: currentUser.name || 'Pengguna',
      email: currentUser.email,
      avatar: currentUser.avatar || fallbackAvatar(currentUser.name),
    };

    try {
      const response = await fetch('/api/clickup/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: replyChannelId,
          text,
          sender,
          clientMessageId,
          replyTo: selectedTab.latest
            ? { author: selectedTab.latest.senderName, text: selectedTab.latest.text }
            : undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Balasan gagal dikirim');

      const reply: ChatNotification = {
        id: String(data.id || clientMessageId),
        senderName: data.user_name || sender.name,
        senderAvatar: data.user_avatar || sender.avatar,
        channelName: selectedTab.channelName,
        channelId: selectedTab.channelId,
        text: data.text || text,
        createdAt: data.created_at || new Date().toISOString(),
      };
      setSentReply(reply);
      setReplyText('');
    } catch (error) {
      setReplyError(error instanceof Error ? error.message : 'Balasan gagal dikirim');
    } finally {
      setReplySending(false);
    }
  };

  const openFullChat = (channelId?: string) => {
    if (channelId) localStorage.setItem('bilik_chat_open_channel', channelId);
    setOpen(false);
    router.push('/chat');
  };

  return (
    <div className="hidden md:flex fixed right-4 bottom-5 md:right-6 md:bottom-6 z-[60] flex-col items-end gap-3">
      {open && (
        <section className="w-[min(380px,calc(100vw-2rem))] h-[min(500px,calc(100vh-7rem))] bg-white border border-[#E8E8EC] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-fade-in">
          <header className="px-4 py-3 border-b border-[#E8E8EC] bg-[#24324A] text-white flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <MessageCircle className="w-4 h-4 text-[#F26B5E] flex-shrink-0" />
              <div className="min-w-0">
                <h2 className="text-xs font-extrabold truncate">Pesan Masuk</h2>
                <p className="text-[10px] text-white/65 truncate">{tabs.length ? `${tabs.length} percakapan baru` : 'Tidak ada pesan baru'}</p>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-white/10" title="Tutup chat">
              <X className="w-4 h-4" />
            </button>
          </header>

          {tabs.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center px-6 text-center text-[#737680]">
              <MessageCircle className="w-8 h-8 text-[#E8E8EC] mb-2" />
              <p className="text-xs font-semibold text-[#24324A]">Belum ada pesan baru</p>
              <p className="text-[10px] mt-1">Pesan DM atau channel akan muncul di sini.</p>
            </div>
          ) : (
            <>
              <div className="px-3 py-2 border-b border-[#E8E8EC] flex gap-1.5 overflow-x-auto">
                {tabs.map((tab) => (
                  <button
                    key={tab.channelId}
                    type="button"
                    onClick={() => setSelectedChannelId(tab.channelId)}
                    className={`relative flex-shrink-0 max-w-40 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${
                      selectedTab?.channelId === tab.channelId
                        ? 'bg-[#EEF2F7] text-[#24324A]'
                        : 'text-[#737680] hover:bg-[#F7F7F8]'
                    }`}
                    title={tab.channelName}
                  >
                    <span className="block truncate">{tab.channelName.replace('💬 ', '').replace('👤 ', '')}</span>
                    {tab.unread > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 flex items-center justify-center bg-[#F26B5E] text-white text-[8px] rounded-full">
                        {tab.unread > 99 ? '99+' : tab.unread}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-4">
                {latestForSelectedTab ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={latestForSelectedTab.senderAvatar} alt={latestForSelectedTab.senderName} className="w-9 h-9 rounded-full object-cover border border-[#E8E8EC]" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#24324A] truncate">{latestForSelectedTab.senderName}</p>
                        <p className="flex items-center gap-1 text-[10px] text-[#737680] truncate">
                          <Hash className="w-2.5 h-2.5" />{selectedTab.channelName}
                        </p>
                      </div>
                    </div>
                    <div className="bg-[#F4F4F5] rounded-2xl rounded-tl-sm px-3 py-2.5 text-xs text-[#202124] whitespace-pre-wrap break-words">
                      {latestForSelectedTab.text}
                    </div>
                    <p className="text-[10px] text-[#737680]">
                      {selectedTab.unread} pesan belum dibaca di percakapan ini.
                    </p>
                    {sentReply?.channelId === selectedTab.channelId && (
                      <div className="border border-[#4F9D78]/25 bg-[#EEF8F3] rounded-xl px-3 py-2 text-[10px] text-[#356D53]">
                        Balasan terkirim: <span className="font-semibold">{sentReply.text}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-[#737680]">Buka percakapan ini untuk melihat pesan.</p>
                )}
              </div>

              <div className="p-3 border-t border-[#E8E8EC] bg-[#F7F7F8]">
                <form onSubmit={handleQuickReply} className="flex items-center gap-2 mb-2">
                  <input
                    value={replyText}
                    onChange={(event) => setReplyText(event.target.value)}
                    placeholder="Tulis balasan..."
                    disabled={!selectedTab || replySending}
                    className="min-w-0 flex-1 px-3 py-2 bg-white border border-[#E8E8EC] rounded-lg text-xs text-[#202124] outline-none focus:border-[#7B68EE] disabled:bg-[#F4F4F5]"
                  />
                  <button
                    type="submit"
                    disabled={!replyText.trim() || replySending || !selectedTab}
                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#7B68EE] text-white hover:bg-[#6655D2] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="Kirim balasan"
                    aria-label="Kirim balasan"
                  >
                    {replySending ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </form>
                {replyError && <p className="mb-2 text-[10px] text-[#D95858]">{replyError}</p>}
                <button type="button" onClick={() => openFullChat(selectedTab?.channelId)} className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 bg-[#24324A] text-white text-xs font-bold rounded-xl hover:bg-[#1A2536] transition-colors">
                  Buka Agency Chat
                  <ChevronRight className="w-3.5 h-3.5 text-[#F26B5E]" />
                </button>
              </div>
            </>
          )}
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative w-14 h-14 rounded-full bg-[#24324A] text-white shadow-xl flex items-center justify-center hover:bg-[#1A2536] transition-colors"
        title={open ? 'Tutup pesan' : 'Buka pesan masuk'}
      >
        {open ? <X className="w-5 h-5" /> : <MessageCircle className="w-6 h-6 text-[#F26B5E]" />}
        {totalUnread > 0 && !open && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 flex items-center justify-center bg-[#F26B5E] text-white text-[9px] font-extrabold rounded-full ring-2 ring-white">
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
        {!open && <span className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-[#4F9D78] border-2 border-[#24324A] rounded-full" />}
      </button>
    </div>
  );
}
