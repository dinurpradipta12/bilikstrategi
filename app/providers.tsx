'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/lib/theme';
import { NotificationProvider } from '@/components/notifications/NotificationProvider';
import AttendanceRealtimeAlerts from '@/components/attendance/AttendanceRealtimeAlerts';
import { BrandingProvider } from '@/components/branding/BrandingProvider';
import type { TeamBranding } from '@/lib/branding/types';

export default function Providers({ children, initialBranding }: { children: React.ReactNode; initialBranding: TeamBranding }) {
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

  return (
    <BrandingProvider initialBranding={initialBranding}>
      <ThemeProvider>
        <AttendanceRealtimeAlerts />
        <NotificationProvider>
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </NotificationProvider>
      </ThemeProvider>
    </BrandingProvider>
  );
}
