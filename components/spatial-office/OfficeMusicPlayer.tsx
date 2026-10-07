'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { ExternalLink, GripHorizontal, Maximize2, Minimize2, Music2, Pause, Radio, Settings2, Volume2, X } from 'lucide-react';
import { resolveMusicSource } from '@/lib/spatial-office/music';
import type { OfficeMusic } from '@/lib/spatial-office/music';
import type { SharedOfficeAction } from '@/lib/spatial-office/space';

type Props = {
  open: boolean;
  music: OfficeMusic | null;
  checkedIn: boolean;
  onlineCount: number;
  canEdit: boolean;
  ready: boolean;
  busy: boolean;
  error: string;
  onOpen: () => void;
  onClose: () => void;
  onSave: (action: SharedOfficeAction) => Promise<boolean>;
};

type PlayerPosition = { left: number; top: number };
type PlayerDrag = PlayerPosition & { pointerId: number; clientX: number; clientY: number };

export default function OfficeMusicPlayer({ open, music, checkedIn, onlineCount, canEdit, ready, busy, error, onOpen, onClose, onSave }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const player = useRef<HTMLElement>(null);
  const drag = useRef<PlayerDrag | null>(null);
  const [activeUrl, setActiveUrl] = useState('');
  const [localError, setLocalError] = useState('');
  const [minimized, setMinimized] = useState(false);
  const [position, setPosition] = useState<PlayerPosition | null>(null);
  const source = useMemo(() => {
    try {
      return music ? resolveMusicSource(music.url) : null;
    } catch {
      return null;
    }
  }, [music]);
  const active = Boolean(checkedIn && music && source && activeUrl === music.url);

  useEffect(() => {
    const node = dialog.current;
    if (open && !node?.open) node?.showModal();
    if (!open && node?.open) node.close();
  }, [open]);

  useEffect(() => {
    const keepInsideOffice = () => {
      const node = player.current;
      const parent = node?.offsetParent as HTMLElement | null;
      if (!node || !parent) return;
      setPosition(current => current && ({
        left: Math.max(8, Math.min(current.left, parent.clientWidth - node.offsetWidth - 8)),
        top: Math.max(8, Math.min(current.top, parent.clientHeight - node.offsetHeight - 8)),
      }));
    };
    window.addEventListener('resize', keepInsideOffice);
    const frame = requestAnimationFrame(keepInsideOffice);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', keepInsideOffice);
    };
  }, [minimized]);

  const close = () => {
    setLocalError('');
    onClose();
  };

  const stopPlayback = () => {
    setActiveUrl('');
    setMinimized(false);
    setPosition(null);
  };

  const togglePlayback = () => {
    if (active || !music) {
      stopPlayback();
      return;
    }
    setMinimized(false);
    setPosition(null);
    setActiveUrl(music.url);
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError('');
    const fields = new FormData(event.currentTarget);
    const url = String(fields.get('url') || '');
    const title = String(fields.get('title') || '');
    try {
      resolveMusicSource(url);
      if (await onSave({ type: 'music', url, title })) stopPlayback();
    } catch (failure) {
      setLocalError(failure instanceof Error ? failure.message : 'Playlist belum dapat disimpan.');
    }
  };

  const clear = async () => {
    setLocalError('');
    if (await onSave({ type: 'music', url: '', title: '' })) stopPlayback();
  };

  const startDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button, a')) return;
    const node = player.current;
    const parent = node?.offsetParent as HTMLElement | null;
    if (!node || !parent) return;
    const rect = node.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    drag.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      left: rect.left - parentRect.left,
      top: rect.top - parentRect.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const movePlayer = (event: ReactPointerEvent<HTMLElement>) => {
    const current = drag.current;
    const node = player.current;
    const parent = node?.offsetParent as HTMLElement | null;
    if (!current || current.pointerId !== event.pointerId || !node || !parent) return;
    setPosition({
      left: Math.max(8, Math.min(current.left + event.clientX - current.clientX, parent.clientWidth - node.offsetWidth - 8)),
      top: Math.max(8, Math.min(current.top + event.clientY - current.clientY, parent.clientHeight - node.offsetHeight - 8)),
    });
  };

  const stopDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const playerStyle: CSSProperties | undefined = position
    ? { left: position.left, top: position.top, right: 'auto', bottom: 'auto' }
    : undefined;

  return <>
    <dialog ref={dialog} className="office-music-dialog office-utility-dialog" aria-labelledby="office-music-title" onCancel={event => { event.preventDefault(); close(); }}>
      <header><div><small>RADIO WORKSPACE · {onlineCount} CHECK-IN</small><h2 id="office-music-title"><Radio size={22} /> Musik bersama</h2></div><button type="button" autoFocus onClick={close} aria-label="Tutup pemutar musik"><X size={18} /></button></header>
      <p>Playlist kantor tersedia untuk semua anggota yang sedang check-in. Setiap perangkat perlu menekan tombol dengarkan karena browser memblokir suara otomatis.</p>
      {music && source ? <section className="office-music-current"><span className="office-music-provider"><Music2 size={17} />{source.label}</span><strong>{music.title}</strong><a href={music.url} target="_blank" rel="noreferrer">Buka sumber <ExternalLink size={13} /></a><button className="office-music-listen" type="button" disabled={!checkedIn} onClick={togglePlayback}>{active ? <><Pause size={17} />Hentikan di perangkat ini</> : <><Volume2 size={17} />Dengarkan bersama</>}</button>{!checkedIn && <small>Check-in dan aktifkan sesi Anda untuk mendengarkan radio kantor.</small>}</section> : <div className="office-music-empty"><Radio size={28} /><strong>Belum ada playlist kantor</strong><span>Admin dapat menambahkan sumber musik di bawah.</span></div>}
      {canEdit && <form key={`${music?.url || 'empty'}:${music?.title || ''}`} className="office-music-form" onSubmit={save}><h3><Settings2 size={16} /> Atur playlist tim</h3><label>Nama playlist<input name="title" defaultValue={music?.title || ''} maxLength={80} onChange={() => setLocalError('')} placeholder="Contoh: Fokus pagi" /></label><label>Tautan musik<input name="url" type="url" required defaultValue={music?.url || ''} maxLength={1000} onChange={() => setLocalError('')} placeholder="https://open.spotify.com/playlist/…" /></label><small>Spotify, Apple Music, YouTube Music, SoundCloud, MP3, M4A, AAC, OGG, dan WAV.</small><div><button type="submit" disabled={busy || !ready}>{busy ? 'Menyimpan…' : 'Simpan playlist'}</button>{music && <button type="button" className="is-danger" disabled={busy || !ready} onClick={() => void clear()}>Hapus playlist</button>}</div></form>}
      {(localError || error) && <p role="alert" className="office-utility-error">{localError || error}</p>}
      {!ready && <p role="status">Penyimpanan kantor belum terhubung.</p>}
    </dialog>
    {active && music && source && <aside ref={player} style={playerStyle} className={`office-shared-player${minimized ? ' is-minimized' : ''}`} aria-label={`Sedang memutar ${music.title}`}>
      <header onPointerDown={startDrag} onPointerMove={movePlayer} onPointerUp={stopDrag} onPointerCancel={stopDrag}>
        <GripHorizontal className="office-player-grip" size={17} aria-hidden="true" />
        <span><i /><strong>{music.title}</strong><small>{source.label} · radio tim</small></span>
        <div className="office-player-actions">
          <button type="button" onClick={() => setMinimized(value => !value)} aria-label={minimized ? 'Perbesar pemutar' : 'Minimalkan pemutar'} aria-expanded={!minimized}>{minimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}</button>
          <button type="button" onClick={stopPlayback} aria-label="Hentikan pemutar"><X size={15} /></button>
        </div>
      </header>
      <div className="office-player-media" aria-hidden={minimized}>
        {source.kind === 'audio' ? <audio key={source.playerUrl} src={source.playerUrl} controls autoPlay /> : <iframe key={source.playerUrl} src={source.playerUrl} title={`Pemutar ${music.title}`} loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-presentation" tabIndex={minimized ? -1 : 0} />}
      </div>
      {!minimized && <footer><button type="button" onClick={onOpen}><Settings2 size={13} /> Buka radio</button></footer>}
    </aside>}
  </>;
}
