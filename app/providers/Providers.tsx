'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { ThemeProvider } from '../context/ThemeContext';
import { TooltipProvider } from '../components/ui/tooltip';
import { AuthProvider } from '../components/auth/auth-provider';
import { LocalizationProvider } from '../context/LocalizationContext';
import { DisplayCurrencyProvider } from '../context/DisplayCurrencyContext';
import { SWRProvider } from './swr-provider';
import { shouldUseWorkspaceProviders } from '../config/routes';

const WorkspaceProviders = dynamic(() => import('./WorkspaceProviders'), {
  ssr: true,
});

interface ProvidersProps {
  children: React.ReactNode;
  country?: string;
}

export default function Providers({ children, country }: ProvidersProps) {
  const pathname = usePathname() || '/';
  const useWorkspace = shouldUseWorkspaceProviders(pathname);

  return (
    <SWRProvider>
    <AuthProvider>
      <ThemeProvider>
        <LocalizationProvider>
          <DisplayCurrencyProvider initialCountry={country}>
            {useWorkspace ? (
              <WorkspaceProviders>
                {children}
              </WorkspaceProviders>
            ) : (
              <TooltipProvider>
                {children}
              </TooltipProvider>
            )}
          </DisplayCurrencyProvider>
        </LocalizationProvider>
      </ThemeProvider>
    </AuthProvider>
    </SWRProvider>
  );
}
