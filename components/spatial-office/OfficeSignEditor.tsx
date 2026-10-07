'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Type, X } from 'lucide-react';
import type { SharedOfficeAction } from '@/lib/spatial-office/space';

type Props = {
  value: string;
  ready: boolean;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (action: SharedOfficeAction) => Promise<boolean>;
};

export default function OfficeSignEditor({ value, ready, busy, error, onClose, onSave }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState(value);

  useEffect(() => {
    const node=dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (await onSave({ type: 'sign', text })) onClose();
  };

  return <dialog ref={dialog} className="office-sign-dialog office-utility-dialog" aria-labelledby="office-sign-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <header><div><small>BRANDING KANTOR</small><h2 id="office-sign-title"><Type size={22} /> Tulisan neon</h2></div><button type="button" autoFocus onClick={onClose} aria-label="Tutup pengaturan neon"><X size={18} /></button></header>
    <p>Ganti tulisan pada neon box depan kantor. Perubahan langsung terlihat oleh seluruh tim.</p>
    <form onSubmit={save}>
      <label>Teks neon<input aria-label="Teks neon kantor" value={text} onChange={event => setText(event.target.value)} maxLength={48} required placeholder="Bilik Strategi Agency" /></label>
      <div><small>{text.length}/48 karakter</small><button type="submit" disabled={!ready || busy || !text.trim()}>{busy ? 'Menyimpan…' : 'Simpan tulisan'}</button></div>
    </form>
    {error && <p role="alert" className="office-utility-error">{error}</p>}
    {!ready && <p role="status">Penyimpanan kantor belum terhubung.</p>}
  </dialog>;
}
