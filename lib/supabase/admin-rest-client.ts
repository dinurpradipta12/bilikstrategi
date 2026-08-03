const DEFAULT_SUPABASE_URL = 'https://spnawjvexcwhhyfavvew.supabase.co';

type SupabaseAdminConfig = {
  url: string;
  key: string;
};

function getConfig(): SupabaseAdminConfig | null {
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!key || key === 'your-service-role-key' || key.includes('placeholder')) return null;

  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  return {
    url: rawUrl.includes('placeholder') ? DEFAULT_SUPABASE_URL : rawUrl,
    key,
  };
}

export function isSupabaseAdminConfigured() {
  return getConfig() !== null;
}

export async function supabaseAdminFetch(path: string, init: RequestInit = {}) {
  const config = getConfig();
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
