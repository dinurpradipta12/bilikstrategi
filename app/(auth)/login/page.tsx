'use client';

import React, { useState } from 'react';
import { Shield, CheckCircle2, ArrowRight, Users, Lock } from 'lucide-react';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  const handleClickUpOAuth = () => {
    setLoading(true);
    // Redirect ke endpoint OAuth yang akan mengarahkan ke halaman login resmi ClickUp
    window.location.href = '/api/auth/clickup/login';
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

        {/* ClickUp OAuth Login Body */}
        <div className="p-8 pt-2 space-y-6 text-center">
          <div className="space-y-2">
            <h2 className="text-sm font-bold text-[#24324A]">Masuk dengan Akun ClickUp Anda</h2>
            <p className="text-xs text-[#737680] leading-relaxed">
              Klik tombol di bawah untuk diarahkan ke halaman login resmi <strong>ClickUp.com</strong>. 
              Setiap anggota tim masuk menggunakan email & password akun ClickUp masing-masing.
            </p>
          </div>

          {/* OAuth Flow Illustration */}
          <div className="flex items-center justify-center gap-3 py-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-[#EEF2F7] rounded-lg">
              <Users className="w-4 h-4 text-[#24324A]" />
              <span className="text-[10px] font-bold text-[#24324A]">Anda</span>
            </div>
            <ArrowRight className="w-4 h-4 text-[#737680]" />
            <div className="flex items-center gap-2 px-3 py-2 bg-[#7B68EE]/10 rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/clickup.png" alt="ClickUp" className="w-4 h-4 object-contain" />
              <span className="text-[10px] font-bold text-[#7B68EE]">ClickUp Login</span>
            </div>
            <ArrowRight className="w-4 h-4 text-[#737680]" />
            <div className="flex items-center gap-2 px-3 py-2 bg-[#4F9D78]/10 rounded-lg">
              <CheckCircle2 className="w-4 h-4 text-[#4F9D78]" />
              <span className="text-[10px] font-bold text-[#4F9D78]">Dashboard</span>
            </div>
          </div>

          {/* Direct ClickUp Official OAuth Button */}
          <button
            type="button"
            onClick={handleClickUpOAuth}
            disabled={loading}
            className="w-full py-4 bg-[#7B68EE] hover:bg-[#6C5CE7] text-white font-extrabold text-sm rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-3 cursor-pointer group disabled:opacity-70"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/clickup.png"
              alt="ClickUp Logo"
              className="w-7 h-7 object-contain flex-shrink-0 group-hover:scale-105 transition-transform"
            />
            <span>{loading ? 'Mengarahkan ke ClickUp.com...' : 'Masuk dengan Akun ClickUp'}</span>
            <ArrowRight className="w-4 h-4 text-white opacity-80 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Info Cards */}
          <div className="space-y-3">
            <div className="p-4 bg-[#F7F7F8] border border-[#E8E8EC] rounded-xl text-left space-y-2 text-xs text-[#737680]">
              <div className="flex items-center gap-2 font-semibold text-[#24324A]">
                <Lock className="w-4 h-4 text-[#7B68EE] flex-shrink-0" />
                <span>Login OAuth Resmi ClickUp</span>
              </div>
              <p className="text-[11px] text-[#737680] pl-6">
                Anda akan diarahkan ke halaman login resmi ClickUp.com. Masukkan email & password akun ClickUp Anda di sana. Aplikasi ini tidak pernah menyimpan password Anda.
              </p>
            </div>

            <div className="p-4 bg-[#F7F7F8] border border-[#E8E8EC] rounded-xl text-left space-y-2 text-xs text-[#737680]">
              <div className="flex items-center gap-2 font-semibold text-[#24324A]">
                <CheckCircle2 className="w-4 h-4 text-[#4F9D78] flex-shrink-0" />
                <span>Sesi Mandiri Per Anggota Tim</span>
              </div>
              <p className="text-[11px] text-[#737680] pl-6">
                Setiap anggota tim dapat login dengan akun ClickUp mereka sendiri. Profil, role, dan hak akses otomatis terhubung ke dashboard.
              </p>
            </div>
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
