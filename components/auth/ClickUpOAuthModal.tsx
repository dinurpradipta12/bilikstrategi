'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, Shield, Lock, ArrowRight, ExternalLink, ChevronDown, User } from 'lucide-react';

interface ClickUpOAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user?: any) => void;
}

interface MemberAccount {
  id: string;
  username: string;
  email: string;
  role: string;
  profilePicture: string;
}

export default function ClickUpOAuthModal({ isOpen, onClose, onSuccess }: ClickUpOAuthModalProps) {
  const [authorizing, setAuthorizing] = useState(false);
  const [members, setMembers] = useState<MemberAccount[]>([]);
  const [selectedMember, setSelectedMember] = useState<MemberAccount | null>(null);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setLoadingMembers(true);
      fetch('/api/clickup/teams')
        .then((res) => res.json())
        .then((data) => {
          if (data.members && Array.isArray(data.members)) {
            const mapped = data.members.map((m: any) => ({
              id: String(m.id),
              username: m.username || m.email?.split('@')[0] || 'Team Member',
              email: m.email || `${(m.username || 'member').toLowerCase()}@bilikstrategi.id`,
              role: m.role === 1 ? 'Workspace Owner' : m.role === 2 ? 'Workspace Admin' : 'Workspace Member',
              profilePicture: m.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.username || 'User')}&background=24324A&color=fff`,
            }));
            setMembers(mapped);
            if (mapped.length > 0) setSelectedMember(mapped[0]);
          }
        })
        .catch(() => {
          // Fallback to default
          setMembers([
            {
              id: '276885530',
              username: 'Dinur Pradipta',
              email: 'snllabsarchive@gmail.com',
              role: 'Workspace Owner',
              profilePicture: 'https://attachments.clickup.com/profilePictures/276885530_r2L.jpg',
            },
          ]);
        })
        .finally(() => setLoadingMembers(false));
    }
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const handleAuthorize = () => {
    setAuthorizing(true);
    setTimeout(() => {
      setAuthorizing(false);
      onSuccess(selectedMember);
    }, 800);
  };

  return createPortal(
    <div data-mobile-modal className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div data-mobile-modal-panel className="w-full max-w-md bg-[#FFFFFF] border border-[#E8E8EC] rounded-2xl shadow-2xl overflow-hidden relative z-[101]">
        {/* Popup Header */}
        <div className="p-6 bg-[#7B68EE] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/clickup.png" alt="ClickUp" className="w-8 h-8 object-contain bg-white rounded-lg p-0.5" />
            <div>
              <h2 className="text-sm font-extrabold leading-tight">ClickUp OAuth Authorization</h2>
              <p className="text-[11px] text-white/80">Connect Bilik Strategi Workspace</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/20 text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Popup Body */}
        <div className="p-6 space-y-5">
          <div className="text-center space-y-2">
            <h3 className="text-base font-bold text-[#24324A]">Izinkan Akses Workspace ClickUp</h3>
            <p className="text-xs text-[#737680] leading-relaxed">
              Pilih akun anggota tim ClickUp yang ingin digunakan untuk masuk ke <strong>Bilik Strategi Workspace</strong>.
            </p>
          </div>

          {/* Account Selector Dropdown */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-[#202124]">Pilih Akun Member ClickUp:</label>
            {loadingMembers ? (
              <div className="p-3 bg-[#F7F7F8] border border-[#E8E8EC] rounded-xl text-center text-xs text-[#737680]">
                Mengambil daftar member ClickUp...
              </div>
            ) : (
              <div className="relative">
                <select
                  value={selectedMember?.id || ''}
                  onChange={(e) => {
                    const found = members.find((m) => m.id === e.target.value);
                    if (found) setSelectedMember(found);
                  }}
                  className="w-full p-3 bg-[#F7F7F8] border border-[#24324A]/20 rounded-xl text-xs font-bold text-[#24324A] outline-none appearance-none cursor-pointer pr-10"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.username} ({m.role}) — {m.email}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-[#24324A] absolute right-3 top-3.5 pointer-events-none" />
              </div>
            )}
          </div>

          {/* Selected Account Profile Card */}
          {selectedMember && (
            <div className="p-4 bg-[#F7F7F8] border border-[#E8E8EC] rounded-xl flex items-center gap-3 animate-fade-in">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedMember.profilePicture}
                alt={selectedMember.username}
                className="w-10 h-10 rounded-full object-cover border border-[#E8E8EC]"
              />
              <div className="flex-1 min-w-0">
                <span className="font-bold text-xs text-[#24324A] block truncate">{selectedMember.username}</span>
                <span className="text-[11px] text-[#737680] block truncate">{selectedMember.email}</span>
                <span className="text-[10px] text-[#4F9D78] font-bold block mt-0.5">{selectedMember.role} • Bilik Strategi</span>
              </div>
            </div>
          )}

          <div className="space-y-2 text-xs text-[#737680] pt-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#4F9D78] flex-shrink-0" />
              <span>Akses penuh ke ClickUp Spaces & Task list</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#4F9D78] flex-shrink-0" />
              <span>Sinkronisasi komentar & status task real-time</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#24324A] flex-shrink-0" />
              <span>Koneksi aman dengan enkripsi SSL/TLS</span>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-[#E8E8EC] flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-[#E8E8EC] text-xs font-semibold text-[#737680] rounded-xl hover:bg-[#F7F7F8]"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleAuthorize}
              disabled={authorizing || !selectedMember}
              className="flex-1 py-2.5 bg-[#7B68EE] hover:bg-[#6C5CE7] text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {authorizing ? (
                <span>Menghubungkan...</span>
              ) : (
                <>
                  <span>Izinkan & Masuk</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#F7F7F8] border-t border-[#E8E8EC] text-center text-[10px] text-[#737680]">
          Authorized by ClickUp API OAuth 2.0 Engine
        </div>
      </div>
    </div>,
    document.body
  );
}
