'use client';
import { useState } from 'react';
import { ORNAMENTS, ornamentError, parseOrnaments, type Ornament } from '@/lib/spatial-office/space';

export default function OfficeEditor({ items, room, rooms, selected, onSelect, onChange, onSave, onCancel, saving, error }: {
  items: Ornament[]; room: number; rooms: number; selected: string; onSelect: (id: string) => void; onChange: (items: Ornament[]) => void;
  onSave: () => void; onCancel: () => void; saving: boolean; error: string;
}) {
  const [asset, setAsset] = useState<Ornament['asset']>('floor_plant');
  const [message, setMessage] = useState('');
  const item = items.find(item => item.id === selected);
  const update = (patch: Partial<Ornament>) => onChange(items.map(current => current.id === selected ? { ...current, ...patch } : current));
  const add = () => {
    for (let z = -5; z <= 5; z += 1) for (let x = -5; x <= 18; x += 1) {
      const next: Ornament = { id: crypto.randomUUID(), asset, x, z, rotation: 0, room };
      try { parseOrnaments([...items, next], rooms); onChange([...items, next]); onSelect(next.id); setMessage(''); return; } catch { /* Find the next free placement. */ }
    }
    setMessage('Belum ada ruang kosong untuk ornamen ini. Geser atau hapus ornamen lain.');
  };
  return <aside className="office-editor-panel" aria-label="Editor ornamen admin">
    <div className="office-panel-title"><h3>Atur kantor <span>ADMIN</span></h3><button type="button" onClick={onCancel} disabled={saving} aria-label="Tutup editor ornamen">×</button></div>
    <p>Seret ornamen di ruang 3D atau gunakan kontrol posisi. Perubahan dibagikan ke tim setelah disimpan.</p>
    <div className="office-editor-add"><label>Tambah ornamen<select value={asset} onChange={event => setAsset(event.target.value as Ornament['asset'])}>{Object.entries(ORNAMENTS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label><button type="button" onClick={add} disabled={saving || items.length >= 60}>Tambah</button></div>
    <label>Ornamen area {room + 1}<select value={selected} onChange={event => onSelect(event.target.value)}><option value="">Pilih ornamen…</option>{items.filter(item => item.room === room).map((item, i) => <option key={item.id} value={item.id}>{i + 1}. {ORNAMENTS[item.asset].label}</option>)}</select></label>
    {item && <fieldset disabled={saving}>
      <legend>{ORNAMENTS[item.asset].label}</legend>
      <label>Kiri / kanan · {item.x.toFixed(2)} m<input aria-label="Posisi ornamen X" type="range" min="-5.5" max="18.5" step="0.25" value={item.x} onChange={event => update({ x: Number(event.target.value) })} /></label>
      <label>Depan / belakang · {item.z.toFixed(2)} m<input aria-label="Posisi ornamen Z" type="range" min="-5.5" max="5.5" step="0.25" value={item.z} onChange={event => update({ z: Number(event.target.value) })} /></label>
      <div className="office-editor-rotate"><button type="button" onClick={() => update({ rotation: (item.rotation - Math.PI / 4 + Math.PI * 2) % (Math.PI * 2) })}>↶ Putar 45°</button><button type="button" onClick={() => update({ rotation: (item.rotation + Math.PI / 4) % (Math.PI * 2) })}>Putar 45° ↷</button></div>
      <button type="button" className="office-editor-delete" onClick={() => { onChange(items.filter(current => current.id !== selected)); onSelect(''); }}>Hapus ornamen</button>
      {ornamentError(item) && <p role="status">{ornamentError(item)}</p>}
    </fieldset>}
    {(message || error) && <p role="alert">{error || message}</p>}
    <div className="office-editor-actions"><button type="button" onClick={onSave} disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan denah'}</button><button type="button" onClick={onCancel} disabled={saving}>Batal</button></div>
  </aside>;
}
