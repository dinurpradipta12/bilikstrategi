'use client';
import { useState } from 'react';
import { ORNAMENTS, ornamentError, parseOrnaments, parseDesks, type Ornament } from '@/lib/spatial-office/space';

import { deskPosition, type DeskLayout } from '@/lib/spatial-office/model';

export default function OfficeEditor({ desks, onDesksChange, items, room, rooms, selected, onSelect, onChange, onSave, onCancel, saving, error }: {
  desks: DeskLayout[]; onDesksChange: (desks: DeskLayout[]) => void;
  items: Ornament[]; room: number; rooms: number; selected: string; onSelect: (id: string) => void; onChange: (items: Ornament[]) => void;
  onSave: () => void; onCancel: () => void; saving: boolean; error: string;
}) {
  const [asset, setAsset] = useState<Ornament['asset']>('floor_plant');
  const [message, setMessage] = useState('');
  const deskSlot = selected.startsWith('desk:') ? Number(selected.slice(5)) : null;
  const desk = deskSlot === null ? null : deskPosition(deskSlot, desks);
  const updateDesk = (patch: Partial<DeskLayout>) => { if (deskSlot === null || !desk) return; onDesksChange([...desks.filter(d => d.slot !== deskSlot), { slot: deskSlot, x: desk.x, z: desk.z, rotation: desk.rotation, ...patch }]); };
  let layoutError = '';
  try { parseDesks(desks, rooms); parseOrnaments(items, rooms, desks); } catch (failure) { layoutError = failure instanceof Error ? failure.message : 'Denah belum valid.'; }
  const item = items.find(item => item.id === selected);
  const update = (patch: Partial<Ornament>) => onChange(items.map(current => current.id === selected ? { ...current, ...patch } : current));
  const add = () => {
    for (let z = -5; z <= 5; z += 1) for (let x = -5; x <= 18; x += 1) {
      const next: Ornament = { id: crypto.randomUUID(), asset, x, z, rotation: 0, room };
      try { parseOrnaments([...items, next], rooms, desks); onChange([...items, next]); onSelect(next.id); setMessage(''); return; } catch { /* Find the next free placement. */ }
    }
    setMessage('Belum ada ruang kosong untuk ornamen ini. Geser atau hapus ornamen lain.');
  };
  return <aside className="office-editor-panel" aria-label="Editor ruangan admin">
    <div className="office-panel-title"><h3>Atur kantor <span>ADMIN</span></h3><button type="button" onClick={onCancel} disabled={saving} aria-label="Tutup editor ornamen">×</button></div>
    <p>Seret meja atau ornamen di ruang 3D atau gunakan kontrol posisi. Perubahan dibagikan ke tim setelah disimpan.</p>
    <div className="office-editor-add"><label>Tambah ornamen<select value={asset} onChange={event => setAsset(event.target.value as Ornament['asset'])}>{Object.entries(ORNAMENTS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label><button type="button" onClick={add} disabled={saving || items.length >= 60}>Tambah</button></div>
    <label>Meja & ornamen area {room + 1}<select value={selected} onChange={event => onSelect(event.target.value)}><option value="">Pilih meja atau ornamen…</option>{Array.from({ length: 10 }, (_, i) => <option key={`desk:${room * 10 + i}`} value={`desk:${room * 10 + i}`}>Meja {room * 10 + i + 1}</option>)}{items.filter(item => item.room === room).map((item, i) => <option key={item.id} value={item.id}>{i + 1}. {ORNAMENTS[item.asset].label}</option>)}</select></label>
    {desk && <fieldset disabled={saving}><legend>Meja {deskSlot! + 1}</legend>
      <label>Kiri / kanan · {desk.x.toFixed(2)} m<input aria-label="Posisi meja X" type="range" min="-5" max="4" step="0.25" value={desk.x} onChange={event => updateDesk({ x: Number(event.target.value) })} /></label>
      <label>Depan / belakang · {desk.z.toFixed(2)} m<input aria-label="Posisi meja Z" type="range" min="-5" max="5" step="0.25" value={desk.z} onChange={event => updateDesk({ z: Number(event.target.value) })} /></label>
      <div className="office-editor-rotate"><button type="button" onClick={() => updateDesk({ rotation: (desk.rotation + Math.PI * 1.5) % (Math.PI * 2) })}>↶ Putar 90°</button><button type="button" onClick={() => updateDesk({ rotation: (desk.rotation + Math.PI / 2) % (Math.PI * 2) })}>Putar 90° ↷</button></div>
      <button type="button" onClick={() => onDesksChange(desks.filter(d => d.slot !== deskSlot))}>Posisi meja semula</button>
    </fieldset>}
    {item && <fieldset disabled={saving}>
      <legend>{ORNAMENTS[item.asset].label}</legend>
      <label>Kiri / kanan · {item.x.toFixed(2)} m<input aria-label="Posisi ornamen X" type="range" min="-5.5" max="18.5" step="0.25" value={item.x} onChange={event => update({ x: Number(event.target.value) })} /></label>
      <label>Depan / belakang · {item.z.toFixed(2)} m<input aria-label="Posisi ornamen Z" type="range" min="-5.5" max="5.5" step="0.25" value={item.z} onChange={event => update({ z: Number(event.target.value) })} /></label>
      <div className="office-editor-rotate"><button type="button" onClick={() => update({ rotation: (item.rotation - Math.PI / 4 + Math.PI * 2) % (Math.PI * 2) })}>↶ Putar 45°</button><button type="button" onClick={() => update({ rotation: (item.rotation + Math.PI / 4) % (Math.PI * 2) })}>Putar 45° ↷</button></div>
      <button type="button" className="office-editor-delete" onClick={() => { onChange(items.filter(current => current.id !== selected)); onSelect(''); }}>Hapus ornamen</button>
      {ornamentError(item, desks) && <p role="status">{ornamentError(item, desks)}</p>}
    </fieldset>}
    {(message || error || layoutError) && <p role="alert">{error || message || layoutError}</p>}
    <div className="office-editor-actions"><button type="button" onClick={onSave} disabled={saving || Boolean(layoutError)}>{saving ? 'Menyimpan…' : 'Simpan denah'}</button><button type="button" onClick={onCancel} disabled={saving}>Batal</button></div>
  </aside>;
}
