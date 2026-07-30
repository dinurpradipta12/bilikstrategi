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
} from 'lucide-react';

export interface AttendanceRecord {
  id: string;
  user_name: string;
  user_avatar: string;
  date: string; // YYYY-MM-DD
  day_name: string;
  check_in_time: string; // HH:mm:ss
  check_out_time: string; // HH:mm:ss
  duration_hours: number;
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

  // Attendance History
  const [history, setHistory] = useState<AttendanceRecord[]>([]);

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

    const activeObj = {
      user_name: currentUser.username,
      checkInTime: startTimeStr,
      checkInTimestamp: startTimestamp,
      selectedProject,
      notesInput,
    };
    localStorage.setItem('bilik_active_attendance', JSON.stringify(activeObj));
  };

  // 4. Handle Check-Out (Stop timer & recap to timesheet)
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
    const finalDuration = Math.max(0.1, durationHours); // Minimum 0.1 hour

    const dayName = now.toLocaleDateString('en-US', { weekday: 'short' }); // Sun, Mon, etc.
    const dateYMD = now.toISOString().split('T')[0];

    const newRecord: AttendanceRecord = {
      id: 'att-' + Date.now(),
      user_name: currentUser.username,
      user_avatar: currentUser.avatar,
      date: dateYMD,
      day_name: dayName,
      check_in_time: checkInTime || '08:00:00',
      check_out_time: checkOutTimeStr,
      duration_hours: finalDuration,
      project_name: selectedProject,
      notes: notesInput || 'Presensi Harian Kerja',
    };

    // Update history
    const updatedHistory = [newRecord, ...history];
    setHistory(updatedHistory);
    localStorage.setItem('bilik_attendance_history', JSON.stringify(updatedHistory));

    // Update Timesheet Recap Store (key: bilik_timesheet_recap)
    const existingRecapStr = localStorage.getItem('bilik_timesheet_recap');
    const existingRecap: Record<string, Record<string, number>> = existingRecapStr
      ? JSON.parse(existingRecapStr)
      : {};

    // User key -> Day key -> add hours
    if (!existingRecap[currentUser.username]) {
      existingRecap[currentUser.username] = {};
    }
    const currentDayHours = existingRecap[currentUser.username][dayName] || 0;
    existingRecap[currentUser.username][dayName] = parseFloat((currentDayHours + finalDuration).toFixed(2));

    localStorage.setItem('bilik_timesheet_recap', JSON.stringify(existingRecap));

    // Reset active check-in
    setIsCheckedIn(false);
    setCheckInTime(null);
    setCheckInTimestamp(null);
    setElapsedSeconds(0);
    setNotesInput('');
    localStorage.removeItem('bilik_active_attendance');
  };

  // Helper formatting for seconds to HH:MM:SS
  const formatTimer = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${String(hrs).padStart(2, '0')} : ${String(mins).padStart(2, '0')} : ${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in pb-12">
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
            Lakukan Check-In untuk memulai penghitungan jam kerja secara live. Hasil Check-Out otomatis terekap ke Timesheet tim!
          </p>
        </div>

        <Link
          href="/team?tab=timesheet"
          className="flex items-center gap-2 px-4 py-2 bg-[#24324A] text-white rounded-xl text-xs font-bold hover:bg-[#1A2536] transition-colors shadow-2xs self-start md:self-auto"
        >
          <span>📊 Lihat Rekap Timesheet</span>
          <ArrowRight className="w-3.5 h-3.5 text-[#F26B5E]" />
        </Link>
      </div>

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
            {isCheckedIn && checkInTime && (
              <p className="text-xs font-semibold text-[#4F9D78] bg-[#4F9D78]/10 inline-block px-3 py-1 rounded-full border border-[#4F9D78]/20">
                ✓ Check-in masuk sejak pukul <b>{checkInTime} WIB</b>
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

            <div className="p-3 bg-[#EEF2F7] rounded-xl border border-[#E8E8EC] space-y-1 text-[11px] text-[#24324A]">
              <p className="font-bold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-[#7B68EE]" /> Fitur Otomatis Timesheet:
              </p>
              <p className="text-[#737680]">
                Durasi jam kerja yang didapat saat Check-Out akan langsung terakumulasi ke kolom hari ini pada tabel <b>Timesheet Tim</b>.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* History Log Table */}
      <div className="bg-white border border-[#E8E8EC] rounded-2xl p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#E8E8EC] pb-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#24324A]" />
            <h3 className="text-sm font-extrabold text-[#24324A]">Riwayat Presensi Saya</h3>
          </div>
          <span className="text-xs font-bold text-[#737680]">{history.length} Entri Dicatat</span>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-8 text-xs text-[#737680] space-y-1">
            <p className="font-bold text-[#24324A]">Belum ada riwayat presensi</p>
            <p>Klik tombol Check-In di atas untuk mulai mencatat jam kerja pertama Anda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F7F7F8] border-b border-[#E8E8EC] text-[#737680] font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Project</th>
                  <th className="py-3 px-4">Jam Masuk</th>
                  <th className="py-3 px-4">Jam Keluar</th>
                  <th className="py-3 px-4 text-center">Total Durasi</th>
                  <th className="py-3 px-4">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E8EC]">
                {history.map((rec) => (
                  <tr key={rec.id} className="hover:bg-[#F7F7F8] transition-colors">
                    <td className="py-3 px-4 font-bold text-[#24324A]">
                      {rec.date} ({rec.day_name})
                    </td>
                    <td className="py-3 px-4 font-medium text-[#24324A]">{rec.project_name}</td>
                    <td className="py-3 px-4 font-mono text-[#4F9D78] font-bold">🟢 {rec.check_in_time}</td>
                    <td className="py-3 px-4 font-mono text-[#F26B5E] font-bold">🔴 {rec.check_out_time}</td>
                    <td className="py-3 px-4 text-center font-bold text-[#24324A] bg-[#EEF2F7]/50 rounded-lg">
                      {rec.duration_hours} Jam
                    </td>
                    <td className="py-3 px-4 text-[#737680] max-w-xs truncate">{rec.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
