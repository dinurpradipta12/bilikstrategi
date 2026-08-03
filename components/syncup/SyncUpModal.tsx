'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  MessageSquare,
  Users,
  Copy,
  Check,
  X,
  Volume2,
  Sparkles,
  Smile,
  Shield,
  Maximize2,
  Minimize2,
} from 'lucide-react';

interface SyncUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomTitle?: string;
}

export default function SyncUpModal({ isOpen, onClose, roomTitle = 'General Agency Huddle' }: SyncUpModalProps) {
  const [mounted, setMounted] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<'participants' | 'chat'>('participants');
  const [chatMessages, setChatMessages] = useState<Array<{ sender: string; text: string; time: string }>>([
    { sender: 'System', text: 'SyncUp Room dimulai. Tim dapat bergabung melalui audio & video.', time: '00:00' },
  ]);
  const [inputMsg, setInputMsg] = useState('');
  const [reactions, setReactions] = useState<string[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const screenRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Timer counter
  useEffect(() => {
    let timer: any = null;
    if (isOpen) {
      setCallDuration(0);
      timer = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isOpen]);

  // Request Web Camera & Microphone
  useEffect(() => {
    if (isOpen && videoOn) {
      navigator.mediaDevices
        ?.getUserMedia({ video: true, audio: true })
        .then((stream) => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch((err) => {
          console.warn('[SyncUp] Camera/Mic access permission error or unavailable:', err);
        });
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen, videoOn]);

  // Handle Screen Share
  const toggleScreenShare = async () => {
    if (!screenSharing) {
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = displayStream;
        setScreenSharing(true);
        if (screenRef.current) {
          screenRef.current.srcObject = displayStream;
        }
        displayStream.getVideoTracks()[0].onended = () => {
          setScreenSharing(false);
        };
      } catch (err) {
        console.warn('[SyncUp] Screen share cancelled:', err);
      }
    } else {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      setScreenSharing(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleCopyLink = () => {
    const link = typeof window !== 'undefined' ? `${window.location.origin}/syncup/room-general` : 'https://bilikstrategi.pages.dev/syncup';
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;
    const now = formatTime(callDuration);
    setChatMessages((prev) => [...prev, { sender: 'Dinur Pradipta', text: inputMsg.trim(), time: now }]);
    setInputMsg('');
  };

  const triggerReaction = (emoji: string) => {
    setReactions((prev) => [...prev, emoji]);
    setTimeout(() => {
      setReactions((prev) => prev.slice(1));
    }, 2500);
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-[#0C131F]/90 backdrop-blur-md p-4 animate-fade-in">
      <div className={`bg-[#141C2B] border border-[#24324A] rounded-2xl w-full flex flex-col shadow-2xl overflow-hidden transition-all duration-300 ${
        isFullscreen ? 'h-full max-w-full rounded-none' : 'max-w-5xl h-[88vh]'
      }`}>
        {/* 1. Header Bar */}
        <div className="h-14 px-6 bg-[#0E1522] border-b border-[#24324A] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#0F5A47] border border-[#10B981]/30 flex items-center justify-center shadow-xs">
              <PhoneCall className="w-4 h-4 text-[#10B981] animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-extrabold text-white">{roomTitle}</h2>
                <span className="px-2 py-0.5 text-[9px] font-extrabold bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30 rounded uppercase tracking-wider">
                  LIVE CALL
                </span>
              </div>
              <p className="text-[11px] text-[#8C9BAE] font-mono">Durasi: {formatTime(callDuration)} • Enkripsi End-to-End</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1E2B40] hover:bg-[#24324A] text-white text-xs font-semibold rounded-lg transition-all border border-[#2A3B57] cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#10B981]" /> : <Copy className="w-3.5 h-3.5 text-[#8C9BAE]" />}
              <span>{copied ? 'Link Tersalin!' : 'Salin Link Meeting'}</span>
            </button>

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 text-[#8C9BAE] hover:text-white hover:bg-[#1E2B40] rounded-lg transition-all"
              title={isFullscreen ? 'Kecilkan' : 'Layar Penuh'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="p-2 text-[#8C9BAE] hover:text-white hover:bg-[#C22929] rounded-lg transition-all"
              title="Tutup Room"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. Main Call Grid & Side Panel */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Reaction Floating Animations */}
          <div className="absolute bottom-20 left-10 z-50 pointer-events-none flex flex-col gap-2">
            {reactions.map((emoji, idx) => (
              <span key={idx} className="text-3xl animate-bounce drop-shadow-md">
                {emoji}
              </span>
            ))}
          </div>

          {/* Left Grid: Participant Video/Audio Cards */}
          <div className="flex-1 p-4 bg-[#0A0F1A] overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4 items-center justify-center">
            {/* Screen Share Tile (If active) */}
            {screenSharing && (
              <div className="md:col-span-2 relative bg-[#141C2B] border border-[#3B82F6] rounded-xl overflow-hidden min-h-[320px] flex items-center justify-center shadow-lg">
                <video ref={screenRef} autoPlay playsInline className="w-full h-full object-contain bg-black" />
                <div className="absolute top-3 left-3 px-3 py-1 bg-black/70 backdrop-blur-xs text-white text-xs font-bold rounded-lg border border-white/10 flex items-center gap-2">
                  <Monitor className="w-3.5 h-3.5 text-[#3B82F6]" />
                  <span>Screen Share Layar Utama</span>
                </div>
              </div>
            )}

            {/* Tile 1: User Camera / Avatar */}
            <div className="relative bg-[#141C2B] border border-[#24324A] rounded-xl overflow-hidden h-[260px] flex items-center justify-center group shadow-md">
              {videoOn ? (
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform -scale-x-100" />
              ) : (
                <div className="flex flex-col items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="https://attachments.clickup.com/profilePictures/276885530_r2L.jpg"
                    alt="Dinur Pradipta"
                    className="w-20 h-20 rounded-full border-2 border-[#10B981] object-cover shadow-md"
                  />
                  <span className="text-xs font-bold text-white">Dinur Pradipta (You)</span>
                </div>
              )}

              {/* Status Badge Overlays */}
              <div className="absolute bottom-3 left-3 px-2.5 py-1 bg-black/60 backdrop-blur-xs rounded-lg text-xs text-white font-semibold flex items-center gap-2 border border-white/10">
                <span>Dinur Pradipta (Host)</span>
                {micOn ? <Volume2 className="w-3.5 h-3.5 text-[#10B981] animate-pulse" /> : <MicOff className="w-3.5 h-3.5 text-[#EF4444]" />}
              </div>
            </div>

            {/* Tile 2: Co-Participant Avatar (Dinur mp) */}
            <div className="relative bg-[#141C2B] border border-[#24324A] rounded-xl overflow-hidden h-[260px] flex items-center justify-center group shadow-md">
              <div className="flex flex-col items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://ui-avatars.com/api/?name=Dinur%20mp&background=24324A&color=F26B5E&font-size=0.4&bold=true"
                  alt="Dinur mp"
                  className="w-20 h-20 rounded-full border-2 border-[#3B82F6] object-cover shadow-md"
                />
                <span className="text-xs font-bold text-white">Dinur mp</span>
              </div>
              <div className="absolute bottom-3 left-3 px-2.5 py-1 bg-black/60 backdrop-blur-xs rounded-lg text-xs text-white font-semibold flex items-center gap-2 border border-white/10">
                <span>Dinur mp (Member)</span>
                <Volume2 className="w-3.5 h-3.5 text-[#10B981] animate-pulse" />
              </div>
            </div>

            {/* Tile 3: Co-Participant Avatar (Syaiful Akhsin) */}
            <div className="relative bg-[#141C2B] border border-[#24324A] rounded-xl overflow-hidden h-[260px] flex items-center justify-center group shadow-md">
              <div className="flex flex-col items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://ui-avatars.com/api/?name=Syaiful%20Akhsin&background=24324A&color=F26B5E&font-size=0.4&bold=true"
                  alt="Syaiful Akhsin"
                  className="w-20 h-20 rounded-full border-2 border-[#8B5CF6] object-cover shadow-md"
                />
                <span className="text-xs font-bold text-white">Syaiful Akhsin</span>
              </div>
              <div className="absolute bottom-3 left-3 px-2.5 py-1 bg-black/60 backdrop-blur-xs rounded-lg text-xs text-white font-semibold flex items-center gap-2 border border-white/10">
                <span>Syaiful Akhsin (Designer)</span>
                <MicOff className="w-3.5 h-3.5 text-[#EF4444]" />
              </div>
            </div>

            {/* Tile 4: Invite More Slot */}
            <div
              onClick={handleCopyLink}
              className="relative bg-[#141C2B]/50 border-2 border-dashed border-[#24324A] hover:border-[#10B981] rounded-xl h-[260px] flex flex-col items-center justify-center gap-2 cursor-pointer transition-all group"
            >
              <div className="w-12 h-12 rounded-full bg-[#1E2B40] group-hover:bg-[#10B981]/20 flex items-center justify-center text-[#8C9BAE] group-hover:text-[#10B981] transition-all">
                <Users className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-white group-hover:text-[#10B981]">Undang Anggota Tim</span>
              <span className="text-[11px] text-[#8C9BAE]">Klik untuk menyalin link SyncUp</span>
            </div>
          </div>

          {/* Right Side Panel: Chat / Participants */}
          <div className="w-80 bg-[#0E1522] border-l border-[#24324A] flex flex-col flex-shrink-0">
            <div className="flex items-center border-b border-[#24324A] text-xs font-bold text-[#8C9BAE]">
              <button
                onClick={() => setActiveTab('participants')}
                className={`flex-1 py-3 border-b-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'participants' ? 'border-[#10B981] text-white bg-[#141C2B]' : 'border-transparent hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Anggota (3)</span>
              </button>
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex-1 py-3 border-b-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'chat' ? 'border-[#10B981] text-white bg-[#141C2B]' : 'border-transparent hover:text-white'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>In-Call Chat</span>
              </button>
            </div>

            {activeTab === 'participants' ? (
              <div className="flex-1 p-4 space-y-3 overflow-y-auto text-xs">
                {[
                  { name: 'Dinur Pradipta', role: 'Host / Owner', avatar: 'https://attachments.clickup.com/profilePictures/276885530_r2L.jpg', isMic: micOn },
                  { name: 'Dinur mp', role: 'Member', avatar: 'https://ui-avatars.com/api/?name=Dinur%20mp&background=24324A&color=F26B5E&font-size=0.4&bold=true', isMic: true },
                  { name: 'Syaiful Akhsin', role: 'Senior Designer', avatar: 'https://ui-avatars.com/api/?name=Syaiful%20Akhsin&background=24324A&color=F26B5E&font-size=0.4&bold=true', isMic: false },
                ].map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 bg-[#141C2B] border border-[#24324A] rounded-xl">
                    <div className="flex items-center gap-2.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.avatar} alt={p.name} className="w-7 h-7 rounded-full object-cover border border-[#2A3B57]" />
                      <div>
                        <span className="font-bold text-white block leading-tight">{p.name}</span>
                        <span className="text-[10px] text-[#8C9BAE]">{p.role}</span>
                      </div>
                    </div>
                    {p.isMic ? <Volume2 className="w-4 h-4 text-[#10B981]" /> : <MicOff className="w-4 h-4 text-[#EF4444]" />}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-between p-3 overflow-hidden">
                <div className="flex-1 space-y-2.5 overflow-y-auto pr-1 text-xs">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className="p-2.5 bg-[#141C2B] border border-[#24324A] rounded-xl space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-bold text-[#10B981]">{msg.sender}</span>
                        <span className="text-[#8C9BAE]">{msg.time}</span>
                      </div>
                      <p className="text-white leading-relaxed">{msg.text}</p>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleSendChat} className="mt-3 pt-2 border-t border-[#24324A] flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Tulis pesan cepat..."
                    value={inputMsg}
                    onChange={(e) => setInputMsg(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs bg-[#141C2B] border border-[#24324A] text-white rounded-lg focus:outline-none focus:border-[#10B981]"
                  />
                  <button type="submit" className="px-3 py-1.5 bg-[#10B981] text-white font-bold text-xs rounded-lg hover:bg-[#0D9668]">
                    Kirim
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* 3. Bottom Control Bar */}
        <div className="h-20 px-6 bg-[#0E1522] border-t border-[#24324A] flex items-center justify-between flex-shrink-0">
          {/* Left Emoji Reactions */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#8C9BAE] hidden sm:inline">Reaksi:</span>
            {['👍', '🔥', '👏', '🎉', '❤️'].map((emoji) => (
              <button
                key={emoji}
                onClick={() => triggerReaction(emoji)}
                className="w-9 h-9 rounded-xl bg-[#141C2B] hover:bg-[#1E2B40] border border-[#24324A] flex items-center justify-center text-lg transition-transform active:scale-125 cursor-pointer"
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Center Call Control Buttons */}
          <div className="flex items-center gap-3">
            {/* Mic Toggle */}
            <button
              onClick={() => setMicOn(!micOn)}
              className={`p-3.5 rounded-2xl transition-all cursor-pointer shadow-md flex items-center gap-2 ${
                micOn ? 'bg-[#1E2B40] hover:bg-[#24324A] text-white border border-[#2A3B57]' : 'bg-[#EF4444] text-white border border-[#DC2626]'
              }`}
              title={micOn ? 'Mute Mikrofon' : 'Unmute Mikrofon'}
            >
              {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>

            {/* Video Toggle */}
            <button
              onClick={() => setVideoOn(!videoOn)}
              className={`p-3.5 rounded-2xl transition-all cursor-pointer shadow-md flex items-center gap-2 ${
                videoOn ? 'bg-[#1E2B40] hover:bg-[#24324A] text-white border border-[#2A3B57]' : 'bg-[#EF4444] text-white border border-[#DC2626]'
              }`}
              title={videoOn ? 'Matikan Kamera' : 'Nyalakan Kamera'}
            >
              {videoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>

            {/* Screen Share Toggle */}
            <button
              onClick={toggleScreenShare}
              className={`p-3.5 rounded-2xl transition-all cursor-pointer shadow-md flex items-center gap-2 ${
                screenSharing ? 'bg-[#3B82F6] text-white border border-[#2563EB]' : 'bg-[#1E2B40] hover:bg-[#24324A] text-white border border-[#2A3B57]'
              }`}
              title={screenSharing ? 'Hentikan Berbagi Layar' : 'Berbagi Layar (Screen Share)'}
            >
              {screenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
            </button>

            {/* END CALL BUTTON */}
            <button
              onClick={onClose}
              className="px-6 py-3 bg-[#EF4444] hover:bg-[#DC2626] text-white font-extrabold text-xs rounded-2xl transition-all shadow-lg flex items-center gap-2 cursor-pointer"
            >
              <PhoneOff className="w-5 h-5" />
              <span>End SyncUp</span>
            </button>
          </div>

          {/* Right Room Info */}
          <div className="hidden md:flex items-center gap-2 text-xs text-[#8C9BAE]">
            <Shield className="w-4 h-4 text-[#10B981]" />
            <span>Koneksi Teramankan</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
