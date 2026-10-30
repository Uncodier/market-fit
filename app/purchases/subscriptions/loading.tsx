'use client'

import { ProcurementListLoading } from '../procurement/ui/list-loading'
import { PurchasedSubscriptionsListSkeleton } from './PurchasedSubscriptionsList'

export default function Loading() {
  return <ProcurementListLoading><PurchasedSubscriptionsListSkeleton /></ProcurementListLoading>
}