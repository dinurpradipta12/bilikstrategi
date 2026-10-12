'use client';

import { useState } from 'react';
import {
  CalendarClock,
  CalendarOff,
  Check,
  Eye,
  Loader2,
  Save,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useHolidayAccess } from '@/components/auth/HolidayAccessContext';
import { DEFAULT_HOLIDAY_CONTROL, type HolidayControl } from '@/lib/attendance/schedule';

type HolidayDraft = {
  manualActive: boolean;
  scheduledEnabled: boolean;
  scheduledStart: string;
  scheduledEnd: string;
  message: string;
};

function localInputValue(value?: string | null) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultScheduleWindow() {
  const start = new Date();
  start.setSeconds(0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  end.setHours(8, 30, 0, 0);
  return { start: localInputValue(start.toISOString()), end: localInputValue(end.toISOString()) };
}

function draftFromControl(control?: HolidayControl | null): HolidayDraft {
  const defaults = defaultScheduleWindow();
  const source = control || DEFAULT_HOLIDAY_CONTROL;
  return {
    manualActive: source.manualActive,
    scheduledEnabled: source.scheduledEnabled,
    scheduledStart: localInputValue(source.scheduledStart) || defaults.start,
    scheduledEnd: localInputValue(source.scheduledEnd) || defaults.end,
    message: source.message || DEFAULT_HOLIDAY_CONTROL.message,
  };
}

function inputDateToIso(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export default function HolidayAdminControl({ onPreview }: { onPreview?: (message: string | null) => void }) {
  const { access, refresh } = useHolidayAccess();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<HolidayDraft>(() => draftFromControl(access?.control));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (!access?.isAdmin) return null;

  const save = async (next: HolidayDraft, successMessage: string) => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const scheduledStart = next.scheduledEnabled ? inputDateToIso(next.scheduledStart) : null;
      const scheduledEnd = next.scheduledEnabled ? inputDateToIso(next.scheduledEnd) : null;
      if (next.scheduledEnabled && (!scheduledStart || !scheduledEnd)) {
        throw new Error('Waktu mulai dan selesai jadwal wajib diisi.');
      }
      const response = await fetch('/api/attendance/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_holiday_control',
          manual_active: next.manualActive,
          scheduled_enabled: next.scheduledEnabled,
          scheduled_start: scheduledStart,
          scheduled_end: scheduledEnd,
          message: next.message,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Pengaturan hari libur belum tersimpan.');
      setMessage(successMessage);
      refresh();
      return true;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Pengaturan hari libur belum tersimpan.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const toggleManual = async (active: boolean) => {
    const previous = draft;
    const next = { ...draft, manualActive: active };
    setDraft(next);
    const saved = await save(next, active ? 'Workspace dikunci untuk anggota.' : 'Workspace dibuka kembali untuk anggota.');
    if (!saved) {
      setDraft(previous);
      return;
    }
    onPreview?.(active ? (next.message.trim() || DEFAULT_HOLIDAY_CONTROL.message) : null);
  };

  const saveSchedule = async () => {
    if (draft.scheduledEnabled && (!draft.scheduledStart || !draft.scheduledEnd)) {
      setError('Waktu mulai dan selesai jadwal wajib diisi.');
      return;
    }
    const saved = await save(draft, 'Jadwal hari libur berhasil disimpan.');
    if (saved) setOpen(false);
  };

  const active = access.isHoliday;

  return (
    <div className="office-holiday-admin" data-open={open}>
      <div className="office-holiday-admin-compact">
        <div>
          <ShieldCheck size={13} />
          <span><strong>Mode libur</strong><small>{active ? 'Anggota terkunci' : 'Workspace terbuka'}</small></span>
        </div>
        <label className="office-holiday-switch" title="Tutup atau buka workspace anggota sekarang">
          <input
            type="checkbox"
            checked={draft.manualActive}
            onChange={(event) => void toggleManual(event.target.checked)}
            disabled={saving || !access.storageReady}
          />
          <span aria-hidden="true" />
          <em>{draft.manualActive ? 'Libur' : 'Aktif'}</em>
        </label>
        <button
          type="button"
          className="office-holiday-schedule-button"
          onClick={() => {
            if (!open) setDraft(draftFromControl(access.control));
            setOpen((value) => !value);
          }}
          aria-expanded={open}
          aria-controls="office-holiday-admin-panel"
          title="Atur jadwal hari libur"
        >
          <CalendarClock size={15} />
        </button>
      </div>

      {open && (
        <section id="office-holiday-admin-panel" className="office-holiday-admin-panel" aria-label="Pengaturan hari libur admin">
          <header>
            <span><CalendarOff size={17} /></span>
            <div><strong>Kontrol hari libur</strong><small>Khusus Owner dan Admin</small></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Tutup pengaturan hari libur"><X size={15} /></button>
          </header>

          <div className="office-holiday-admin-body">
            <div className="office-holiday-admin-note">
              <ShieldCheck size={14} />
              <p>Admin tetap dapat memakai seluruh aplikasi. Anggota hanya melihat dashboard kantor dalam keadaan terkunci.</p>
            </div>

            <label className="office-holiday-setting-row">
              <span><strong>Tutup sekarang</strong><small>Aktif sampai slider dimatikan kembali.</small></span>
              <input
                type="checkbox"
                checked={draft.manualActive}
                onChange={(event) => void toggleManual(event.target.checked)}
                disabled={saving || !access.storageReady}
              />
            </label>

            <label className="office-holiday-setting-row">
              <span><strong>Jadwalkan penutupan</strong><small>Workspace mengunci dan membuka otomatis.</small></span>
              <input
                type="checkbox"
                checked={draft.scheduledEnabled}
                onChange={(event) => setDraft((current) => ({ ...current, scheduledEnabled: event.target.checked }))}
                disabled={saving || !access.storageReady}
              />
            </label>

            {draft.scheduledEnabled && (
              <div className="office-holiday-date-grid">
                <label><span>Mulai libur</span><input type="datetime-local" value={draft.scheduledStart} onChange={(event) => setDraft((current) => ({ ...current, scheduledStart: event.target.value }))} disabled={saving} /></label>
                <label><span>Buka kembali</span><input type="datetime-local" value={draft.scheduledEnd} onChange={(event) => setDraft((current) => ({ ...current, scheduledEnd: event.target.value }))} disabled={saving} /></label>
              </div>
            )}

            <label className="office-holiday-message-field">
              <span>Pesan untuk tim</span>
              <textarea value={draft.message} onChange={(event) => setDraft((current) => ({ ...current, message: event.target.value.slice(0, 240) }))} rows={3} maxLength={240} disabled={saving} />
              <small>{draft.message.length}/240</small>
            </label>

            {!access.storageReady && <p className="office-holiday-error">Penyimpanan server belum tersedia. Periksa koneksi Supabase dan service role.</p>}
            {error && <p className="office-holiday-error">{error}</p>}
            {message && <p className="office-holiday-success"><Check size={13} /> {message}</p>}
          </div>

          <footer>
            <button
              type="button"
              className="is-preview"
              onClick={() => onPreview?.(draft.message.trim() || DEFAULT_HOLIDAY_CONTROL.message)}
            >
              <Eye size={14} /> Pratinjau pesan
            </button>
            <button type="button" onClick={() => setOpen(false)} disabled={saving}>Batal</button>
            <button type="button" className="is-primary" onClick={() => void saveSchedule()} disabled={saving || !access.storageReady}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan jadwal
            </button>
          </footer>
        </section>
      )}
    </div>
  );
}
