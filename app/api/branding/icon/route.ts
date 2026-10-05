import { NextResponse } from 'next/server';
import { readTeamBranding } from '@/lib/branding/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[character] || character);
}

export async function GET() {
  const branding = await readTeamBranding();
  if (branding.icon_url) {
    return NextResponse.redirect(branding.icon_url, { headers: { 'Cache-Control': 'no-store' } });
  }

  const initial = escapeXml(Array.from(branding.short_name.trim())[0]?.toUpperCase() || 'T');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" rx="42" fill="${branding.primary_color}"/><circle cx="148" cy="45" r="20" fill="${branding.accent_color}"/><text x="50%" y="55%" dominant-baseline="central" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-size="104" font-weight="700">${initial}</text></svg>`;
  return new NextResponse(svg, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
