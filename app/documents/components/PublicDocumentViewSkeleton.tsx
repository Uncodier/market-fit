import { Skeleton } from "@/app/components/ui/skeleton"

/** Loading placeholder matching PublicDocumentView + shop nav. */
export function PublicDocumentViewSkeleton() {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-[#030303] print:bg-white">
      <div className="h-4 w-full shrink-0 print:hidden" />
      <div className="sticky top-4 z-40 w-full mb-4 md:mb-8 shrink-0 print:hidden">
        <div className="px-4 md:px-8 w-full max-w-7xl mx-auto">
          <div className="rounded-full border border-black/5 dark:border-white/10 bg-white/80 dark:bg-[#030303]/80 backdrop-blur-md shadow-sm flex items-center justify-between px-3 md:px-6 py-2 w-full min-h-[56px] gap-3">
            <Skeleton className="h-6 w-28 rounded-full" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <Skeleton className="h-9 w-20 rounded-full hidden md:block" />
            </div>
          </div>
        </div>
      </div>

      <div className="py-8 print:py-0">
        <div className="max-w-4xl mx-auto bg-white dark:bg-[#0a0a0a] p-8 space-y-8 shadow-sm border border-black/5 dark:border-white/10 print:shadow-none print:border-none print:bg-white">
          <div className="border-b border-gray-200 dark:border-white/10 pb-6 flex justify-between gap-6">
            <div className="flex items-start gap-4 min-w-0">
              <Skeleton className="h-14 w-14 shrink-0 rounded-md" />
              <div className="space-y-2">
                <Skeleton className="h-9 w-40" />
                <Skeleton className="h-5 w-28" />
              </div>
            </div>
            <div className="text-right space-y-2 shrink-0">
              <Skeleton className="h-4 w-16 ml-auto" />
              <Skeleton className="h-6 w-28 ml-auto" />
              <Skeleton className="h-4 w-20 ml-auto mt-2" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-40" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-52" />
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-white/5 p-6 rounded-lg space-y-2">
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-8 w-36" />
          </div>

          <div className="border border-gray-200 dark:border-white/10 rounded-lg overflow-hidden">
            <div className="bg-gray-50 dark:bg-white/5 px-4 py-3 flex gap-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-12 ml-auto" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
            </div>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="border-t border-gray-200 dark:border-white/10 px-4 py-3 flex gap-4 items-center"
              >
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-8 ml-auto" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
              <div className="flex justify-between">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-14" />
              </div>
              <div className="flex justify-between pt-3 border-t border-gray-200 dark:border-white/10">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-20" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
