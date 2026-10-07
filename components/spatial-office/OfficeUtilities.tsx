'use client';
import { useEffect, useRef, useState } from 'react';
import { ROOM_LIGHTS, lightEnabled, type OfficeSpace, type SharedOfficeAction, type StickyNote, type LightMode } from '@/lib/spatial-office/space';

type Props={space:OfficeSpace;room:number;night:boolean;boardId:string|null;viewerId:string;canEdit:boolean;busy:boolean;ready:boolean;error:string;onSave:(action:SharedOfficeAction)=>Promise<boolean>;onClose:()=>void;onEdit:()=>void;names:Record<string,string>};
export default function OfficeUtilities({space,room,night,boardId,viewerId,canEdit,busy,ready,error,onSave,onClose,onEdit,names}:Props) {
  const dialog=useRef<HTMLDialogElement>(null),closeRef=useRef(onClose);
  const [editing,setEditing]=useState<StickyNote|null>(null),[text,setText]=useState(''),[color,setColor]=useState('yellow');
  useEffect(()=>{closeRef.current=onClose;},[onClose]);
  useEffect(()=>{const node=dialog.current;if(boardId)node?.showModal();else node?.show();const outside=(event:PointerEvent)=>{if(node&&!node.contains(event.target as Node))closeRef.current();};if(!boardId)document.addEventListener('pointerdown',outside);return ()=>{document.removeEventListener('pointerdown',outside);node?.close();};},[boardId]);
  const save=async()=>{if(await onSave({type:'note',boardId:boardId!,id:editing?.id||crypto.randomUUID(),text,color,expectedRevision:editing?.revision||0})) {setText('');setColor('yellow');setEditing(null);}};
  const saveLight=(key:string,mode:LightMode)=>void onSave({type:'light',key:`${room}:${key}`,mode});
  return <dialog ref={dialog} className={`office-utility-dialog${boardId?'':' office-light-popover'}`} aria-labelledby="office-utility-title" onCancel={event=>{event.preventDefault();onClose();}}>
    <header><div><small>AREA {room+1}</small><h2 id="office-utility-title">{boardId?'Papan ide tim':'Lampu ruangan'}</h2></div><button type="button" autoFocus onClick={onClose} aria-label="Tutup panel">×</button></header>
    {boardId?<>
      <p>Catatan bersama untuk ide, pengingat, dan pekerjaan tim.</p>
      {canEdit&&<button type="button" onClick={onEdit}>Geser / atur papan tulis</button>}
      <div className="office-sticky-grid">{space.notes.filter(n=>n.boardId===boardId).map(note=><article key={note.id} data-color={note.color}><p>{note.text}</p><small>{names[note.authorId]||'Anggota tim'}</small>{(canEdit||note.authorId===viewerId)&&<footer><button type="button" disabled={busy||!ready} onClick={()=>{setEditing(note);setText(note.text);setColor(note.color);}}>Edit</button><button type="button" disabled={busy||!ready} onClick={()=>void onSave({type:'note',boardId,id:note.id,text:note.text,color:note.color,expectedRevision:note.revision,remove:true})}>Hapus</button></footer>}</article>)}</div>
      {!space.notes.some(n=>n.boardId===boardId)&&<p className="office-notes-empty">Belum ada catatan. Tulis ide pertama tim di sini.</p>}
      <form onSubmit={event=>{event.preventDefault();void save();}}><label>{editing?'Edit catatan':'Catatan baru'}<textarea aria-label="Isi sticky note" required maxLength={500} rows={3} value={text} onChange={event=>setText(event.target.value)} placeholder="Tulis ide atau pengingat…"/></label><div className="office-note-form-actions"><select aria-label="Warna sticky note" value={color} onChange={event=>setColor(event.target.value)}><option value="yellow">Kuning</option><option value="pink">Merah muda</option><option value="blue">Biru</option><option value="green">Hijau</option></select><button type="submit" disabled={busy||!ready||!text.trim()}>{busy?'Menyimpan…':editing?'Simpan catatan':'Tambah catatan'}</button>{editing&&<button type="button" onClick={()=>{setEditing(null);setText('');}}>Batal</button>}</div></form>
    </>:<><p className="office-light-help">Denah lampu area {room+1}. Saklar mengatur nyala atau mati; pilih <strong>Auto</strong> untuk mengikuti jadwal malam.</p><div className="office-light-map" aria-label="Denah dan saklar lampu ruangan">{Object.entries(ROOM_LIGHTS).map(([key,roomLight])=>{const mode=space.lights[`${room}:${key}`]||'auto',isOn=lightEnabled(mode,night);return <section key={key} className={`office-light-room room-${key}`} aria-label={roomLight.label}><span className="office-light-room-name">{roomLight.label}</span><span className="office-light-status" data-on={isOn}>{isOn?'Menyala':'Mati'}</span><div className="office-light-controls"><button type="button" role="switch" aria-checked={isOn} aria-label={`Saklar lampu ${roomLight.label}`} disabled={busy||!ready} className="office-light-switch" onClick={()=>saveLight(key,isOn?'off':'on')}><i/></button><button type="button" className="office-light-auto" aria-pressed={mode==='auto'} disabled={busy||!ready||mode==='auto'} onClick={()=>saveLight(key,'auto')}>Auto</button></div></section>;})}</div></>}
    {error&&<p role="alert" className="office-utility-error">{error}</p>}
    {!ready&&<p role="status">Penyimpanan kantor belum terhubung.</p>}
  </dialog>;
}
