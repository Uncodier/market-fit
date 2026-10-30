import { Skeleton } from '@/app/components/ui/skeleton'

export default function Loading() {
  return <div className="min-w-0 space-y-6 py-6"><Skeleton className="h-8 w-48" />
    {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-16 w-full" />)}
  </div>
}