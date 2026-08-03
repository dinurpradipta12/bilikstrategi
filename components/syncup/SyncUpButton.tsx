'use client';

import React, { useState } from 'react';
import { PhoneCall } from 'lucide-react';
import SyncUpModal from './SyncUpModal';

interface SyncUpButtonProps {
  roomTitle?: string;
  variant?: 'header' | 'compact' | 'full';
  className?: string;
  channelId?: string;
  onStartCall?: () => void;
}

export default function SyncUpButton({
  roomTitle = 'General Agency Huddle',
  variant = 'header',
  className = '',
  channelId,
  onStartCall,
}: SyncUpButtonProps) {
  const [isCallOpen, setIsCallOpen] = useState(false);

  const handleStartCall = async () => {
    setIsCallOpen(true);

    if (channelId) {
      try {
        await fetch('/api/clickup/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channelId,
            text: `📞 **SyncUp Voice & Video Call Dimulai!**\nPanggilan Huddle "${roomTitle}" telah aktif di channel ini. Klik **Start SyncUp** untuk bergabung!`,
          }),
        });
        if (onStartCall) onStartCall();
      } catch (err) {
        console.warn('[SyncUpButton] Gagal mengirimkan notifikasi call ke channel:', err);
      }
    }
  };

  return (
    <>
      {variant === 'header' && (
        <button
          onClick={handleStartCall}
          className={`flex items-center gap-2 px-3 py-1.5 bg-[#0F5A47] hover:bg-[#0B4537] text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer border border-[#10B981]/30 group ${className}`}
          title="Jump on a voice call or video call (ClickUp SyncUp)"
        >
          <div className="w-5 h-5 rounded-full bg-[#10B981] flex items-center justify-center shadow-xs group-hover:scale-110 transition-transform">
            <PhoneCall className="w-3 h-3 text-white animate-pulse" />
          </div>
          <div className="text-left leading-tight">
            <span className="block font-extrabold text-[11px] tracking-tight">Start SyncUp</span>
          </div>
        </button>
      )}

      {variant === 'compact' && (
        <button
          onClick={handleStartCall}
          className={`p-2 bg-[#0F5A47] hover:bg-[#0B4537] text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer border border-[#10B981]/30 ${className}`}
          title="Start SyncUp (Voice/Video Call)"
        >
          <PhoneCall className="w-4 h-4 text-[#10B981]" />
        </button>
      )}

      {variant === 'full' && (
        <button
          onClick={handleStartCall}
          className={`w-full py-2.5 px-4 bg-[#0F5A47] hover:bg-[#0B4537] text-white rounded-xl text-xs font-extrabold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer border border-[#10B981]/30 ${className}`}
        >
          <PhoneCall className="w-4 h-4 text-[#10B981] animate-pulse" />
          <span>Start SyncUp (Jump on Voice/Video Call)</span>
        </button>
      )}

      {/* SyncUp Voice & Video Call Modal */}
      <SyncUpModal
        isOpen={isCallOpen}
        onClose={() => setIsCallOpen(false)}
        roomTitle={roomTitle}
      />
    </>
  );
}
