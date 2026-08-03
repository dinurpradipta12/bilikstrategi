'use client';

import { useEffect } from 'react';
import { CHAT_NOTIFICATION_EVENT } from '@/lib/chat/notification-store';
import {
  playChatNotificationSound,
  showBackgroundChatNotification,
  unlockChatNotificationSound,
} from '@/lib/chat/notification-sound';

export default function ChatNotificationSound() {
  useEffect(() => {
    const unlock = () => unlockChatNotificationSound();
    const interactionEvents = ['pointerdown', 'keydown', 'touchstart'] as const;
    interactionEvents.forEach((eventName) => {
      window.addEventListener(eventName, unlock, { passive: true });
    });

    const handleChatNotification = (event: Event) => {
      const notification = (event as CustomEvent).detail?.notification;
      if (!notification?.id) return;
      playChatNotificationSound();
      showBackgroundChatNotification(notification);
    };

    window.addEventListener(CHAT_NOTIFICATION_EVENT, handleChatNotification);
    return () => {
      interactionEvents.forEach((eventName) => {
        window.removeEventListener(eventName, unlock);
      });
      window.removeEventListener(CHAT_NOTIFICATION_EVENT, handleChatNotification);
    };
  }, []);

  return null;
}
