import type { Metadata } from 'next';
import FloatingAttendance from '@/components/attendance/FloatingAttendance';
import OfficeDashboard from '@/components/spatial-office/OfficeDashboard';

export const metadata: Metadata = {
  title: 'Work Center Preview — Bilik Strategi',
  robots: { index: false, follow: false },
};

export default function OfficeWorkCenterPreviewPage() {
  return <main className="office-workcenter-preview-shell">
    <OfficeDashboard demo immersive workCenterPreview />
    <FloatingAttendance hideTrigger />
  </main>;
}
