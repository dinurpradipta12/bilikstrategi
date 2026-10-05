'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Check, Copy, Database, Download, GitBranch, Globe2, KeyRound, Palette } from 'lucide-react';

type Team = {
  name: string;
  slug: string;
  short_name: string;
  owner_email: string;
  tagline: string;
  primary_color: string;
  accent_color: string;
  app_url: string | null;
};

const templateUrl = 'https://github.com/dinurpradipta12/bilik-strategi-team-template';
const sqlPath = '/team-template/setup_all.sql';

function externalLink(url: string, label: string) {
  return <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-[#24324A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#162238]">{label}<ArrowUpRight className="h-4 w-4" /></a>;
}

function deployedOrigin(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    return url.origin;
  } catch { return ''; }
}

export default function TeamSetupPage() {
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState<number[]>([]);
  const [siteInput, setSiteInput] = useState('');
  const [setupCode, setSetupCode] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const invite = new URLSearchParams(window.location.search).get('invite') || '';
    const load = invite
      ? fetch(`/api/team-apps/setup?invite=${encodeURIComponent(invite)}`, { cache: 'no-store' })
      : Promise.reject(new Error('Link setup tidak valid. Minta link baru kepada pengirim.'));
    load
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Gagal memuat tim.');
        return data.team as Team;
      })
      .then((value) => {
        setTeam(value);
        setSiteInput(value.app_url || '');
        try {
          const stored = JSON.parse(localStorage.getItem(`team_setup_progress:${value.slug}`) || '[]');
          if (Array.isArray(stored)) setCompleted(stored.filter((step) => Number.isInteger(step) && step >= 1 && step <= 4));
        } catch { /* Browser storage is optional. */ }
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Gagal memuat tim.'))
      .finally(() => setLoading(false));
  }, []);

  const siteUrl = useMemo(() => deployedOrigin(siteInput), [siteInput]);
  const vercelUrl = useMemo(() => {
    if (!team) return '';
    const url = new URL('https://vercel.com/new/clone');
    url.searchParams.set('repository-url', templateUrl);
    url.searchParams.set('repository-name', `${team.slug}-app`);
    url.searchParams.set('project-name', team.slug);
    url.searchParams.set('env', 'NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY,TEAM_SETUP_TOKEN');
    return url.toString();
  }, [team]);

  function toggleStep(step: number) {
    if (!team) return;
    const next = completed.includes(step) ? completed.filter((value) => value !== step) : [...completed, step];
    setCompleted(next);
    try { localStorage.setItem(`team_setup_progress:${team.slug}`, JSON.stringify(next)); } catch { /* Browser storage is optional. */ }
  }

  async function copySql() {
    try {
      const response = await fetch(sqlPath);
      if (!response.ok) throw new Error();
      await navigator.clipboard.writeText(await response.text());
      setMessage('SQL tersalin. Tempel ke SQL Editor proyek Supabase baru.');
    } catch { setMessage('Gagal menyalin SQL. Gunakan tombol Unduh SQL.'); }
  }

  function generateCode() {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const code = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    setSetupCode(code);
    setMessage('Kode dibuat di browser ini. Simpan sebelum membuka halaman lain.');
  }

  async function copyCode() {
    try { await navigator.clipboard.writeText(setupCode); setMessage('Kode setup tersalin.'); }
    catch { setMessage('Gagal menyalin kode. Salin secara manual.'); }
  }

  if (loading) return <main className="min-h-screen bg-[#F7F8FA] px-4 py-20 text-center text-sm text-[#667085]">Memuat link setup…</main>;
  if (!team) return <main className="flex min-h-screen items-center justify-center bg-[#F7F8FA] p-4"><div role="alert" className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-6 text-sm text-red-700">{error}</div></main>;

  const steps = [
    { number: 1, title: 'Database tim', icon: Database },
    { number: 2, title: 'Kode dan hosting', icon: GitBranch },
    { number: 3, title: 'Owner pertama', icon: KeyRound },
    { number: 4, title: 'Branding tim', icon: Palette },
  ];

  return (
    <main className="min-h-screen bg-[#F7F8FA] px-4 py-8 text-[#24324A] sm:py-12">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="rounded-3xl border border-[#E5E8EF] bg-white p-5 shadow-sm sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#F26B5E]">Setup aplikasi tim mandiri</p>
          <div className="mt-4 flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-extrabold text-white" style={{ backgroundColor: team.primary_color }}>{team.short_name.slice(0, 2).toUpperCase()}</div>
            <div className="min-w-0"><h1 className="break-words text-2xl font-extrabold sm:text-3xl">{team.name}</h1><p className="mt-1 text-sm text-[#667085]">{team.tagline || 'Aplikasi kerja milik tim Anda'}</p></div>
          </div>
          <p className="mt-5 max-w-3xl text-sm leading-6 text-[#475467]">Ikuti langkah ini dengan akun GitHub, Supabase, dan hosting milik tim Anda. Setelah deploy, aplikasi akan memakai database, URL, login, dan branding sendiri. Semua modul tersedia tanpa konfigurasi ClickUp.</p>
          <p className="mt-3 rounded-xl bg-[#F7F8FA] p-3 text-xs leading-5 text-[#667085]">Link ini berisi panduan setup, bukan aplikasi yang sudah aktif. Kunci Supabase dan kode setup diisi langsung di hosting tim Anda, tidak dikirim ke Bilik Strategi.</p>
        </header>

        <nav aria-label="Kemajuan setup" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {steps.map((step) => <a key={step.number} href={`#langkah-${step.number}`} className="flex items-center gap-2 rounded-xl border border-[#E5E8EF] bg-white px-3 py-3 text-xs font-semibold sm:text-sm"><span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${completed.includes(step.number) ? 'bg-green-100 text-green-700' : 'bg-[#F1F3F8] text-[#475467]'}`}>{completed.includes(step.number) ? <Check className="h-4 w-4" /> : step.number}</span><span>{step.title}</span></a>)}
        </nav>

        {message && <p role="status" className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">{message}</p>}

        <section id="langkah-1" className="scroll-mt-6 rounded-3xl border border-[#E5E8EF] bg-white p-5 shadow-sm sm:p-8">
          <div className="flex items-start gap-3"><Database className="mt-0.5 h-6 w-6 shrink-0 text-[#F26B5E]" /><div><p className="text-xs font-bold uppercase tracking-wider text-[#F26B5E]">Langkah 1</p><h2 className="mt-1 text-xl font-bold">Buat database Supabase baru</h2></div></div>
          <ol className="mt-5 list-decimal space-y-3 pl-5 text-sm leading-6 text-[#475467]">
            <li>Masuk ke Supabase dengan akun tim dan buat proyek baru yang kosong. Jangan gunakan database Bilik Strategi yang lama.</li>
            <li>Buka SQL Editor di proyek baru, tempel seluruh isi SQL di bawah, lalu jalankan sekali. Berkas ini berisi seluruh migrasi template secara berurutan.</li>
            <li>Di Project Settings → API Keys, catat Project URL, kunci publik (anon/publishable), dan kunci server (service_role/secret) untuk langkah hosting.</li>
          </ol>
          <div className="mt-5 flex flex-wrap gap-2">{externalLink('https://supabase.com/dashboard/new', 'Buat proyek Supabase')}{externalLink('https://supabase.com/dashboard/project/_/sql', 'Buka SQL Editor')}<button type="button" onClick={copySql} className="inline-flex items-center gap-2 rounded-xl border border-[#D0D5DD] px-4 py-2.5 text-sm font-semibold hover:bg-[#F7F8FA]"><Copy className="h-4 w-4" /> Salin semua SQL</button><a href={sqlPath} download="team-app-setup.sql" className="inline-flex items-center gap-2 rounded-xl border border-[#D0D5DD] px-4 py-2.5 text-sm font-semibold hover:bg-[#F7F8FA]"><Download className="h-4 w-4" /> Unduh SQL</a></div>
          <p className="mt-3 text-xs text-[#667085]">SQL hanya untuk proyek baru dan kosong. Tidak ada data tim lama yang ikut disalin.</p>
          <button type="button" onClick={() => toggleStep(1)} className="mt-5 text-sm font-semibold text-[#315B9A] hover:underline">{completed.includes(1) ? 'Batalkan tanda selesai' : 'Tandai database selesai'}</button>
        </section>

        <section id="langkah-2" className="scroll-mt-6 rounded-3xl border border-[#E5E8EF] bg-white p-5 shadow-sm sm:p-8">
          <div className="flex items-start gap-3"><GitBranch className="mt-0.5 h-6 w-6 shrink-0 text-[#F26B5E]" /><div><p className="text-xs font-bold uppercase tracking-wider text-[#F26B5E]">Langkah 2</p><h2 className="mt-1 text-xl font-bold">Salin kode dan deploy</h2></div></div>
          <p className="mt-5 text-sm leading-6 text-[#475467]">Pilih jalur hosting. Kedua jalur membuat kode aplikasi berada di akun GitHub milik tim Anda.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-[#D8E1F2] bg-[#F5F8FE] p-4"><h3 className="font-bold">Vercel: salin dan deploy sekaligus</h3><p className="mt-2 text-sm leading-6 text-[#475467]">Tombol ini membuka alur Vercel yang menyalin template ke GitHub Anda dan membuat proyek hosting. Isi empat variabel di bawah pada formulir Vercel.</p><div className="mt-4">{externalLink(vercelUrl, 'Buka setup Vercel')}</div></div>
            <div className="rounded-2xl border border-[#E5E8EF] p-4"><h3 className="font-bold">Hosting lain</h3><p className="mt-2 text-sm leading-6 text-[#475467]">Buat salinan repositori lewat GitHub “Use this template”, lalu hubungkan repositori baru ke hosting Next.js 16 pilihan Anda.</p><div className="mt-4">{externalLink(`${templateUrl}/generate`, 'Salin ke GitHub')}</div></div>
          </div>
          <div className="mt-5 rounded-2xl bg-[#F7F8FA] p-4"><h3 className="text-sm font-bold">Variabel environment untuk deployment tim</h3><ul className="mt-3 space-y-2 text-xs sm:text-sm">
            <li><code className="break-all font-semibold">NEXT_PUBLIC_SUPABASE_URL</code> — Project URL Supabase tim</li>
            <li><code className="break-all font-semibold">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> — kunci publik anon/publishable</li>
            <li><code className="break-all font-semibold">SUPABASE_SERVICE_ROLE_KEY</code> — kunci server service_role/secret; hanya di server hosting</li>
            <li><code className="break-all font-semibold">TEAM_SETUP_TOKEN</code> — kode acak untuk membuat Owner pertama</li>
          </ul></div>
          <div className="mt-4 rounded-2xl border border-[#E5E8EF] p-4"><p className="text-sm font-semibold">Buat kode <code>TEAM_SETUP_TOKEN</code> di browser Anda</p><p className="mt-1 text-xs leading-5 text-[#667085]">Gunakan kode yang sama di hosting dan di halaman <code>/setup</code>. Simpan di pengelola kata sandi; kode ini tidak disimpan di Bilik Strategi.</p><div className="mt-3 flex flex-wrap items-center gap-2"><button type="button" onClick={generateCode} className="rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm font-semibold hover:bg-[#F7F8FA]">{setupCode ? 'Buat kode baru' : 'Buat kode setup'}</button>{setupCode && <button type="button" onClick={copyCode} className="inline-flex items-center gap-1.5 rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm font-semibold hover:bg-[#F7F8FA]"><Copy className="h-4 w-4" /> Salin kode</button>}</div>{setupCode && <code className="mt-3 block break-all rounded-lg bg-[#F7F8FA] p-3 text-xs">{setupCode}</code>}</div>
          <p className="mt-4 text-xs leading-5 text-[#667085]">Cloudflare Pages lama memakai adaptor yang belum cocok dengan template Next.js 16 ini. Untuk Cloudflare, gunakan alur Workers yang sudah Anda uji atau pilih hosting Next.js lain.</p>
          <button type="button" onClick={() => toggleStep(2)} className="mt-5 text-sm font-semibold text-[#315B9A] hover:underline">{completed.includes(2) ? 'Batalkan tanda selesai' : 'Tandai deploy selesai'}</button>
        </section>

        <section id="langkah-3" className="scroll-mt-6 rounded-3xl border border-[#E5E8EF] bg-white p-5 shadow-sm sm:p-8">
          <div className="flex items-start gap-3"><KeyRound className="mt-0.5 h-6 w-6 shrink-0 text-[#F26B5E]" /><div><p className="text-xs font-bold uppercase tracking-wider text-[#F26B5E]">Langkah 3</p><h2 className="mt-1 text-xl font-bold">Buat Owner pertama</h2></div></div>
          <p className="mt-5 text-sm leading-6 text-[#475467]">Setelah deployment berhasil, atur Site URL dan Redirect URLs pada Supabase Auth sesuai domain aplikasi tim. Buka <code>/setup</code> di domain tersebut, masukkan kode setup yang tadi disimpan, lalu buat akun Owner dengan email <strong className="break-all">{team.owner_email}</strong>.</p>
          <label className="mt-4 block text-sm font-semibold">URL aplikasi tim setelah deploy<input type="url" inputMode="url" placeholder="https://tim-anda.vercel.app" value={siteInput} onChange={(event) => setSiteInput(event.target.value)} className="mt-2 w-full rounded-xl border border-[#D0D5DD] px-3 py-2.5 font-normal outline-none focus:border-[#315B9A]" /></label>
          <p className="mt-2 text-xs text-[#667085]">URL ini hanya dipakai di browser Anda untuk membuka halaman setup. Pengirim dapat mencatat URL final secara terpisah di aplikasi pusat.</p>
          <div className="mt-4 flex flex-wrap gap-2">{siteUrl && externalLink(`${siteUrl}/setup`, 'Buka setup Owner')}{externalLink('https://supabase.com/docs/guides/auth/redirect-urls', 'Panduan URL Auth')}</div>
          <button type="button" onClick={() => toggleStep(3)} className="mt-5 text-sm font-semibold text-[#315B9A] hover:underline">{completed.includes(3) ? 'Batalkan tanda selesai' : 'Tandai Owner selesai'}</button>
        </section>

        <section id="langkah-4" className="scroll-mt-6 rounded-3xl border border-[#E5E8EF] bg-white p-5 shadow-sm sm:p-8">
          <div className="flex items-start gap-3"><Palette className="mt-0.5 h-6 w-6 shrink-0 text-[#F26B5E]" /><div><p className="text-xs font-bold uppercase tracking-wider text-[#F26B5E]">Langkah 4</p><h2 className="mt-1 text-xl font-bold">Atur identitas aplikasi</h2></div></div>
          <p className="mt-5 text-sm leading-6 text-[#475467]">Masuk sebagai Owner dan buka Pengaturan. Ubah nama aplikasi, logo, favicon, warna, anggota, hak akses, dan modul aktif sesuai kebutuhan tim. Semua modul sudah tersedia sejak awal.</p>
          <div className="mt-4 flex flex-wrap gap-2">{siteUrl && externalLink(`${siteUrl}/login`, 'Masuk aplikasi tim')}{siteUrl && externalLink(`${siteUrl}/settings`, 'Buka Pengaturan')}</div>
          <button type="button" onClick={() => toggleStep(4)} className="mt-5 text-sm font-semibold text-[#315B9A] hover:underline">{completed.includes(4) ? 'Batalkan tanda selesai' : 'Tandai branding selesai'}</button>
        </section>

        <footer className="flex items-start gap-2 px-2 pb-8 text-xs leading-5 text-[#667085]"><Globe2 className="h-4 w-4 shrink-0" /><p>Progres langkah hanya tersimpan di browser ini. Kepemilikan kode, database, dan hosting berada pada akun tim yang melakukan setup.</p></footer>
      </div>
    </main>
  );
}
