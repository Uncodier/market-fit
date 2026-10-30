'use client'

import { Suspense } from 'react'
import { BuyerLibraryView } from '@/app/buyer/components/BuyerLibraryView'
import { usePortalDemo } from '../demo-context'

export default function LibraryPage() {
  const demo = usePortalDemo()
  return <Suspense><BuyerLibraryView demo={demo} /></Suspense>
}