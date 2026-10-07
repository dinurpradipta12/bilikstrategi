export type MusicProvider = 'spotify' | 'apple' | 'youtube' | 'soundcloud' | 'audio';
export type MusicSource = { provider: MusicProvider; label: string; url: string; kind: 'embed' | 'audio'; playerUrl: string };
export type OfficeMusic = { provider: MusicProvider; title: string; url: string; updatedAt: number; updatedBy: string };

const labels: Record<MusicProvider, string> = {
  spotify: 'Spotify', apple: 'Apple Music', youtube: 'YouTube Music', soundcloud: 'SoundCloud', audio: 'Audio langsung',
};

function cleanUrl(input: unknown) {
  if (typeof input !== 'string' || input.trim().length > 1000) throw new Error('Masukkan tautan playlist yang valid.');
  let url: URL;
  try { url = new URL(input.trim()); } catch { throw new Error('Masukkan tautan HTTPS dari layanan musik yang didukung.'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Playlist harus menggunakan tautan HTTPS.');
  url.hash = '';
  return url;
}

export function resolveMusicSource(input: unknown): MusicSource {
  const url = cleanUrl(input), host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (host === 'open.spotify.com') {
    const match = url.pathname.match(/^\/(playlist|album|track|show|episode)\/([a-zA-Z0-9]+)\/?$/);
    if (!match) throw new Error('Gunakan tautan playlist, album, lagu, atau podcast Spotify.');
    const playerUrl = `https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=generator&theme=0`;
    return { provider: 'spotify', label: labels.spotify, url: `https://open.spotify.com/${match[1]}/${match[2]}`, kind: 'embed', playerUrl };
  }
  if (host === 'music.apple.com' || host === 'embed.music.apple.com') {
    if (url.pathname.split('/').filter(Boolean).length < 2) throw new Error('Gunakan tautan playlist, album, atau lagu Apple Music.');
    url.hostname = 'music.apple.com';
    const original = url.toString(); url.hostname = 'embed.music.apple.com';
    return { provider: 'apple', label: labels.apple, url: original, kind: 'embed', playerUrl: url.toString() };
  }
  if (['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'].includes(host)) {
    const list = url.searchParams.get('list');
    const video = host === 'youtu.be' ? url.pathname.split('/').filter(Boolean)[0] : url.searchParams.get('v');
    if (list && /^[\w-]{8,}$/.test(list)) return { provider: 'youtube', label: labels.youtube, url: url.toString(), kind: 'embed', playerUrl: `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(list)}` };
    if (video && /^[\w-]{6,}$/.test(video)) return { provider: 'youtube', label: labels.youtube, url: url.toString(), kind: 'embed', playerUrl: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(video)}` };
    throw new Error('Gunakan tautan playlist atau video YouTube Music.');
  }
  if (host === 'soundcloud.com' && url.pathname.split('/').filter(Boolean).length >= 2) {
    return { provider: 'soundcloud', label: labels.soundcloud, url: url.toString(), kind: 'embed', playerUrl: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url.toString())}&auto_play=false&hide_related=true&show_comments=false` };
  }
  if (/\.(mp3|m4a|aac|ogg|wav)$/i.test(url.pathname)) return { provider: 'audio', label: labels.audio, url: url.toString(), kind: 'audio', playerUrl: url.toString() };
  throw new Error('Layanan didukung: Spotify, Apple Music, YouTube Music, SoundCloud, atau tautan audio langsung.');
}

export function musicPlayerUrl(source: MusicSource, origin = '') {
  // Query parameters on signed audio URLs are part of their signature. Keep
  // direct sources byte-for-byte identical and only decorate provider embeds.
  if (source.kind === 'audio') return source.playerUrl;
  const url = new URL(source.playerUrl);
  if (source.provider === 'soundcloud') url.searchParams.set('auto_play', 'true');
  else url.searchParams.set('autoplay', '1');
  if (source.provider === 'youtube') {
    url.searchParams.set('playsinline', '1');
    url.searchParams.set('enablejsapi', '1');
    if (origin) url.searchParams.set('origin', origin);
  }
  return url.toString();
}

export function supportsHandsFreePlayback(source: MusicSource) {
  return source.kind === 'audio';
}

export function normalizeOfficeMusic(input: unknown): OfficeMusic | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as Partial<OfficeMusic>;
  try {
    const source = resolveMusicSource(value.url);
    const title = typeof value.title === 'string' ? value.title.trim().slice(0, 80) : '';
    return {
      provider: source.provider, title: title || `${source.label} kantor`, url: source.url,
      updatedAt: Number.isFinite(value.updatedAt) && Number(value.updatedAt) > 0 ? Number(value.updatedAt) : 0,
      updatedBy: typeof value.updatedBy === 'string' ? value.updatedBy.slice(0, 128) : '',
    };
  } catch { return null; }
}
