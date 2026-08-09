import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const origin = new URL(req.url).origin;
  const clientId = process.env.NEXT_PUBLIC_CLICKUP_CLIENT_ID || process.env.CLICKUP_CLIENT_ID;
  const redirectUri = process.env.CLICKUP_REDIRECT_URI || `${origin}/api/auth/clickup/callback`;

  if (!clientId || clientId === 'dummy-client-id') {
    // If Client ID is not configured yet in .env, proceed to callback simulation
    return NextResponse.redirect(new URL('/api/auth/clickup/callback?code=simulated_code', req.url));
  }

  // Redirect to Official ClickUp OAuth Login Authorization Page
  const clickUpOAuthUrl = `https://app.clickup.com/api?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  return NextResponse.redirect(clickUpOAuthUrl);
}
