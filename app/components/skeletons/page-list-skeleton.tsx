import { Skeleton } from "@/app/components/ui/skeleton"

export function PageListSkeleton() {
  return (
    <div className="flex-1 min-w-0 w-full p-8 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    </div>
  )
}
