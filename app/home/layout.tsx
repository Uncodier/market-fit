import type { ReactNode } from 'react'
import { BuyerShell } from '@/app/buyer/components/BuyerShell'

export default function HomeLayout({ children }: { children: ReactNode }) {
  return <BuyerShell requireAuth>{children}</BuyerShell>
}