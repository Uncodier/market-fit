'use client';

import React from 'react';
import { LayoutProvider } from '../context/LayoutContext';
import { SiteProvider } from '@/app/context/SiteContext';
import { PermissionProvider } from '@/app/context/PermissionContext';
import { ScreenAccessProvider } from '@/app/context/ScreenAccessContext';
import { WidgetProvider } from '../context/WidgetContext';
import { RobotsProvider } from '../context/RobotsContext';
import { TooltipProvider } from '../components/ui/tooltip';
import { SiteCurrencyBootstrap } from '../components/commerce/SiteCurrencyBootstrap';
import { SiteLocaleBootstrap } from '../components/commerce/SiteLocaleBootstrap';
import { useSite } from '@/app/context/SiteContext';

function WorkspaceSiteBootstraps() {
  const { currentSite } = useSite()
  return (
    <>
      <SiteCurrencyBootstrap />
      <SiteLocaleBootstrap locale={currentSite?.settings?.default_locale} />
    </>
  )
}

export default function WorkspaceProviders({ children }: { children: React.ReactNode }) {
  return (
    <LayoutProvider>
      <SiteProvider>
        <WorkspaceSiteBootstraps />
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
