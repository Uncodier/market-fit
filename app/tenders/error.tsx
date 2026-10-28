'use client'

import { Button } from '@/app/components/ui/button'
import { TenderHeader, TenderFooter } from './public-header'

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="flex flex-col min-h-screen bg-background"><TenderHeader />
    <main className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-8 py-8 md:py-12">
      <div role="alert" className="space-y-3 py-8"><h1 className="text-2xl font-bold">Unable to load published tenders</h1>
        <p>Tender publications are temporarily unavailable.</p><Button variant="outline" onClick={reset}>Retry</Button>
      </div>
    </main><TenderFooter /></div>
}