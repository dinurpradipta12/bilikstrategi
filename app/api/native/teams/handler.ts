import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { readTeamBranding } from '@/lib/branding/server';

export async function GET() {
  const admin = createSupabaseAdminClient();
  const [{ data, error }, branding] = await Promise.all([
    admin.from('profiles').select('id,full_name,email,avatar_url,phone,job_title,division,role,status,capacity_hours').eq('status', 'active').order('full_name'),
    readTeamBranding(),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 503 });
  const members = (data || []).map((profile) => ({
    id: profile.id,
    username: profile.full_name,
    email: profile.email,
    profilePicture: profile.avatar_url || '',
    role_key: profile.role,
    role: profile.role === 'owner' ? 1 : profile.role === 'admin' ? 2 : 3,
    capacity_hours: profile.capacity_hours,
    phone: profile.phone || '',
    job_title: profile.job_title || '',
    division: profile.division || '',
  }));
  return NextResponse.json({ teams: [{ id: 'team', name: branding.name, members }], members, source: 'app' });
}
