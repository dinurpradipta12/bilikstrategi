'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare, Send, Hash, RefreshCw,
  MessageCircle, X, Reply, ChevronRight,
  User, Bell, AtSign, Check, CheckCheck, PhoneCall,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import SyncUpButton from '@/components/syncup/SyncUpButton';
import { AgencyChatMessage } from '@/lib/mock/data';

// ─── Types ───────────────────────────────────────────────────────────────────

type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read';

interface ChatMessageItem extends AgencyChatMessage {
  parent_id?: string | null;
  reply_count?: number;
  replies?: ChatMessageItem[];
  /** Only set for messages sent by current user in this session */
  localStatus?: MessageStatus;
  /** Temp ID before server confirms */
  isOptimistic?: boolean;
}

interface ToastNotification {
  id: string;
  senderName: string;
  senderAvatar: string;
  channelName: string;
  channelId: string;
  text: string;
  exiting?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function chatCacheKey(channelId: string) {
  return `bilik_chat_messages_${channelId}`;
}

/** Render WhatsApp-style status ticks for own messages */
function MessageStatusIcon({ status }: { status: MessageStatus }) {
  if (status === 'sending') {
    return (
      <span title="Mengirim…" className="inline-flex items-center">
        <svg className="w-3 h-3 text-white/40 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
        </svg>
      </span>
    );
  }
  if (status === 'sent') {
    return <Check className="w-3 h-3 text-white/50" aria-label="Terkirim" />;
  }
  if (status === 'delivered') {
    return <CheckCheck className="w-3 h-3 text-white/60" aria-label="Tersampaikan" />;
  }
  // read
  return <CheckCheck className="w-3 h-3 text-[#4FC3F7]" aria-label="Dibaca" />;
}

function renderMentionedText(text: string, members: Array<{ username: string }> = []) {
  if (!text || !text.includes('@')) return text;

  const memberNames = members.map((m) => m.username).filter(Boolean);
  const allNames = Array.from(new Set(memberNames)).sort((a, b) => b.length - a.length);
  if (allNames.length === 0) return text;

  const escaped = allNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const regex = new RegExp(`(@(?:${escaped}))`, 'gi');

  const parts = text.split(regex);
  return parts.map((part, idx) => {
    if (part.startsWith('@')) {
      return (
        <span
          key={idx}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-[#7B68EE]/20 text-[#7B68EE] font-extrabold text-[11px] mx-0.5 border border-[#7B68EE]/30"
        >
          <AtSign className="w-3 h-3 text-[#7B68EE] inline flex-shrink-0" />
          {part.slice(1)}
        </span>
      );
    }
    return part;
  });
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ChatPage() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [channels, setChannels] = useState<Array<{
    id: string; name: string; type: string; unread_count: number; avatar?: string; email?: string;
  }>>([
    { id: '7-90182855619-8',  name: '📢 General - Bilik Strategi Workspace', type: 'general',  unread_count: 0 },
    { id: '4-901811772332-8', name: '💬 Media Brand',      type: 'project', unread_count: 0 },
    { id: '6-901819386455-8', name: '💬 Brainstorming',    type: 'project', unread_count: 0 },
    { id: '6-901819384971-8', name: '💬 Approval Script',  type: 'project', unread_count: 0 },
    { id: '6-901819385000-8', name: '💬 Approval Content', type: 'project', unread_count: 0 },
    { id: 'dm_allisha',       name: '👤 DM: Allisha',      type: 'direct',  unread_count: 0 },
    { id: 'dm_dinur',         name: '👤 DM: Dinur Pradipta', type: 'direct', unread_count: 0 },
    { id: 'dm_doni',          name: '👤 DM: Doni Setiawan', type: 'direct', unread_count: 0 },
    { id: 'dm_amalia',        name: '👤 DM: Amalia Fitriani', type: 'direct', unread_count: 0 },
    { id: 'dm_bayu',          name: '👤 DM: Mohammad Nuris Bayu Samodro', type: 'direct', unread_count: 0 },
    { id: 'dm_mei',           name: '👤 DM: Mei Indraningrum', type: 'direct', unread_count: 0 },
    { id: 'dm_syaiful',       name: '👤 DM: Syaiful Akhsin', type: 'direct', unread_count: 0 },
  ]);

  const [activeChannelId, setActiveChannelId]       = useState('7-90182855619-8');
  const [rawMessages, setRawMessages]               = useState<ChatMessageItem[]>([]);
  const [textInput, setTextInput]                   = useState('');
  const [threadInput, setThreadInput]               = useState('');
  const [activeThreadMessage, setActiveThreadMessage] = useState<ChatMessageItem | null>(null);
  const [liveMembers, setLiveMembers]               = useState<Array<{ id: number; username: string; email: string; avatar: string }>>([]);
  const [loadingMessages, setLoadingMessages]       = useState(false);
  const [unreadMap, setUnreadMap]                   = useState<Record<string, number>>({});
  const [mobileChannelsOpen, setMobileChannelsOpen] = useState(false);
  
  // Authenticated user (default Dinur Pradipta)
  const [currentUser, setCurrentUser] = useState({
    id: 276885530,
    username: 'Dinur Pradipta',
    email: 'snllabsarchive@gmail.com',
    avatar: 'https://attachments.clickup.com/profilePictures/276885530_r2L.jpg',
  });

  // local status map: messageId → status (for own messages)
  const [statusMap, setStatusMap]     = useState<Record<string, MessageStatus>>({});

  // typing debounce
  const typingTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef     = useRef(false);

  // Mention Autocomplete State
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Toast
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  // Scroll anchors
  const messagesEndRef  = useRef<HTMLDivElement>(null);
  const threadEndRef    = useRef<HTMLDivElement>(null);
  const previousCountRef = useRef<number>(0);

  // ── Scroll helpers ────────────────────────────────────────────────────────
  const scrollToBottom      = (smooth = true) => setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' }), 80);
  const scrollToThreadBottom = (smooth = true) => setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' }), 80);

  // ── Toast helper ──────────────────────────────────────────────────────────
  const showToast = useCallback((data: ToastNotification) => {
    const id = data.id;
    setToasts((prev) => [...prev.slice(-3), { ...data, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 300);
    }, 5000);
  }, []);

  const triggerNotification = useCallback((data: ToastNotification) => {
    showToast({ ...data, id: `toast-${Date.now()}` });
    setUnreadMap((prev) => ({ ...prev, [data.channelId]: (prev[data.channelId] || 0) + 1 }));
  }, [showToast]);

  // ── Simulate "read" after another member receives message ────────────────
  const advanceStatusToRead = useCallback((msgId: string) => {
    // sent → delivered after 800ms
    setTimeout(() => {
      setStatusMap((prev) => ({ ...prev, [msgId]: 'delivered' }));
    }, 800);
    // delivered → read after 2–5s (random, simulating other user opening)
    const readDelay = 2000 + Math.random() * 3000;
    setTimeout(() => {
      setStatusMap((prev) => ({ ...prev, [msgId]: 'read' }));
    }, readDelay);
  }, []);

  // ── Load workspace data in parallel ───────────────────────────────────────
  useEffect(() => {
    // 1. Fetch current logged-in user profile immediately
    fetch('/api/clickup/user')
      .then((res) => res.json())
      .then((userData) => {
        if (userData.user) {
          setCurrentUser({
            id: userData.user.id,
            username: userData.user.username,
            email: userData.user.email,
            avatar: userData.user.profilePicture ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.user.username)}&background=24324A&color=fff`,
          });
        }
      })
      .catch((err) => console.warn('[Chat] User fetch error:', err));

    // 2. Fetch team members list immediately
    fetch('/api/clickup/teams')
      .then((res) => res.json())
      .then((teamData) => {
        if (teamData.members?.length > 0) {
          setLiveMembers(teamData.members.map((m: any) => ({
            id: m.id,
            username: m.username || m.email?.split('@')[0] || 'Team Member',
            email: m.email || '',
            avatar: m.profilePicture ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(m.username || 'User')}&background=24324A&color=fff`,
          })));
        }
      })
      .catch((err) => console.warn('[Chat] Team fetch error:', err));

