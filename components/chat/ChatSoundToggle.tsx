'use client';

import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { CHAT_SOUND_EVENT, readChatSoundEnabled, requestChatNotificationPermission, setChatSoundEnabled, unlockChatNotificationSound } from '@/lib/chat/notification-sound';

export default function ChatSoundToggle({ compact = false }: { compact?: boolean }) {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setEnabled(readChatSoundEnabled());
    const handleSoundUpdate = (event: Event) => {
      const nextEnabled = (event as CustomEvent).detail?.enabled;
      if (typeof nextEnabled === 'boolean') setEnabled(nextEnabled);
    };
    window.addEventListener(CHAT_SOUND_EVENT, handleSoundUpdate);
    return () => window.removeEventListener(CHAT_SOUND_EVENT, handleSoundUpdate);
  }, []);

  const toggle = async () => {
    const nextEnabled = !enabled;
    setEnabled(nextEnabled);
    setChatSoundEnabled(nextEnabled);
    if (!nextEnabled) return;
    unlockChatNotificationSound();
    try {
      await requestChatNotificationPermission();
    } catch {
      // Permission prompts may be unavailable in embedded or restricted PWA contexts.
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={enabled}
      aria-label={enabled ? 'Matikan suara notifikasi chat' : 'Aktifkan suara notifikasi chat'}
      title={enabled ? 'Suara chat aktif' : 'Aktifkan suara chat dan notifikasi sistem'}
      className={compact
        ? 'p-1.5 rounded-lg text-[#737680] hover:bg-white hover:text-[#24324A] transition-colors'
        : 'w-full flex items-center justify-between gap-3 px-2 py-2 rounded-lg text-left hover:bg-[#F7F7F8] transition-colors'}
    >
      <span className={compact ? '' : 'flex items-center gap-2 text-[11px] font-semibold text-[#24324A]'}>
        {enabled ? <Volume2 className="w-3.5 h-3.5 text-[#4F9D78]" /> : <VolumeX className="w-3.5 h-3.5 text-[#737680]" />}
        {!compact && 'Suara chat'}
      </span>
      {!compact && <span className="text-[10px] font-bold text-[#737680]">{enabled ? 'Aktif' : 'Mati'}</span>}
    </button>
  );
}
