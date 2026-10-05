import { NextResponse } from 'next/server';
import { readTeamBranding } from '@/lib/branding/server';

export async function GET() {
  const branding = await readTeamBranding();
  return NextResponse.json({ spaces: [{ id: 'team', name: branding.name }] });
}
