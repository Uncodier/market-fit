'use client';

import React from 'react';
import { ThemeProvider } from '../context/ThemeContext';
import { LayoutProvider } from '../context/LayoutContext';
import { SiteProvider } from '../context/SiteContext';
import { TooltipProvider } from '../components/ui/tooltip';
import { AuthProvider } from '../components/auth/auth-provider';

interface ProvidersProps {
  children: React.ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider>
      <LayoutProvider isLayoutCollapsed={false}>
        <SiteProvider>
          <AuthProvider>
            <TooltipProvider>
              {children}
            </TooltipProvider>
          </AuthProvider>
        </SiteProvider>
      </LayoutProvider>
    </ThemeProvider>
  );
} 