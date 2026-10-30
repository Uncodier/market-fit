import type { ReactNode } from 'react'
import { HomeShell } from './home-shell'
import { PortalDemoProvider } from './demo-context'
import { isProcurementPortalDemo } from '@/app/tenders/demo-mode'

export default async function HomeLayout({ children }: { children: ReactNode }) {
  return <PortalDemoProvider demo={await isProcurementPortalDemo()}><HomeShell>{children}</HomeShell></PortalDemoProvider>
}