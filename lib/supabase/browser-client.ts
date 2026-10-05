'use client';

import { createBrowserClient } from '@supabase/ssr';
import { getSupabasePublicConfig } from '@/lib/supabase/config';

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
  if (browserClient) return browserClient;
  const { url, anonKey } = getSupabasePublicConfig();
  browserClient = createBrowserClient(url, anonKey);
  return browserClient;
}
