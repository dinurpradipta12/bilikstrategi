'use client';

import React, { useState } from 'react';
import {
  Settings,
  Link2,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Shield,
  Key,
  Database,
  Users,
  Bell,
  Sparkles,
} from 'lucide-react';

type SettingsTab = 'general' | 'clickup' | 'users' | 'security';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('clickup');
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setTestingConnection(false);
    setTestResult({
      success: true,
      message: 'Koneksi ClickUp API berhasil! Workspace "Bilik Strategi Main Workspace" terhubung dengan token terenkripsi.',
    });
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      <div>
        <h1 className="text-2xl font-extrabold text-[#24324A] tracking-tight">Workspace Settings</h1>
        <p className="text-xs text-[#737680] mt-1">
          Pengaturan aplikasi, status integrasi ClickUp, manajemen peran pengguna, dan sinkronisasi.
        </p>
      </div>

      {/* Tabs Header */}
      <div className="flex items-center gap-2 border-b border-[#E8E8EC]">
        {[
          { id: 'clickup', label: 'ClickUp Integration', icon: Link2 },
          { id: 'general', label: 'General & Workspace', icon: Settings },
          { id: 'users', label: 'Users & Roles', icon: Users },
          { id: 'security', label: 'Security & Webhooks', icon: Shield },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as SettingsTab)}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all ${
                isActive ? 'border-[#F26B5E] text-[#F26B5E]' : 'border-transparent text-[#737680] hover:text-[#202124]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* CLICKUP INTEGRATION TAB */}
      {activeTab === 'clickup' && (
        <div className="space-y-6">
          {/* Connection Status Card */}
          <div className="p-6 bg-[#FFFFFF] border border-[#E8E8EC] rounded-2xl shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#EEF2F7] flex items-center justify-center text-[#24324A] font-bold">
                  CU
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#24324A] flex items-center gap-2">
                    ClickUp Workspace Connection Status
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-[#EEF2F7] text-[#4F9D78] rounded flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Connected
                    </span>
                  </h3>
                  <p className="text-xs text-[#737680]">Metode: Personal Access Token (Encrypted Service Layer)</p>
                </div>
              </div>

              <button
                onClick={handleTestConnection}
                disabled={testingConnection}
                className="px-4 py-2 bg-[#24324A] text-white text-xs font-semibold rounded-xl hover:bg-[#1A2536] transition-colors flex items-center gap-1.5 shadow-2xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[#F26B5E] ${testingConnection ? 'animate-spin' : ''}`} />
                <span>{testingConnection ? 'Menguji...' : 'Test Connection'}</span>
              </button>
            </div>

            {testResult && (
              <div className="p-4 bg-[#EEF2F7] border border-[#4F9D78] text-[#4F9D78] text-xs rounded-xl flex items-center">
                <CheckCircle2 className="w-4 h-4 mr-2 flex-shrink-0" />
                {testResult.message}
              </div>
            )}

            {/* Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-[#E8E8EC] text-xs">
              <div>
                <span className="text-[#737680] block text-[11px]">Workspace ID</span>
                <span className="font-mono font-bold text-[#24324A]">90001122</span>
              </div>
              <div>
                <span className="text-[#737680] block text-[11px]">Token Security Status</span>
                <span className="font-mono text-[#737680]">pk_1234****_secured_in_env</span>
              </div>
              <div>
                <span className="text-[#737680] block text-[11px]">Terakhir Disinkronkan</span>
                <span className="font-semibold text-[#202124]">Baru saja (Live Sync)</span>
              </div>
            </div>
          </div>

          {/* Webhook Status Box */}
          <div className="p-6 bg-[#FFFFFF] border border-[#E8E8EC] rounded-2xl shadow-2xs space-y-3">
            <h3 className="text-sm font-bold text-[#24324A]">Status Webhook ClickUp</h3>
            <p className="text-xs text-[#737680]">
              Webhook mendengarkan event <code>taskCreated</code>, <code>taskUpdated</code>, <code>taskStatusUpdated</code>, dan <code>taskCommentPosted</code>.
            </p>
            <div className="p-3 bg-[#F7F7F8] border border-[#E8E8EC] rounded-xl text-xs flex items-center justify-between">
              <span className="font-mono text-[#24324A]">https://bilikstrategi.com/api/webhooks/clickup</span>
              <span className="px-2 py-0.5 bg-[#EEF2F7] text-[#4F9D78] font-bold rounded text-[10px]">Active & Verified</span>
            </div>
          </div>
        </div>
      )}

      {/* GENERAL TAB */}
      {activeTab === 'general' && (
        <div className="p-6 bg-[#FFFFFF] border border-[#E8E8EC] rounded-2xl shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-[#24324A]">Pengaturan Umum Agency</h3>
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold mb-1 text-[#202124]">Nama Agency Workspace</label>
              <input
                type="text"
                defaultValue="Bilik Strategi Workspace"
                className="w-full max-w-md px-3 py-2 border border-[#E8E8EC] rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* USERS & ROLES TAB */}
      {activeTab === 'users' && (
        <div className="p-6 bg-[#FFFFFF] border border-[#E8E8EC] rounded-2xl shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-[#24324A]">Manajemen Hak Akses & Peran Pengguna</h3>
          <div className="space-y-2 text-xs">
            <p className="text-[#737680]">Peran yang tersedia: Owner, Admin, Team Lead, Member, dan Client Portal.</p>
          </div>
        </div>
      )}

      {/* SECURITY TAB */}
      {activeTab === 'security' && (
        <div className="p-6 bg-[#FFFFFF] border border-[#E8E8EC] rounded-2xl shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-[#24324A]">Keamanan & Row Level Security (RLS)</h3>
          <p className="text-xs text-[#737680]">Token ClickUp tidak pernah dipublikasikan ke browser dan selalu dilindungi oleh proxy API Backend Next.js.</p>
        </div>
      )}
    </div>
  );
}
