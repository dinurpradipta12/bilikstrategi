import { NextResponse } from 'next/server';
import { readTeamBranding } from '@/lib/branding/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
  const branding = await readTeamBranding();
  return NextResponse.json({
    name: branding.name,
    short_name: branding.short_name,
    description: branding.tagline,
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#F7F7F8',
    theme_color: branding.primary_color,
    icons: [{ src: '/api/branding/icon', sizes: 'any', purpose: 'any maskable' }],
  }, { headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/manifest+json' } });
}
