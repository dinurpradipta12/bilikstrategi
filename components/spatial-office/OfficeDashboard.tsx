'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, PencilRuler, Moon, Sun, ArrowUpRight, Box, Check, ChevronLeft, ChevronRight, Coffee, LogIn, LogOut, Pause, Play, Plus, RefreshCw, Users, X } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { officeTime, type DeskLayout, defaultAvatar, parseAvatar, workedSeconds, DESKS_PER_ROOM, reconcileSeats, statusLabel, type AvatarStyle, type OfficeMember, type OfficeSnapshot } from '@/lib/spatial-office/model';
import { OFFICE_BRAND } from '@/lib/spatial-office/branding';
import { normalizeAttendanceSchedule, type AttendanceSchedule } from '@/lib/attendance/schedule';
import AvatarEditor from './AvatarEditor';
import OfficeEditor from './OfficeEditor';
import { normalizeSpace, claimDesk, parseDesks, moveOrnament, moveDesk, setActivity, parseOrnaments, spaceCapacity, type OfficeSpace, type Ornament } from '@/lib/spatial-office/space';
import './office.css';

const OfficeCanvas = dynamic(() => import('./OfficeCanvas'), { ssr: false, loading: () => <div className="office-viewport office-canvas-placeholder">Menyiapkan tampilan 3D…</div> });
const DEMO_MEMBERS: OfficeMember[] = [
  { id: 'demo-1', name: 'Alya', status: 'working', project: 'Brand identity' },
  { id: 'demo-2', name: 'Bima', status: 'working', project: 'Website tim' },
  { id: 'demo-3', name: 'Citra', status: 'paused', project: 'Content plan' },
  { id: 'demo-4', name: 'Dara', status: 'working', project: 'Content plan' },
  { id: 'demo-5', name: 'Eka', status: 'offline', project: '' },
  { id: 'demo-6', name: 'Farhan', status: 'working', project: 'Social media' },
];
type Data = OfficeSnapshot & { seats: Map<string, number> };

