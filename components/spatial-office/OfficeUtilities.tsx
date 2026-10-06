'use client';
import { useEffect, useRef, useState } from 'react';
import { ROOM_LIGHTS, lightEnabled, type OfficeSpace, type SharedOfficeAction, type StickyNote, type LightMode } from '@/lib/spatial-office/space';

type Props={space:OfficeSpace;room:number;night:boolean;boardId:string|null;viewerId:string;canEdit:boolean;busy:boolean;ready:boolean;error:string;onSave:(action:SharedOfficeAction)=>Promise<boolean>;onClose:()=>void;onEdit:()=>void;names:Record<string,string>};
export default function OfficeUtilities({space,room,night,boardId,viewerId,canEdit,busy,ready,error,onSave,onClose,onEdit,names}:Props) {
  const dialog=useRef<HTMLDialogElement>(null);
  const [editing,setEditing]=useState<StickyNote|null>(null),[text,setText]=useState(''),[color,setColor]=useState('yellow');
  useEffect(()=>{const node=dialog.current;node?.showModal();return ()=>node?.close();},[]);
  const save=async()=>{if(await onSave({type:'note',boardId:boardId!,id:editing?.id||crypto.randomUUID(),text,color,expectedRevision:editing?.revision||0})) {setText('');setColor('yellow');setEditing(null);}};
  return <dialog ref={dialog} className="office-utility-dialog" aria-labelledby="office-utility-title" onCancel={event=>{event.preventDefault();onClose();}}>
    <header><div><small>AREA {room+1}</small><h2 id="office-utility-title">{boardId?'Papan ide tim':'Lampu ruangan'}</h2></div><button type="button" autoFocus onClick={onClose} aria-label="Tutup panel">×</button></header>
    {boardId?<>
      <p>Catatan bersama untuk ide, pengingat, dan pekerjaan tim.</p>
      {canEdit&&<button type="button" onClick={onEdit}>Geser / atur papan tulis</button>}
      <div className="office-sticky-grid">{space.notes.filter(n=>n.boardId===boardId).map(note=><article key={note.id} data-color={note.color}><p>{note.text}</p><small>{names[note.authorId]||'Anggota tim'}</small>{(canEdit||note.authorId===viewerId)&&<footer><button type="button" disabled={busy||!ready} onClick={()=>{setEditing(note);setText(note.text);setColor(note.color);}}>Edit</button><button type="button" disabled={busy||!ready} onClick={()=>void onSave({type:'note',boardId,id:note.id,text:note.text,color:note.color,expectedRevision:note.revision,remove:true})}>Hapus</button></footer>}</article>)}</div>
      {!space.notes.some(n=>n.boardId===boardId)&&<p className="office-notes-empty">Belum ada catatan. Tulis ide pertama tim di sini.</p>}
      <form onSubmit={event=>{event.preventDefault();void save();}}><label>{editing?'Edit catatan':'Catatan baru'}<textarea aria-label="Isi sticky note" required maxLength={500} rows={3} value={text} onChange={event=>setText(event.target.value)} placeholder="Tulis ide atau pengingat…"/></label><div className="office-note-form-actions"><select aria-label="Warna sticky note" value={color} onChange={event=>setColor(event.target.value)}><option value="yellow">Kuning</option><option value="pink">Merah muda</option><option value="blue">Biru</option><option value="green">Hijau</option></select><button type="submit" disabled={busy||!ready||!text.trim()}>{busy?'Menyimpan…':editing?'Simpan catatan':'Tambah catatan'}</button>{editing&&<button type="button" onClick={()=>{setEditing(null);setText('');}}>Batal</button>}</div></form>
    </>:<><p>Mode Otomatis menyalakan lampu saat malam menurut jam kantor. Pilihan manual berlaku sampai diubah kembali.</p><div className="office-lights-list">{Object.entries(ROOM_LIGHTS).map(([key,roomLight])=>{const mode=space.lights[`${room}:${key}`]||'auto';return <label key={key}><span><i data-on={lightEnabled(mode,night)}/>{roomLight.label}<small>{lightEnabled(mode,night)?'Menyala':'Mati'}</small></span><select aria-label={`Lampu ${roomLight.label}`} disabled={busy||!ready} value={mode} onChange={event=>void onSave({type:'light',key:`${room}:${key}`,mode:event.target.value as LightMode})}><option value="auto">Otomatis</option><option value="on">Nyala</option><option value="off">Mati</option></select></label>;})}</div></>}
    {error&&<p role="alert" className="office-utility-error">{error}</p>}
    {!ready&&<p role="status">Penyimpanan kantor belum terhubung.</p>}
  </dialog>;
}
