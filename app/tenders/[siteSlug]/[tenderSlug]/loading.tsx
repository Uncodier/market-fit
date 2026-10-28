import { Skeleton } from '@/app/components/ui/skeleton'
import { TenderHeader, TenderFooter } from '../../public-header'

export default function Loading() {
  return <div className="min-h-screen bg-background flex flex-col"><TenderHeader />
    <main aria-label="Loading published tender" aria-busy="true" className="flex-1 w-full max-w-7xl mx-auto space-y-6 px-4 md:px-8 py-4 md:py-6">
      <Skeleton className="h-5 w-48" />
      <div className="grid grid-cols-1 items-start gap-8 lg:gap-10 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7 xl:col-span-8"><Skeleton className="h-5 w-56" /><Skeleton className="h-10 w-3/4" /><Skeleton className="h-24 w-full" /><Skeleton className="h-56 w-full rounded-2xl" /></div>
        <div className="lg:col-span-5 xl:col-span-4"><Skeleton className="h-72 w-full rounded-2xl" /></div>
      </div>
    </main><TenderFooter /></div>
}