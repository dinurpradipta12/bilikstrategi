'use client';
import { useMemo, useState } from 'react';
import { Box, Plus, Search } from 'lucide-react';
import { OBJECT_COLORS, ORNAMENTS, ornamentError, parseOrnaments, parseDesks, moveOrnament, moveDesk, snapOrnament, isWallOrnament, type Ornament } from '@/lib/spatial-office/space';

import { DESKS_PER_ROOM, deskBounds, deskLabel, deskPosition, type DeskLayout } from '@/lib/spatial-office/model';

export default function OfficeEditor({ desks, onDesksChange, items, room, rooms, selected, onSelect, onChange, onSave, onCancel, onReload, conflict, saving, error }: {
  desks: DeskLayout[]; onDesksChange: (desks: DeskLayout[]) => void;
  items: Ornament[]; room: number; rooms: number; selected: string; onSelect: (id: string) => void; onChange: (items: Ornament[]) => void;
  onSave: () => void; onCancel: () => void; onReload: () => void; conflict: boolean; saving: boolean; error: string;
}) {
  const [library, setLibrary] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Semua');
  const [placement, setPlacement] = useState('workspace');
  const [message, setMessage] = useState('');
  const deskSlot = selected.startsWith('desk:') ? Number(selected.slice(5)) : null;
  const [deskXmin,deskXmax,deskZmin,deskZmax]=deskBounds(deskSlot??0);
  const desk = deskSlot === null ? null : deskPosition(deskSlot, desks);
  const updateDesk = (patch: Partial<DeskLayout>) => { if (deskSlot === null || !desk) return; try { onDesksChange(moveDesk(desks,deskSlot,patch,rooms,items)); setMessage(''); } catch(failure) { setMessage(failure instanceof Error ? failure.message : 'Posisi belum valid.'); } };
  const layoutError = useMemo(()=>{ try { parseDesks(desks, rooms); parseOrnaments(items, rooms, desks); return ''; } catch (failure) { return failure instanceof Error ? failure.message : 'Denah belum valid.'; } },[desks,items,rooms]);
  const item = items.find(item => item.id === selected);
  const update = (patch: Partial<Ornament>, attach = false) => { try { onChange(moveOrnament(items,selected,patch,rooms,desks,attach)); setMessage(''); } catch(failure) { setMessage(failure instanceof Error ? failure.message : 'Posisi belum valid.'); } };
  const add = (asset: Ornament['asset']) => {
    const bounds: Record<string, number[]> = { workspace:[-5,5,-5,5], manager:[-5,-1,-11,-7], lead:[1,5,-12.5,-8.5], lounge:[7,11,-4.5,0], pantry:[7,11,2,5], garden:[13,18,-5,5], meeting:[7,11,-12.5,-8.5] };
    const [xmin,xmax,zmin,zmax]=bounds[placement];
    for (let z=zmin; z<=zmax; z+=.5) for (let x=xmin; x<=xmax; x+=.5) {
      const candidate: Ornament = { id:crypto.randomUUID(),asset,x,z,rotation:0,room };
      const next=snapOrnament(candidate,candidate,isWallOrnament(candidate));
      try { parseOrnaments([...items,next],rooms,desks); onChange([...items,next]); onSelect(next.id); setMessage(''); setLibrary(false); return; } catch { /* Try another free position. */ }
    }
    setMessage('Ruangan ini belum memiliki tempat kosong yang cukup. Pilih ruangan lain atau geser objek dahulu.');
  };
  const colorControls = (color: string | undefined, change: (color: string) => void) => <div className="office-color-control"><label>Warna objek<input aria-label="Warna objek" type="color" value={color && color !== 'original' ? color : '#ffffff'} onChange={event=>change(event.target.value)} /></label><div>{OBJECT_COLORS.map(c=><button type="button" key={c} title={c === 'original' ? 'Warna asli' : c} aria-label={c === 'original' ? 'Warna asli' : `Warna ${c}`} aria-pressed={(color || 'original')===c} style={{background:c === 'original' ? '#f1eee4' : c}} onClick={()=>change(c)}>{c === 'original' ? 'Asli' : ''}</button>)}</div></div>;
  return <aside className="office-editor-panel" aria-label="Editor ruangan admin">
    <div className="office-panel-title"><h3>Atur kantor <span>ADMIN</span></h3><button type="button" onClick={onCancel} disabled={saving} aria-label="Tutup editor ornamen">×</button></div>
    <p>Seret furnitur untuk mengatur posisi. Meja kerja dan perangkatnya bergerak bersama. Objek berhenti di batas dinding; posisi yang bertabrakan tidak diterapkan. Klik Simpan denah untuk membagikan perubahan ke tim.</p>
    <button className="office-open-library" type="button" onClick={()=>setLibrary(v=>!v)} aria-expanded={library}><Plus size={16}/> Library objek <span>{Object.keys(ORNAMENTS).length} aset</span></button>
    {library && <section className="office-object-library" aria-label="Library objek">
      <label>Ruangan penempatan<select value={placement} onChange={event=>setPlacement(event.target.value)}><option value="workspace">Ruang kerja</option><option value="manager">Manager</option><option value="lead">Project lead</option><option value="lounge">Lounge</option><option value="pantry">Pantry</option><option value="garden">Taman</option><option value="meeting">Meeting room</option></select></label>
      <label className="office-library-search"><Search size={14}/><input type="search" aria-label="Cari objek" placeholder="Cari objek…" value={search} onChange={event=>setSearch(event.target.value)}/></label>
      <label>Kategori<select value={category} onChange={event=>setCategory(event.target.value)}>{['Semua',...new Set(Object.values(ORNAMENTS).map(o=>o.category))].map(c=><option key={c}>{c}</option>)}</select></label>
      <div className="office-library-grid">{Object.entries(ORNAMENTS).filter(([,a])=>(category==='Semua'||a.category===category)&&a.label.toLowerCase().includes(search.toLowerCase())).map(([key,a])=><button type="button" key={key} disabled={saving || items.length >= 1200} onClick={()=>add(key as Ornament['asset'])}><Box size={22}/><strong>{a.label}</strong><small>{a.width} × {a.depth} m</small></button>)}</div>
    </section>}
    <label>Meja & ornamen area {room + 1}<select value={selected} onChange={event => onSelect(event.target.value)}><option value="">Pilih meja atau ornamen…</option>{Array.from({ length: DESKS_PER_ROOM }, (_, i) => <option key={`desk:${room * DESKS_PER_ROOM + i}`} value={`desk:${room * DESKS_PER_ROOM + i}`}>{deskLabel(room*DESKS_PER_ROOM+i)}{deskPosition(room*DESKS_PER_ROOM+i,desks).removed?' (dihapus)':''}</option>)}{items.filter(item => item.room === room).map((item, i) => <option key={item.id} value={item.id}>{i + 1}. {ORNAMENTS[item.asset].label}</option>)}</select></label>
    {desk && !desk.removed && <fieldset disabled={saving}><legend>{deskLabel(deskSlot!)}</legend>
      <label>Kiri / kanan · {desk.x.toFixed(2)} m<input aria-label="Posisi meja X" type="range" min={deskXmin} max={deskXmax} step="0.25" value={desk.x} onChange={event => updateDesk({ x: Number(event.target.value) })} /></label>
      <label>Depan / belakang · {desk.z.toFixed(2)} m<input aria-label="Posisi meja Z" type="range" min={deskZmin} max={deskZmax} step="0.25" value={desk.z} onChange={event => updateDesk({ z: Number(event.target.value) })} /></label>
      <div className="office-editor-rotate"><button type="button" onClick={() => updateDesk({ rotation: (desk.rotation + Math.PI * 1.5) % (Math.PI * 2) })}>↶ Putar 90°</button><button type="button" onClick={() => updateDesk({ rotation: (desk.rotation + Math.PI / 2) % (Math.PI * 2) })}>Putar 90° ↷</button></div>
      {colorControls(desk.color, color=>updateDesk({color}))}
      <button type="button" onClick={() => onDesksChange(desks.filter(d => d.slot !== deskSlot))}>Posisi meja semula</button>
    </fieldset>}
    {desk?.removed && <fieldset disabled={saving}><legend>Meja dihapus</legend><p>Posisi tersimpan. Pulihkan untuk menggunakan meja ini kembali.</p><button type="button" onClick={()=>updateDesk({removed:false})}>Pulihkan meja</button></fieldset>}
    {item && <fieldset disabled={saving}>
      <legend>{ORNAMENTS[item.asset].label}</legend>
      <button type="button" onClick={()=>update({},true)}>Tempel ke dinding terdekat</button>
      <label>Kiri / kanan · {item.x.toFixed(2)} m<input aria-label="Posisi ornamen X" type="range" min="-18" max="19" step="0.01" value={item.x} onChange={event => update({ x: Number(event.target.value) })} /></label>
      <label>Depan / belakang · {item.z.toFixed(2)} m<input aria-label="Posisi ornamen Z" type="range" min="-13.5" max="6" step="0.01" value={item.z} onChange={event => update({ z: Number(event.target.value) })} /></label>
      <div className="office-editor-rotate"><button type="button" onClick={() => update({ rotation: (item.rotation - Math.PI / 4 + Math.PI * 2) % (Math.PI * 2) })}>↶ Putar 45°</button><button type="button" onClick={() => update({ rotation: (item.rotation + Math.PI / 4) % (Math.PI * 2) })}>Putar 45° ↷</button></div>
      <label>Ketinggian · {(item.y || 0).toFixed(2)} m<input aria-label="Ketinggian objek" type="range" min="0" max="2" step="0.01" value={item.y || 0} onChange={event=>update({y:Number(event.target.value)})}/></label>
      <p>Gunakan 0,78 m untuk menaruh perangkat di atas meja kantor.</p>
      {colorControls(item.color, color=>update({color}))}
      <button type="button" className="office-editor-delete" onClick={() => { onChange(items.filter(current => current.id !== selected)); onSelect(''); }}>Hapus ornamen</button>
      {ornamentError(item, desks) && <p role="status">{ornamentError(item, desks)}</p>}
    </fieldset>}
    <div className="office-editor-save">
      {(message || error || layoutError) && <p role="alert">{error || message || layoutError}</p>}
      {conflict && <div role="alert"><p>Denah bersama sudah berubah. Muat versi terbaru untuk mengganti draft ini sebelum mengedit kembali.</p><button type="button" onClick={onReload} disabled={saving}>Muat denah terbaru</button></div>}
      <div className="office-editor-actions"><button type="button" onClick={()=>{ if(layoutError) setMessage(layoutError); else { setMessage(''); onSave(); } }} disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan denah'}</button><button type="button" onClick={onCancel} disabled={saving}>Batal</button></div>
    </div>
  </aside>;
}
