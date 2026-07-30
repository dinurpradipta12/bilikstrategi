'use client';

import React, { useState, useEffect } from 'react';
import { GanttChartSquare, Filter, AlertTriangle, Calendar, Search, RefreshCw } from 'lucide-react';
import { MOCK_TASKS, MOCK_PROJECTS, AgencyTask, AgencyProject } from '@/lib/mock/data';
import TaskDetailDrawer from '@/components/tasks/TaskDetailDrawer';

export default function TimelinePage() {
  const [tasks, setTasks] = useState<AgencyTask[]>([]);
  const [projects, setProjects] = useState<AgencyProject[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedTask, setSelectedTask] = useState<AgencyTask | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [projectFilter, setProjectFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tasksRes, projectsRes] = await Promise.all([
        fetch('/api/clickup/tasks').catch(() => null),
        fetch('/api/clickup/projects').catch(() => null),
      ]);

      if (tasksRes?.ok) {
        const d = await tasksRes.json();
        setTasks(Array.isArray(d.tasks) ? d.tasks : []);
      } else {
        setTasks([]);
      }

      if (projectsRes?.ok) {
        const d = await projectsRes.json();
        setProjects(Array.isArray(d.projects) ? d.projects : []);
      } else {
        setProjects([]);
      }
    } catch {
      setTasks([]);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredTasks = tasks.filter((t) => {
    const matchesProject = projectFilter === 'all' || t.project_id === projectFilter;
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesProject && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#24324A] tracking-tight">Agency Timeline</h1>
          <p className="text-xs text-[#737680] mt-1">
            Visualisasi jadwal pengerjaan task, alokasi durasi, dan milestone deliverable.
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 bg-[#FFFFFF] p-2 border border-[#E8E8EC] rounded-xl shadow-2xs">
          <Filter className="w-3.5 h-3.5 text-[#737680] ml-1" />
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="text-xs font-semibold bg-transparent border-none text-[#24324A] outline-none cursor-pointer"
          >
            <option value="all">Semua Project</option>
            {MOCK_PROJECTS.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Gantt Timeline Container */}
      <div className="bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl shadow-2xs p-6 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-[#E8E8EC] text-xs font-semibold text-[#737680]">
          <span>Daftar Task Deliverable</span>
          <div className="flex gap-8">
            <span>Minggu 1 (Jul)</span>
            <span>Minggu 2 (Jul)</span>
            <span>Minggu 3 (Jul)</span>
            <span>Minggu 4 (Jul)</span>
            <span>Agustus 2026</span>
          </div>
        </div>

        <div className="space-y-4">
          {filteredTasks.map((task) => {
            const isOverdue = task.tags.includes('Overdue') || task.status === 'revision';
            return (
              <div
                key={task.id}
                onClick={() => { setSelectedTask(task); setDrawerOpen(true); }}
                className="group p-3 border border-[#E8E8EC] rounded-xl hover:border-[#24324A] cursor-pointer transition-all space-y-2 bg-[#FFFFFF]"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#24324A]">{task.task_name}</span>
                    <span className="text-[10px] text-[#737680]">({task.project_name})</span>
                    {isOverdue && (
                      <span className="flex items-center gap-1 px-1.5 py-0.2 bg-[#FFF0ED] text-[#D95858] text-[10px] font-bold rounded">
                        <AlertTriangle className="w-3 h-3" /> Overdue
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] text-[#737680]">
                    PIC: {task.assignee_names.join(', ')} • Due: {new Date(task.due_date).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' })}
                  </span>
                </div>

                {/* Timeline Progress Bar */}
                <div className="w-full bg-[#EEF2F7] h-4 rounded-lg overflow-hidden relative">
                  <div
                    className={`h-full rounded-lg text-[9px] font-bold text-white flex items-center px-2 transition-all ${
                      isOverdue ? 'bg-[#D95858]' : task.status === 'completed' ? 'bg-[#4F9D78]' : 'bg-[#24324A]'
                    }`}
                    style={{ width: `${task.status === 'completed' ? 100 : Math.max(30, Math.floor(Math.random() * 80))}%` }}
                  >
                    {task.status.toUpperCase()}
                  </div>
                </div>
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
