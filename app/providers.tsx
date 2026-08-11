'use client';

import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/lib/theme';
import { NotificationProvider } from '@/components/notifications/NotificationProvider';
import AttendanceRealtimeAlerts from '@/components/attendance/AttendanceRealtimeAlerts';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  useEffect(() => {
    const dummyMarkers = [
      'Nusantara Retail',
      'Kopi Senja',
      'TechVision',
      'GlowSkin',
      'Finansial Kuat',
      'Brief_Project',
      'Key_Visual_Design_Asset',
      'Agency Client Group',
      'contoh task',
      'Syaiful Akhsin',
      'Dinur mp',
    ];

    const containsDummyMarker = (value: string | null) => {
      if (!value) return false;
      return dummyMarkers.some((marker) => value.includes(marker));
    };

    const keysToCheck = [
      'bilik_agency_projects_db',
      'bilik_agency_clients_db',
      'bilik_custom_clients',
      'bilik_deleted_project_ids',
      'bilik_deleted_task_ids',
      'bilik_notif_unread_count',
    ];

    keysToCheck.forEach((key) => {
      if (containsDummyMarker(localStorage.getItem(key))) {
        localStorage.removeItem(key);
      }
    });

    Object.keys(localStorage).forEach((key) => {
      if ((key.startsWith('bilik_project_meta_') || key.startsWith('bilik_subtasks_')) && containsDummyMarker(localStorage.getItem(key))) {
        localStorage.removeItem(key);
      }
    });
  }, []);

  return (
    <ThemeProvider>
      <AttendanceRealtimeAlerts />
      <NotificationProvider>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}
