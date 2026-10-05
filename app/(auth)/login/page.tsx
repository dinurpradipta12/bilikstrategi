'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBranding } from '@/components/branding/BrandingProvider';

export default function LoginPage() {
  const router = useRouter();
  const { branding } = useBranding();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/auth/bootstrap', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => { if (data.needs_setup === true) router.replace('/setup'); })
      .catch(() => {});
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal masuk.');
      router.replace(data.redirect_to || '/dashboard');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal masuk.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F7F8] p-4">
      <form onSubmit={submit} className="w-full max-w-md space-y-6 rounded-2xl border border-[#E8E8EC] bg-white p-8 shadow-xl">
        <div className="space-y-3 text-center">
          {branding.logo_url ? (
            <img src={branding.logo_url} alt={`Logo ${branding.name}`} className="mx-auto h-14 max-w-[220px] object-contain" />
          ) : (
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl text-2xl font-bold text-white" style={{ backgroundColor: branding.primary_color }} aria-hidden="true">
              {branding.short_name.charAt(0).toUpperCase()}
            </div>
          )}
          <h1 className="text-xl font-bold text-[#24324A]">{branding.name}</h1>
          <p className="text-sm text-[#737680]">{branding.tagline}</p>
        </div>
        <div className="space-y-2">
          <label htmlFor="identifier" className="block text-sm font-semibold">Email atau username</label>
          <input id="identifier" autoComplete="username" required value={identifier} onChange={(event) => setIdentifier(event.target.value)} className="w-full rounded-lg border border-[#E8E8EC] px-3 py-2.5 outline-none focus:ring-2" style={{ outlineColor: branding.accent_color }} />
        </div>
        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-semibold">Password</label>
          <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-lg border border-[#E8E8EC] px-3 py-2.5 outline-none focus:ring-2" style={{ outlineColor: branding.accent_color }} />
        </div>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={busy} className="w-full rounded-lg px-4 py-3 font-semibold text-white disabled:opacity-60" style={{ backgroundColor: branding.primary_color }}>
          {busy ? 'Memproses…' : 'Masuk'}
        </button>
      </form>
    </main>
  );
}
