"use client"

import { BuyerHomeSkeleton } from './BuyerHomeSkeleton'
import { BuyerListSkeleton } from './BuyerListSkeleton'
import { BuyerOrderDetailSkeleton } from './BuyerOrderDetailSkeleton'
import { BuyerQuoteDetailSkeleton } from './BuyerQuoteDetailSkeleton'
import { AccountProfileSkeleton, SubmissionsSkeleton } from '@/app/home/portal-skeletons'
import BookLoading from '@/app/buyer/book/[entitlementId]/loading'

/** Authentication must not replace every account route with the same list placeholder. */
export function AccountScreenLoading({ pathname }: { pathname: string | null }) {
  if (pathname?.match(/^\/(buyer|home)\/orders\/[^/]+$/) || pathname?.startsWith('/home/preview/orders/')) {
    return <BuyerOrderDetailSkeleton />
  }
  if (pathname?.match(/^\/(buyer|home)\/quotes\/[^/]+$/) || pathname?.startsWith('/home/preview/quotes/')) {
    return <BuyerQuoteDetailSkeleton />
  }
  const list = pathname?.match(/^\/(buyer|home)\/(orders|subscriptions|library|quotes)$/)?.[2]
  if (list) return <BuyerListSkeleton kind={list as 'orders' | 'subscriptions' | 'library' | 'quotes'} />
  if (pathname === '/home/submissions' || pathname === '/home/tenders') return <SubmissionsSkeleton />
  if (pathname?.match(/^\/(buyer|home)\/profile$/)) return <AccountProfileSkeleton credentials={pathname === '/home/profile'} />
  if (pathname?.startsWith('/buyer/book/')) return <BookLoading />
  return <BuyerHomeSkeleton />
}