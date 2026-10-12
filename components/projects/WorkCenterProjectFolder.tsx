'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarRange,
  CheckCircle2,
  CircleDashed,
  Clock3,
  FolderKanban,
  Timer,
  Users,
} from 'lucide-react';
import type { WorkCenterProjectSnapshot } from '@/lib/projects/work-center-snapshot';

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}j ${minutes}m` : `${minutes}m`;
}

function readableStatus(status: string) {
  const key = status.toLocaleLowerCase('en-US');
  if (['done', 'completed', 'closed'].includes(key)) return 'Selesai';
  if (key === 'in_progress') return 'Sedang berjalan';
  if (key === 'review') return 'Review';
  return status.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function presenceLabel(status: WorkCenterProjectSnapshot['members'][number]['status']) {
  if (status === 'working') return 'Sedang bekerja';
  if (status === 'paused') return 'Istirahat';
  return 'Offline';
}

export default function WorkCenterProjectFolder({ snapshot }: { snapshot: WorkCenterProjectSnapshot }) {
  const progress = snapshot.taskCount ? Math.min(100, Math.round(snapshot.completedTasks / snapshot.taskCount * 100)) : 0;
  const openTasks = snapshot.tasks.filter(task => !task.done);
  const completedTasks = snapshot.tasks.filter(task => task.done);

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/office-workcenter-preview" className="inline-flex items-center gap-2 text-xs font-semibold text-[#66706C] transition-colors hover:text-[#243D32]">
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Work Center
        </Link>
        <Link href="/projects" className="inline-flex items-center gap-2 rounded-lg border border-[#D9E1D8] bg-white px-3 py-2 text-xs font-semibold text-[#46604E] transition-colors hover:bg-[#F3F7F1]">
          Buka Project Hub <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <section className="overflow-hidden rounded-2xl border border-[#DCE5DA] bg-white shadow-[0_16px_45px_rgba(51,75,58,0.08)]">
        <div className="grid gap-6 bg-gradient-to-br from-[#F5F9F3] via-white to-[#EEF5EB] p-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:p-8">
          <div className="min-w-0">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#DDEBDA] text-[#46654D]">
              <FolderKanban className="h-6 w-6" />
            </div>
            <p className="text-[10px] font-bold tracking-[0.16em] text-[#7B8B7A]">PROJECT FOLDER · WORK CENTER</p>
            <h1 className="mt-2 truncate text-2xl font-bold text-[#243D32]">{snapshot.name}</h1>
            <p className="mt-2 max-w-2xl text-xs leading-6 text-[#748078]">
              Ringkasan ini berasal dari task, presensi, dan waktu kerja tim yang sedang tercatat di Work Center.
            </p>
          </div>
          <div className="rounded-2xl border border-[#DCE6DA] bg-white/85 p-5 backdrop-blur">
            <div className="flex items-end justify-between gap-4">
              <div><span className="text-[10px] font-bold tracking-[0.12em] text-[#899487]">PROGRESS</span><strong className="mt-1 block text-3xl text-[#36523E]">{progress}%</strong></div>
              <span className="text-right text-[11px] text-[#7F8B7D]">{snapshot.completedTasks} dari {snapshot.taskCount} task selesai</span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#E5ECE2]"><span className="block h-full rounded-full bg-[#698C6F]" style={{ width: `${progress}%` }} /></div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[#E2E7E0] bg-white p-4"><CheckCircle2 className="h-4 w-4 text-[#64836A]" /><strong className="mt-3 block text-xl text-[#2F4637]">{snapshot.taskCount}</strong><span className="text-[11px] text-[#859083]">Total task project</span></div>
        <div className="rounded-xl border border-[#E2E7E0] bg-white p-4"><Users className="h-4 w-4 text-[#64836A]" /><strong className="mt-3 block text-xl text-[#2F4637]">{snapshot.members.length}</strong><span className="text-[11px] text-[#859083]">Anggota terlibat</span></div>
        <div className="rounded-xl border border-[#E2E7E0] bg-white p-4"><Timer className="h-4 w-4 text-[#64836A]" /><strong className="mt-3 block text-xl text-[#2F4637]">{formatDuration(snapshot.trackedSeconds)}</strong><span className="text-[11px] text-[#859083]">Waktu kerja tercatat</span></div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,.7fr)]">
        <section className="rounded-2xl border border-[#E1E6DF] bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4"><div><p className="text-[10px] font-bold tracking-[0.14em] text-[#849082]">TASK STATUS</p><h2 className="mt-1 text-base font-bold text-[#2E4436]">Pekerjaan dalam project</h2></div><span className="rounded-full bg-[#EFF5EC] px-3 py-1 text-[10px] font-semibold text-[#55705C]">{openTasks.length} aktif</span></div>
          <div className="mt-5 divide-y divide-[#E8ECE7]">
            {snapshot.tasks.length ? snapshot.tasks.map(task => (
              <article key={task.id} className="flex items-center gap-3 py-3.5">
                <span className={`grid h-8 w-8 flex-none place-items-center rounded-lg border ${task.done ? 'border-[#CFE0CE] bg-[#EAF4E7] text-[#52745A]' : 'border-[#DFE4DD] bg-[#FAFBF9] text-[#7D8A7B]'}`}>
                  {task.done ? <CheckCircle2 className="h-4 w-4" /> : <CircleDashed className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1"><strong className="block truncate text-xs text-[#314439]">{task.name}</strong><span className="mt-1 block truncate text-[10px] text-[#879187]">{task.member}</span></div>
                <span className="flex-none rounded-full bg-[#F2F5F0] px-2.5 py-1 text-[9px] font-semibold text-[#687768]">{readableStatus(task.status)}</span>
              </article>
            )) : <p className="mt-5 rounded-xl border border-dashed border-[#D8E0D5] p-8 text-center text-xs text-[#7D887C]">Belum ada rincian task yang terhubung dari Work Center.</p>}
          </div>
        </section>

        <div className="space-y-5">
          <section className="rounded-2xl border border-[#E1E6DF] bg-white p-5">
            <div className="flex items-center gap-2"><Users className="h-4 w-4 text-[#638069]" /><h2 className="text-sm font-bold text-[#2E4436]">Tim Project</h2></div>
            <div className="mt-4 space-y-2.5">
              {snapshot.members.map(member => <div key={member.name} className="flex items-center gap-3 rounded-xl border border-[#E8ECE6] p-3"><span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-[#DDE9D9] text-[10px] font-bold text-[#54705B]">{member.name.slice(0, 2).toUpperCase()}</span><div className="min-w-0 flex-1"><strong className="block truncate text-xs text-[#304338]">{member.name}</strong><span className="mt-0.5 block truncate text-[9px] text-[#859085]">{member.role}</span></div><i className={`h-2 w-2 rounded-full ${member.status === 'working' ? 'bg-[#5EA36B]' : member.status === 'paused' ? 'bg-[#D6A653]' : 'bg-[#AEB7AC]'}`} title={presenceLabel(member.status)} /></div>)}
            </div>
          </section>

          <section className="rounded-2xl border border-[#E1E6DF] bg-white p-5">
            <div className="flex items-center gap-2"><CalendarRange className="h-4 w-4 text-[#638069]" /><h2 className="text-sm font-bold text-[#2E4436]">Timeline Project</h2></div>
            <div className="relative mt-5 space-y-5 pl-6 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-[#DCE5D9]">
              <div className="relative"><i className="absolute -left-6 top-0.5 h-3.5 w-3.5 rounded-full border-4 border-white bg-[#729079] shadow-[0_0_0_1px_#CAD8C8]" /><strong className="block text-xs text-[#34483B]">Project sedang berjalan</strong><span className="mt-1 block text-[10px] leading-5 text-[#869086]">{openTasks.length} task aktif sedang dikerjakan oleh {snapshot.members.length} anggota.</span></div>
              <div className="relative"><i className="absolute -left-6 top-0.5 h-3.5 w-3.5 rounded-full border-4 border-white bg-[#9EAE9D] shadow-[0_0_0_1px_#D3DDD1]" /><strong className="block text-xs text-[#34483B]">Aktivitas terakhir tercatat</strong><span className="mt-1 block text-[10px] leading-5 text-[#869086]">{formatDuration(snapshot.trackedSeconds)} waktu kerja tersinkron ke Work Center.</span></div>
              <div className="relative"><i className="absolute -left-6 top-0.5 h-3.5 w-3.5 rounded-full border-4 border-white bg-[#D5DDD3] shadow-[0_0_0_1px_#DDE4DB]" /><strong className="block text-xs text-[#34483B]">Target berikutnya</strong><span className="mt-1 block text-[10px] leading-5 text-[#869086]">Selesaikan {Math.max(0, snapshot.taskCount - snapshot.completedTasks)} task tersisa. Tanggal deadline mengikuti data project utama.</span></div>
            </div>
            {completedTasks.length > 0 && <div className="mt-5 flex items-center gap-2 rounded-xl bg-[#F1F6EF] p-3 text-[10px] font-semibold text-[#5E7563]"><Clock3 className="h-3.5 w-3.5" /> {completedTasks.length} task sudah masuk riwayat selesai</div>}
          </section>
        </div>
      </div>
    </div>
  );
}
