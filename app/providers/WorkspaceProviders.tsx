'use client';

import React from 'react';
import { LayoutProvider } from '../context/LayoutContext';
import { SiteProvider } from '@/app/context/SiteContext';
import { PermissionProvider } from '@/app/context/PermissionContext';
import { ScreenAccessProvider } from '@/app/context/ScreenAccessContext';
import { WidgetProvider } from '../context/WidgetContext';
import { RobotsProvider } from '../context/RobotsContext';
import { TooltipProvider } from '../components/ui/tooltip';

export default function WorkspaceProviders({ children }: { children: React.ReactNode }) {
  return (
    <LayoutProvider>
      <SiteProvider>
        <PermissionProvider>
          <ScreenAccessProvider>
            <RobotsProvider>
              <WidgetProvider>
                <TooltipProvider>
                  {children}
                </TooltipProvider>
              </WidgetProvider>
            </RobotsProvider>
          </ScreenAccessProvider>
        </PermissionProvider>
      </SiteProvider>
    </LayoutProvider>
  );
}
