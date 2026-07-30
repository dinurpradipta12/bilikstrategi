'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, CheckCircle2, ArrowRight, ChevronDown, UserCheck } from 'lucide-react';

interface ClickUpMember {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<ClickUpMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<ClickUpMember | null>(null);

  useEffect(() => {
    fetch('/api/clickup/teams')
      .then((res) => res.json())
      .then((data) => {
        if (data.members && Array.isArray(data.members)) {
          const mapped: ClickUpMember[] = data.members.map((m: any) => ({
            id: String(m.id),
            name: m.username || m.email?.split('@')[0] || 'Team Member',
            email: m.email || `${(m.username || 'member').toLowerCase().replace(/\s+/g, '')}@bilikstrategi.id`,
            role: m.role === 1 ? 'owner' : m.role === 2 ? 'admin' : 'member',
            avatar: m.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.username || 'User')}&background=24324A&color=fff`,
          }));
          setMembers(mapped);
          if (mapped.length > 0) setSelectedMember(mapped[0]);
        }
      })
      .catch(() => {});
  }, []);

  const handleClickUpOAuth = () => {
    setLoading(true);

    if (selectedMember) {
      const url = `/api/auth/clickup/callback?name=${encodeURIComponent(selectedMember.name)}&email=${encodeURIComponent(selectedMember.email)}&role=${selectedMember.role}&avatar=${encodeURIComponent(selectedMember.avatar)}`;
      window.location.href = url;
    } else {
      window.location.href = '/api/auth/clickup/login';
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F7F8] flex flex-col justify-center items-center p-4">
      {/* Background Graphic Accents */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-[#EEF2F7] to-transparent opacity-60 pointer-events-none -z-10" />

      {/* Main Container */}
      <div className="w-full max-w-md bg-[#FFFFFF] border border-[#E8E8EC] rounded-2xl shadow-xl overflow-hidden animate-fade-in space-y-6">
        {/* Brand Header */}
        <div className="p-8 text-center border-b border-[#E8E8EC] bg-[#FFFFFF]">
          <div className="w-14 h-14 rounded-2xl bg-[#24324A] text-white font-extrabold text-2xl flex items-center justify-center mx-auto mb-3 shadow-md">
            BS
          </div>
          <h1 className="text-xl font-extrabold text-[#24324A] tracking-tight">Bilik Strategi Workspace</h1>
          <p className="text-xs text-[#737680] mt-1">Agency Operations & ClickUp Project Management Engine</p>
        </div>

        {/* Pure ClickUp SSO Body */}
        <div className="p-8 pt-2 space-y-6 text-center">
          <div className="space-y-2">
            <h2 className="text-sm font-bold text-[#24324A]">Masuk dengan Akun ClickUp</h2>
            <p className="text-xs text-[#737680] leading-relaxed">
              Pilih akun anggota tim ClickUp Anda untuk masuk dan menghubungkan hak akses ke dashboard aplikasi.
            </p>
          </div>

          {/* Member Selection Box */}
          {members.length > 0 && (
            <div className="text-left space-y-2">
              <label className="block text-xs font-semibold text-[#202124]">Pilih Akun Member ClickUp Anda:</label>
              <div className="relative">
                <select
                  value={selectedMember?.id || ''}
                  onChange={(e) => {
                    const found = members.find((m) => m.id === e.target.value);
                    if (found) setSelectedMember(found);
                  }}
                  className="w-full p-3.5 bg-[#F7F7F8] border border-[#24324A]/20 rounded-xl text-xs font-bold text-[#24324A] outline-none appearance-none cursor-pointer pr-10"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.role.toUpperCase()}) — {m.email}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-[#24324A] absolute right-3 top-4 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Selected Profile Card Preview */}
          {selectedMember && (
            <div className="p-4 bg-[#F7F7F8] border border-[#E8E8EC] rounded-xl flex items-center gap-3 text-left">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selectedMember.avatar} alt={selectedMember.name} className="w-10 h-10 rounded-full object-cover border border-[#E8E8EC]" />
              <div className="flex-1 min-w-0">
                <span className="font-bold text-xs text-[#24324A] block truncate">{selectedMember.name}</span>
                <span className="text-[11px] text-[#737680] block truncate">{selectedMember.email}</span>
                <span className="text-[10px] text-[#4F9D78] font-bold block mt-0.5 uppercase">{selectedMember.role} • ClickUp Account</span>
              </div>
            </div>
          )}

          {/* Direct ClickUp Official OAuth Button */}
          <button
            type="button"
            onClick={handleClickUpOAuth}
            disabled={loading}
            className="w-full py-4 bg-[#7B68EE] hover:bg-[#6C5CE7] text-white font-extrabold text-sm rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-3 cursor-pointer group"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/clickup.png"
              alt="ClickUp Logo"
              className="w-7 h-7 object-contain flex-shrink-0 group-hover:scale-105 transition-transform"
            />
            <span>{loading ? 'Menghubungkan Akun...' : `Masuk sebagai ${selectedMember?.name || 'ClickUp User'}`}</span>
            <ArrowRight className="w-4 h-4 text-white opacity-80 group-hover:translate-x-0.5 transition-transform" />
          </button>

          <div className="p-4 bg-[#F7F7F8] border border-[#E8E8EC] rounded-xl text-left space-y-2 text-xs text-[#737680]">
            <div className="flex items-center gap-2 font-semibold text-[#24324A]">
              <CheckCircle2 className="w-4 h-4 text-[#4F9D78] flex-shrink-0" />
              <span>Multi-Browser & Sesi Mandiri</span>
            </div>
            <p className="text-[11px] text-[#737680] pl-6">
              Buka tab Incognito atau browser berbeda untuk masuk sebagai akun anggota tim lain (*Member* / *Admin*) secara independen.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#F7F7F8] border-t border-[#E8E8EC] text-center text-[11px] text-[#737680] flex items-center justify-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-[#4F9D78]" />
          <span>Protected by Official ClickUp OAuth 2.0 Engine</span>
        </div>
      </div>
    </div>
  );
}
