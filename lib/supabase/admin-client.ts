import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdminConfig } from '@/lib/supabase/admin-rest-client';

export function createSupabaseAdminClient() {
  const config = getSupabaseAdminConfig();
  if (!config) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi di environment server.');
  }

  return createClient(config.url, config.key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
