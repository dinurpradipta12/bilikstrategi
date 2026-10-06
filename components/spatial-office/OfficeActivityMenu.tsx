'use client';
import { useEffect, useRef } from 'react';
import { Coffee, UsersRound, Trees, Armchair, Monitor, WandSparkles, X } from 'lucide-react';
import type { OfficeActivityZone, OfficeMember } from '@/lib/spatial-office/model';
export const OFFICE_ACTIONS = [
  {zone:'pantry',label:'Ngopi',detail:'Ke pantry · 5 menit',Icon:Coffee},
  {zone:'meeting',label:'Meeting',detail:'Kursi kosong · 15 menit',Icon:UsersRound},
  {zone:'garden',label:'Ke taman',detail:'Cari udara segar · 5 menit',Icon:Trees},
  {zone:'lounge',label:'Istirahat di lounge',detail:'Duduk santai · 5 menit',Icon:Armchair},
  {zone:'desk',label:'Kembali bekerja',detail:'Fokus di meja · 5 menit',Icon:Monitor},
  {zone:'auto',label:'Otomatis',detail:'Ikuti aktivitas sesi',Icon:WandSparkles},
] as const;
export default function OfficeActivityMenu({member,activity,now,ready,busy,error,onPick,onClose}: {
  member?:OfficeMember;activity?:OfficeMember['activity'];now:number;ready:boolean;busy:boolean;error:string;
  onPick:(zone:OfficeActivityZone|'auto')=>Promise<boolean>;onClose:()=>void;
}) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const node=ref.current;node?.showModal();return ()=>node?.close();},[]);
  const active=member?.status==='working'&&!member.presenceIdle,current=activity&&activity.until>now?activity.zone:'auto';
  return <dialog ref={ref} className="office-utility-dialog office-activity-dialog" aria-labelledby="office-activity-title" onCancel={e=>{e.preventDefault();onClose();}}>
    <header><div><small>{member?.name||'AVATAR SAYA'}</small><h2 id="office-activity-title">Mau ke mana?</h2></div><button type="button" autoFocus aria-label="Tutup menu aktivitas" onClick={onClose}><X size={18}/></button></header>
    <p>Pilih aktivitas avatar. Aktivitas ini tidak mengubah status atau waktu presensi.</p>
    {!active&&<p role="status">Check-in dan pastikan sesi aktif untuk masuk ke kantor.</p>}
    <div className="office-activity-grid">{OFFICE_ACTIONS.map(({zone,label,detail,Icon})=><button type="button" key={zone} aria-pressed={current===zone} disabled={!ready||busy||!member||(!active&&zone!=='auto')} onClick={async()=>{if(await onPick(zone))onClose();}}><Icon size={24}/><strong>{label}</strong><small>{detail}</small></button>)}</div>
    {busy&&<p role="status">Menyimpan aktivitas…</p>}{error&&<p role="alert" className="office-utility-error">{error}</p>}
    {!ready&&<p role="status">Penyimpanan kantor belum terhubung.</p>}
  </dialog>;
}
