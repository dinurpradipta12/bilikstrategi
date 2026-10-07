'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { AttendanceSchedule } from '@/lib/attendance/schedule';
import { OFFICE_BRAND } from '@/lib/spatial-office/branding';
import type { DeskLayout } from '@/lib/spatial-office/model';
import { Building2, LocateFixed, Hand, Orbit, Minus, Plus, RotateCcw } from 'lucide-react';
import type { Ornament, LightMode } from '@/lib/spatial-office/space';
import type { OfficeMember } from '@/lib/spatial-office/model';
import { OfficeScene, type ObjectMenuTarget } from '@/lib/spatial-office/scene';

type Props = {
  members: { member: OfficeMember; slot: number }[];
  lights: Record<string,LightMode>; schedule?: AttendanceSchedule; desks: DeskLayout[];
  room: number; ornaments: Ornament[]; editing: boolean; selectedOrnament: string;
  onSelectDesk: (slot: number) => void; onSelectOrnament: (id: string) => void; onMoveOrnament: (id: string, x: number, z: number) => void;
  onObjectMenu: (target: ObjectMenuTarget) => void; children?: ReactNode;
  motion: boolean; selected: string; onSelect: (id: string) => void;
  signText: string;
};
export default function OfficeCanvas({ members, motion, selected, onSelect, room, ornaments, editing, selectedOrnament, onSelectDesk, onSelectOrnament, onMoveOrnament, onObjectMenu, children, desks, schedule, lights, signText }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const scene = useRef<OfficeScene | null>(null);
  const [state, setState] = useState({ loading: true, error: '' });
  const [pan, setPan] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const selectCallback = useRef(onSelect);
  const editCallbacks = useRef({ onSelectDesk, onSelectOrnament, onMoveOrnament, onObjectMenu });
  useEffect(() => { editCallbacks.current = { onSelectDesk, onSelectOrnament, onMoveOrnament, onObjectMenu }; }, [onSelectDesk, onSelectOrnament, onMoveOrnament,onObjectMenu]);
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
        onObjectMenu: target=>editCallbacks.current.onObjectMenu(target),
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
  useEffect(() => { scene.current?.setLights(lights); }, [lights, attempt]);
  useEffect(() => { scene.current?.setDeskLayout(desks); }, [desks, attempt]);
  useEffect(() => { scene.current?.setEnvironment(schedule); scene.current?.setBrand({ ...OFFICE_BRAND, name: signText }); }, [schedule, signText, attempt]);
  useEffect(() => { scene.current?.setPan(pan); }, [pan, attempt]);
  return <div className={`office-viewport ${editing ? 'is-editing' : ''}`}>
    <div className="office-webgl" ref={host} />
    <div className="office-labels" ref={labels} />
    {children}
    {(state.loading || state.error) && <div className="office-canvas-message" role="status">
      <div><strong>{state.error ? 'Tampilan 3D belum tersedia' : 'Menyiapkan kantor…'}</strong>
        <p>{state.error || 'Memuat karakter dan furnitur kantor Anda.'}</p>
        {state.error && <button type="button" onClick={() => { setState({ loading: true, error: '' }); setAttempt(value => value + 1); }}>Coba lagi</button>}
      </div>
    </div>}
    <div className="office-camera-controls" aria-label="Kontrol kamera">
      {editing&&selectedOrnament&&<button type="button" aria-label="Sorot objek terpilih" title="Sorot objek terpilih" onClick={()=>scene.current?.focusObject(selectedOrnament)}><LocateFixed size={17}/></button>}
      <button type="button" aria-label={pan ? 'Mode orbit kamera' : 'Mode geser kamera'} title={pan ? 'Orbit: seret untuk memutar' : 'Geser: seret untuk memindahkan pandangan'} aria-pressed={pan} onClick={()=>setPan(v=>!v)}>{pan ? <Hand size={17}/> : <Orbit size={17}/>}</button>
      <button type="button" title="Perbesar" aria-label="Perbesar kantor" onClick={() => scene.current?.zoom(1)}><Plus size={17} /></button>
      <button type="button" title="Perkecil" aria-label="Perkecil kantor" onClick={() => scene.current?.zoom(-1)}><Minus size={17} /></button>
      <button type="button" title="Tampak depan · sejajar mata" aria-label="Tampak depan kantor" onClick={()=>scene.current?.frontView()}><Building2 size={17}/></button>
      <button type="button" title="Atur ulang kamera" aria-label="Atur ulang kamera" onClick={() => scene.current?.resetCamera()}><RotateCcw size={16} /></button>
    </div>
    <div className="office-camera-hint">{pan ? 'Seret untuk geser pandangan' : 'Seret untuk orbit · Klik kanan + seret untuk geser'} · Dua jari: geser & zoom</div>
  </div>;
}