export default function OfficeDashboard({ demo = false, immersive = false, onStatistics }: { demo?: boolean; immersive?: boolean; onStatistics?: () => void }) {
  const [data, setData] = useState<Data>(() => ({ members: demo ? DEMO_MEMBERS : [], syncedAt: '', seats: reconcileSeats(new Map(), demo ? DEMO_MEMBERS : []) }));
  const [now, setNow] = useState(0);
  const [schedule, setSchedule] = useState<AttendanceSchedule>();
  useEffect(() => {
    const tick = () => setNow(Date.now()); queueMicrotask(tick); const timer = setInterval(tick, 1000);
    let cancelled = false;
    const load = () => { if (!demo) void fetch('/api/attendance/schedule', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(data => { if (!cancelled && data?.schedule) setSchedule(normalizeAttendanceSchedule(data.schedule, data.storage_ready)); }).catch(() => {}); };
    load(); const poll = setInterval(load, 300000);
    return () => { cancelled = true; clearInterval(timer); clearInterval(poll); };
  }, [demo]);
  const clock = officeTime(now, schedule);
  const [panel, setPanel] = useState<'team' | 'desks' | 'member' | null>(null);
  const [selectedDesk, setSelectedDesk] = useState<number | null>(null);
  const [draft, setDraft] = useState<{ ornaments: Ornament[]; desks: DeskLayout[]; layoutRevision: number } | null>(null);
  const [selectedOrnament, setSelectedOrnament] = useState('');
  const [spaceError, setSpaceError] = useState('');
  const [spaceSaving, setSpaceSaving] = useState(false);
  const [demoAdmin, setDemoAdmin] = useState(true);
  const [editing, setEditing] = useState<{ id: string; avatar: AvatarStyle } | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [refreshing, setRefreshing] = useState(!demo);
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState('');
  const [room, setRoom] = useState(0);
  const [motion, setMotion] = useState(true);
  const [query, setQuery] = useState('');
  const [demoCounter, setDemoCounter] = useState(7);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setMotion(!preference.matches);
    update(); preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (demo) return;
    let disposed = false;
    let running = false;
    let pending = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    const load = async () => {
      if (disposed || document.hidden) return;
      if (running) { pending = true; return; }
      running = true;
      setRefreshing(true);
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 20_000);
      try {
        const response = await fetch('/api/spatial-office', { cache: 'no-store', signal: controller.signal });
        const payload = await response.json();
        if (!disposed && (response.status === 401 || response.status === 403)) {
          setData({ members: [], syncedAt: '', seats: new Map() });
          setAuthRequired(true);
        }
        if (!response.ok || !Array.isArray(payload.members)) throw new Error(payload.error || 'Data kantor belum tersedia.');
        if (!disposed) {
          setData(previous => {
            const space = normalizeSpace(previous.space && previous.space.revision > (payload.space?.revision ?? -1) ? previous.space : payload.space, payload.members);
            return { members: payload.members, viewerRole: payload.viewerRole, viewerId: payload.viewerId, avatarStorage: payload.avatarStorage, canEditOffice: payload.canEditOffice, spaceStorage: payload.spaceStorage, space, syncedAt: payload.syncedAt, seats: new Map(Object.entries(space.claims)) };
          });
          setError(''); setAuthRequired(false);
        }
      } catch (failure) {
        if (!disposed) setError(failure instanceof Error && failure.name !== 'AbortError' ? failure.message : 'Sinkronisasi tertunda. Data terakhir tetap ditampilkan.');
      } finally {
        clearTimeout(timeout);
        running = false;
        if (!disposed) {
          setRefreshing(false);
          if (pending) { pending = false; timer = setTimeout(load, 300); }
        }
      }
    };
    const schedule = () => { clearTimeout(timer); timer = setTimeout(load, 500); };
    const visibility = () => { if (!document.hidden) schedule(); };
    void load();
    const interval = setInterval(load, 10_000);
    const realtime = supabase.channel('spatial-office-presence')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'active_sessions' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_user_roles' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, schedule)
      .subscribe(status => {
        if (disposed) return;
        setRealtimeConnected(status === 'SUBSCRIBED');
        // Recover changes missed while the channel was connecting or reconnecting.
        if (status === 'SUBSCRIBED') schedule();
      });
    const broadcast = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('bilik_attendance_channel') : null;
    if (broadcast) broadcast.onmessage = schedule;
    window.addEventListener('focus', schedule);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      disposed = true; clearInterval(interval); clearTimeout(timer); controller?.abort();
      broadcast?.close(); void supabase.removeChannel(realtime);
      window.removeEventListener('focus', schedule); document.removeEventListener('visibilitychange', visibility);
    };
  }, [demo, refresh]);

  const space = useMemo(() => normalizeSpace(data.space || { claims: Object.fromEntries(data.seats) }, data.members), [data]);
  const rooms = spaceCapacity(space, data.members.length) / DESKS_PER_ROOM;
  const canEdit = demo ? demoAdmin : data.canEditOffice === true;
  const sharedReady = demo || data.spaceStorage === true;
  const currentRoom = Math.min(room, rooms - 1);
  const members = useMemo(() => data.members.flatMap(member => {
    const slot = data.seats.get(member.id)!;
    member = { ...member, activity: space.activities[member.id] };
    return Math.floor(slot / DESKS_PER_ROOM) === currentRoom ? [{ member: editing?.id === member.id ? { ...member, avatar: editing.avatar } : member, slot }] : [];
  }), [data, space.activities, currentRoom, editing]);
  const dataReady = demo || Boolean(data.syncedAt);
  const active = data.members.filter(member => member.status !== 'offline').length;
  const paused = data.members.filter(member => member.status === 'paused').length;
  const selectedMember = data.members.find(member => member.id === selected);
  const selectMember = (id: string) => {
    if (draft) return;
    setSelected(id); setPanel('member');
    setEditing(current => current?.id === id ? current : null);
    const slot = data.seats.get(id);
    if (slot !== undefined) setRoom(Math.floor(slot / DESKS_PER_ROOM));
  };
  const openEditor = () => {
    const member = data.members.find(m => m.id === (demo ? selected : data.viewerId));
    if (!member) return;
    selectMember(member.id); setNotice(''); setEditing({ id: member.id, avatar: member.avatar || defaultAvatar(member.id) });
  };
  const saveAvatar = async () => {
    if (!editing) return;
    const { id, avatar } = editing;
    if (!demo) {
      const response = await fetch('/api/spatial-office', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ avatar }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Avatar belum tersimpan.');
    } else { try { localStorage.setItem(`office-demo-avatar:${id}`, JSON.stringify(avatar)); } catch { throw new Error('Browser tidak mengizinkan penyimpanan avatar simulasi.'); } }
    setData(previous => ({ ...previous, members: previous.members.map(m => m.id === id ? { ...m, avatar } : m) }));
    setEditing(null); setNotice(demo ? 'Avatar simulasi tersimpan di browser ini.' : 'Avatar Anda tersimpan.');
  };
  useEffect(() => {
    if (!demo) return;
    const members = DEMO_MEMBERS.map(member => {
      let avatar;
      try { avatar = parseAvatar(JSON.parse(localStorage.getItem(`office-demo-avatar:${member.id}`) || 'null')) || undefined; } catch { /* Retain the supplied asset style. */ }
      return { ...member, startedAt: Date.now(), accumulatedSeconds: 0, avatar, tasks: member.project ? [{ name: `Review ${member.project}`, status: 'in_progress' }, { name: `Susun draft ${member.project}`, status: 'to_do' }] : [] };
    });
    let restored: unknown = null;
    try { restored = JSON.parse(localStorage.getItem('office-demo-space-v3') || 'null'); } catch { /* Use the default office. */ }
    const space = normalizeSpace(restored, members);
    try { parseOrnaments(space.ornaments, spaceCapacity(space, members.length) / DESKS_PER_ROOM); } catch { space.ornaments = normalizeSpace(null, members).ornaments; }
    queueMicrotask(() => setData(previous => ({ ...previous, members, space, seats: new Map(Object.entries(space.claims)) })));
  }, [demo]);
  const pantryDemo = () => {
    if (!demo || !selectedMember) return;
    setData(previous => ({ ...previous, members: previous.members.map(m => m.id === selected ? { ...m, status: 'working', startedAt: Date.now(), accumulatedSeconds: 900 } : m) }));
  };
  const changeDemo = (status: OfficeMember['status']) => {
    if (!demo || !selectedMember) return;
    setData(previous => ({ ...previous, members: previous.members.map(member => member.id === selected ? { ...member, status, startedAt: Date.now(), accumulatedSeconds: status === 'offline' ? 0 : workedSeconds(member, Date.now()), project: status === 'offline' ? '' : member.project || 'Project baru' } : member) }));
  };
  const addDemo = () => {
    if (!demo) return;
    const member: OfficeMember = { id: `demo-${demoCounter}`, name: `Anggota ${demoCounter}`, status: 'working', project: 'Project baru' };
    setData(previous => { const next = [...previous.members, member]; const space = normalizeSpace(previous.space || { claims: Object.fromEntries(previous.seats) }, next); return { ...previous, members: next, space, seats: new Map(Object.entries(space.claims)) }; });
    setDemoCounter(count => count + 1);
    setSelected(member.id);
    const seats = new Map(Object.entries(normalizeSpace(space, [...data.members, member]).claims));
    setRoom(Math.floor(seats.get(member.id)! / DESKS_PER_ROOM));
  };
  const removeDemo = () => {
    if (!demo || !selectedMember) return;
    setData(previous => { const next = previous.members.filter(member => member.id !== selected); const space = normalizeSpace(previous.space || { claims: Object.fromEntries(previous.seats) }, next); return { ...previous, members: next, space, seats: new Map(Object.entries(space.claims)) }; });
    setSelected(''); setEditing(null);
  };

  const viewerId = demo ? (selected || 'demo-1') : data.viewerId;
  const applySpace = (next: OfficeSpace) => {
    if (demo) localStorage.setItem('office-demo-space-v3', JSON.stringify(next));
    setData(previous => ({ ...previous, space: next, seats: new Map(Object.entries(next.claims)) }));
  };
  const saveSpace = async (action: { type: 'claim'; slot: number } | { type: 'activity'; zone: 'auto' | 'garden' | 'pantry' | 'lounge' } | { type: 'layout'; ornaments: Ornament[]; desks: DeskLayout[]; layoutRevision: number }) => {
    setSpaceSaving(true); setSpaceError('');
    try {
      let next: OfficeSpace;
      if (demo) {
        if (action.type === 'activity') next = setActivity(space, viewerId || '', action.zone);
        else if (action.type === 'claim') next = claimDesk(space, viewerId || '', action.slot, data.members.length);
        else {
          if (!canEdit) throw new Error('Hanya admin yang dapat mengatur kantor.');
          next = { ...space, revision: space.revision + 1, layoutRevision: space.layoutRevision + 1, desks: parseDesks(action.desks, rooms), ornaments: parseOrnaments(action.ornaments, rooms, action.desks) };
        }
      } else {
        const response = await fetch('/api/spatial-office', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action), signal: AbortSignal.timeout(20_000) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Perubahan belum tersimpan.');
        next = result.space;
      }
      applySpace(next);
      if (action.type === 'layout') { setDraft(null); setNotice('Denah kantor tersimpan.'); }
      else if (action.type === 'activity') { setNotice(action.zone === 'auto' ? 'Aktivitas otomatis dilanjutkan.' : 'Avatar berpindah selama 5 menit. Presensi tetap sesuai sesi Anda.'); }
      else { setNotice(`Meja ${action.slot + 1} sekarang milik Anda.`); setRoom(Math.floor(action.slot / DESKS_PER_ROOM)); }
    } catch (failure) { setSpaceError(failure instanceof Error && failure.name === 'TimeoutError' ? 'Koneksi penyimpanan melewati batas waktu. Posisi tetap ada di draft; coba Simpan denah lagi.' : failure instanceof Error ? failure.message : 'Perubahan belum tersimpan.'); }
    finally { setSpaceSaving(false); }
  };
  const selectDesk = (slot: number) => { if (draft) { setSelectedOrnament(`desk:${slot}`); return; } setSelectedDesk(slot); setPanel('desks'); setSpaceError(''); };
  const openLayout = () => {
    if (!canEdit || !sharedReady) return;
    setDraft({ ornaments: structuredClone(space.ornaments), desks: structuredClone(space.desks), layoutRevision: space.layoutRevision }); setSelectedOrnament(''); setPanel(null); setEditing(null); setSpaceError('');
  };
  const deskOwner = selectedDesk === null ? undefined : data.members.find(member => space.claims[member.id] === selectedDesk);
  const shownOrnaments = draft && canEdit ? draft.ornaments : space.ornaments;

  return <section className={`spatial-office ${immersive ? 'office-game' : ''} ${panel ? `office-panel-${panel}` : ''}`} aria-label="Kantor 3D">
    {immersive && <header className="office-game-hud">
      <div className="office-game-brand">{/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={OFFICE_BRAND.logo} alt="" /><div><strong>{OFFICE_BRAND.name}</strong><span>{demo ? 'SIMULASI' : error ? 'KONEKSI TERPUTUS' : dataReady ? `${active} CHECK-IN · AREA ${currentRoom + 1}` : 'MENGHUBUNGKAN…'}</span></div></div>
      <div className="office-game-actions">
        <div className="office-clock" title={`Zona waktu ${clock.timezone}${schedule?.configured ? '' : ' · jadwal standar Sen–Jum 08:30–17:30'}`}>
          {clock.phase === 'Malam' ? <Moon size={14} /> : <Sun size={14} />}<div><time>{now ? clock.clock : '—:—:—'}</time><small>{clock.phase} · {clock.timezone.split('/').at(-1)}</small></div>
        </div>
        {rooms > 1 && <select aria-label="Area kantor" value={currentRoom} onChange={event => { setRoom(Number(event.target.value)); setSelectedOrnament(''); }}>{Array.from({ length: rooms }, (_, i) => <option key={i} value={i}>Area {i + 1}</option>)}</select>}
        {onStatistics ? <button type="button" title="Kembali ke dashboard" aria-label="Kembali ke dashboard" onClick={onStatistics}><ArrowLeft size={17} /><span className="office-back-copy">Dashboard</span></button> : <Link className="office-back-dashboard" href="/dashboard" aria-label="Kembali ke dashboard"><ArrowLeft size={17} /></Link>}
        <button type="button" aria-label="Sinkronkan data kantor" disabled={refreshing} onClick={() => setRefresh(value => value + 1)}><RefreshCw size={16} /></button>
      </div>
    </header>}
    <header className="office-heading">
      <div><div className="office-eyebrow"><span className="office-tiny-square" /> SPATIAL WORKSPACE <span className="office-version">02</span></div>
        <h2>Satu tim. Satu ruang.</h2><p>Temui tim di meja mereka, dari mana saja.</p>
      </div>
      <div className="office-heading-actions">
        <span className={`office-sync ${error ? 'office-sync-warning' : ''}`} role="status"><span />{demo ? 'Data contoh · bukan presensi asli' : error ? 'Koneksi data bermasalah' : !dataReady ? 'Menghubungkan presensi…' : realtimeConnected ? 'Presensi live' : 'Sinkron berkala · 10 detik'}</span>
        {!demo && <button type="button" className="office-icon-button" aria-label="Sinkronkan kantor" title="Sinkronkan kantor" disabled={refreshing} onClick={() => setRefresh(value => value + 1)}><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /></button>}
      </div>
    </header>
    {demo && <div className="office-demo-note"><Box size={16} /><span><strong>Simulasi desain — tidak mengikuti check-in asli.</strong> Nama dan presensi di sini adalah contoh. Pilih anggota untuk mencoba check-in, istirahat, atau checkout.</span></div>}
    {error && <div className="office-error" role="alert">{error} {data.syncedAt && 'Tampilan menggunakan data terakhir yang berhasil diterima.'}{authRequired && <Link href="/login" className="office-login-link">Buka halaman login →</Link>}</div>}
    <div className="office-stats">
      <div><Users size={16} /><strong>{dataReady ? active : '—'}</strong><span>check-in</span></div>
      <div><Coffee size={16} /><strong>{dataReady ? paused : '—'}</strong><span>istirahat</span></div>
      <div><Box size={16} /><strong>{dataReady ? data.members.length : '—'}</strong><span>meja tim</span></div>
      <span className="office-stats-caption">Istirahat di lounge · di luar jam kerja tidur.</span>
    </div>
    <div className="office-stage">
      <div className="office-stage-bar">
        <div className="office-room-name"><span className="office-room-icon"><Box size={17} /></span><div><strong>Meja komunal</strong><span>Area {currentRoom + 1} dari {rooms} · {members.length} anggota</span></div></div>
        <div className="office-stage-actions">
          {rooms > 1 && <div className="office-room-nav"><button type="button" aria-label="Area sebelumnya" disabled={currentRoom === 0} onClick={() => setRoom(currentRoom - 1)}><ChevronLeft size={17} /></button><span>{currentRoom + 1}/{rooms}</span><button type="button" aria-label="Area berikutnya" disabled={currentRoom >= rooms - 1} onClick={() => setRoom(currentRoom + 1)}><ChevronRight size={17} /></button></div>}
          <button type="button" className="office-motion" aria-label={motion ? 'Jeda animasi' : 'Aktifkan animasi'} aria-pressed={!motion} onClick={() => setMotion(value => !value)}>{motion ? <Pause size={14} /> : <Play size={14} />}<span>{motion ? 'Jeda animasi' : 'Aktifkan animasi'}</span></button>
        </div>
      </div>
      <OfficeCanvas schedule={schedule} desks={draft && canEdit ? draft.desks : space.desks} members={members} motion={motion} selected={selected} onSelect={selectMember} room={currentRoom} ornaments={shownOrnaments} editing={Boolean(draft && canEdit && !spaceSaving)} selectedOrnament={selectedOrnament} onSelectOrnament={setSelectedOrnament} onSelectDesk={selectDesk} onMoveOrnament={(id, x, z) => {
        if(!draft || !canEdit || spaceSaving) return;
        try {
          if(id.startsWith('desk:')) setDraft({...draft,desks:moveDesk(draft.desks,Number(id.slice(5)),{x,z},rooms,draft.ornaments)});
          else setDraft({...draft,ornaments:moveOrnament(draft.ornaments,id,{x,z},rooms,draft.desks)});
          setSpaceError('');
        } catch(failure) { setSpaceError(failure instanceof Error ? failure.message : 'Posisi belum valid.'); }
      }} />
      {!data.members.length && !refreshing && !error && <div className="office-empty">Tim belum memiliki anggota. Meja akan muncul mengikuti data tim.</div>}
      <div className="office-stage-footer"><span><i /> Sudah check-in</span><span><i className="is-paused" /> Istirahat</span><span><i className="is-offline" /> Di luar kantor</span><p>Bubble: project & tugas · Pantry: animasi 1 menit setiap 15 menit kerja.</p></div>
    </div>
    <div className="office-game-dock" aria-label="Aksi kantor">
      <button type="button" disabled={Boolean(draft)} aria-pressed={panel === 'team'} onClick={() => { setPanel(panel === 'team' ? null : 'team'); }}><Users size={18} /><span>Tim</span></button>
      <Link href="/attendance"><Check size={18} /><span>Presensi</span></Link>
      <button type="button" disabled={!viewerId || Boolean(draft)} onClick={() => { if (viewerId) { selectMember(viewerId); setEditing({ id: viewerId, avatar: data.members.find(m => m.id === viewerId)?.avatar || defaultAvatar(viewerId) }); } }}><Users size={18} /><span>Avatar</span></button>
      {canEdit && <button className="office-edit-room" aria-label="Edit ruangan" title="Edit ruangan" type="button" disabled={!sharedReady || spaceSaving} onClick={draft ? () => setDraft(null) : openLayout} aria-pressed={Boolean(draft)}><PencilRuler size={18} /><span>Edit ruangan</span></button>}
      <button type="button" onClick={() => setMotion(value => !value)} aria-pressed={!motion}>{motion ? <Pause size={18} /> : <Play size={18} />}<span>{motion ? 'Jeda' : 'Gerak'}</span></button>
    </div>
    {canEdit && !sharedReady && immersive && dataReady && <div className="office-game-toast" role="status">Penyimpanan kantor belum terhubung. Klaim dan editor belum aktif.</div>}
    {notice && immersive && <div className="office-game-toast" role="status"><span>{notice}</span><button type="button" aria-label="Tutup pemberitahuan" onClick={() => setNotice('')}>×</button></div>}
    {panel === 'desks' && <aside className="office-desks-panel" aria-label="Kepemilikan meja">
      <div className="office-panel-title"><h3>Pilih meja Anda</h3><button type="button" onClick={() => setPanel(null)} aria-label="Tutup pilihan meja">×</button></div>
      <p>Meja terisi tetap milik penggunanya meski offline. Pindah ke meja kosong akan melepas meja lama Anda.</p>
      {demo && <p>Simulasi klaim sebagai <strong>{data.members.find(m => m.id === viewerId)?.name}</strong>. Pilih anggota untuk mengganti pengguna simulasi.</p>}
      <div className="office-desk-grid">{Array.from({ length: DESKS_PER_ROOM }, (_, index) => {
        const slot = currentRoom * DESKS_PER_ROOM + index, owner = data.members.find(member => space.claims[member.id] === slot);
        return <button type="button" key={slot} aria-pressed={slot === selectedDesk} className={owner?.id === viewerId ? 'is-mine' : ''} onClick={() => setSelectedDesk(slot)}><strong>{String(slot + 1).padStart(2, '0')}</strong><span>{owner?.name || 'Kosong'}</span></button>;
      })}</div>
      {selectedDesk !== null && <div className="office-desk-claim"><strong>Meja {selectedDesk + 1}</strong><p>{deskOwner ? deskOwner.id === viewerId ? 'Meja Anda saat ini.' : `Dimiliki ${deskOwner.name}.` : 'Tersedia untuk diklaim.'}</p><button type="button" disabled={!viewerId || !sharedReady || spaceSaving || Boolean(deskOwner)} onClick={() => void saveSpace({ type: 'claim', slot: selectedDesk })}>{spaceSaving ? 'Menyimpan…' : 'Klaim & pindah ke meja ini'}</button></div>}
      {!sharedReady && <p role="status">Klaim meja tersedia setelah penyimpanan server terhubung.</p>}
      {spaceError && <p role="alert">{spaceError}</p>}
      {rooms > 1 && <div className="office-editor-rotate"><button type="button" disabled={!currentRoom} onClick={() => setRoom(currentRoom - 1)}>← Area sebelumnya</button><button type="button" disabled={currentRoom === rooms - 1} onClick={() => setRoom(currentRoom + 1)}>Area berikutnya →</button></div>}
    </aside>}
    {draft && canEdit && <OfficeEditor desks={draft.desks} onDesksChange={desks => { if (!spaceSaving) { setDraft({ ...draft, desks }); setSpaceError(''); } }} items={draft.ornaments} room={currentRoom} rooms={rooms} selected={selectedOrnament} onSelect={setSelectedOrnament} onChange={ornaments => { if (!spaceSaving) { setDraft({ ...draft, ornaments }); setSpaceError(''); } }} onSave={() => void saveSpace({ type: 'layout', ...draft })} onCancel={() => { setDraft(null); setSpaceError(''); }} onReload={openLayout} conflict={draft.layoutRevision !== space.layoutRevision} saving={spaceSaving} error={spaceError} />}
    <div className="office-bottom-grid">
      {immersive && <button type="button" className="office-close-drawer" onClick={() => { setPanel(null); setEditing(null); }} aria-label="Tutup panel tim">×</button>}
      <section className="office-team-panel">
        <div className="office-panel-title"><h3>Anggota tim <span>{data.members.length}</span></h3><input type="search" aria-label="Cari anggota kantor" placeholder="Cari anggota…" value={query} onChange={event => setQuery(event.target.value)} /></div>
        <div className="office-member-grid">
          {data.members.filter(member => member.name.toLowerCase().includes(query.toLowerCase())).map(member => <button key={member.id} type="button" className={`office-member ${selected === member.id ? 'is-selected' : ''}`} onClick={() => selectMember(member.id)} aria-pressed={selected === member.id}>
            <span className="office-initials">{member.name.slice(0, 2).toUpperCase()}<i className={`status-${member.status}`} /></span>
            <span className="office-member-copy"><strong>{member.name}</strong><span>{statusLabel(member)}</span></span>
            <span className="office-seat-number">{String((data.seats.get(member.id) ?? 0) + 1).padStart(2, '0')}</span>
          </button>)}
          {data.members.length > 0 && !data.members.some(member => member.name.toLowerCase().includes(query.toLowerCase())) && <p className="office-muted">Anggota tidak ditemukan.</p>}
        </div>
      </section>
      <aside className="office-detail-panel">
        <div className="office-panel-title"><h3>{selectedMember ? 'Meja anggota' : 'Ruang untuk terhubung'}</h3>{selectedMember && <button type="button" className="office-icon-button" aria-label="Tutup detail anggota" onClick={() => setSelected('')}><X size={15} /></button>}</div>
        {selectedMember ? <><h4>{selectedMember.name}</h4><p>{statusLabel(selectedMember)} · Meja {(data.seats.get(selectedMember.id) ?? 0) + 1}</p><div className="office-project"><span>PROJECT PRESENSI</span><strong>{selectedMember.project || 'Belum ada project yang dipilih'}</strong></div></> : <p>Pilih karakter atau nama anggota untuk melihat status dan project yang sedang mereka kerjakan.</p>}
        {((demo && selectedMember) || (!demo && data.viewerId)) && !editing && <button type="button" className="office-edit-avatar" onClick={openEditor}>{demo ? 'Ubah avatar' : 'Ubah avatar saya'}</button>}
        {selectedMember && (demo || selectedMember.id === data.viewerId) && <div className="office-activity-controls">
          <label>Aktivitas avatar<select aria-label="Aktivitas avatar" disabled={!sharedReady || spaceSaving || selectedMember.status === 'offline'} value={space.activities[selectedMember.id]?.until > now ? space.activities[selectedMember.id].zone : 'auto'} onChange={event => void saveSpace({ type: 'activity', zone: event.target.value as 'auto' | 'garden' | 'pantry' | 'lounge' })}>
            <option value="auto">Otomatis mengikuti sesi</option><option value="garden">Duduk di taman · 5 menit</option><option value="pantry">Buat kopi di pantry · 5 menit</option><option value="lounge">Ngobrol di lounge · 5 menit</option>
          </select></label><small>Gerakan dan percakapan bersifat ilustrasi. Waktu presensi tidak berubah.</small>
        </div>}
        {editing && <AvatarEditor value={editing.avatar} onChange={avatar => setEditing({ ...editing, avatar })} onSave={saveAvatar} onClose={() => setEditing(null)} demo={demo} storage={Boolean(data.avatarStorage)} />}
        {notice && <p role="status">{notice}</p>}
        {demo ? <div className="office-demo-controls">
          <button type="button" aria-pressed={demoAdmin} onClick={() => { setDemoAdmin(value => !value); setDraft(null); }}>Mode {demoAdmin ? 'admin' : 'anggota'}</button>
          {selectedMember && <><button type="button" onClick={() => changeDemo('working')}><LogIn size={14} /> Check-in</button><button type="button" onClick={() => changeDemo('paused')}><Coffee size={14} /> Istirahat</button><button type="button" onClick={() => changeDemo('offline')}><LogOut size={14} /> Checkout</button><button type="button" onClick={pantryDemo}><Coffee size={14} /> Simulasi 15 menit → pantry</button><button type="button" onClick={removeDemo}><X size={14} /> Hapus anggota</button></>}
          <button type="button" onClick={addDemo}><Plus size={14} /> Tambah anggota</button>
        </div> : <><Link href="/attendance" className="office-primary-link"><Check size={15} /> Buka presensi <ArrowUpRight size={15} /></Link><Link href="/office-preview" target="_blank" className="office-preview-link">Coba simulasi gerakan <ArrowUpRight size={13} /></Link></>}
      </aside>
    </div>
    <footer className="office-footnote"><span>Karakter bergerak sebagai ilustrasi suasana kerja; bukan pelacakan aktivitas.</span>{!demo && data.syncedAt && <span>Sinkron terakhir {new Date(data.syncedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} · {realtimeConnected ? 'Realtime + cadangan 10 detik' : 'Sinkron tiap 10 detik'}</span>}</footer>
  </section>;
}
