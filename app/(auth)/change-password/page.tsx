'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useBranding } from '@/components/branding/BrandingProvider';

export default function ChangePasswordPage() {
  const router = useRouter();
  const { branding } = useBranding();
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== repeat) { setError('Konfirmasi password belum cocok.'); return; }
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Password gagal diperbarui.');
      router.replace('/dashboard');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Password gagal diperbarui.');
    } finally { setBusy(false); }
  }

  return <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
    <form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div>{branding.logo_url && <img src={branding.logo_url} alt="" className="mb-4 h-12 max-w-36 object-contain" />}<p className="text-sm font-semibold text-[var(--brand-primary)]">{branding.name}</p><h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">Ganti password</h1><p className="mt-1 text-sm text-slate-500">Buat password pribadi sebelum mulai menggunakan aplikasi.</p></div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Password baru<input type="password" autoComplete="new-password" minLength={10} required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white" /></label>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Ulangi password<input type="password" autoComplete="new-password" minLength={10} required value={repeat} onChange={(event) => setRepeat(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white" /></label>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button disabled={busy} className="w-full rounded-lg bg-[var(--brand-primary)] px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'Menyimpan...' : 'Simpan password'}</button>
    </form>
  </main>;
}
