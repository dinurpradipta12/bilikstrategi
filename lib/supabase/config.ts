/** Every team deployment must provide its own Supabase project. */
export function getSupabasePublicConfig() {
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const anonKey = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

  if (!/^https:\/\/[^/]+\.supabase\.co\/?$/.test(url) || /YOUR_|REPLACE_|placeholder/i.test(url)
    || !anonKey || /^(YOUR_|REPLACE_)/i.test(anonKey) || anonKey.includes('placeholder')) {
    throw new Error('Konfigurasi Supabase untuk aplikasi tim ini belum lengkap.');
  }

  return { url: url.replace(/\/$/, ''), anonKey };
}
