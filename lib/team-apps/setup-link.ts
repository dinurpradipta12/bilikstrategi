const tokenLifetimeSeconds = 30 * 24 * 60 * 60;
const tokenScope = 'bilik-team-setup-v1';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function signingKey() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('Kunci server belum tersedia.');
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(`${tokenScope}:${secret}`),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function encode(bytes: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function decode(input: string) {
  const value = input.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(value.padEnd(Math.ceil(value.length / 4) * 4, '='));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function createTeamSetupPath(id: string) {
  if (!uuidPattern.test(id)) throw new Error('ID tim tidak valid.');
  const expires = (Math.floor(Date.now() / 86400000) + 30) * 86400;
  const payload = `${tokenScope}:${id}:${expires}`;
  const signature = await crypto.subtle.sign('HMAC', await signingKey(), new TextEncoder().encode(payload));
  return `/team-setup?invite=${id}.${expires}.${encode(signature)}`;
}

export async function verifyTeamSetupToken(token: string) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [id, expiresText, signatureText] = parts;
  if (!uuidPattern.test(id) || !/^\d{10}$/.test(expiresText) || !/^[A-Za-z0-9_-]{43}$/.test(signatureText)) return null;
  const expires = Number(expiresText);
  const now = Math.floor(Date.now() / 1000);
  if (expires <= now || expires > now + tokenLifetimeSeconds) return null;
  try {
    const valid = await crypto.subtle.verify(
      'HMAC',
      await signingKey(),
      decode(signatureText),
      new TextEncoder().encode(`${tokenScope}:${id}:${expires}`),
    );
    return valid ? id : null;
  } catch {
    return null;
  }
}
