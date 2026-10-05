'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Box, Check, ChevronLeft, ChevronRight, Coffee, LogIn, LogOut, Pause, Play, Plus, RefreshCw, Users, X } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { DESKS_PER_ROOM, reconcileSeats, statusLabel, type OfficeMember, type OfficeSnapshot } from '@/lib/spatial-office/model';
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

export default function OfficeDashboard({ demo = false }: { demo?: boolean }) {
  const [data, setData] = useState<Data>(() => ({ members: demo ? DEMO_MEMBERS : [], syncedAt: '', seats: reconcileSeats(new Map(), demo ? DEMO_MEMBERS : []) }));
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
          setData(previous => ({ members: payload.members, syncedAt: payload.syncedAt, seats: reconcileSeats(previous.seats, payload.members) }));
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

  const rooms = Math.max(1, Math.ceil((Math.max(-1, ...data.seats.values()) + 1) / DESKS_PER_ROOM));
  const currentRoom = Math.min(room, rooms - 1);
  const members = useMemo(() => data.members.flatMap(member => {
    const slot = data.seats.get(member.id)!;
    return Math.floor(slot / DESKS_PER_ROOM) === currentRoom ? [{ member, slot }] : [];
  }), [data, currentRoom]);
  const dataReady = demo || Boolean(data.syncedAt);
  const active = data.members.filter(member => member.status !== 'offline').length;
  const paused = data.members.filter(member => member.status === 'paused').length;
  const selectedMember = data.members.find(member => member.id === selected);
  const selectMember = useCallback((id: string) => {
    setSelected(id);
    const slot = data.seats.get(id);
    if (slot !== undefined) setRoom(Math.floor(slot / DESKS_PER_ROOM));
  }, [data.seats]);
  const changeDemo = (status: OfficeMember['status']) => {
    if (!demo || !selectedMember) return;
    setData(previous => ({ ...previous, members: previous.members.map(member => member.id === selected ? { ...member, status, project: status === 'offline' ? '' : member.project || 'Project baru' } : member) }));
  };
  const addDemo = () => {
    if (!demo) return;
    const member: OfficeMember = { id: `demo-${demoCounter}`, name: `Anggota ${demoCounter}`, status: 'working', project: 'Project baru' };
    setData(previous => { const next = [...previous.members, member]; return { ...previous, members: next, seats: reconcileSeats(previous.seats, next) }; });
    setDemoCounter(count => count + 1);
    setSelected(member.id);
    const seats = reconcileSeats(data.seats, [...data.members, member]);
    setRoom(Math.floor(seats.get(member.id)! / DESKS_PER_ROOM));
  };
  const removeDemo = () => {
    if (!demo || !selectedMember) return;
    setData(previous => { const next = previous.members.filter(member => member.id !== selected); return { ...previous, members: next, seats: reconcileSeats(previous.seats, next) }; });
    setSelected('');
  };

  return <section className="spatial-office" aria-label="Kantor 3D">
    <header className="office-heading">
      <div><div className="office-eyebrow"><span className="office-tiny-square" /> SPATIAL WORKSPACE <span className="office-version">01</span></div>
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
      <div><Users size={16} /><strong>{dataReady ? active : '—'}</strong><span>di kantor</span></div>
      <div><Coffee size={16} /><strong>{dataReady ? paused : '—'}</strong><span>istirahat</span></div>
      <div><Box size={16} /><strong>{dataReady ? data.members.length : '—'}</strong><span>meja tim</span></div>
      <span className="office-stats-caption">Meja tetap tersedia saat pemiliknya keluar.</span>
    </div>
    <div className="office-stage">
      <div className="office-stage-bar">
        <div className="office-room-name"><span className="office-room-icon"><Box size={17} /></span><div><strong>Meja komunal</strong><span>Area {currentRoom + 1} dari {rooms} · {members.length} anggota</span></div></div>
        <div className="office-stage-actions">
          {rooms > 1 && <div className="office-room-nav"><button type="button" aria-label="Area sebelumnya" disabled={currentRoom === 0} onClick={() => setRoom(currentRoom - 1)}><ChevronLeft size={17} /></button><span>{currentRoom + 1}/{rooms}</span><button type="button" aria-label="Area berikutnya" disabled={currentRoom >= rooms - 1} onClick={() => setRoom(currentRoom + 1)}><ChevronRight size={17} /></button></div>}
          <button type="button" className="office-motion" aria-label={motion ? 'Jeda animasi' : 'Aktifkan animasi'} aria-pressed={!motion} onClick={() => setMotion(value => !value)}>{motion ? <Pause size={14} /> : <Play size={14} />}<span>{motion ? 'Jeda animasi' : 'Aktifkan animasi'}</span></button>
        </div>
      </div>
      <OfficeCanvas members={members} motion={motion} selected={selected} onSelect={selectMember} />
      {!data.members.length && !refreshing && !error && <div className="office-empty">Tim belum memiliki anggota. Meja akan muncul mengikuti data tim.</div>}
      <div className="office-stage-footer"><span><i /> Sudah check-in</span><span><i className="is-paused" /> Istirahat</span><span><i className="is-offline" /> Di luar kantor</span><p>Bubble menampilkan status sesi dan project presensi.</p></div>
    </div>
    <div className="office-bottom-grid">
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
        {demo ? <div className="office-demo-controls">
          {selectedMember && <><button type="button" onClick={() => changeDemo('working')}><LogIn size={14} /> Check-in</button><button type="button" onClick={() => changeDemo('paused')}><Coffee size={14} /> Istirahat</button><button type="button" onClick={() => changeDemo('offline')}><LogOut size={14} /> Checkout</button><button type="button" onClick={removeDemo}><X size={14} /> Hapus anggota</button></>}
          <button type="button" onClick={addDemo}><Plus size={14} /> Tambah anggota</button>
        </div> : <><Link href="/attendance" className="office-primary-link"><Check size={15} /> Buka presensi <ArrowUpRight size={15} /></Link><Link href="/office-preview" target="_blank" className="office-preview-link">Coba simulasi gerakan <ArrowUpRight size={13} /></Link></>}
      </aside>
    </div>
    <footer className="office-footnote"><span>Karakter bergerak sebagai ilustrasi suasana kerja; bukan pelacakan aktivitas.</span>{!demo && data.syncedAt && <span>Sinkron terakhir {new Date(data.syncedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} · {realtimeConnected ? 'Realtime + cadangan 10 detik' : 'Sinkron tiap 10 detik'}</span>}</footer>
  </section>;
}
