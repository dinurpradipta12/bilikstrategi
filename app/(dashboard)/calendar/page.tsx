'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CalendarPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/timeline');
  }, [router]);

  return (
    <div className="p-12 text-center text-xs text-[#737680]">
      Mengalihkan ke halaman Timeline...
    </div>
  );
}
