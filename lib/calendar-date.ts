export interface CalendarDayRange {
  startDay: number;
  endDay: number;
}

function parseCalendarDate(value: unknown): Date | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const isoDate = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) {
    const year = Number(isoDate[1]);
    const month = Number(isoDate[2]);
    const day = Number(isoDate[3]);
    const date = new Date(year, month - 1, day);

    if (
      date.getFullYear() === year
      && date.getMonth() === month - 1
      && date.getDate() === day
    ) {
      return date;
    }

    return null;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;

  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

export function getCalendarMonthRange(
  startValue: unknown,
  endValue: unknown,
  year: number,
  monthIndex: number,
  fallbackDay = 5,
): CalendarDayRange | null {
  const monthStart = new Date(year, monthIndex, 1);
  const monthEnd = new Date(year, monthIndex + 1, 0);
  let start = parseCalendarDate(startValue);
  let end = parseCalendarDate(endValue);

  if (!start && !end) {
    const safeFallbackDay = Math.min(Math.max(fallbackDay, 1), monthEnd.getDate());
    start = new Date(year, monthIndex, safeFallbackDay);
    end = start;
  } else {
    start = start || end;
    end = end || start;
  }

  if (!start || !end) return null;

  if (start.getTime() > end.getTime()) {
    [start, end] = [end, start];
  }

  if (end.getTime() < monthStart.getTime() || start.getTime() > monthEnd.getTime()) {
    return null;
  }

  const visibleStart = start.getTime() < monthStart.getTime() ? monthStart : start;
  const visibleEnd = end.getTime() > monthEnd.getTime() ? monthEnd : end;

  return {
    startDay: visibleStart.getDate(),
    endDay: visibleEnd.getDate(),
  };
}

export function formatCalendarDate(value: unknown): string {
  const date = parseCalendarDate(value);
  if (!date) return '-';

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}
