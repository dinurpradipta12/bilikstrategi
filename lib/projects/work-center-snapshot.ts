export type WorkCenterProjectTask = {
  id: string;
  name: string;
  status: string;
  member: string;
  done: boolean;
};

export type WorkCenterProjectMember = {
  name: string;
  role: string;
  status: 'working' | 'paused' | 'offline';
};

export type WorkCenterProjectSnapshot = {
  version: 1;
  savedAt: string;
  name: string;
  trackedSeconds: number;
  taskCount: number;
  completedTasks: number;
  members: WorkCenterProjectMember[];
  tasks: WorkCenterProjectTask[];
};

export function normalizeProjectLookupName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('id-ID');
}

export function workCenterProjectHref(name: string) {
  return `/projects?projectName=${encodeURIComponent(name)}`;
}

function storageKey(name: string) {
  return `bilik_workcenter_project:${normalizeProjectLookupName(name)}`;
}

export function rememberWorkCenterProject(snapshot: WorkCenterProjectSnapshot) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(storageKey(snapshot.name), JSON.stringify(snapshot));
  } catch {
    // Navigation still works when browser storage is disabled.
  }
}

export function readWorkCenterProject(name: string): WorkCenterProjectSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(storageKey(name)) || 'null') as Partial<WorkCenterProjectSnapshot> | null;
    if (!parsed || parsed.version !== 1 || normalizeProjectLookupName(String(parsed.name || '')) !== normalizeProjectLookupName(name)) return null;
    return {
      version: 1,
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : new Date().toISOString(),
      name: String(parsed.name),
      trackedSeconds: Math.max(0, Number(parsed.trackedSeconds) || 0),
      taskCount: Math.max(0, Number(parsed.taskCount) || 0),
      completedTasks: Math.max(0, Number(parsed.completedTasks) || 0),
      members: Array.isArray(parsed.members) ? parsed.members.filter(member => member && typeof member.name === 'string').map(member => ({
        name: member.name,
        role: typeof member.role === 'string' ? member.role : 'Team member',
        status: member.status === 'working' || member.status === 'paused' ? member.status : 'offline',
      })) : [],
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks.filter(task => task && typeof task.name === 'string').map((task, index) => ({
        id: typeof task.id === 'string' ? task.id : `task-${index}`,
        name: task.name,
        status: typeof task.status === 'string' ? task.status : 'to_do',
        member: typeof task.member === 'string' ? task.member : 'Belum ditugaskan',
        done: task.done === true,
      })) : [],
    };
  } catch {
    return null;
  }
}
