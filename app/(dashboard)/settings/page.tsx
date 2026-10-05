'use client';

import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { useBranding } from '@/components/branding/BrandingProvider';
import { TEAM_MODULE_OPTIONS, type TeamBranding, type TeamModuleKey } from '@/lib/branding/types';

type UserRow = { id: string; full_name: string; email: string; username: string; role: string; status: string };

export default function SettingsPage() {
  const { branding, refreshBranding } = useBranding();
  const [form, setForm] = useState<TeamBranding>(branding);
  const [isManager, setIsManager] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [newUser, setNewUser] = useState({ full_name: '', username: '', email: '', password: '', role: 'member' });

  useEffect(() => { setForm(branding); }, [branding]);
  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        setIsManager(['owner', 'admin'].includes(data.user?.app_role));
        setIsOwner(data.user?.app_role === 'owner');
      })
      .catch(() => setIsManager(false));
  }, []);
  useEffect(() => {
    if (!isManager) return;
    fetch('/api/admin/users', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => setUsers(Array.isArray(data.users) ? data.users : []))
      .catch(() => {});
  }, [isManager]);

  function field(key: Exclude<keyof TeamBranding, 'modules_enabled'>, label: string, hint = '') {
    return (
      <label className="block text-sm font-semibold" key={key}>
        {label}
        {hint && <span className="ml-2 text-xs font-normal text-[#737680]">{hint}</span>}
        <input
          type={key.endsWith('_color') ? 'color' : key === 'company_email' ? 'email' : 'text'}
          value={form[key]}
          disabled={!isManager}
          onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
          className={`mt-1 block w-full rounded-lg border border-[#E8E8EC] bg-white px-3 py-2.5 font-normal disabled:opacity-60 ${key.endsWith('_color') ? 'h-11' : ''}`}
        />
      </label>
    );
  }

  async function save() {
    setBusy(true);
    setMessage('');
    try {
      const brandFields = { ...form };
      delete (brandFields as Partial<TeamBranding>).modules_enabled;
      const response = await fetch('/api/branding', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(isOwner ? form : brandFields),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal menyimpan branding.');
      await refreshBranding();
      setMessage('Identitas aplikasi berhasil disimpan.');
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Gagal menyimpan branding.'); }
    finally { setBusy(false); }
  }

  async function upload(kind: 'logo' | 'icon', event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMessage('');
    try {
      const body = new FormData();
      body.set('kind', kind);
      body.set('file', file);
      const response = await fetch('/api/branding/upload', { method: 'POST', body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal mengunggah gambar.');
      await refreshBranding();
      setMessage(kind === 'logo' ? 'Logo berhasil diperbarui.' : 'Ikon berhasil diperbarui.');
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Gagal mengunggah gambar.'); }
    finally { setBusy(false); event.target.value = ''; }
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newUser),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal membuat pengguna.');
      setNewUser({ full_name: '', username: '', email: '', password: '', role: 'member' });
      const list = await fetch('/api/admin/users', { cache: 'no-store' }).then((result) => result.json());
      setUsers(Array.isArray(list.users) ? list.users : []);
      setMessage('Pengguna berhasil dibuat.');
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Gagal membuat pengguna.'); }
    finally { setBusy(false); }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 pb-10">
      <header>
        <h1 className="text-2xl font-bold text-[#24324A]">Pengaturan Aplikasi</h1>
        <p className="mt-1 text-sm text-[#737680]">Atur identitas visual dan anggota tim untuk aplikasi ini.</p>
      </header>
      {message && <p role="status" className="rounded-lg border border-[#E8E8EC] bg-white p-3 text-sm">{message}</p>}

      <section className="rounded-2xl border border-[#E8E8EC] bg-white p-5 md:p-7">
        <h2 className="text-lg font-bold">Branding</h2>
        <p className="mt-1 text-sm text-[#737680]">Nama, logo, warna, dan identitas dokumen berlaku untuk aplikasi tim ini.</p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          {(['logo', 'icon'] as const).map((kind) => (
            <div key={kind} className="rounded-xl border border-[#E8E8EC] p-4">
              <p className="text-sm font-semibold">{kind === 'logo' ? 'Logo aplikasi' : 'Ikon aplikasi / favicon'}</p>
              <div className="mt-3 flex h-24 items-center justify-center rounded-lg bg-[#F7F7F8]">
                {form[kind === 'logo' ? 'logo_url' : 'icon_url'] ? (
                  <img src={form[kind === 'logo' ? 'logo_url' : 'icon_url']} alt={kind === 'logo' ? 'Pratinjau logo' : 'Pratinjau ikon'} className="max-h-20 max-w-full object-contain" />
                ) : <span className="text-xs text-[#737680]">Belum ada gambar</span>}
              </div>
              {isManager && <input aria-label={`Unggah ${kind}`} type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={(event) => void upload(kind, event)} className="mt-3 block w-full text-xs" />}
              <p className="mt-2 text-xs text-[#737680]">PNG, JPG, atau WebP; maksimal 2 MB. Ikon sebaiknya berbentuk persegi.</p>
            </div>
          ))}
        </div>
        <form onSubmit={(event) => { event.preventDefault(); void save(); }} className="mt-6 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {field('name', 'Nama aplikasi')}
            {field('short_name', 'Nama singkat', 'Untuk ikon aplikasi')}
            {field('tagline', 'Deskripsi singkat')}
            {field('company_name', 'Nama perusahaan')}
            {field('primary_color', 'Warna utama')}
            {field('accent_color', 'Warna aksen')}
            {field('company_email', 'Email perusahaan')}
            {field('company_phone', 'Telepon perusahaan')}
          </div>
          {field('company_address', 'Alamat perusahaan')}
          {isManager && <button type="submit" disabled={busy} className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: branding.primary_color }}>{busy ? 'Menyimpan…' : 'Simpan branding'}</button>}
        </form>
      </section>

      {isOwner && <section className="rounded-2xl border border-[#E8E8EC] bg-white p-5 md:p-7">
        <h2 className="text-lg font-bold">Fitur Aplikasi</h2>
        <p className="mt-1 text-sm text-[#737680]">Semua fitur aktif sejak awal. Fitur yang dinonaktifkan disembunyikan dari navigasi dan akses datanya ditutup untuk tim ini.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {TEAM_MODULE_OPTIONS.map(({ key, label }) => <label key={key} className="flex items-center justify-between gap-3 rounded-lg border border-[#E8E8EC] px-4 py-3 text-sm">
            <span>{label}</span>
            <input type="checkbox" checked={form.modules_enabled[key]} onChange={(event) => {
              const enabled = event.target.checked;
              setForm((current) => ({ ...current, modules_enabled: { ...current.modules_enabled, [key as TeamModuleKey]: enabled } }));
            }} className="size-4 accent-[#24324A]" />
          </label>)}
        </div>
        <button type="button" onClick={() => void save()} disabled={busy} className="mt-5 rounded-lg bg-[#24324A] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">Simpan pengaturan fitur</button>
      </section>}

      {isManager && <section className="rounded-2xl border border-[#E8E8EC] bg-white p-5 md:p-7">
        <h2 className="text-lg font-bold">Anggota Tim</h2>
        <div className="mt-4 overflow-x-auto rounded-lg border border-[#E8E8EC]">
          <table className="w-full min-w-[500px] text-left text-sm">
            <thead className="bg-[#F7F7F8]"><tr><th className="p-3">Nama</th><th className="p-3">Email</th><th className="p-3">Peran</th><th className="p-3">Status</th></tr></thead>
            <tbody>{users.map((user) => <tr key={user.id} className="border-t border-[#E8E8EC]"><td className="p-3">{user.full_name}</td><td className="p-3">{user.email}</td><td className="p-3">{user.role}</td><td className="p-3">{user.status}</td></tr>)}</tbody>
          </table>
        </div>
        <form onSubmit={createUser} className="mt-5 grid gap-3 sm:grid-cols-2">
          {(['full_name', 'username', 'email', 'password'] as const).map((key) => <label key={key} className="text-sm font-semibold">{({ full_name: 'Nama lengkap', username: 'Username', email: 'Email', password: 'Password awal' })[key]}<input required type={key === 'email' ? 'email' : key === 'password' ? 'password' : 'text'} value={newUser[key]} onChange={(event) => setNewUser((current) => ({ ...current, [key]: event.target.value }))} className="mt-1 block w-full rounded-lg border border-[#E8E8EC] px-3 py-2.5 font-normal" /></label>)}
          <label className="text-sm font-semibold">Peran<select value={newUser.role} onChange={(event) => setNewUser((current) => ({ ...current, role: event.target.value }))} className="mt-1 block w-full rounded-lg border border-[#E8E8EC] px-3 py-2.5 font-normal"><option value="member">Member</option><option value="admin">Admin</option><option value="client">Client</option>{isOwner && <option value="owner">Owner</option>}</select></label>
          <div className="flex items-end"><button type="submit" disabled={busy} className="w-full rounded-lg bg-[#24324A] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">Tambah anggota</button></div>
        </form>
      </section>}
    </main>
  );
}
