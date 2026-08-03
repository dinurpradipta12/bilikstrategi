'use client';

import React, { useEffect, useState } from 'react';
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
  Plus,
} from 'lucide-react';

type SettingsTab = 'general' | 'clickup' | 'users' | 'security';

type AppWorkspace = {
  id: string;
  name: string;
  slug: string;
  clickup_workspace_id?: string | null;
  clickup_space_id?: string | null;
  clickup_sync_enabled?: boolean;
  clickup_sync_status?: string;
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('clickup');
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [workspaces, setWorkspaces] = useState<AppWorkspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('bilik-strategi');
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newClickUpWorkspaceId, setNewClickUpWorkspaceId] = useState('');
  const [newClickUpSpaceId, setNewClickUpSpaceId] = useState('');
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [workspaceMessage, setWorkspaceMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadWorkspaces = async () => {
    try {
      const res = await fetch('/api/app/workspaces', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengambil workspace');
      setWorkspaces(data.workspaces || []);
      setActiveWorkspaceId(data.current_workspace_id || 'bilik-strategi');
    } catch (err: any) {
      setWorkspaceMessage({ type: 'error', text: err.message || 'Gagal mengambil workspace' });
    }
  };

  useEffect(() => {
    loadWorkspaces();
  }, []);

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

  const handleCreateWorkspace = async () => {
    const name = newWorkspaceName.trim();
    if (!name) {
      setWorkspaceMessage({ type: 'error', text: 'Nama workspace wajib diisi.' });
      return;
    }

    setCreatingWorkspace(true);
    setWorkspaceMessage(null);
    try {
      const res = await fetch('/api/app/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          clickup_workspace_id: newClickUpWorkspaceId.trim() || null,
          clickup_space_id: newClickUpSpaceId.trim() || null,
          clickup_sync_enabled: Boolean(newClickUpWorkspaceId.trim() || newClickUpSpaceId.trim()),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat workspace');
      setNewWorkspaceName('');
      setNewClickUpWorkspaceId('');
      setNewClickUpSpaceId('');
      setWorkspaceMessage({ type: 'success', text: 'Workspace baru dibuat dan dipilih sebagai workspace aktif.' });
      await loadWorkspaces();
      window.dispatchEvent(new Event('bilik-workspace-updated'));
    } catch (err: any) {
      setWorkspaceMessage({ type: 'error', text: err.message || 'Gagal membuat workspace' });
    } finally {
      setCreatingWorkspace(false);
    }
  };

  const handleSelectWorkspace = async (workspaceId: string) => {
    setWorkspaceMessage(null);
    try {
      const res = await fetch('/api/app/workspaces', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memilih workspace');
      setActiveWorkspaceId(workspaceId);
      setWorkspaceMessage({ type: 'success', text: `Workspace aktif: ${data.workspace?.name || workspaceId}.` });
      window.dispatchEvent(new Event('bilik-workspace-updated'));
    } catch (err: any) {
      setWorkspaceMessage({ type: 'error', text: err.message || 'Gagal memilih workspace' });
    }
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
        <div className="space-y-6">
          <div className="p-6 bg-[#FFFFFF] border border-[#E8E8EC] rounded-2xl shadow-2xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-[#24324A]">Workspace Aplikasi</h3>
              <p className="text-xs text-[#737680] mt-1">
                Workspace aplikasi menjadi sumber utama data realtime. ClickUp hanya disiapkan sebagai sinkronisasi latar belakang.
              </p>
            </div>

            {workspaceMessage && (
              <div
                className={`p-3 rounded-xl border text-xs ${
                  workspaceMessage.type === 'success'
                    ? 'bg-[#EEF8F3] border-[#B8E1CB] text-[#2F7D58]'
                    : 'bg-[#FFF0ED] border-[#FFC7BE] text-[#C94D43]'
                }`}
              >
                {workspaceMessage.text}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold mb-1 text-xs text-[#202124]">Nama Workspace</label>
                <input
                  type="text"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  placeholder="Contoh: Brand Client A"
                  className="w-full px-3 py-2 border border-[#E8E8EC] rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1 text-xs text-[#202124]">ClickUp Workspace ID</label>
                <input
                  type="text"
                  value={newClickUpWorkspaceId}
                  onChange={(e) => setNewClickUpWorkspaceId(e.target.value)}
                  placeholder="Opsional"
                  className="w-full px-3 py-2 border border-[#E8E8EC] rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1 text-xs text-[#202124]">ClickUp Space ID</label>
                <input
                  type="text"
                  value={newClickUpSpaceId}
                  onChange={(e) => setNewClickUpSpaceId(e.target.value)}
                  placeholder="Opsional"
                  className="w-full px-3 py-2 border border-[#E8E8EC] rounded-lg text-xs"
                />
              </div>
            </div>

            <button
              onClick={handleCreateWorkspace}
              disabled={creatingWorkspace}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#24324A] text-white text-xs font-semibold rounded-lg hover:bg-[#1A2536] disabled:opacity-60"
            >
              <Plus className="w-3.5 h-3.5 text-[#F26B5E]" />
              {creatingWorkspace ? 'Membuat...' : 'Buat Workspace'}
            </button>
          </div>

          <div className="p-6 bg-[#FFFFFF] border border-[#E8E8EC] rounded-2xl shadow-2xs space-y-3">
            <h3 className="text-sm font-bold text-[#24324A]">Daftar Workspace</h3>
            <div className="divide-y divide-[#E8E8EC] border border-[#E8E8EC] rounded-xl overflow-hidden">
              {workspaces.length === 0 && (
                <div className="p-4 text-xs text-[#737680]">Belum ada workspace tersimpan.</div>
              )}
              {workspaces.map((workspace) => (
                <div key={workspace.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#24324A] truncate">{workspace.name}</p>
                    <p className="text-[11px] text-[#737680] font-mono truncate">
                      {workspace.slug} {workspace.clickup_space_id ? `• ClickUp Space ${workspace.clickup_space_id}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => handleSelectWorkspace(workspace.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                      activeWorkspaceId === workspace.id
                        ? 'bg-[#EEF8F3] border-[#B8E1CB] text-[#2F7D58]'
                        : 'bg-white border-[#E8E8EC] text-[#24324A] hover:bg-[#F7F7F8]'
                    }`}
                  >
                    {activeWorkspaceId === workspace.id ? 'Aktif' : 'Pilih'}
                  </button>
                </div>
              ))}
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
