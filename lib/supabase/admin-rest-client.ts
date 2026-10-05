type SupabaseAdminConfig = {
  url: string;
  key: string;
};

export function getSupabaseAdminConfig(): SupabaseAdminConfig | null {
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!key || /^(YOUR_|REPLACE_)/i.test(key) || key.includes('placeholder')) return null;

  const rawUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  if (!/^https:\/\/[^/]+\.supabase\.co\/?$/.test(rawUrl) || /YOUR_|REPLACE_|placeholder/i.test(rawUrl)) return null;
  return {
    url: rawUrl.replace(/\/$/, ''),
    key,
  };
}

export function isSupabaseAdminConfigured() {
  return getSupabaseAdminConfig() !== null;
}

export async function supabaseAdminFetch(path: string, init: RequestInit = {}) {
  const config = getSupabaseAdminConfig();
  if (!config) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi di environment server.');
  }

  const headers = new Headers(init.headers);
  headers.set('apikey', config.key);
  headers.set('Authorization', `Bearer ${config.key}`);
  headers.set('Content-Type', 'application/json');

  return fetch(`${config.url}/rest/v1/${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });
}
