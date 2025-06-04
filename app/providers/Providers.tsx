'use client';

import React from 'react';
import { ThemeProvider } from '../context/ThemeContext';
import { LayoutProvider } from '../context/LayoutContext';
import { SiteProvider } from '../context/SiteContext';
import { WidgetProvider } from '../context/WidgetContext';
import { TooltipProvider } from '../components/ui/tooltip';
import { AuthProvider } from '../components/auth/auth-provider';

interface ProvidersProps {
  children: React.ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <LayoutProvider>
          <SiteProvider>
            <WidgetProvider>
              <TooltipProvider>
                {children}
              </TooltipProvider>
            </WidgetProvider>
          </SiteProvider>
        </LayoutProvider>
      </ThemeProvider>
    </AuthProvider>
  );
} 