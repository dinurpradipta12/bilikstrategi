export const ATTENDANCE_WORKSPACE_KEY = 'bilik-strategi';
export const DEFAULT_ATTENDANCE_TIMEZONE = 'Asia/Makassar';

export type WorkDaySchedule = {
  day: number;
  label: string;
  shortLabel: string;
  isWorking: boolean;
  startTime: string;
  endTime: string;
};

export type AttendanceSchedule = {
  workspaceKey: string;
  timezone: string;
  days: WorkDaySchedule[];
  updatedAt?: string | null;
  configured?: boolean;
};

export type AttendanceAccessRequest = {
  id: string;
  email: string;
  displayName: string;
  requestDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedByEmail?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  createdAt?: string | null;
};

// JavaScript uses Sunday = 0. The UI deliberately presents Monday first.
export const WORK_WEEK: ReadonlyArray<Pick<WorkDaySchedule, 'day' | 'label' | 'shortLabel'>> = [
  { day: 1, label: 'Senin', shortLabel: 'Sen' },
  { day: 2, label: 'Selasa', shortLabel: 'Sel' },
  { day: 3, label: 'Rabu', shortLabel: 'Rab' },
  { day: 4, label: 'Kamis', shortLabel: 'Kam' },
  { day: 5, label: 'Jumat', shortLabel: 'Jum' },
  { day: 6, label: 'Sabtu', shortLabel: 'Sab' },
  { day: 0, label: 'Minggu', shortLabel: 'Min' },
];

export const DEFAULT_WORK_DAYS: WorkDaySchedule[] = WORK_WEEK.map((day) => ({
  ...day,
  isWorking: day.day >= 1 && day.day <= 5,
  startTime: '08:30',
  endTime: '17:30',
}));

function normalizeTime(value: unknown, fallback: string) {
  const candidate = String(value || '').trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(candidate) ? candidate : fallback;
}

function normalizeDayNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 6 ? parsed : null;
}

export function normalizeWorkDays(value: unknown): WorkDaySchedule[] {
  const source = Array.isArray(value) ? value : [];

  return WORK_WEEK.map((definition) => {
    const raw = source.find((item) => normalizeDayNumber(item?.day ?? item?.day_index) === definition.day) as
      | Record<string, unknown>
      | undefined;

    return {
      ...definition,
      isWorking:
        typeof raw?.isWorking === 'boolean'
          ? raw.isWorking
          : typeof raw?.is_working === 'boolean'
            ? raw.is_working
            : DEFAULT_WORK_DAYS.find((day) => day.day === definition.day)?.isWorking ?? false,
      startTime: normalizeTime(raw?.startTime ?? raw?.start_time, '08:30'),
      endTime: normalizeTime(raw?.endTime ?? raw?.end_time, '17:30'),
    };
  });
}

export function createDefaultAttendanceSchedule(
  configured = true,
  workspaceKey = ATTENDANCE_WORKSPACE_KEY,
  timezone = DEFAULT_ATTENDANCE_TIMEZONE
): AttendanceSchedule {
  return {
    workspaceKey,
    timezone,
    days: DEFAULT_WORK_DAYS.map((day) => ({ ...day })),
    updatedAt: null,
    configured,
  };
}

export function normalizeAttendanceSchedule(row?: Record<string, unknown> | null, configured = true) {
  const fallback = createDefaultAttendanceSchedule(configured);
  return {
    workspaceKey: String(row?.workspace_key || row?.workspaceKey || fallback.workspaceKey),
    timezone: String(row?.timezone || fallback.timezone),
    days: normalizeWorkDays(row?.days),
    updatedAt: row?.updated_at ? String(row.updated_at) : null,
    configured,
  } satisfies AttendanceSchedule;
}

export function formatDateYmd(date = new Date(), timeZone?: string) {
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(date);
      const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
      if (values.year && values.month && values.day) {
        return `${values.year}-${values.month}-${values.day}`;
      }
    } catch {
      // Fall back to the runtime's local date if a timezone is unavailable.
    }
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isValidDateYmd(value: unknown): value is string {
  const candidate = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return false;
  const [year, month, day] = candidate.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day, 12));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

export function getDayIndexForDate(dateYmd: string) {
  if (!isValidDateYmd(dateYmd)) return new Date().getDay();
  const [year, month, day] = dateYmd.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
}

export function getWorkDayForDate(schedule: AttendanceSchedule, dateYmd: string) {
  const dayIndex = getDayIndexForDate(dateYmd);
  return schedule.days.find((day) => day.day === dayIndex) || null;
}

export function getNextWorkingLabel(schedule: AttendanceSchedule, dateYmd: string) {
  const currentDay = getDayIndexForDate(dateYmd);

  for (let offset = 1; offset <= 7; offset += 1) {
    const nextDay = (currentDay + offset) % 7;
    const workDay = schedule.days.find((day) => day.day === nextDay);
    if (workDay?.isWorking) {
      return `${workDay.label}, pukul ${workDay.startTime}–${workDay.endTime}`;
    }
  }

  return 'jadwal kerja berikutnya';
}

export function toAttendanceAccessRequest(row: Record<string, unknown>): AttendanceAccessRequest {
  return {
    id: String(row.id || ''),
    email: String(row.email || ''),
    displayName: String(row.display_name || row.displayName || 'Pengguna'),
    requestDate: String(row.request_date || row.requestDate || ''),
    reason: String(row.reason || ''),
    status: (['pending', 'approved', 'rejected'].includes(String(row.status))
      ? String(row.status)
      : 'pending') as AttendanceAccessRequest['status'],
    reviewedByEmail: row.reviewed_by_email ? String(row.reviewed_by_email) : null,
    reviewedByName: row.reviewed_by_name ? String(row.reviewed_by_name) : null,
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
    createdAt: row.created_at ? String(row.created_at) : null,
  };
}
