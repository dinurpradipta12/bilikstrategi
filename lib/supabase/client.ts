import { createClient } from '@supabase/supabase-js';

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const isPlaceholder = !rawUrl || rawUrl.includes('placeholder.supabase.co');

const supabaseUrl = isPlaceholder ? 'https://placeholder.supabase.co' : rawUrl;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: !isPlaceholder,
  },
  realtime: {
    timeout: isPlaceholder ? 0 : 10000,
  },
});
