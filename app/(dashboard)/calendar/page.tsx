'use client';

import React, { useState, useEffect } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Filter, RefreshCw } from 'lucide-react';
import { MOCK_TASKS, AgencyTask } from '@/lib/mock/data';
import TaskDetailDrawer from '@/components/tasks/TaskDetailDrawer';

type CalendarViewMode = 'month' | 'week' | 'day';

export default function CalendarPage() {
  const [tasks, setTasks] = useState<AgencyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [selectedTask, setSelectedTask] = useState<AgencyTask | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const fetchCalendarTasks = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/clickup/tasks');
      if (res.ok) {
        const data = await res.json();
        setTasks(Array.isArray(data.tasks) ? data.tasks : []);
      } else {
        setTasks([]);
      }
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendarTasks();
  }, []);

  const daysInMonth = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#24324A] tracking-tight">Calendar Workspace</h1>
          <p className="text-xs text-[#737680] mt-1">
            Jadwal deliverable task ClickUp berdasarkan due date dan tanggal mulai.
          </p>
        </div>

        {/* Calendar Navigation & View Modes */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-[#FFFFFF] border border-[#E8E8EC] p-1 rounded-xl shadow-2xs">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${viewMode === 'month' ? 'bg-[#EEF2F7] text-[#24324A]' : 'text-[#737680]'}`}
            >
              Bulan
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${viewMode === 'week' ? 'bg-[#EEF2F7] text-[#24324A]' : 'text-[#737680]'}`}
            >
              Minggu
            </button>
            <button
              onClick={() => setViewMode('day')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${viewMode === 'day' ? 'bg-[#EEF2F7] text-[#24324A]' : 'text-[#737680]'}`}
            >
              Hari
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Grid Container */}
      <div className="bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl shadow-2xs p-6 space-y-4">
        <div className="flex items-center justify-between font-bold text-sm text-[#24324A]">
          <span>Juli 2026</span>
          <div className="flex items-center gap-2">
            <button className="p-1 border border-[#E8E8EC] rounded-lg hover:bg-[#F7F7F8]"><ChevronLeft className="w-4 h-4" /></button>
            <button className="p-1 border border-[#E8E8EC] rounded-lg hover:bg-[#F7F7F8]"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Days Header */}
        <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-[#737680] uppercase pb-2 border-b border-[#E8E8EC]">
          <span>Sen</span><span>Sel</span><span>Rab</span><span>Kam</span><span>Jum</span><span>Sab</span><span>Ming</span>
        </div>

        {/* Calendar Dates Grid */}
        <div className="grid grid-cols-7 gap-2">
          {daysInMonth.map((day) => {
            const taskOnDay = tasks.find((t) => new Date(t.due_date).getDate() === day);
            return (
              <div
                key={day}
                className="h-24 p-2 border border-[#E8E8EC] rounded-xl bg-[#FFFFFF] hover:border-[#24324A] transition-colors flex flex-col justify-between"
              >
                <span className="text-xs font-bold text-[#24324A]">{day}</span>
                {taskOnDay && (
                  <div
                    onClick={() => { setSelectedTask(taskOnDay); setDrawerOpen(true); }}
                    className="p-1 bg-[#EEF2F7] border border-[#24324A]/20 rounded text-[9px] font-bold text-[#24324A] truncate cursor-pointer hover:bg-[#24324A] hover:text-white transition-colors"
                  >
                    {taskOnDay.task_name}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Task Drawer */}
      <TaskDetailDrawer
        task={selectedTask}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
