import { Skeleton } from "@/app/components/ui/skeleton"

export function PaymentDialogSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div className="flex flex-col h-full justify-between bg-slate-50 dark:bg-muted/10 rounded-2xl overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
          <Skeleton className="h-14 w-14 rounded-full" />
          <div className="flex flex-col items-center gap-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-8 w-44" />
          </div>
        </div>
      </div>

      <div className="flex flex-col mt-4 md:mt-0 justify-between bg-slate-50 dark:bg-muted/10 rounded-2xl overflow-hidden h-full">
        <div className="flex flex-col items-center justify-center py-8 px-4 border-b border-border/40">
          <Skeleton className="h-3 w-24 mb-3" />
          <Skeleton className="h-12 w-40" />
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <Skeleton className="h-4 w-36" />
        </div>
      </div>

      <div className="flex flex-col gap-3 mt-4 md:mt-0 justify-center h-full px-2">
        <div className="grid grid-cols-4 gap-3">
          <div className="col-span-3 grid grid-cols-3 gap-3">
            {Array.from({ length: 12 }).map((_, index) => (
              <Skeleton key={index} className="aspect-square rounded-full" />
            ))}
          </div>
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="flex-1 aspect-square rounded-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
