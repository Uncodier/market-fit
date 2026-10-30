'use client'

import { BuyerOrdersView } from '@/app/buyer/components/BuyerOrdersView'
import { usePortalDemo } from '../demo-context'

export default function OrdersPage() {
  return <BuyerOrdersView demo={usePortalDemo()} />
}