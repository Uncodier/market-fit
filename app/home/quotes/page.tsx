'use client'

import { BuyerQuotesView } from '@/app/buyer/components/BuyerQuotesView'
import { usePortalDemo } from '../demo-context'

export default function QuotesPage() {
  return <BuyerQuotesView demo={usePortalDemo()} />
}