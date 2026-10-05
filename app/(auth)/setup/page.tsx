'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function SetupPage() {
  const router = useRouter();
  const [state, setState] = useState<'checking' | 'ready' | 'error'>('checking');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ team_name: '', full_name: '', username: '', email: '', password: '', setup_token: '' });

  useEffect(() => {
    fetch('/api/auth/bootstrap', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Setup belum siap.');
        if (!data.needs_setup) router.replace('/login');
        else setState('ready');
      })
      .catch((cause) => { setMessage(cause instanceof Error ? cause.message : 'Setup belum siap.'); setState('error'); });
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/auth/bootstrap', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Setup gagal.');
      router.replace('/login');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Setup gagal.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F7F8] p-4">
      <div className="w-full max-w-lg rounded-2xl border border-[#E8E8EC] bg-white p-8 shadow-xl">
        <h1 className="text-xl font-bold">Siapkan aplikasi tim</h1>
        <p className="mt-2 text-sm text-[#737680]">Pengaturan awal ini membuat akun Owner dan nama aplikasi. Kode setup berasal dari konfigurasi deployment tim ini.</p>
        {state === 'checking' && <p className="mt-6 text-sm">Memeriksa database…</p>}
        {state === 'error' && <p role="alert" className="mt-6 text-sm text-red-700">{message}</p>}
        {state === 'ready' && (
          <form onSubmit={submit} className="mt-6 space-y-4">
            {([
              ['team_name', 'Nama tim', 'text', 'organization'],
              ['full_name', 'Nama Owner', 'text', 'name'],
              ['username', 'Username Owner', 'text', 'username'],
              ['email', 'Email Owner', 'email', 'email'],
              ['password', 'Password Owner', 'password', 'new-password'],
              ['setup_token', 'Kode setup', 'password', 'off'],
            ] as const).map(([key, label, type, autoComplete]) => (
              <label key={key} className="block text-sm font-semibold">
                {label}
                <input required type={type} autoComplete={autoComplete} value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} className="mt-1 block w-full rounded-lg border border-[#E8E8EC] px-3 py-2.5 font-normal" />
              </label>
            ))}
            {message && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{message}</p>}
            <button type="submit" disabled={busy} className="w-full rounded-lg bg-[#24324A] px-4 py-3 font-semibold text-white disabled:opacity-60">{busy ? 'Menyiapkan…' : 'Buat aplikasi tim'}</button>
          </form>
        )}
        <p className="mt-5 text-center text-xs text-[#737680]"><Link href="/login" className="underline">Kembali ke login</Link></p>
      </div>
    </main>
  );
}
