'use client';

import { useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Info,
  Loader2,
  LockKeyhole,
  Send,
  X,
} from 'lucide-react';

export type HolidayAccessSnapshot = {
  date: string;
  nextWorkingLabel: string;
  requestStatus: 'none' | 'pending' | 'approved' | 'rejected';
  requestReason?: string;
};

type HolidayAccessBlockProps = {
  access: HolidayAccessSnapshot;
};

function formatHolidayDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function HolidayAccessBlock({ access }: HolidayAccessBlockProps) {
  const [showRequestForm, setShowRequestForm] = useState(access.requestStatus === 'rejected');
  const [reason, setReason] = useState(access.requestReason || '');
  const [requestStatus, setRequestStatus] = useState(access.requestStatus);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submitRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setError('Alasan izin wajib diisi.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/attendance/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'request_access',
          request_date: access.date,
          reason: trimmedReason,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Gagal mengirim permintaan izin.');

      setRequestStatus(data.request?.status || 'pending');
      setShowRequestForm(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Gagal mengirim permintaan izin.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F7F7F8] dark:bg-[#171A20] text-[#24324A] dark:text-[#F4F6FA] flex items-center justify-center p-4 sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="holiday-access-title"
        className="w-full max-w-lg bg-white dark:bg-[#20242C] border border-[#E8E8EC] dark:border-[#303742] rounded-3xl shadow-xl overflow-hidden"
      >
        <div className="bg-[#24324A] dark:bg-[#1F2733] px-6 py-5 sm:px-8 sm:py-6 text-white">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center flex-shrink-0">
              <LockKeyhole className="w-6 h-6 text-[#F26B5E]" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.16em] font-extrabold text-white/60">Akses Workspace</p>
              <h1 id="holiday-access-title" className="text-xl sm:text-2xl font-extrabold mt-1">Hari ini Libur bekerja</h1>
              <p className="text-xs text-white/65 mt-2">{formatHolidayDate(access.date)}</p>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-5">
          <p className="text-sm leading-6 text-[#737680] dark:text-[#98A2B3]">
            Silakan kembali lagi di jam kerja {access.nextWorkingLabel} untuk mengerjakan pekerjaan lanjutan atau minta izin kepada admin.
          </p>

          <div className="flex items-start gap-3 p-4 rounded-2xl bg-[#EEF2F7] dark:bg-[#2A3340] border border-[#E8E8EC] dark:border-[#303742]">
            <Clock3 className="w-4 h-4 mt-0.5 text-[#7B68EE] flex-shrink-0" />
            <div>
              <p className="text-xs font-extrabold text-[#24324A] dark:text-[#F4F6FA]">Jadwal kerja berikutnya</p>
              <p className="text-xs text-[#737680] dark:text-[#98A2B3] mt-1">{access.nextWorkingLabel}</p>
            </div>
          </div>

          {requestStatus === 'pending' && (
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-[#FFF8E7] dark:bg-[#3D321F] border border-[#E6A23C]/30 text-[#8C641F] dark:text-[#E9A955]">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-extrabold">Permintaan izin sedang menunggu persetujuan admin.</p>
                <p className="text-[11px] mt-1">Halaman akan terbuka otomatis setelah admin menyetujui permintaan ini.</p>
              </div>
            </div>
          )}

          {requestStatus === 'rejected' && !showRequestForm && (
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-[#FFF0ED] dark:bg-[#3B272B] border border-[#F26B5E]/30 text-[#D95858] dark:text-[#EF7373]">
              <X className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p className="text-xs font-extrabold">Permintaan izin sebelumnya ditolak. Anda dapat mengajukan kembali dengan alasan yang lebih lengkap.</p>
            </div>
          )}

          {showRequestForm ? (
            <form onSubmit={submitRequest} className="space-y-3">
              <label className="block text-xs font-extrabold text-[#24324A] dark:text-[#F4F6FA]" htmlFor="holiday-access-reason">
                Alasan minta izin masuk
              </label>
              <textarea
                id="holiday-access-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={4}
                maxLength={1000}
                placeholder="Contoh: Ada revisi klien yang harus diselesaikan hari ini."
                className="w-full resize-none rounded-2xl border border-[#E8E8EC] dark:border-[#303742] bg-white dark:bg-[#171A20] px-4 py-3 text-sm text-[#24324A] dark:text-[#F4F6FA] outline-none focus:border-[#7B68EE]"
                disabled={saving}
                autoFocus
              />
              {error && <p className="text-xs font-bold text-[#D95858]">{error}</p>}
              <div className="flex items-center justify-end gap-2 pt-1">
                {requestStatus === 'rejected' && (
                  <button
                    type="button"
                    onClick={() => setShowRequestForm(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-[#737680] hover:text-[#24324A] dark:hover:text-white cursor-pointer"
                    disabled={saving}
                  >
                    Batal
                  </button>
                )}
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#24324A] dark:bg-[#F26B5E] px-4 py-2.5 text-xs font-extrabold text-white hover:opacity-90 cursor-pointer disabled:opacity-60"
                  disabled={saving}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Kirim permintaan izin
                </button>
              </div>
            </form>
          ) : requestStatus !== 'pending' && (
            <button
              type="button"
              onClick={() => {
                setError('');
                setShowRequestForm(true);
              }}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#24324A] dark:bg-[#F26B5E] px-4 py-3 text-xs font-extrabold text-white hover:opacity-90 cursor-pointer"
            >
              <CalendarDays className="w-4 h-4" />
              Minta izin masuk hari ini
            </button>
          )}

          {requestStatus === 'approved' && (
            <div className="flex items-center gap-2 text-xs font-extrabold text-[#4F9D78]">
              <CheckCircle2 className="w-4 h-4" />
              Izin Anda sudah disetujui. Muat ulang halaman untuk melanjutkan.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
