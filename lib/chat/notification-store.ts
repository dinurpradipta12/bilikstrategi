export type ChatNotification = {
  id: string;
  senderName: string;
  senderAvatar: string;
  channelName: string;
  channelId: string;
  text: string;
  createdAt: string;
};

export const CHAT_NOTIFICATION_EVENT = 'bilik-chat-notification-update';
export const UNREAD_BADGE_EVENT = 'unread-badge-update';

const CHAT_UNREAD_MAP_KEY = 'bilik_chat_unread_map';
const CHAT_UNREAD_COUNT_KEY = 'bilik_chat_unread_count';
const CHAT_NOTIFICATIONS_KEY = 'bilik_chat_notifications';

function isBrowser() {
  return typeof window !== 'undefined';
}

/** Keep the raw ClickUp channel ids and the app's DM pair id in one namespace. */
export function normalizeChatChannelId(channelId: string) {
  const clean = String(channelId || '').trim().toLowerCase();
  if (!clean) return '';
  if (
    clean === 'dm_pair_allisha_dinur' ||
    clean === 'dm_allisha' ||
    clean === 'dm_dinur' ||
    clean.includes('allisha') ||
    clean.includes('dinur')
  ) {
    return 'dm_pair_allisha_dinur';
  }
  return clean;
}

export function getChatChannelAliases(channelId: string) {
  const raw = String(channelId || '').trim().toLowerCase();
  const canonical = normalizeChatChannelId(raw);
  const aliases = new Set<string>();
  if (raw) aliases.add(raw);
  if (canonical) aliases.add(canonical);
  if (canonical === 'dm_pair_allisha_dinur') {
    aliases.add('dm_allisha');
    aliases.add('dm_dinur');
  }
  return Array.from(aliases);
}

function normalizeUnreadMap(unreadMap: Record<string, number>) {
  const normalized: Record<string, number> = {};
  Object.entries(unreadMap).forEach(([channelId, value]) => {
    if (typeof value !== 'number' || value <= 0) return;
    const key = normalizeChatChannelId(channelId) || channelId;
    normalized[key] = (normalized[key] || 0) + value;
  });
  return normalized;
}

export function getChatUnreadForChannel(unreadMap: Record<string, number>, channelId: string) {
  return getChatChannelAliases(channelId).reduce((total, alias) => total + (unreadMap[alias] || 0), 0);
}

export function incrementChatUnread(unreadMap: Record<string, number>, channelId: string) {
  const key = normalizeChatChannelId(channelId) || String(channelId || '').trim().toLowerCase();
  if (!key) return unreadMap;
  const normalizedMap = normalizeUnreadMap(unreadMap);
  return {
    ...normalizedMap,
    [key]: (normalizedMap[key] || 0) + 1,
  };
}

export function clearChatUnreadForChannel(unreadMap: Record<string, number>, channelId: string) {
  const nextMap = { ...unreadMap };
  getChatChannelAliases(channelId).forEach((alias) => delete nextMap[alias]);
  delete nextMap[normalizeChatChannelId(channelId)];
  return nextMap;
}

export function readChatUnreadMap(): Record<string, number> {
  if (!isBrowser()) return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(CHAT_UNREAD_MAP_KEY) || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return normalizeUnreadMap(parsed as Record<string, number>);
  } catch {
    return {};
  }
}

export function readChatNotifications(): ChatNotification[] {
  if (!isBrowser()) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(CHAT_NOTIFICATIONS_KEY) || '[]');
    return Array.isArray(parsed)
      ? parsed
        .filter((item) => item && typeof item === 'object')
        .map((item) => {
          const channelId = normalizeChatChannelId(String(item.channelId ?? item.channel_id ?? ''));
          return {
            id: String(item.id ?? ''),
            senderName: String(item.senderName ?? item.sender_name ?? 'Pengguna'),
            senderAvatar: String(item.senderAvatar ?? item.sender_avatar ?? ''),
            channelName: String(item.channelName ?? item.channel_name ?? 'Agency Chat'),
            channelId,
            text: String(item.text ?? ''),
            createdAt: String(item.createdAt ?? item.created_at ?? new Date().toISOString()),
          } satisfies ChatNotification;
        })
        .filter((item) => Boolean(item.id && item.channelId))
      : [];
  } catch {
    return [];
  }
}

export function getChatUnreadTotal(unreadMap: Record<string, number>) {
  return Object.values(unreadMap).reduce((total, count) => total + count, 0);
}

function dispatchUnreadCount(count: number) {
  if (!isBrowser()) return;
  localStorage.setItem(CHAT_UNREAD_COUNT_KEY, String(count));
  window.dispatchEvent(new CustomEvent(UNREAD_BADGE_EVENT, {
    detail: { type: 'chat', count },
  }));
}

export function publishChatUnreadMap(unreadMap: Record<string, number>) {
  if (!isBrowser()) return;
  const normalizedMap = normalizeUnreadMap(unreadMap);
  localStorage.setItem(CHAT_UNREAD_MAP_KEY, JSON.stringify(normalizedMap));
  dispatchUnreadCount(getChatUnreadTotal(normalizedMap));
}

export function publishChatNotification(notification: ChatNotification, unreadMap: Record<string, number>) {
  if (!isBrowser()) return false;
  const normalizedNotification = {
    ...notification,
    channelId: normalizeChatChannelId(notification.channelId) || notification.channelId,
  };
  const existingNotifications = readChatNotifications();
  if (existingNotifications.some((item) => item.id === normalizedNotification.id)) return false;
  const normalizedMap = normalizeUnreadMap(unreadMap);
  const notifications = [normalizedNotification, ...existingNotifications].slice(0, 30);
  localStorage.setItem(CHAT_UNREAD_MAP_KEY, JSON.stringify(normalizedMap));
  localStorage.setItem(CHAT_NOTIFICATIONS_KEY, JSON.stringify(notifications));
  const count = getChatUnreadTotal(normalizedMap);
  dispatchUnreadCount(count);
  window.dispatchEvent(new CustomEvent(CHAT_NOTIFICATION_EVENT, {
    detail: { notification: normalizedNotification, notifications, count },
  }));
  return true;
}

export function clearChatChannelNotifications(channelId: string) {
  if (!isBrowser()) return;
  const aliases = new Set(getChatChannelAliases(channelId));
  const notifications = readChatNotifications().filter((item) => !aliases.has(normalizeChatChannelId(item.channelId)));
  localStorage.setItem(CHAT_NOTIFICATIONS_KEY, JSON.stringify(notifications));
  window.dispatchEvent(new CustomEvent(CHAT_NOTIFICATION_EVENT, {
    detail: { notifications },
  }));
}