    // 3. Fetch chat channels list
    fetch('/api/clickup/chat')
      .then((res) => res.json())
      .then((chatData) => {
        if (chatData.channels?.length > 0) {
          const unique: typeof channels = [];
          const seen = new Set<string>();
          chatData.channels.forEach((c: any) => {
            const key = `${c.id}-${c.name}`;
            if (!seen.has(key)) { seen.add(key); unique.push(c); }
          });
          setChannels(unique);
        }
      })
      .catch((err) => console.warn('[Chat] Channels fetch error:', err));
  }, []);

  const isCurrentUserMessage = useCallback((msg: Pick<ChatMessageItem, 'user_id' | 'user_name'>) => {
    const messageUserId = String(msg.user_id || '');
    const currentUserId = String(currentUser.id || '');
    if (messageUserId && currentUserId && messageUserId === currentUserId) return true;

    const messageName = (msg.user_name || '').toLowerCase().trim();
    const currentName = (currentUser.username || '').toLowerCase().trim();
    if (!messageName || !currentName || currentName === 'pengguna') return false;
    return messageName === currentName;
  }, [currentUser.id, currentUser.username]);

  // ── Fetch messages ────────────────────────────────────────────────────────
  const fetchActiveMessages = useCallback(async (channelId: string, shouldScroll = false) => {
    setLoadingMessages(true);
    try {
      const res  = await fetch(`/api/clickup/chat?channelId=${channelId}`);
      const data = await res.json();
      if (data.messages) {
        const newMsgs: ChatMessageItem[] = data.messages;

        if (previousCountRef.current > 0 && newMsgs.length > previousCountRef.current) {
          const latestMsg = newMsgs[newMsgs.length - 1];
          if (!isCurrentUserMessage(latestMsg)) {
            const chName = channels.find((c) => c.id === channelId)?.name || 'Channel';
            triggerNotification({
              id: latestMsg.id,
              senderName: latestMsg.user_name,
              senderAvatar: latestMsg.user_avatar,
              channelName: chName.replace('💬 ', '').replace('📢 ', ''),
              channelId,
              text: latestMsg.text,
            });
          }
        }
        previousCountRef.current = newMsgs.length;

        // Merge: keep localStatus for optimistic messages
        setRawMessages((prev) => {
          if (newMsgs.length === 0 && prev.some((m) => m.channel_id === channelId)) {
            return prev;
          }

          const statusPreserved = newMsgs.map((nm) => {
            const existing = prev.find((p) => p.id === nm.id);
            return existing?.localStatus ? { ...nm, localStatus: existing.localStatus } : nm;
          });
          if (typeof window !== 'undefined') {
            localStorage.setItem(chatCacheKey(channelId), JSON.stringify(statusPreserved));
          }
          return statusPreserved;
        });

        if (shouldScroll) scrollToBottom(true);
      }
  } catch (err) {
      console.warn('[Chat] Gagal memuat pesan:', err);
    } finally {
      setLoadingMessages(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels, isCurrentUserMessage, triggerNotification]);

  // ── Typing API integration ────────────────────────────────────────────────
  const [otherTypingUsers, setOtherTypingUsers] = useState<Array<{ userId: string | number; username: string }>>([]);

  const sendTypingStatus = useCallback(async (isTyping: boolean) => {
    if (!activeChannelId) return;
    try {
      await fetch('/api/typing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: activeChannelId,
          userId: currentUser.id,
          username: currentUser.username,
          isTyping,
        }),
      });
    } catch {
      // ignore
    }
  }, [activeChannelId, currentUser.id, currentUser.username]);

  const fetchTypingStatus = useCallback(async () => {
    if (!activeChannelId) return;
    try {
      const res = await fetch(`/api/typing?channel_id=${encodeURIComponent(activeChannelId)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.typingUsers)) {
          const others = data.typingUsers.filter(
            (u: { userId: string | number }) => String(u.userId) !== String(currentUser.id)
          );
          setOtherTypingUsers(others);
        }
      }
    } catch {
      // ignore
    }
  }, [activeChannelId, currentUser.id]);

  useEffect(() => {
    if (!activeChannelId) return;
    setActiveThreadMessage(null);
    previousCountRef.current = 0;
    setIsSelfTyping(false);
    isTypingRef.current = false;
    setOtherTypingUsers([]);
    setUnreadMap((prev) => ({ ...prev, [activeChannelId]: 0 }));
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(chatCacheKey(activeChannelId));
        setRawMessages(cached ? JSON.parse(cached) : []);
      } catch {
        setRawMessages([]);
      }
    }
    fetchActiveMessages(activeChannelId, true);
    fetchTypingStatus();
  }, [activeChannelId, fetchActiveMessages, fetchTypingStatus]);

  // 2-second polling
  useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden && activeChannelId) {
        fetchActiveMessages(activeChannelId, false);
        fetchTypingStatus();
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [activeChannelId, fetchActiveMessages, fetchTypingStatus]);

  // ── Mention autocomplete filtering ─────────────────────────────────────────
  const filteredMentionMembers = React.useMemo(() => {
    if (!mentionQuery) return liveMembers;
    return liveMembers.filter((m) =>
      m.username.toLowerCase().includes(mentionQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(mentionQuery.toLowerCase())
    );
  }, [liveMembers, mentionQuery]);

  const insertMention = (member: { username: string }) => {
    const val = textInput;
    const cursorPos = inputRef.current?.selectionStart || val.length;
    const textBeforeCursor = val.slice(0, cursorPos);
    const lastAt = textBeforeCursor.lastIndexOf('@');
    if (lastAt !== -1) {
      const newText = val.slice(0, lastAt) + `@${member.username} ` + val.slice(cursorPos);
      setTextInput(newText);
      setMentionOpen(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mentionOpen && filteredMentionMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((prev) => (prev + 1) % filteredMentionMembers.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((prev) => (prev - 1 + filteredMentionMembers.length) % filteredMentionMembers.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredMentionMembers[mentionIndex]);
      } else if (e.key === 'Escape') {
        setMentionOpen(false);
      }
    }
  };

  // ── Handle text input change (typing indicator self + mention detector) ────
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTextInput(val);

    // Detect @ trigger
    const cursorPos = e.target.selectionStart || val.length;
    const textBeforeCursor = val.slice(0, cursorPos);
    const lastAt = textBeforeCursor.lastIndexOf('@');

    if (lastAt !== -1) {
      const query = textBeforeCursor.slice(lastAt + 1);
      if (!query.includes(' ') && query.length <= 25) {
        setMentionOpen(true);
        setMentionQuery(query);
        setMentionIndex(0);
      } else {
        setMentionOpen(false);
      }
    } else {
      setMentionOpen(false);
    }

    const hasText = val.length > 0;
    if (hasText && !isTypingRef.current) {
      isTypingRef.current = true;
      setIsSelfTyping(true);
      sendTypingStatus(true);
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      setIsSelfTyping(false);
      sendTypingStatus(false);
    }, 2000);
    if (!hasText) {
      isTypingRef.current = false;
      setIsSelfTyping(false);
      sendTypingStatus(false);
    }
  };

  // ── Build message tree: root messages + nested replies ─────────────────────
  const { rootMessages, replyMap } = React.useMemo(() => {
    const sorted = [...rawMessages].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const roots: ChatMessageItem[] = [];
    const replies: Record<string, ChatMessageItem[]> = {};

    for (const msg of sorted) {
      if (msg.parent_id) {
        // This is a thread reply — group under its parent
        if (!replies[msg.parent_id]) replies[msg.parent_id] = [];
        replies[msg.parent_id].push(msg);
      } else {
        roots.push(msg);
      }
    }
    return { rootMessages: roots, replyMap: replies };
  }, [rawMessages]);

  // Attach fetched replies to a root message
  const getMessageWithReplies = (msg: ChatMessageItem): ChatMessageItem => ({
    ...msg,
    replies: replyMap[msg.id] ?? msg.replies ?? [],
    reply_count: (replyMap[msg.id]?.length ?? 0) || msg.reply_count || 0,
  });

  // ── Send main message ─────────────────────────────────────────────────────
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;

    const tempId = `msg-${Date.now()}`;
    // Optimistic: add to root messages only (no parent_id)
    const tempMsg: ChatMessageItem = {
      id: tempId,
      channel_id: activeChannelId,
      user_id: String(currentUser.id),
      user_name: currentUser.username,
      user_avatar: currentUser.avatar,
      text: textInput,
      created_at: new Date().toISOString(),
      parent_id: null,   // explicitly root message
      localStatus: 'sending',
      isOptimistic: true,
    };

    setRawMessages((prev) => {
      const next = [...prev, tempMsg];
      if (typeof window !== 'undefined') {
        localStorage.setItem(chatCacheKey(activeChannelId), JSON.stringify(next));
      }
      return next;
    });
    setStatusMap((prev) => ({ ...prev, [tempId]: 'sending' }));
    scrollToBottom(true);

    const toSend = textInput;
    const sender = {
      id: currentUser.id,
      name: currentUser.username,
      email: currentUser.email,
      avatar: currentUser.avatar,
    };
    setTextInput('');
    isTypingRef.current = false;
    setIsSelfTyping(false);
    sendTypingStatus(false);

    try {
      await fetch('/api/clickup/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: activeChannelId, text: toSend, sender }),
      });
      setStatusMap((prev) => ({ ...prev, [tempId]: 'sent' }));
      setRawMessages((prev) =>
        prev.map((m) => m.id === tempId ? { ...m, localStatus: 'sent', isOptimistic: false } : m)
      );
      advanceStatusToRead(tempId);
      await fetchActiveMessages(activeChannelId, true);
    } catch (err) {
      console.error('[Chat] Gagal kirim:', err);
    }
  };

  // ── Send thread reply ─────────────────────────────────────────────────────
  const handleSendThreadReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!threadInput.trim() || !activeThreadMessage) return;

    const replyId  = `reply-${Date.now()}`;
    const parentId = activeThreadMessage.id;

    const replyMsg: ChatMessageItem = {
      id: replyId,
      channel_id: activeChannelId,
      user_id: String(currentUser.id),
      user_name: currentUser.username,
      user_avatar: currentUser.avatar,
      text: threadInput,
      created_at: new Date().toISOString(),
      parent_id: parentId,   // marks this as a thread reply, NOT a root message
      localStatus: 'sending',
    };

    // ── Optimistic update: append to thread panel ONLY ─────────────────────
    // We do NOT add replyMsg to rawMessages so it won't appear in the main feed.
    // Instead we immediately update the activeThreadMessage's replies.
    setActiveThreadMessage((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        reply_count: (prev.reply_count || 0) + 1,
        replies: [...(prev.replies || []), replyMsg],
      };
    });
    setStatusMap((prev) => ({ ...prev, [replyId]: 'sending' }));
    scrollToThreadBottom(true);

    const toSend = threadInput;
    const sender = {
      id: currentUser.id,
      name: currentUser.username,
      email: currentUser.email,
      avatar: currentUser.avatar,
    };
    setThreadInput('');

    try {
      await fetch('/api/clickup/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: activeChannelId,
          text: toSend,
          sender,
          replyTo: {
            author: activeThreadMessage.user_name,
            text: activeThreadMessage.text,
          },
        }),
      });
      setStatusMap((prev) => ({ ...prev, [replyId]: 'sent' }));
      advanceStatusToRead(replyId);
      // Refresh to get server-confirmed replies — the API will return the new
      // reply with parent_id set, so replyMap will pick it up correctly.
      await fetchActiveMessages(activeChannelId, false);
    } catch (err) {
      console.error('[Chat] Gagal kirim thread reply:', err);
    }
  };

  // ── Sidebar grouping ──────────────────────────────────────────────────────
  const generalChannels = channels.filter((c) => c.type === 'general');
  const spaceChannels   = channels.filter((c) => c.type === 'project' || (!c.type && !c.name.includes('DM:')));
  const dmChannels      = channels.filter((c) => {
    if (c.type !== 'direct' && !c.name.includes('DM:')) return false;
    const cleanName = c.name.replace('👤 DM: ', '').replace('DM:', '').trim().toLowerCase();
    const myName = (currentUser.username || '').toLowerCase().trim();
    if (!myName || myName === 'pengguna') return true;
    return !cleanName.includes(myName) && !myName.includes(cleanName);
  });

  const activeChannel  = channels.find((c) => c.id === activeChannelId) || channels[0];
  const totalUnread    = Object.values(unreadMap).reduce((s, n) => s + n, 0);

  // isSelfTyping: true only when the current user is actively typing in the input box
  const [isSelfTyping, setIsSelfTyping] = useState(false);

  const typingText = React.useMemo(() => {
    const names = otherTypingUsers.map((u) => u.username);
    if (isSelfTyping) {
      names.push('Kamu');
    }
    if (names.length === 0) return null;
    if (names.length === 1) return `${names[0]} sedang mengetik…`;
    if (names.length === 2) return `${names[0]} dan ${names[1]} sedang mengetik…`;
    return `${names[0]} dan ${names.length - 1} orang lainnya sedang mengetik…`;
  }, [otherTypingUsers, isSelfTyping]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* inject typing keyframes */}
      <style>{`
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>

      <div className="relative h-[calc(100vh-8rem)] bg-white border border-[#E8E8EC] rounded-2xl shadow-xs overflow-hidden flex animate-fade-in">

        {/* ══ ① Toast Stack ════════════════════════════════════════════════ */}
        <div className="fixed top-6 right-6 z-[55] flex flex-col gap-2 pointer-events-none">
          {toasts.map((toast) => (
            <div key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 bg-white border border-[#E8E8EC]
                rounded-2xl shadow-xl px-4 py-3 w-80 cursor-pointer
                ${toast.exiting ? 'toast-exit' : 'toast-enter'}`}
              onClick={() => {
                setActiveChannelId(toast.channelId);
                setUnreadMap((prev) => ({ ...prev, [toast.channelId]: 0 }));
                setToasts((prev) => prev.filter((t) => t.id !== toast.id));
              }}
            >
              <div className="relative flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={toast.senderAvatar} alt={toast.senderName} className="w-9 h-9 rounded-full object-cover border border-[#E8E8EC]" />
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#4F9D78] border-2 border-white rounded-full" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[12px] font-bold text-[#24324A] truncate">{toast.senderName}</span>
                  <span className="text-[10px] text-[#737680] ml-2 flex-shrink-0 flex items-center gap-1">
                    <Hash className="w-2.5 h-2.5" />{toast.channelName}
                  </span>
                </div>
                <p className="text-[11px] text-[#737680] line-clamp-2 leading-snug">{toast.text}</p>
              </div>
              <button onClick={(ev) => { ev.stopPropagation(); setToasts((p) => p.filter((t) => t.id !== toast.id)); }}
                className="flex-shrink-0 text-[#737680] hover:text-[#202124] cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* ══ ③ Left Sidebar (Discord Channels Drawer) ════════════════════════ */}
        {mobileChannelsOpen && (
          <div
            onClick={() => setMobileChannelsOpen(false)}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs md:hidden"
          />
        )}

        <div className={`w-72 border-r border-[#E8E8EC] bg-[#F7F7F8] flex-col flex-shrink-0 transition-all ${
          mobileChannelsOpen ? 'fixed inset-y-0 left-0 z-50 flex shadow-2xl w-80' : 'hidden md:flex'
        }`}>
          <div className="px-4 pt-4 pb-3 border-b border-[#E8E8EC] flex items-center justify-between">
            <h2 className="text-xs font-extrabold text-[#24324A] uppercase tracking-wider flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-[#F26B5E]" /> Agency Chat
            </h2>
            <div className="flex items-center gap-2">
              {totalUnread > 0 && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-[#F26B5E] text-white font-extrabold text-[10px] rounded-full badge-pop">
                  <Bell className="w-2.5 h-2.5" />{totalUnread}
                </span>
              )}
              <button
                onClick={() => setMobileChannelsOpen(false)}
                className="md:hidden p-1 text-[#737680] hover:text-[#202124]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-3 space-y-5 px-2">
            {generalChannels.length > 0 && (
              <div>
                <p className="text-[9px] font-extrabold text-[#737680] uppercase tracking-widest px-3 mb-1.5">📢 Workspace</p>
                <div className="space-y-0.5">
                  {generalChannels.map((ch) => (
                    <ChannelButton key={ch.id} ch={ch} isActive={ch.id === activeChannelId}
                      unread={unreadMap[ch.id] || 0} label={ch.name}
                      icon={<Hash className="w-3 h-3 text-[#F26B5E]" />}
                      onClick={() => {
                        setActiveChannelId(ch.id);
                        setUnreadMap((p) => ({ ...p, [ch.id]: 0 }));
                        setMobileChannelsOpen(false);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {spaceChannels.length > 0 && (
              <div>
                <p className="text-[9px] font-extrabold text-[#737680] uppercase tracking-widest px-3 mb-1.5">💬 Chat Space</p>
                <div className="space-y-0.5">
                  {spaceChannels.map((ch) => (
                    <ChannelButton key={ch.id} ch={ch} isActive={ch.id === activeChannelId}
                      unread={unreadMap[ch.id] || 0} label={ch.name.replace('💬 ', '')}
                      icon={<Hash className="w-3 h-3 text-[#737680]" />}
                      onClick={() => {
                        setActiveChannelId(ch.id);
                        setUnreadMap((p) => ({ ...p, [ch.id]: 0 }));
                        setMobileChannelsOpen(false);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {dmChannels.length > 0 && (
              <div>
                <div className="flex items-center gap-2 px-3 mb-1.5">
                  <p className="text-[9px] font-extrabold text-[#737680] uppercase tracking-widest whitespace-nowrap">Direct Messages</p>
                  <div className="flex-1 h-px bg-[#E8E8EC]" />
                </div>
                <div className="space-y-0.5">
                  {dmChannels.map((ch) => {
                    const isActive = ch.id === activeChannelId;
                    const unread   = unreadMap[ch.id] || 0;
                    const dmName   = ch.name.replace('👤 DM: ', '').replace('DM:', '').trim();
                    const initials = dmName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
                    const memberAvatar = ch.avatar || liveMembers.find((m) =>
                      m.username.toLowerCase() === dmName.toLowerCase() ||
                      m.username.toLowerCase().includes(dmName.toLowerCase()) ||
                      dmName.toLowerCase().includes(m.username.toLowerCase())
                    )?.avatar;
                    return (
                      <button key={ch.id}
                        onClick={() => {
                          setActiveChannelId(ch.id);
                          setUnreadMap((p) => ({ ...p, [ch.id]: 0 }));
                          setMobileChannelsOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold
                          transition-all text-left cursor-pointer
                          ${isActive ? 'bg-gradient-to-r from-[#7B68EE]/15 to-[#7B68EE]/5 text-[#7B68EE] border border-[#7B68EE]/20'
                            : 'text-[#737680] hover:bg-white hover:text-[#202124]'}`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {memberAvatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={memberAvatar}
                              alt={dmName}
                              className={`w-6 h-6 rounded-full object-cover flex-shrink-0 border ${
                                isActive ? 'border-[#7B68EE]/40' : 'border-[#E8E8EC]'
                              }`}
                            />
                          ) : (
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-extrabold flex-shrink-0
                              ${isActive ? 'bg-[#7B68EE] text-white' : 'bg-[#E8E8EC] text-[#737680]'}`}>
                              {initials || <User className="w-3 h-3" />}
                            </div>
                          )}
                          <span className="truncate">{dmName}</span>
                        </div>
                        {unread > 0 && (
                          <span className="ml-1 px-1.5 py-0.5 bg-[#7B68EE] text-white font-extrabold text-[9px] rounded-full badge-pop flex-shrink-0">
                            {unread}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar footer */}
          <div className="px-3 py-3 border-t border-[#E8E8EC] flex items-center gap-2">
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={currentUser.avatar} alt={currentUser.username} className="w-7 h-7 rounded-full object-cover border border-[#E8E8EC]" />
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#4F9D78] border-2 border-[#F7F7F8] rounded-full online-dot" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-[#24324A] truncate">{currentUser.username}</p>
              <p className="text-[9px] text-[#4F9D78] font-semibold">● Online</p>
            </div>
            <AtSign className="w-3.5 h-3.5 text-[#737680]" />
          </div>
        </div>

        {/* ══ ④ Main Message Area ══════════════════════════════════════════ */}
        <div className="flex-1 flex flex-col bg-white min-w-0">
          {/* Header */}
          <div className="h-14 px-4 md:px-6 border-b border-[#E8E8EC] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <button
                onClick={() => setMobileChannelsOpen(true)}
                className="md:hidden p-1.5 rounded-lg border border-[#E8E8EC] text-[#24324A] hover:bg-[#F7F7F8] flex-shrink-0 cursor-pointer"
                title="Buka Channel Discord Chat"
              >
                <Hash className="w-4 h-4 text-[#F26B5E]" />
              </button>

              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-extrabold text-[#24324A] leading-none truncate">{activeChannel?.name}</h3>

                {/* Subtitle: switches between member count and "sedang mengetik" */}
                <div className="h-4 mt-0.5 overflow-hidden">
                  {typingText ? (
                    <p className="text-[11px] text-[#4F9D78] font-medium flex items-center gap-1.5 animate-fade-in">
                      <span className="inline-flex items-center gap-0.5">
                        {[0, 150, 300].map((delay) => (
                          <span key={delay} className="w-1 h-1 bg-[#4F9D78] rounded-full"
                            style={{ animation: `typingBounce 1.2s ${delay}ms ease-in-out infinite` }} />
                        ))}
                      </span>
                      <span>{typingText}</span>
                    </p>
                  ) : (
                    <p className="text-[11px] text-[#737680] animate-fade-in">
                      {liveMembers.length} anggota • Login sebagai {currentUser.username}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <SyncUpButton
                variant="header"
                roomTitle={`SyncUp - ${activeChannel?.name || 'Chat Room'}`}
                channelId={activeChannelId}
                onStartCall={() => fetchActiveMessages(activeChannelId, true)}
              />

              <button onClick={() => fetchActiveMessages(activeChannelId, true)}
                className="px-3 py-1.5 border border-[#E8E8EC] rounded-lg hover:bg-[#F7F7F8] text-[11px]
                  text-[#737680] flex items-center gap-1.5 transition-colors cursor-pointer">
                <RefreshCw className={`w-3 h-3 ${loadingMessages ? 'animate-spin' : ''}`} />
                Sync
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {rootMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-2">
                <MessageSquare className="w-10 h-10 text-[#E8E8EC]" />
                <p className="text-sm font-semibold text-[#24324A]">Belum ada percakapan</p>
                <p className="text-xs text-[#737680]">Kirim pesan pertama ke {activeChannel?.name}</p>
              </div>
            ) : (
              rootMessages.map((rawMsg) => {
                const msg = getMessageWithReplies(rawMsg);
                const isMe = isCurrentUserMessage(msg);
                const replyCount = msg.reply_count || 0;
                const isSelected = activeThreadMessage?.id === msg.id;
                const msgStatus: MessageStatus = statusMap[msg.id] || 'read';

                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                    <div className={`flex items-end gap-2 max-w-[72%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>

                      {/* Avatar */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={msg.user_avatar} alt={msg.user_name}
                        className="w-7 h-7 rounded-full object-cover border border-[#E8E8EC] flex-shrink-0 mb-5" />

                      <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        {/* Name + time */}
                        <div className={`flex items-center gap-1.5 mb-1 text-[11px] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                          <span className="font-bold text-[#24324A]">{isMe ? 'Saya' : msg.user_name}</span>
                          <span className="text-[#737680]">{formatTime(msg.created_at)}</span>
                        </div>

                        {/* Bubble */}
                        <div className="relative group/bubble">
                          <div
                            onClick={() => setActiveThreadMessage(msg.id === activeThreadMessage?.id ? null : msg)}
                            className={`px-4 py-2.5 rounded-2xl text-xs whitespace-pre-wrap cursor-pointer
                              transition-all select-text
                              ${isMe
                                ? 'bg-[#24324A] text-white rounded-br-sm shadow-sm hover:opacity-95'
                                : 'bg-[#F4F4F5] text-[#202124] rounded-bl-sm hover:bg-[#EBEBED]'}
                              ${isSelected ? 'ring-2 ring-[#7B68EE] ring-offset-1' : ''}`}
                          >
                            {msg.text.includes('SyncUp Voice & Video Call') ? (
                              <div className="p-3 bg-[#0F5A47] text-white rounded-xl shadow-sm border border-[#10B981]/40 space-y-2 max-w-xs text-left">
                                <div className="flex items-center gap-2 font-extrabold text-xs text-[#10B981]">
                                  <PhoneCall className="w-4 h-4 text-[#10B981] animate-pulse" />
                                  <span>SyncUp Call Aktif</span>
                                </div>
                                <p className="text-[11px] text-white/90 leading-relaxed">
                                  {msg.user_name} telah memulai panggilan Huddle di channel ini.
                                </p>
                                <SyncUpButton
                                  variant="full"
                                  roomTitle={`SyncUp - ${activeChannel?.name || 'Chat Room'}`}
                                  className="mt-1"
                                />
                              </div>
                            ) : (
                              renderMentionedText(msg.text, liveMembers)
                            )}
                          </div>

                          {/* Hover action */}
                          <div className={`absolute bottom-0 opacity-0 group-hover/bubble:opacity-100 transition-opacity
                            flex items-center gap-1 bg-white border border-[#E8E8EC] shadow-md rounded-lg px-2 py-1 z-10
                            ${isMe ? 'right-full mr-2' : 'left-full ml-2'}`}>
                            <button type="button"
                              onClick={() => setActiveThreadMessage(msg.id === activeThreadMessage?.id ? null : msg)}
                              className="hover:text-[#24324A] text-[#737680] flex items-center gap-1
                                text-[10px] font-bold cursor-pointer whitespace-nowrap">
                              <Reply className="w-3 h-3 text-[#F26B5E]" />Balas
                            </button>
                          </div>
                        </div>

                        {/* ── Status row (only for own messages) ─────────────── */}
                        {isMe && (
                          <div className="flex items-center gap-1 mt-1 px-1">
                            <span className="text-[9px] text-[#737680]">
                              {msgStatus === 'sending'   && 'Mengirim…'}
                              {msgStatus === 'sent'      && 'Terkirim'}
                              {msgStatus === 'delivered' && 'Tersampaikan'}
                              {msgStatus === 'read'      && 'Dibaca'}
                            </span>
                            <MessageStatusIcon status={msgStatus} />
                          </div>
                        )}

                        {/* Thread badge — click opens Thread panel */}
                        {replyCount > 0 && (
                          <button type="button"
                            onClick={() => setActiveThreadMessage(msg.id === activeThreadMessage?.id ? null : msg)}
                            className={`mt-1.5 flex items-center gap-1.5 text-[10px] font-bold
                              transition-colors cursor-pointer
                              ${isSelected ? 'text-[#6852ED]' : 'text-[#7B68EE] hover:text-[#6852ED]'}`}>
                            <MessageCircle className="w-3 h-3" />
                            {replyCount} balasan thread
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            <div ref={messagesEndRef} className="h-1" />
          </div>

          {/* Input bar + Mention Autocomplete Popup */}
          <div className="relative">
            {mentionOpen && filteredMentionMembers.length > 0 && (
              <div className="absolute bottom-full left-4 mb-2 w-64 bg-white border border-[#E8E8EC] rounded-2xl shadow-2xl overflow-hidden z-50 animate-fade-in divide-y divide-[#E8E8EC]">
                <div className="px-3 py-2 bg-[#F7F7F8] flex items-center justify-between text-[10px] font-bold text-[#737680] uppercase tracking-wider">
                  <span className="flex items-center gap-1"><AtSign className="w-3 h-3 text-[#7B68EE]" /> Mention Tim</span>
                  <span>{filteredMentionMembers.length} anggota</span>
                </div>
                <div className="max-h-48 overflow-y-auto py-1">
                  {filteredMentionMembers.map((m, idx) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => insertMention(m)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors cursor-pointer ${
                        idx === mentionIndex ? 'bg-[#EEF2F7] text-[#24324A] font-bold' : 'hover:bg-[#F7F7F8] text-[#202124]'
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.avatar} alt={m.username} className="w-6 h-6 rounded-full object-cover border border-[#E8E8EC] flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold truncate leading-tight text-xs">{m.username}</p>
                        <p className="text-[10px] text-[#737680] truncate">{m.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSendMessage}
              className="px-4 py-3 border-t border-[#E8E8EC] flex items-center gap-2 bg-[#F7F7F8]">
              <input
                ref={inputRef}
                type="text"
                value={textInput}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={`Kirim pesan (ketik @ untuk mention tim) ke ${activeChannel?.name ?? '…'}`}
                className="flex-1 px-4 py-2.5 text-xs bg-white border border-[#E8E8EC] rounded-xl
                  focus:outline-none focus:border-[#24324A] transition-colors"
              />
              <button type="submit"
                className="px-4 py-2.5 bg-[#24324A] text-white text-xs font-semibold rounded-xl
                  hover:bg-[#1A2536] flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer">
                <Send className="w-3.5 h-3.5 text-[#F26B5E]" />Kirim
              </button>
            </form>
          </div>
        </div>

        {/* ══ ⑤ Right Panel ═════════════════════════════════════════════════ */}
        {activeThreadMessage ? (
          <div className="w-80 border-l border-[#E8E8EC] bg-white flex flex-col flex-shrink-0 animate-slide-left">
            {/* header */}
            <div className="h-14 px-4 border-b border-[#E8E8EC] flex items-center justify-between bg-[#F7F7F8]">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-[#7B68EE]" />
                <span className="text-xs font-extrabold text-[#24324A]">Thread</span>
              </div>
              <button onClick={() => setActiveThreadMessage(null)}
                className="p-1 rounded-lg hover:bg-white text-[#737680] hover:text-[#202124] cursor-pointer transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* root */}
              <div className="p-3 bg-[#F4F4F5] rounded-2xl space-y-2">
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={activeThreadMessage.user_avatar} alt={activeThreadMessage.user_name}
                    className="w-6 h-6 rounded-full object-cover border border-[#E8E8EC]" />
                  <span className="text-[11px] font-bold text-[#24324A]">{activeThreadMessage.user_name}</span>
                  <span className="text-[10px] text-[#737680] ml-auto">{formatTime(activeThreadMessage.created_at)}</span>
                </div>
                <div className="text-xs text-[#202124] whitespace-pre-wrap">{renderMentionedText(activeThreadMessage.text, liveMembers)}</div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-[#737680] border-b border-[#E8E8EC] pb-2">
                <span className="font-extrabold uppercase tracking-wide">
                  {(replyMap[activeThreadMessage.id]?.length ?? (activeThreadMessage.replies ?? []).length)} Balasan
                </span>
                <span className="text-[#7B68EE] text-[9px]">↕ ClickUp Sync</span>
              </div>

              {/* replies — merge thread panel's own optimistic replies with replyMap from API */}
              {(() => {
                const serverReplies = replyMap[activeThreadMessage.id] ?? [];
                // Merge: server replies + optimistic replies not yet confirmed by server
                const serverIds = new Set(serverReplies.map((r) => r.id));
                const optimisticReplies = (activeThreadMessage.replies ?? []).filter(
                  (r) => r.isOptimistic || !serverIds.has(r.id)
                );
                const allReplies = [...serverReplies, ...optimisticReplies].sort(
                  (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                );
                return allReplies.length ? (
                allReplies.map((reply) => {
                  const isReplyMe = isCurrentUserMessage(reply);
                  const replyStatus: MessageStatus = statusMap[reply.id] || 'read';
                  return (
                    <div key={reply.id} className="flex items-start gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={reply.user_avatar} alt={reply.user_name}
                        className="w-6 h-6 rounded-full object-cover border border-[#E8E8EC] mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`text-[11px] font-bold ${isReplyMe ? 'text-[#7B68EE]' : 'text-[#24324A]'}`}>
                            {isReplyMe ? 'Saya' : reply.user_name}
                          </span>
                          <span className="text-[9px] text-[#737680]">{formatTime(reply.created_at)}</span>
                        </div>
                        <div className={`px-3 py-2 rounded-xl text-xs whitespace-pre-wrap
                          ${isReplyMe ? 'bg-[#7B68EE]/10 text-[#24324A]' : 'bg-[#F4F4F5] text-[#202124]'}`}>
                          {renderMentionedText(reply.text, liveMembers)}
                        </div>
                        {/* status for own thread replies */}
                        {isReplyMe && (
                          <div className="flex items-center gap-1 mt-0.5 px-1">
                            <span className="text-[9px] text-[#737680]">
                              {replyStatus === 'sending'   && 'Mengirim…'}
                              {replyStatus === 'sent'      && 'Terkirim'}
                              {replyStatus === 'delivered' && 'Tersampaikan'}
                              {replyStatus === 'read'      && 'Dibaca'}
                            </span>
                            <MessageStatusIcon status={replyStatus} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-xs text-[#737680]">
                  <MessageCircle className="w-6 h-6 mx-auto mb-2 text-[#E8E8EC]" />
                  <p className="font-semibold text-[#24324A]">Belum ada balasan</p>
                  <p className="text-[10px] mt-0.5">Mulai diskusi di thread ini!</p>
                </div>
              );
              })()}
              <div ref={threadEndRef} className="h-1" />
            </div>

            {/* thread input */}
            <form onSubmit={handleSendThreadReply}
              className="p-3 border-t border-[#E8E8EC] bg-[#F7F7F8] flex items-center gap-2">
              <input type="text" value={threadInput}
                onChange={(e) => setThreadInput(e.target.value)}
                placeholder={`Balas thread ${activeThreadMessage.user_name}…`}
                className="flex-1 px-3 py-2 text-xs bg-white border border-[#E8E8EC] rounded-xl
                  focus:outline-none focus:border-[#7B68EE] transition-colors" />
              <button type="submit"
                className="px-3 py-2 bg-[#7B68EE] text-white text-xs font-semibold rounded-xl
                  hover:bg-[#6852ED] flex items-center gap-1 shadow-sm cursor-pointer transition-colors">
                <Send className="w-3.5 h-3.5" />Balas
              </button>
            </form>
          </div>
        ) : (
          /* Members panel */
          <div className="w-60 border-l border-[#E8E8EC] bg-white p-4 hidden lg:flex flex-col gap-4 flex-shrink-0">
            <h3 className="text-[10px] font-extrabold text-[#737680] uppercase tracking-widest border-b border-[#E8E8EC] pb-2">
              Tim ClickUp ({liveMembers.length})
            </h3>
            <div className="space-y-2 overflow-y-auto flex-1">
              {liveMembers.map((m) => (
                <div key={m.id} className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-[#F7F7F8] transition-colors">
                  <div className="relative flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.avatar} alt={m.username} className="w-7 h-7 rounded-full object-cover border border-[#E8E8EC]" />
                    <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-[#4F9D78] border border-white rounded-full" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-[#202124] truncate">{m.username}</p>
                    <p className="text-[9px] text-[#737680] truncate">{m.email}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── ChannelButton ────────────────────────────────────────────────────────────

function ChannelButton({
  ch, isActive, unread, icon, label, onClick,
}: {
  ch: { id: string };
  isActive: boolean;
  unread: number;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold
        transition-all text-left cursor-pointer
        ${isActive ? 'bg-white text-[#24324A] shadow-sm border border-[#E8E8EC]' : 'text-[#737680] hover:bg-white hover:text-[#202124]'}`}
    >
      <div className="flex items-center gap-2 truncate min-w-0">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      {unread > 0 && (
        <span className="ml-1 px-1.5 py-0.5 bg-[#F26B5E] text-white font-extrabold text-[9px] rounded-full badge-pop flex-shrink-0">
          {unread}
        </span>
      )}
    </button>
  );
}
