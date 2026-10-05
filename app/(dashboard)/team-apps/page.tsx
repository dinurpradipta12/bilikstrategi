'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ArrowUpRight, Building2, CheckCircle2, Loader2, Plus, X } from 'lucide-react';
import { normalizeTeamSlug } from '@/lib/team-apps/validation';

type TeamApp = {
  id: string;
  name: string;
  slug: string;
  short_name: string;
  owner_email: string;
  tagline: string;
  primary_color: string;
  accent_color: string;
  hosting_provider: string;
  app_url: string | null;
  status: 'draft' | 'link_recorded';
  created_at: string;
};

type Draft = {
  name: string;
  slug: string;
  short_name: string;
  owner_email: string;
  tagline: string;
  primary_color: string;
  accent_color: string;
};

const emptyDraft: Draft = {
  name: '', slug: '', short_name: '', owner_email: '', tagline: '',
  primary_color: '#24324A', accent_color: '#F26B5E',
};

export default function TeamAppsPage() {
  const [apps, setApps] = useState<TeamApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [slugEdited, setSlugEdited] = useState(false);
  const [shortNameEdited, setShortNameEdited] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [provider, setProvider] = useState('vercel');
  const [appUrl, setAppUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/team-apps', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Gagal memuat aplikasi tim.');
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        setApps(Array.isArray(data.apps) ? data.apps : []);
        setError('');
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Gagal memuat aplikasi tim.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function changeName(name: string) {
    setDraft((current) => ({
      ...current,
      name,
      short_name: shortNameEdited ? current.short_name : name.slice(0, 40),
      slug: slugEdited ? current.slug : normalizeTeamSlug(name),
    }));
  }

  async function createApp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/team-apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal menambahkan tim.');
      setApps((current) => [data.app, ...current]);
      setDraft(emptyDraft);
      setSlugEdited(false);
      setShortNameEdited(false);
      setShowForm(false);
      setMessage('Tim disimpan. Pilih hosting nanti untuk membuat aplikasi dan link mandiri.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal menambahkan tim.');
    } finally { setBusy(false); }
  }

  async function saveLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!linkingId) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/team-apps', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: linkingId, hosting_provider: provider, app_url: appUrl }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal menyimpan tautan.');
      setApps((current) => current.map((app) => app.id === linkingId ? data.app : app));
      setLinkingId(null);
      setAppUrl('');
      setMessage('Tautan tersimpan. Periksa aplikasi tim sebelum dibagikan kepada anggota.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal menyimpan tautan.');
    } finally { setBusy(false); }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 pb-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-[#F26B5E]">Owner</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#24324A]">Aplikasi Tim</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#737680]">Siapkan identitas tiap tim dan kelola link aplikasinya dari Bilik Strategi.</p>
        </div>
        <button type="button" onClick={() => { setShowForm(true); setError(''); }}
          className="inline-flex items-center gap-2 rounded-xl bg-[#24324A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1A2536]">
          <Plus className="h-4 w-4" /> Tambah Tim
        </button>
      </div>

      <section className="rounded-2xl border border-[#E8E8EC] bg-white p-5 shadow-2xs">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-[#FFF0ED] p-2.5 text-[#F26B5E]"><Building2 className="h-5 w-5" /></div>
          <div className="space-y-1 text-sm">
            <h2 className="font-bold text-[#24324A]">Satu tim, satu aplikasi mandiri</h2>
            <p className="text-[#737680]">Setiap aplikasi tim memakai database, login, dan link sendiri. Semua modul tersedia sejak awal; Owner tim dapat mengubah logo, warna, dan fitur dari Pengaturan di aplikasinya.</p>
            <p className="text-[#737680]">Saat ini Anda bisa menyimpan rancangan tim. Aktivasi otomatis menunggu pilihan hosting dan koneksi akun penyedia satu kali.</p>
          </div>
        </div>
      </section>

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{message}</p>}

      {showForm && (
        <section className="rounded-2xl border border-[#E8E8EC] bg-white p-5 shadow-2xs sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div><h2 className="text-lg font-bold text-[#24324A]">Tim baru</h2><p className="mt-1 text-xs text-[#737680]">Identitas awal ini disimpan sebagai rancangan. Data Bilik Strategi tetap terpisah.</p></div>
            <button type="button" onClick={() => setShowForm(false)} aria-label="Tutup formulir" className="rounded-lg p-1.5 text-[#737680] hover:bg-[#F7F7F8]"><X className="h-4 w-4" /></button>
          </div>
          <form onSubmit={createApp} className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold text-[#24324A]">Nama tim
              <input required minLength={2} maxLength={100} value={draft.name} onChange={(event) => changeName(event.target.value)} placeholder="Contoh: Tim Kreatif" className="mt-1.5 w-full rounded-xl border border-[#E8E8EC] px-3 py-2.5 text-sm font-normal outline-none focus:border-[#F26B5E]" />
            </label>
            <label className="text-xs font-semibold text-[#24324A]">Nama singkat
              <input required minLength={2} maxLength={40} value={draft.short_name} onChange={(event) => { setShortNameEdited(true); setDraft((current) => ({ ...current, short_name: event.target.value })); }} placeholder="Tim Kreatif" className="mt-1.5 w-full rounded-xl border border-[#E8E8EC] px-3 py-2.5 text-sm font-normal outline-none focus:border-[#F26B5E]" />
            </label>
            <label className="text-xs font-semibold text-[#24324A]">Slug tim
              <input required minLength={2} maxLength={60} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={draft.slug} onChange={(event) => { setSlugEdited(true); setDraft((current) => ({ ...current, slug: normalizeTeamSlug(event.target.value) })); }} placeholder="tim-kreatif" className="mt-1.5 w-full rounded-xl border border-[#E8E8EC] px-3 py-2.5 text-sm font-normal outline-none focus:border-[#F26B5E]" />
              <span className="mt-1 block text-[11px] font-normal text-[#737680]">Dipakai sebagai identitas tim; belum menjadi link sampai aplikasi diaktifkan.</span>
            </label>
            <label className="text-xs font-semibold text-[#24324A]">Email Owner tim
              <input required type="email" maxLength={254} value={draft.owner_email} onChange={(event) => setDraft((current) => ({ ...current, owner_email: event.target.value }))} placeholder="owner@tim.com" className="mt-1.5 w-full rounded-xl border border-[#E8E8EC] px-3 py-2.5 text-sm font-normal outline-none focus:border-[#F26B5E]" />
            </label>
            <label className="text-xs font-semibold text-[#24324A] sm:col-span-2">Tagline <span className="font-normal text-[#737680]">(opsional)</span>
              <input maxLength={180} value={draft.tagline} onChange={(event) => setDraft((current) => ({ ...current, tagline: event.target.value }))} placeholder="Ruang kerja tim Anda" className="mt-1.5 w-full rounded-xl border border-[#E8E8EC] px-3 py-2.5 text-sm font-normal outline-none focus:border-[#F26B5E]" />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-[#E8E8EC] p-3 text-xs font-semibold text-[#24324A]">Warna utama
              <input type="color" value={draft.primary_color} onChange={(event) => setDraft((current) => ({ ...current, primary_color: event.target.value }))} className="h-9 w-14 cursor-pointer rounded border-0 bg-transparent" />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-[#E8E8EC] p-3 text-xs font-semibold text-[#24324A]">Warna aksen
              <input type="color" value={draft.accent_color} onChange={(event) => setDraft((current) => ({ ...current, accent_color: event.target.value }))} className="h-9 w-14 cursor-pointer rounded border-0 bg-transparent" />
            </label>
            <div className="flex justify-end sm:col-span-2">
              <button disabled={busy} type="submit" className="inline-flex items-center gap-2 rounded-xl bg-[#F26B5E] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#E65D50] disabled:opacity-60">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Simpan Tim
              </button>
            </div>
          </form>
        </section>
      )}

      <section aria-label="Daftar aplikasi tim" className="space-y-3">
        {loading && <div className="rounded-2xl border border-[#E8E8EC] bg-white p-8 text-center text-sm text-[#737680]">Memuat aplikasi tim…</div>}
        {!loading && apps.length === 0 && !error && <div className="rounded-2xl border border-dashed border-[#DADBE0] bg-white p-8 text-center text-sm text-[#737680]">Belum ada tim. Pilih “Tambah Tim” untuk membuat rancangan pertama.</div>}
        {apps.map((app) => (
          <article key={app.id} className="rounded-2xl border border-[#E8E8EC] bg-white p-5 shadow-2xs">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold text-white" style={{ backgroundColor: app.primary_color }}>{app.short_name.slice(0, 2).toUpperCase()}</div>
                <div className="min-w-0">
                  <h3 className="truncate text-base font-bold text-[#24324A]">{app.name}</h3>
                  <p className="break-all text-xs text-[#737680]">{app.slug} · Owner: {app.owner_email}</p>
                  {app.tagline && <p className="mt-1 text-sm text-[#737680]">{app.tagline}</p>}
                </div>
              </div>
              <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${app.app_url ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-800'}`}>
                {app.app_url ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}{app.app_url ? 'Tautan tersimpan' : 'Menunggu aktivasi'}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#E8E8EC] pt-4 text-xs">
              {app.app_url ? <a href={app.app_url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 break-all font-semibold text-[#F26B5E] hover:underline">{app.app_url}<ArrowUpRight className="h-3.5 w-3.5 shrink-0" /></a>
                : <span className="text-[#737680]">Link dibuat setelah hosting dan database tim tersedia.</span>}
              <button type="button" onClick={() => { setLinkingId(app.id); setProvider(app.hosting_provider === 'undecided' ? 'vercel' : app.hosting_provider); setAppUrl(app.app_url || ''); setError(''); }} className="font-semibold text-[#24324A] underline-offset-2 hover:underline">{app.app_url ? 'Ubah tautan' : 'Catat tautan yang sudah ada'}</button>
            </div>
            {linkingId === app.id && (
              <form onSubmit={saveLink} className="mt-4 grid gap-3 rounded-xl bg-[#F7F7F8] p-4 sm:grid-cols-[180px_1fr_auto] sm:items-end">
                <label className="text-xs font-semibold text-[#24324A]">Hosting
                  <select value={provider} onChange={(event) => setProvider(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#E8E8EC] bg-white px-3 py-2.5 text-sm font-normal">
                    <option value="vercel">Vercel</option><option value="cloudflare_workers">Cloudflare Workers</option><option value="other">Lainnya</option>
                  </select>
                </label>
                <label className="min-w-0 text-xs font-semibold text-[#24324A]">Alamat HTTPS aplikasi
                  <input type="url" required placeholder="https://tim-kreatif.example.com" value={appUrl} onChange={(event) => setAppUrl(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#E8E8EC] bg-white px-3 py-2.5 text-sm font-normal" />
                </label>
                <div className="flex items-center gap-2"><button disabled={busy} type="submit" className="rounded-lg bg-[#24324A] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">Simpan</button><button type="button" onClick={() => setLinkingId(null)} className="rounded-lg px-2 py-2.5 text-sm text-[#737680]">Batal</button></div>
                <p className="text-[11px] text-[#737680] sm:col-span-3">Tautan dicatat tanpa memeriksa deployment. Pastikan login dan modul aplikasi tim sudah berfungsi sebelum membagikannya.</p>
              </form>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}
