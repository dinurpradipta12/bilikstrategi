import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Setup aplikasi tim',
  robots: { index: false, follow: false },
  other: { referrer: 'no-referrer' },
};

export default function TeamSetupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
