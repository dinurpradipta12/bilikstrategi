'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
const OfficeDashboard = dynamic(() => import('@/components/spatial-office/OfficeDashboard'), { ssr: false, loading: () => <div className="min-h-dvh grid place-items-center bg-[#e8ece1] text-[#45634f]">Menyiapkan kantor…</div> });
const StatisticsDashboard = dynamic(() => import('@/components/dashboard/StatisticsDashboard'), { loading: () => <p>Memuat statistik…</p> });

export default function DashboardPage() {
  const [statistics, setStatistics] = useState(false);
  if (statistics) return <div className="p-4 md:p-8 max-w-[1800px] mx-auto"><StatisticsDashboard onOffice={() => setStatistics(false)} /></div>;
  return <OfficeDashboard immersive onStatistics={() => setStatistics(true)} />;
}
