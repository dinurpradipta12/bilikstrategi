'use client';

import { useState } from 'react';
import { AVATAR_MODELS, AVATAR_COLORS, AVATAR_LABELS, type AvatarStyle } from '@/lib/spatial-office/model';

const colors = ['Warna aset', 'Cokelat', 'Emas', 'Pink', 'Sage', 'Biru', 'Lavender', 'Krem'];
export default function AvatarEditor({ value, onChange, onSave, onClose, demo, storage }: {
  value: AvatarStyle; onChange: (value: AvatarStyle) => void; onSave: () => Promise<void>; onClose: () => void; demo: boolean; storage: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  return <form className="office-avatar-editor" onSubmit={async event => {
    event.preventDefault(); setSaving(true); setError('');
    try { await onSave(); } catch (failure) { setError(failure instanceof Error ? failure.message : 'Avatar belum tersimpan.'); }
    finally { setSaving(false); }
  }}>
    <h4>Gaya karakter</h4><p>Perubahan langsung terlihat di kantor. {demo ? 'Pilihan simulasi disimpan di browser ini.' : 'Avatar tersimpan untuk akun Anda dan terlihat oleh tim.'}</p>
    <label>Model karakter<select value={value.model} onChange={event => onChange({ ...value, model: event.target.value as AvatarStyle['model'] })}>{AVATAR_MODELS.map(model => <option key={model} value={model}>{AVATAR_LABELS[model]}</option>)}</select></label>
    <label>Gaya rambut<select value={value.hair} onChange={event => onChange({ ...value, hair: event.target.value as AvatarStyle['hair'] })}>{AVATAR_MODELS.map(model => <option key={model} value={model}>Gaya {AVATAR_LABELS[model]}</option>)}</select></label>
    {(['hairColor', 'shirtColor'] as const).map(field => <label key={field}>{field === 'hairColor' ? 'Warna rambut' : 'Warna pakaian'}<select value={value[field]} onChange={event => onChange({ ...value, [field]: event.target.value })}>{AVATAR_COLORS.map((color, i) => <option key={color} value={color}>{colors[i]}</option>)}</select></label>)}
    <label className="office-avatar-checkbox"><input type="checkbox" checked={value.glasses} onChange={event => onChange({ ...value, glasses: event.target.checked })} /> Kacamata</label>
    {!demo && !storage && <p role="status">Pratinjau tersedia. Penyimpanan akun belum terhubung ke database.</p>}
    {error && <p role="alert">{error}</p>}
    <div className="office-demo-controls"><button type="submit" disabled={saving || (!demo && !storage)}>{saving ? 'Menyimpan…' : 'Simpan avatar'}</button><button type="button" disabled={saving} onClick={onClose}>Batal</button></div>
  </form>;
}
