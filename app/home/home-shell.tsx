'use client'

import type { ReactNode } from 'react'
import { BuyerShell } from '@/app/buyer/components/BuyerShell'
import { usePortalDemo } from './demo-context'
import { usePathname } from 'next/navigation'

export function HomeShell({ children }: { children: ReactNode }) {
  const demo = usePortalDemo()
  const pathname = usePathname()
  const procurementPreview = ['/home', '/home/search', '/home/tenders', '/home/submissions', '/home/profile',
    '/home/orders', '/home/quotes', '/home/subscriptions', '/home/library'].includes(pathname ?? '') ||
    /^\/home\/preview\/(orders|quotes|subscriptions|library|reservations)\/[^/]+$/.test(pathname ?? '')
  return <BuyerShell requireAuth={!(demo && procurementPreview)}>{children}</BuyerShell>
}