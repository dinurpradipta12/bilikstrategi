'use client';

import { useEffect, useRef, useState } from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import type { Ornament } from '@/lib/spatial-office/space';
import type { OfficeMember } from '@/lib/spatial-office/model';
import { OfficeScene } from '@/lib/spatial-office/scene';

type Props = {
  members: { member: OfficeMember; slot: number }[];
  room: number; ornaments: Ornament[]; editing: boolean; selectedOrnament: string;
  onSelectDesk: (slot: number) => void; onSelectOrnament: (id: string) => void; onMoveOrnament: (id: string, x: number, z: number) => void;
  motion: boolean; selected: string; onSelect: (id: string) => void;
};
export default function OfficeCanvas({ members, motion, selected, onSelect, room, ornaments, editing, selectedOrnament, onSelectDesk, onSelectOrnament, onMoveOrnament }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const scene = useRef<OfficeScene | null>(null);
  const [state, setState] = useState({ loading: true, error: '' });
  const [attempt, setAttempt] = useState(0);
  const selectCallback = useRef(onSelect);
  const editCallbacks = useRef({ onSelectDesk, onSelectOrnament, onMoveOrnament });
  useEffect(() => { editCallbacks.current = { onSelectDesk, onSelectOrnament, onMoveOrnament }; }, [onSelectDesk, onSelectOrnament, onMoveOrnament]);
  useEffect(() => { selectCallback.current = onSelect; }, [onSelect]);
  useEffect(() => {
    if (!host.current || !labels.current) return;
    let engine: OfficeScene | null = null;
    try {
      engine = new OfficeScene(host.current, labels.current, {
        onReady: () => setState({ loading: false, error: '' }),
        onError: error => setState({ loading: false, error }),
        onSelect: id => selectCallback.current(id),
        onSelectDesk: slot => editCallbacks.current.onSelectDesk(slot),
        onSelectOrnament: id => editCallbacks.current.onSelectOrnament(id),
        onMoveOrnament: (id, x, z) => editCallbacks.current.onMoveOrnament(id, x, z),
      });
      scene.current = engine;
    } catch {
      queueMicrotask(() => setState({ loading: false, error: 'Browser ini belum dapat menampilkan WebGL 2. Daftar anggota tetap tersedia di bawah.' }));
    }
    return () => { engine?.dispose(); scene.current = null; };
  }, [attempt]);
  useEffect(() => { scene.current?.setMembers(members); }, [members, attempt]);
  useEffect(() => { scene.current?.setMotion(motion); }, [motion, attempt]);
  useEffect(() => { scene.current?.select(selected); }, [selected, attempt]);
  useEffect(() => { scene.current?.setOrnaments(ornaments, room, editing, selectedOrnament); }, [ornaments, room, editing, selectedOrnament, attempt]);
  return <div className={`office-viewport ${editing ? 'is-editing' : ''}`}>
    <div className="office-webgl" ref={host} />
    <div className="office-labels" ref={labels} />
    {(state.loading || state.error) && <div className="office-canvas-message" role="status">
      <div><strong>{state.error ? 'Tampilan 3D belum tersedia' : 'Menyiapkan kantor…'}</strong>
        <p>{state.error || 'Memuat karakter dan furnitur kantor Anda.'}</p>
        {state.error && <button type="button" onClick={() => { setState({ loading: true, error: '' }); setAttempt(value => value + 1); }}>Coba lagi</button>}
      </div>
    </div>}
    <div className="office-view-controls" aria-label="Pilihan ruangan">
      <button type="button" onClick={() => scene.current?.resetCamera()}>Semua</button>
      <button type="button" onClick={() => scene.current?.focus('desk')}>Meja</button>
      <button type="button" onClick={() => scene.current?.focus('lounge')}>Lounge</button>
      <button type="button" onClick={() => scene.current?.focus('pantry')}>Pantry</button>
      <button type="button" onClick={() => scene.current?.focus('garden')}>Taman</button>
    </div>
    <div className="office-camera-controls" aria-label="Kontrol kamera">
      <button type="button" title="Perbesar" aria-label="Perbesar kantor" onClick={() => scene.current?.zoom(1)}><Plus size={17} /></button>
      <button type="button" title="Perkecil" aria-label="Perkecil kantor" onClick={() => scene.current?.zoom(-1)}><Minus size={17} /></button>
      <button type="button" title="Atur ulang kamera" aria-label="Atur ulang kamera" onClick={() => scene.current?.resetCamera()}><RotateCcw size={16} /></button>
    </div>
    <div className="office-camera-hint">Seret untuk melihat sekitar · Cubit atau gunakan + / −</div>
  </div>;
}
