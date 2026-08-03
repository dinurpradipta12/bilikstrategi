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

export function readChatUnreadMap(): Record<string, number> {
  if (!isBrowser()) return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(CHAT_UNREAD_MAP_KEY) || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => typeof value === 'number' && value > 0)
    ) as Record<string, number>;
  } catch {
    return {};
  }
}

export function readChatNotifications(): ChatNotification[] {
  if (!isBrowser()) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(CHAT_NOTIFICATIONS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
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
  localStorage.setItem(CHAT_UNREAD_MAP_KEY, JSON.stringify(unreadMap));
  dispatchUnreadCount(getChatUnreadTotal(unreadMap));
}

export function publishChatNotification(notification: ChatNotification, unreadMap: Record<string, number>) {
  if (!isBrowser()) return false;
  const existingNotifications = readChatNotifications();
  if (existingNotifications.some((item) => item.id === notification.id)) return false;
  const notifications = [notification, ...existingNotifications].slice(0, 30);
  localStorage.setItem(CHAT_NOTIFICATIONS_KEY, JSON.stringify(notifications));
  const count = getChatUnreadTotal(unreadMap);
  dispatchUnreadCount(count);
  window.dispatchEvent(new CustomEvent(CHAT_NOTIFICATION_EVENT, {
    detail: { notification, notifications, count },
  }));
  return true;
}

export function clearChatChannelNotifications(channelId: string) {
  if (!isBrowser()) return;
  const notifications = readChatNotifications().filter((item) => item.channelId !== channelId);
  localStorage.setItem(CHAT_NOTIFICATIONS_KEY, JSON.stringify(notifications));
  window.dispatchEvent(new CustomEvent(CHAT_NOTIFICATION_EVENT, {
    detail: { notifications },
  }));
}
