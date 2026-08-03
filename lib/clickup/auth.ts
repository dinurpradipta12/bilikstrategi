import { clickUpFetch } from './client';

export function getClickUpOAuthUrl(redirectUri?: string): string {
  const clientId = process.env.CLICKUP_CLIENT_ID;
  const redirect = redirectUri || process.env.CLICKUP_REDIRECT_URI || '';
  if (!clientId) {
    throw new Error('CLICKUP_CLIENT_ID belum dikonfigurasi di environment variables.');
  }
  return `https://app.clickup.com/api?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirect)}`;
}

export async function exchangeCodeForToken(code: string): Promise<{ access_token: string; token_type: string }> {
  const clientId = process.env.CLICKUP_CLIENT_ID;
  const clientSecret = process.env.CLICKUP_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('CLICKUP_CLIENT_ID atau CLICKUP_CLIENT_SECRET belum dikonfigurasi.');
  }

  return await clickUpFetch<{ access_token: string; token_type: string }>('/oauth/token', {
    method: 'POST',
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });
}
