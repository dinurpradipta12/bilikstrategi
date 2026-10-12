'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { HolidayControl } from '@/lib/attendance/schedule';

export type HolidayAccessSnapshot = {
  date: string;
  nextWorkingLabel: string;
  requestStatus: 'none' | 'pending' | 'approved' | 'rejected';
  requestReason?: string;
  isAdmin: boolean;
  isHoliday: boolean;
  allowed: boolean;
  mode: 'manual' | 'scheduled' | 'weekly' | null;
  message: string;
  control: HolidayControl;
  storageReady: boolean;
};

type HolidayAccessContextValue = {
  access: HolidayAccessSnapshot | null;
  locked: boolean;
  refresh: () => void;
};

const HolidayAccessContext = createContext<HolidayAccessContextValue>({
  access: null,
  locked: false,
  refresh: () => {},
});

export function HolidayAccessProvider({
  value,
  children,
}: {
  value: HolidayAccessContextValue;
  children: ReactNode;
}) {
  return <HolidayAccessContext.Provider value={value}>{children}</HolidayAccessContext.Provider>;
}

export function useHolidayAccess() {
  return useContext(HolidayAccessContext);
}
