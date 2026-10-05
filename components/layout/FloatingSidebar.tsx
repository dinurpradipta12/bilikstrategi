'use client';
import { useEffect, useRef, useState } from 'react';
import { PanelRightOpen, X } from 'lucide-react';
import Sidebar from './Sidebar';

export default function FloatingSidebar() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const first = panel.current?.querySelector<HTMLElement>('a,button'); first?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); }
      if (event.key !== 'Tab') return;
      const items = [...(panel.current?.querySelectorAll<HTMLElement>('a[href],button:not([hidden]):not([disabled])') || [])].filter(el => el.offsetParent !== null);
      const index = items.indexOf(document.activeElement as HTMLElement), next = event.shiftKey ? index - 1 : index + 1;
      if (next < 0 || next >= items.length) { event.preventDefault(); items[(next + items.length) % items.length]?.focus(); }
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [open]);
  return <>
    <button ref={trigger} type="button" className="fixed right-4 top-1/2 z-[90] grid h-11 w-11 -translate-y-1/2 place-items-center rounded-2xl border border-[#cad7cc] bg-white/95 text-[#395746] shadow-lg" aria-label="Buka sidebar aplikasi" aria-expanded={open} aria-controls="office-floating-sidebar" onClick={() => setOpen(v => !v)}><PanelRightOpen size={20} /></button>
    {open && <div id="office-floating-sidebar" ref={panel} role="dialog" aria-modal="true" aria-label="Navigasi aplikasi" className="fixed inset-0 z-[110]" onClick={event => { if ((event.target as HTMLElement).closest('a')) setOpen(false); }}>
      <button type="button" aria-label="Tutup sidebar" className="absolute inset-0 bg-[#17282c]/25 backdrop-blur-[2px]" onClick={() => { setOpen(false); trigger.current?.focus(); }} />
      <Sidebar floating />
      <button type="button" aria-label="Tutup navigasi" className="fixed right-[16.5rem] top-4 z-50 rounded-xl border bg-white p-2 text-[#395746]" onClick={() => { setOpen(false); trigger.current?.focus(); }}><X size={18} /></button>
    </div>}
  </>;
}
