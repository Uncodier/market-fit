import { Skeleton } from '@/app/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/app/components/ui/card'
import { TenderHeader, TenderFooter } from './public-header'

export default function Loading() {
  return <div className="flex flex-col min-h-screen bg-background"><TenderHeader /><main className="flex-1 max-w-7xl mx-auto w-full space-y-8 px-4 md:px-8 py-8 md:py-12" aria-label="Loading published tenders" aria-busy="true">
    <div className="space-y-3"><Skeleton className="h-9 w-2/3" /><Skeleton className="h-5 w-1/2" /></div>
    <div className="flex gap-8 items-start"><div className="hidden md:block w-64 shrink-0 space-y-4"><Skeleton className="h-7 w-32" /><Skeleton className="h-32 w-full" /></div><div className="flex-1 min-w-0 space-y-6"><Skeleton className="ml-auto h-9 w-40 rounded-full" />
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <Card key={index} className="rounded-2xl">
      <CardHeader className="space-y-3"><Skeleton className="h-5 w-1/3" /><Skeleton className="h-7 w-full" /></CardHeader>
      <CardContent className="space-y-4"><Skeleton className="h-16 w-full" /><Skeleton className="h-10 w-full" /></CardContent>
    </Card>)}</div></div></div>
  </main><TenderFooter /></div>
}