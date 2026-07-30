'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Clock,
  Play,
  Square,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  FileText,
  User,
  ArrowRight,
  History,
  Sparkles,
  FileCheck2,
  UserX,
  Stethoscope,
  Umbrella,
  Send,
  X,
  AlertTriangle,
} from 'lucide-react';

export interface AttendanceRecord {
  id: string;
  user_name: string;
  user_avatar: string;
  date: string; // YYYY-MM-DD
  day_name: string; // Sun, Mon, Tue, etc.
  check_in_time: string; // HH:mm:ss
  check_out_time: string; // HH:mm:ss
  duration_hours: number; // Total elapsed
  regular_hours: number; // Max 8h
  overtime_hours: number; // Excess above 8h
  status: 'HADIR' | 'ALPHA' | 'LEMBUR' | 'IZIN' | 'SAKIT' | 'CUTI';
  project_name: string;
  notes: string;
}

export default function AttendancePage() {
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    username: string;
    avatar: string;
  }>({
    id: 'user-1',
    username: 'Dinur Pradipta',
    avatar: 'https://ui-avatars.com/api/?name=Dinur+Pradipta&background=24324A&color=fff',
  });

  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDateStr, setCurrentDateStr] = useState<string>('');

  // Live Check-in State
  const [isCheckedIn, setIsCheckedIn] = useState<boolean>(false);
  const [checkInTime, setCheckInTime] = useState<string | null>(null);
  const [checkInTimestamp, setCheckInTimestamp] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Form Inputs
  const [selectedProject, setSelectedProject] = useState<string>('Bilik Strategi Workspace');
  const [notesInput, setNotesInput] = useState<string>('');
  const [projectsList, setProjectsList] = useState<string[]>([
    'Bilik Strategi Workspace',
    'Media Brand Campaign',
    'Client Strategy Consulting',
    'Internal System R&D',
  ]);

  // Attendance History & Alert Banner
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [lastCheckOutNotice, setLastCheckOutNotice] = useState<{
    type: 'success' | 'warning' | 'alpha';
    message: string;
  } | null>(null);

  // Leave / Permit Modal State
  const [showLeaveModal, setShowLeaveModal] = useState<boolean>(false);
  const [leaveType, setLeaveType] = useState<'IZIN' | 'SAKIT' | 'CUTI'>('IZIN');
  const [leaveReason, setLeaveReason] = useState<string>('');

  // 1. Fetch User & Load Attendance State on Mount
  useEffect(() => {
    async function loadUserAndData() {
      try {
        const userRes = await fetch('/api/clickup/user');
        if (userRes.ok) {
          const userData = await userRes.json();
          if (userData.user) {
            setCurrentUser({
              id: String(userData.user.id),
              username: userData.user.username,
              avatar:
                userData.user.profilePicture ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.user.username)}&background=24324A&color=fff`,
            });
          }
        }

        const projRes = await fetch('/api/clickup/projects');
        if (projRes.ok) {
          const projData = await projRes.json();
          if (Array.isArray(projData.projects) && projData.projects.length > 0) {
            setProjectsList(projData.projects.map((p: any) => p.name));
          }
        }
      } catch (err) {
        console.warn('[Attendance] User or projects fetch error', err);
      }

      // Restore active check-in state from localStorage
      const activeState = localStorage.getItem('bilik_active_attendance');
      if (activeState) {
        try {
          const parsed = JSON.parse(activeState);
          setIsCheckedIn(true);
          setCheckInTime(parsed.checkInTime);
          setCheckInTimestamp(parsed.checkInTimestamp);
          setSelectedProject(parsed.selectedProject || 'Bilik Strategi Workspace');
          setNotesInput(parsed.notesInput || '');
        } catch {
          localStorage.removeItem('bilik_active_attendance');
        }
      }

      // Restore history logs
      const historyState = localStorage.getItem('bilik_attendance_history');
      if (historyState) {
        try {
          setHistory(JSON.parse(historyState));
        } catch {
          setHistory([]);
        }
      }
    }

    loadUserAndData();
  }, []);

  // 2. Real-time Clock & Elapsed Timer Ticker
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }) + ' WIB'
      );
      setCurrentDateStr(
        now.toLocaleDateString('id-ID', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      );

      if (isCheckedIn && checkInTimestamp) {
        const diffSec = Math.floor((now.getTime() - checkInTimestamp) / 1000);
        setElapsedSeconds(diffSec > 0 ? diffSec : 0);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isCheckedIn, checkInTimestamp]);

  // 3. Handle Check-In
  const handleCheckIn = () => {
    const now = new Date();
    const startTimeStr = now.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const startTimestamp = now.getTime();

    setIsCheckedIn(true);
    setCheckInTime(startTimeStr);
    setCheckInTimestamp(startTimestamp);
    setElapsedSeconds(0);
    setLastCheckOutNotice(null);

    const activeObj = {
      user_name: currentUser.username,
      checkInTime: startTimeStr,
      checkInTimestamp: startTimestamp,
      selectedProject,
      notesInput,
    };
    localStorage.setItem('bilik_active_attendance', JSON.stringify(activeObj));
  };

  // 4. Handle Check-Out (Includes Minimum 1 Hour Threshold + Overtime Logic)
  const handleCheckOut = () => {
    if (!checkInTimestamp) return;

    const now = new Date();
    const checkOutTimeStr = now.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const diffMs = now.getTime() - checkInTimestamp;
    const durationHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));

    const dayName = now.toLocaleDateString('en-US', { weekday: 'short' }); // Sun, Mon, etc.
    const dateYMD = now.toISOString().split('T')[0];

    // Rules:
    // 1. Min 1.0 hour required -> under 1.0h is ALPHA
    // 2. Standard daily capacity = 8.0h -> excess hours go to OVERTIME (LEMBUR)
    let status: 'HADIR' | 'ALPHA' | 'LEMBUR' = 'HADIR';
    let regularHours = 0;
    let overtimeHours = 0;

    if (durationHours < 1.0) {
      status = 'ALPHA';
      regularHours = 0;
      overtimeHours = 0;
      setLastCheckOutNotice({
        type: 'alpha',
        message: `⚠️ Durasi kerja hanya ${durationHours} jam (< 1 jam). Presensi dihitung ALPHA / TIDAK BEKERJA (0h ke Timesheet).`,
      });
    } else {
      regularHours = Math.min(8.0, durationHours);
      if (durationHours > 8.0) {
        status = 'LEMBUR';
        overtimeHours = parseFloat((durationHours - 8.0).toFixed(2));
        setLastCheckOutNotice({
          type: 'warning',
          message: `🔥 Durasi kerja ${durationHours} jam. 8.0h Jam Reguler + ${overtimeHours}h LEMBUR (Overtime) berhasil terekap!`,
        });
      } else {
        status = 'HADIR';
        setLastCheckOutNotice({
          type: 'success',
          message: `✅ Presensi ${durationHours} jam berhasil dicatat dan masuk ke Timesheet!`,
        });
      }
    }

    const newRecord: AttendanceRecord = {
      id: 'att-' + Date.now(),
      user_name: currentUser.username,
      user_avatar: currentUser.avatar,
      date: dateYMD,
      day_name: dayName,
      check_in_time: checkInTime || '08:00:00',
      check_out_time: checkOutTimeStr,
      duration_hours: durationHours,
      regular_hours: regularHours,
      overtime_hours: overtimeHours,
      status: status,
      project_name: selectedProject,
      notes: notesInput || (status === 'ALPHA' ? 'Alpha: Durasi kerja kurang dari 1 jam' : 'Presensi Harian Kerja'),
    };

    // Update history
    const updatedHistory = [newRecord, ...history];
    setHistory(updatedHistory);
    localStorage.setItem('bilik_attendance_history', JSON.stringify(updatedHistory));

    // Update Timesheet Recap Store (key: bilik_timesheet_recap)
    const existingRecapStr = localStorage.getItem('bilik_timesheet_recap');
    const existingRecap: Record<string, Record<string, { regular: number; overtime: number; status: string; notes: string }>> = existingRecapStr
      ? JSON.parse(existingRecapStr)
      : {};

    if (!existingRecap[currentUser.username]) {
      existingRecap[currentUser.username] = {};
    }

    const currentEntry = existingRecap[currentUser.username][dayName] || { regular: 0, overtime: 0, status: 'HADIR', notes: '' };
    existingRecap[currentUser.username][dayName] = {
      regular: parseFloat((currentEntry.regular + regularHours).toFixed(2)),
      overtime: parseFloat((currentEntry.overtime + overtimeHours).toFixed(2)),
      status: status,
      notes: notesInput || 'Presensi Harian',
    };

    localStorage.setItem('bilik_timesheet_recap', JSON.stringify(existingRecap));

    // Reset active check-in
    setIsCheckedIn(false);
    setCheckInTime(null);
    setCheckInTimestamp(null);
    setElapsedSeconds(0);
    setNotesInput('');
    localStorage.removeItem('bilik_active_attendance');
  };

  // 5. Handle Submit Leave Request (Izin / Sakit / Cuti)
  const handleSubmitLeave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveReason.trim()) return;

    const now = new Date();
    const dayName = now.toLocaleDateString('en-US', { weekday: 'short' });
    const dateYMD = now.toISOString().split('T')[0];

    const leaveRecord: AttendanceRecord = {
      id: 'leave-' + Date.now(),
      user_name: currentUser.username,
      user_avatar: currentUser.avatar,
      date: dateYMD,
      day_name: dayName,
      check_in_time: '-',
      check_out_time: '-',
      duration_hours: 0,
      regular_hours: 0,
      overtime_hours: 0,
      status: leaveType,
      project_name: 'Pengajuan Presensi',
      notes: `${leaveType}: ${leaveReason}`,
    };

    const updatedHistory = [leaveRecord, ...history];
    setHistory(updatedHistory);
    localStorage.setItem('bilik_attendance_history', JSON.stringify(updatedHistory));

    // Timesheet Recap update for Leave
    const existingRecapStr = localStorage.getItem('bilik_timesheet_recap');
    const existingRecap: Record<string, Record<string, { regular: number; overtime: number; status: string; notes: string }>> = existingRecapStr
      ? JSON.parse(existingRecapStr)
      : {};

    if (!existingRecap[currentUser.username]) {
      existingRecap[currentUser.username] = {};
    }

    existingRecap[currentUser.username][dayName] = {
      regular: 0,
      overtime: 0,
      status: leaveType,
      notes: `${leaveType}: ${leaveReason}`,
    };

    localStorage.setItem('bilik_timesheet_recap', JSON.stringify(existingRecap));

    setShowLeaveModal(false);
    setLeaveReason('');
    setLastCheckOutNotice({
      type: 'warning',
      message: `📩 Pengajuan ${leaveType} berhasil dicatat & diperbarui di Timesheet!`,
    });
  };

  // Helper formatting for seconds to HH:MM:SS
  const formatTimer = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${String(hrs).padStart(2, '0')} : ${String(mins).padStart(2, '0')} : ${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in pb-12 relative">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E8E8EC] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-[#24324A] tracking-tight">Presensi & Live Tracker</h1>
            <span className="px-2 py-0.5 text-[10px] font-mono bg-[#EEF2F7] text-[#24324A] rounded-md border border-[#E8E8EC]">
              @bilik-strategi
            </span>
          </div>
          <p className="text-xs text-[#737680] mt-1">
            Min 1 jam bekerja (dibawah 1 jam = Alpha). Lebih dari 8 jam otomatis masuk Rekap Lembur. Pengajuan Izin/Sakit langsung terhubung ke Timesheet!
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setShowLeaveModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#F7F7F8] border border-[#E8E8EC] text-[#24324A] hover:bg-[#EEF2F7] rounded-xl text-xs font-extrabold transition-colors shadow-2xs cursor-pointer"
          >
            <FileCheck2 className="w-4 h-4 text-[#7B68EE]" />
            <span>📝 Form Izin / Sakit / Cuti</span>
          </button>

          <Link
            href="/team?tab=timesheet"
            className="flex items-center gap-2 px-4 py-2 bg-[#24324A] text-white rounded-xl text-xs font-bold hover:bg-[#1A2536] transition-colors shadow-2xs"
          >
            <span>📊 Rekap Timesheet & Lembur</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#F26B5E]" />
          </Link>
        </div>
      </div>

      {/* Alert Notice Banner */}
      {lastCheckOutNotice && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between text-xs font-bold animate-fade-in ${
            lastCheckOutNotice.type === 'alpha'
              ? 'bg-[#F26B5E]/10 border-[#F26B5E]/30 text-[#D95858]'
              : lastCheckOutNotice.type === 'warning'
              ? 'bg-[#E6A23C]/10 border-[#E6A23C]/30 text-[#B87C24]'
              : 'bg-[#4F9D78]/10 border-[#4F9D78]/30 text-[#3D8362]'
          }`}
        >
          <div className="flex items-center gap-2">
            {lastCheckOutNotice.type === 'alpha' ? (
              <UserX className="w-4 h-4 text-[#F26B5E] flex-shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 text-[#4F9D78] flex-shrink-0" />
            )}
            <span>{lastCheckOutNotice.message}</span>
          </div>
          <button onClick={() => setLastCheckOutNotice(null)} className="text-[#737680] hover:text-[#24324A] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Grid: Left Timer Panel + Right Active Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Giant Live Timer Card (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-[#E8E8EC] rounded-2xl p-6 shadow-2xs flex flex-col justify-between relative overflow-hidden">
          {/* Top Status & Date */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`w-3 h-3 rounded-full ${
                  isCheckedIn ? 'bg-[#4F9D78] animate-ping' : 'bg-[#737680]'
                }`}
              />
              <span className="text-xs font-bold text-[#24324A]">
                {isCheckedIn ? 'Status: SEDANG BEKERJA (LIVE)' : 'Status: BELUM CHECK-IN'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-[#737680] font-semibold bg-[#F7F7F8] px-3 py-1 rounded-lg border border-[#E8E8EC]">
              <Calendar className="w-3.5 h-3.5 text-[#24324A]" />
              <span>{currentDateStr || 'Hari ini'}</span>
            </div>
          </div>

          {/* Center Timer Display */}
          <div className="my-8 text-center space-y-3">
            <span className="text-[11px] font-bold text-[#737680] uppercase tracking-widest block">
              {isCheckedIn ? 'Durasi Jam Kerja Berjalan' : 'Waktu Real-Time Saat Ini'}
            </span>
            <div className="text-4xl sm:text-5xl font-extrabold font-mono tracking-tight text-[#24324A]">
              {isCheckedIn ? formatTimer(elapsedSeconds) : currentTime || '00 : 00 : 00'}
            </div>

            {isCheckedIn ? (
              <div className="space-y-1">
                {checkInTime && (
                  <p className="text-xs font-semibold text-[#4F9D78] bg-[#4F9D78]/10 inline-block px-3 py-1 rounded-full border border-[#4F9D78]/20">
                    ✓ Check-in masuk sejak pukul <b>{checkInTime} WIB</b>
                  </p>
                )}
                {elapsedSeconds < 3600 && (
                  <p className="text-[11px] font-bold text-[#D95858] block">
                    ⚠️ Butuh minimal 1:00:00 jam kerja agar presensi sah (Bukan Alpha).
                  </p>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-[#737680]">
                Syarat Presensi Sah: Minimal <b>1 Jam Kerja</b>. Di atas <b>8 Jam</b> dihitung <b>Lembur</b>.
              </p>
            )}
          </div>

          {/* Action Check-In / Check-Out Button */}
          <div>
            {!isCheckedIn ? (
              <button
                type="button"
                onClick={handleCheckIn}
                className="w-full py-4 bg-[#4F9D78] hover:bg-[#3D8362] text-white rounded-xl text-sm font-extrabold flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer transform hover:-translate-y-0.5"
              >
                <Play className="w-5 h-5 fill-white" />
                <span>🟢 CHECK-IN (MULAI BEKERJA)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCheckOut}
                className="w-full py-4 bg-[#F26B5E] hover:bg-[#D95346] text-white rounded-xl text-sm font-extrabold flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer transform hover:-translate-y-0.5"
              >
                <Square className="w-5 h-5 fill-white" />
                <span>🔴 CHECK-OUT (SELESAI & SIMPAN KE TIMESHEET)</span>
              </button>
            )}
          </div>
        </div>

        {/* Right: Active Profile & Activity Notes Form (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-[#E8E8EC] rounded-2xl p-6 shadow-2xs space-y-5">
          {/* User Badge */}
          <div className="flex items-center gap-3 p-3 bg-[#F7F7F8] border border-[#E8E8EC] rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentUser.avatar}
              alt={currentUser.username}
              className="w-11 h-11 rounded-full object-cover border-2 border-[#24324A]"
            />
            <div>
              <h4 className="text-xs font-bold text-[#24324A]">{currentUser.username}</h4>
              <span className="text-[10px] text-[#737680]">Bilik Strategi Team Member</span>
            </div>
          </div>

          {/* Form Options */}
          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-[#24324A] mb-1 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-[#24324A]" />
                Project / Focus Area
              </label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                disabled={isCheckedIn}
                className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-medium outline-none focus:border-[#24324A] transition-colors"
              >
                {projectsList.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-[#24324A] mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#24324A]" />
                Catatan Pekerjaan Harian
              </label>
              <textarea
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                disabled={isCheckedIn}
                rows={3}
                placeholder="Contoh: Mengerjakan revisi desain UI dashboard, meeting klien, dll."
                className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-medium outline-none focus:border-[#24324A] transition-colors resize-none"
              />
            </div>

            <div className="p-3 bg-[#EEF2F7] rounded-xl border border-[#E8E8EC] space-y-1.5 text-[11px] text-[#24324A]">
              <p className="font-bold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-[#7B68EE]" /> Aturan Jam Kerja Timesheet:
              </p>
              <ul className="text-[#737680] space-y-0.5 list-disc list-inside">
                <li><b>&lt; 1 Jam</b>: Dianggap <b>Alpha / Tidak Bekerja</b>.</li>
                <li><b>1 - 8 Jam</b>: Jam Kerja Reguler Harian.</li>
                <li><b>&gt; 8 Jam</b>: Kelebihan jam masuk <b>Rekap Lembur (OT)</b>.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* History Log Table */}
      <div className="bg-white border border-[#E8E8EC] rounded-2xl p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#E8E8EC] pb-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#24324A]" />
            <h3 className="text-sm font-extrabold text-[#24324A]">Riwayat Presensi & Pengajuan Izin Saya</h3>
          </div>
          <span className="text-xs font-bold text-[#737680]">{history.length} Entri Dicatat</span>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-8 text-xs text-[#737680] space-y-1">
            <p className="font-bold text-[#24324A]">Belum ada riwayat presensi</p>
            <p>Klik tombol Check-In atau Form Izin di atas untuk mulai mencatat presensi pertama Anda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F7F7F8] border-b border-[#E8E8EC] text-[#737680] font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Jam Masuk</th>
                  <th className="py-3 px-4">Jam Keluar</th>
                  <th className="py-3 px-4 text-center">Durasi Total</th>
                  <th className="py-3 px-4 text-center">Lembur (OT)</th>
                  <th className="py-3 px-4">Project / Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E8EC]">
                {history.map((rec) => (
                  <tr key={rec.id} className="hover:bg-[#F7F7F8] transition-colors">
                    <td className="py-3 px-4 font-bold text-[#24324A]">
                      {rec.date} ({rec.day_name})
                    </td>
                    <td className="py-3 px-4">
                      {rec.status === 'HADIR' && (
                        <span className="px-2.5 py-1 bg-[#4F9D78]/10 text-[#4F9D78] border border-[#4F9D78]/30 rounded-lg font-bold">
                          ✓ HADIR
                        </span>
                      )}
                      {rec.status === 'ALPHA' && (
                        <span className="px-2.5 py-1 bg-[#F26B5E]/10 text-[#F26B5E] border border-[#F26B5E]/30 rounded-lg font-bold">
                          ⚠️ ALPHA (&lt;1h)
                        </span>
                      )}
                      {rec.status === 'LEMBUR' && (
                        <span className="px-2.5 py-1 bg-[#E6A23C]/10 text-[#B87C24] border border-[#E6A23C]/30 rounded-lg font-bold">
                          🔥 LEMBUR ({rec.overtime_hours}h)
                        </span>
                      )}
                      {(rec.status === 'IZIN' || rec.status === 'SAKIT' || rec.status === 'CUTI') && (
                        <span className="px-2.5 py-1 bg-[#7B68EE]/10 text-[#7B68EE] border border-[#7B68EE]/30 rounded-lg font-bold">
                          📝 {rec.status}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-[#4F9D78] font-bold">
                      {rec.check_in_time !== '-' ? `🟢 ${rec.check_in_time}` : '-'}
                    </td>
                    <td className="py-3 px-4 font-mono text-[#F26B5E] font-bold">
                      {rec.check_out_time !== '-' ? `🔴 ${rec.check_out_time}` : '-'}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-[#24324A] bg-[#EEF2F7]/50 rounded-lg">
                      {rec.duration_hours} Jam
                    </td>
                    <td className="py-3 px-4 text-center font-extrabold text-[#E6A23C]">
                      {rec.overtime_hours > 0 ? `+${rec.overtime_hours} Jam` : '-'}
                    </td>
                    <td className="py-3 px-4 text-[#737680] max-w-xs truncate">{rec.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Form Pengajuan Izin / Sakit / Cuti */}
      {showLeaveModal && (
        <div className="fixed inset-0 bg-[#24324A]/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-[#E8E8EC] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 relative">
            <button
              onClick={() => setShowLeaveModal(false)}
              className="absolute top-4 right-4 text-[#737680] hover:text-[#24324A] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 border-b border-[#E8E8EC] pb-3">
              <FileCheck2 className="w-5 h-5 text-[#7B68EE]" />
              <h3 className="text-base font-extrabold text-[#24324A]">Form Pengajuan Izin / Cuti / Sakit</h3>
            </div>

            <form onSubmit={handleSubmitLeave} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#24324A] mb-1.5">Jenis Pengajuan Presensi</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setLeaveType('IZIN')}
                    className={`py-2 px-3 rounded-xl font-bold border transition-colors cursor-pointer text-center ${
                      leaveType === 'IZIN'
                        ? 'bg-[#24324A] text-white border-[#24324A]'
                        : 'bg-[#F7F7F8] text-[#737680] border-[#E8E8EC] hover:bg-[#EEF2F7]'
                    }`}
                  >
                    📝 Izin
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeaveType('SAKIT')}
                    className={`py-2 px-3 rounded-xl font-bold border transition-colors cursor-pointer text-center ${
                      leaveType === 'SAKIT'
                        ? 'bg-[#24324A] text-white border-[#24324A]'
                        : 'bg-[#F7F7F8] text-[#737680] border-[#E8E8EC] hover:bg-[#EEF2F7]'
                    }`}
                  >
                    🤒 Sakit
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeaveType('CUTI')}
                    className={`py-2 px-3 rounded-xl font-bold border transition-colors cursor-pointer text-center ${
                      leaveType === 'CUTI'
                        ? 'bg-[#24324A] text-white border-[#24324A]'
                        : 'bg-[#F7F7F8] text-[#737680] border-[#E8E8EC] hover:bg-[#EEF2F7]'
                    }`}
                  >
                    🏖️ Cuti
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#24324A] mb-1">Alasan / Keterangan Pengajuan</label>
                <textarea
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  rows={3}
                  required
                  placeholder="Contoh: Sakit flu berat (ada surat dokter) / Izin mendadak urusan keluarga."
                  className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-medium outline-none focus:border-[#24324A] transition-colors resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowLeaveModal(false)}
                  className="px-4 py-2 bg-[#F7F7F8] border border-[#E8E8EC] text-[#737680] hover:text-[#24324A] rounded-xl font-bold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#7B68EE] hover:bg-[#6852ED] text-white rounded-xl font-extrabold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Kirim Pengajuan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
