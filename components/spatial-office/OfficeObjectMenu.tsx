'use client';

import { useEffect, useRef, useState } from 'react';
import { Move, UserRoundCheck, UsersRound, Trash2, X } from 'lucide-react';
import type { ObjectMenuTarget } from '@/lib/spatial-office/scene';
import type { OfficeMember } from '@/lib/spatial-office/model';

export default function OfficeObjectMenu({ target, title, slot, owner, viewerId, members, canEdit, ready, busy, hasDraft, error, onClose, onEdit, onClaim, onAssign, onDelete }: {
  target: ObjectMenuTarget; title: string; slot: number | null; owner?: OfficeMember; viewerId?: string;
  members: OfficeMember[]; canEdit: boolean; ready: boolean; busy: boolean; hasDraft: boolean; error: string;
  onClose: () => void; onEdit: () => void; onClaim: () => void; onAssign: (id:string) => void; onDelete: () => void;
}) {
  const root=useRef<HTMLDivElement>(null);
  const [pane,setPane]=useState<'assign'|'delete'|null>(null);
  const [memberId,setMemberId]=useState('');
  useEffect(()=>{
    root.current?.focus();
    const outside=(event:PointerEvent)=>{ if(!root.current?.contains(event.target as Node)) onClose(); };
    const escape=(event:KeyboardEvent)=>{ if(event.key==='Escape') { event.preventDefault(); onClose(); } };
    document.addEventListener('pointerdown',outside); document.addEventListener('keydown',escape);
    return ()=>{ document.removeEventListener('pointerdown',outside); document.removeEventListener('keydown',escape); };
  },[onClose]);
  const locked=busy||!ready;
  const claimReason=slot===null?'Klaim tersedia untuk meja kerja.':hasDraft?'Simpan denah terlebih dahulu.':owner?owner.id===viewerId?'Ini meja Anda.':`Meja milik ${owner.name}.`:'Klaim meja';
  return <div ref={root} tabIndex={-1} role="dialog" aria-label="Menu objek kantor" className="office-object-menu"
    style={{left:`clamp(10px, ${target.x}%, calc(100% - 290px))`,top:`clamp(10px, ${target.y}%, calc(100% - ${pane?330:150}px))`}}>
    <header><div><strong>{title}</strong><small>{owner?owner.name:slot!==null?'Belum diklaim':'Ornamen kantor'}</small></div><button type="button" aria-label="Tutup menu objek" onClick={onClose}><X size={15}/></button></header>
    <div className="office-object-actions" role="group" aria-label="Aksi objek">
      <button type="button" disabled={!canEdit||locked} title={canEdit?'Edit posisi':'Khusus admin'} onClick={onEdit}><Move size={19}/><span>Edit posisi</span></button>
      <button type="button" disabled={locked||slot===null||!viewerId||Boolean(owner)||hasDraft} title={claimReason} onClick={onClaim}><UserRoundCheck size={19}/><span>Klaim meja</span></button>
      <button type="button" disabled={!canEdit||locked||slot===null||hasDraft} title={hasDraft?'Simpan denah terlebih dahulu.':canEdit?'Set meja untuk tim':'Khusus admin'} aria-expanded={pane==='assign'} onClick={()=>setPane(pane==='assign'?null:'assign')}><UsersRound size={19}/><span>Set untuk tim</span></button>
      <button type="button" className="is-danger" disabled={!canEdit||locked} title={canEdit?'Hapus objek':'Khusus admin'} aria-expanded={pane==='delete'} onClick={()=>setPane(pane==='delete'?null:'delete')}><Trash2 size={19}/><span>Hapus objek</span></button>
    </div>
    {pane==='assign' && <div className="office-object-form"><label>Anggota tim<select aria-label="Anggota penerima meja" value={memberId} onChange={e=>setMemberId(e.target.value)} disabled={busy}><option value="">Pilih anggota…</option>{members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      {owner&&memberId&&owner.id!==memberId&&<p>Meja {owner.name} akan ditukar dengan meja anggota pilihan.</p>}
      <button type="button" disabled={!memberId||busy} onClick={()=>onAssign(memberId)}>{busy?'Menyimpan…':'Tetapkan meja'}</button></div>}
    {pane==='delete'&&<div className="office-object-form"><p>{slot!==null?`Hapus meja beserta kursi dan perangkatnya? ${owner?`${owner.name} akan dipindahkan ke meja kosong.`:'Meja dapat dipulihkan melalui Edit ruangan.'}`:'Hapus objek ini dari kantor?'}</p><button type="button" className="is-danger" disabled={busy} onClick={onDelete}>{busy?'Menghapus…':'Hapus objek ini'}</button></div>}
    {hasDraft&&slot!==null&&<p>Penghapusan masuk ke draft. Klik Simpan denah untuk menerapkannya.</p>}
    {error&&<p role="alert">{error}</p>}
  </div>;
}
