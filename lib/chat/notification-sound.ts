import type { ChatNotification } from '@/lib/chat/notification-store';

export const CHAT_SOUND_EVENT = 'bilik-chat-sound-update';
const CHAT_SOUND_ENABLED_KEY = 'bilik_chat_sound_enabled';

let audioContext: AudioContext | null = null;

function isBrowser() {
  return typeof window !== 'undefined';
}

export function readChatSoundEnabled() {
  if (!isBrowser()) return true;
  return localStorage.getItem(CHAT_SOUND_ENABLED_KEY) !== 'false';
}

export function setChatSoundEnabled(enabled: boolean) {
  if (!isBrowser()) return;
  localStorage.setItem(CHAT_SOUND_ENABLED_KEY, String(enabled));
  window.dispatchEvent(new CustomEvent(CHAT_SOUND_EVENT, { detail: { enabled } }));
}

function getAudioContext() {
  if (!isBrowser()) return null;
  if (audioContext?.state === 'closed') audioContext = null;
  if (audioContext) return audioContext;

  try {
    const AudioContextConstructor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return null;
    audioContext = new AudioContextConstructor();
    return audioContext;
  } catch {
    return null;
  }
}

/** Call this from a user gesture so later realtime events may play audio. */
export function unlockChatNotificationSound() {
  if (!isBrowser() || !readChatSoundEnabled()) return;
  const context = getAudioContext();
  if (context?.state === 'suspended') void context.resume().catch(() => undefined);
}

export function playChatNotificationSound() {
  if (!isBrowser() || !readChatSoundEnabled()) return;
  const context = getAudioContext();
  if (!context) return;

  if (context.state === 'suspended') {
    void context.resume()
      .then(() => {
        if (context.state === 'running') playChatNotificationSound();
      })
      .catch(() => undefined);
    return;
  }

  try {
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, now);
    oscillator.frequency.exponentialRampToValueAtTime(1320, now + 0.08);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.2);
  } catch {
    // Audio is an enhancement; a blocked or unavailable output must not break chat.
  }
}

export async function requestChatNotificationPermission() {
  if (!isBrowser() || !('Notification' in window)) return 'unsupported' as const;
  if (Notification.permission === 'granted') return 'granted' as const;
  if (Notification.permission === 'denied') return 'denied' as const;
  return Notification.requestPermission();
}

/** Show the browser/PWA notification only when the app is not visible. */
export function showBackgroundChatNotification(notification: ChatNotification) {
  if (!isBrowser() || document.visibilityState !== 'hidden') return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  try {
    const systemNotification = new Notification(
      `${notification.senderName} · ${notification.channelName}`,
      {
        body: notification.text || 'Pesan baru',
        icon: notification.senderAvatar || '/favicon.png',
        tag: `bilik-chat-${notification.id}`,
        silent: false,
      }
    );
    systemNotification.onclick = () => {
      systemNotification.close();
      window.focus();
      localStorage.setItem('bilik_chat_open_channel', notification.channelId);
      if (window.location.pathname.startsWith('/chat')) {
        window.dispatchEvent(new CustomEvent('bilik-open-chat-channel', {
          detail: { channelId: notification.channelId },
        }));
      } else {
        window.location.assign('/chat');
      }
    };
  } catch {
    // Notification permission or platform support can change while the app runs.
  }
}
