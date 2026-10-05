import 'server-only';
import { createSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { DEFAULT_BRANDING, normalizeBranding, type TeamBranding } from './types';

export async function readTeamBranding(): Promise<TeamBranding> {
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from('team_branding').select('*').eq('id', true).maybeSingle();
    if (error || !data) return DEFAULT_BRANDING;
    return normalizeBranding(data);
  } catch {
    return DEFAULT_BRANDING;
  }
}
