'use client';

import React from 'react';
import { ThemeProvider } from '../context/ThemeContext';
import { LayoutProvider } from '../context/LayoutContext';
import { SiteProvider } from '../context/SiteContext';
import { WidgetProvider } from '../context/WidgetContext';
import { RobotsProvider } from '../context/RobotsContext';
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
            <RobotsProvider>
              <WidgetProvider>
                <TooltipProvider>
                  {children}
                </TooltipProvider>
              </WidgetProvider>
            </RobotsProvider>
          </SiteProvider>
        </LayoutProvider>
      </ThemeProvider>
    </AuthProvider>
  );
} 