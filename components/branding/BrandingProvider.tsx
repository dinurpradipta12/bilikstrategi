'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { DEFAULT_BRANDING, normalizeBranding, type TeamBranding } from '@/lib/branding/types';

type BrandingContextValue = {
  branding: TeamBranding;
  refreshBranding: () => Promise<void>;
};

const BrandingContext = createContext<BrandingContextValue>({
  branding: DEFAULT_BRANDING,
  refreshBranding: async () => {},
});

export function BrandingProvider({ children, initialBranding }: { children: React.ReactNode; initialBranding: TeamBranding }) {
  const [branding, setBranding] = useState<TeamBranding>(initialBranding);

  const refreshBranding = useCallback(async () => {
    try {
      const response = await fetch('/api/branding', { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      setBranding(normalizeBranding(data.branding));
    } catch {
      // The generic identity remains visible while the connection recovers.
    }
  }, []);

  useEffect(() => { void refreshBranding(); }, [refreshBranding]);
  useEffect(() => {
    document.documentElement.style.setProperty('--brand-primary', branding.primary_color);
    document.documentElement.style.setProperty('--brand-accent', branding.accent_color);
    document.title = branding.name;
  }, [branding]);

  return (
    <BrandingContext.Provider value={{ branding, refreshBranding }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
