import type { Metadata } from 'next';
import './globals.css';
import Providers from './providers';

export const metadata: Metadata = {
  title: 'Bilik Strategi Workspace - Agency Operations & ClickUp Engine',
  description: 'Aplikasi internal agency untuk project management, task tracking ClickUp, team workload, dan komunikasi.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
