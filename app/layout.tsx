import type { Metadata, Viewport } from 'next';
import './globals.css';
import Providers from './providers';
import { readTeamBranding } from '@/lib/branding/server';

export async function generateMetadata(): Promise<Metadata> {
  const branding = await readTeamBranding();
  return {
    title: branding.name,
    description: branding.tagline,
    manifest: '/api/branding/manifest',
    appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: branding.short_name },
    icons: { icon: '/api/branding/icon', shortcut: '/api/branding/icon', apple: '/api/branding/icon' },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#F6F7FB',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const branding = await readTeamBranding();
  return (
    <html lang="id" data-ui-style="m3" suppressHydrationWarning style={{
      '--brand-primary': branding.primary_color,
      '--brand-accent': branding.accent_color,
    } as React.CSSProperties}>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <script
          dangerouslySetInnerHTML={{
            __html: `try { var t = localStorage.getItem('bilik_theme') === 'dark' ? 'dark' : 'light'; localStorage.removeItem('bilik_ui_style'); document.documentElement.classList.toggle('dark', t === 'dark'); document.documentElement.dataset.theme = t; document.documentElement.dataset.uiStyle = 'm3'; document.documentElement.style.colorScheme = t; } catch (_) { document.documentElement.dataset.uiStyle = 'm3'; }`,
          }}
        />
      </head>
      <body>
        <Providers initialBranding={branding}>{children}</Providers>
      </body>
    </html>
  );
}
