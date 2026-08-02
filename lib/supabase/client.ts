import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://spnawjvexcwhhyfavvew.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwbmF3anZleGN3aGh5ZmF2dmV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNjU1NDgsImV4cCI6MjEwMDk0MTU0OH0.IYNTrKH7s5aTBcRREiBgq1SOw5ONBcP0uxWpC_tSznU';

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
export const isSupabaseConfigured = true;

const supabaseUrl = rawUrl.includes('placeholder') ? DEFAULT_SUPABASE_URL : rawUrl;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes('placeholder')
    ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    : DEFAULT_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
  },
  realtime: {
    timeout: 10000,
  },
});
