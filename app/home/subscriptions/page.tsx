'use client'

import { BuyerSubscriptionsView } from '@/app/buyer/components/BuyerSubscriptionsView'
import { usePortalDemo } from '../demo-context'

export default function SubscriptionsPage() {
  return <BuyerSubscriptionsView demo={usePortalDemo()} />
}