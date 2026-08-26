import { Skeleton } from "@/app/components/ui/skeleton"

export function ContextFilesSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-3">
        <div className="space-y-1">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-60" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>

      <div className="space-y-3">
        {Array(3).fill(0).map((_, i) => (
          <div key={i} className="border rounded-lg p-3 flex items-center">
            <div className="flex-1 flex items-center space-x-3">
              <Skeleton className="h-4 w-4 rounded-full" />
              <div className="space-y-1 flex-1">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
            <div className="flex space-x-1">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ActivitiesSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-3">
        <div className="space-y-1">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>

      <div className="space-y-3">
        {Array(6).fill(0).map((_, i) => (
          <div key={i} className="border rounded-lg p-3 flex items-center">
            <div className="flex-1 flex items-center space-x-3">
              <Skeleton className="h-4 w-4 rounded-full" />
              <div className="space-y-1 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-44" />
              </div>
            </div>
            <Skeleton className="h-5 w-10 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function AgentPageSkeleton() {
  return (
    <div className="flex-1 p-0">
      <div className="sticky top-[var(--topbar-height,64px)] min-h-[71px] flex items-center p-0 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border/40 z-10">
        <div className="w-full transition-[padding] duration-300 ease-in-out">
          <div className="px-4 md:px-16 pt-0">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-8">
                <div className="inline-flex h-10 items-center justify-center rounded-full bg-muted p-1 text-muted-foreground">
                  {["Basic Information", "Tools", "Triggers", "Integrations", "Context Files", "Activities"].map((tab, index) => (
                    <div
                      key={index}
                      className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ${
                        index === 0
                          ? "bg-background text-foreground shadow-sm"
                          : index === 1 || index === 2 || index === 3
                            ? "hidden"
                            : "text-muted-foreground"
                      }`}
                      data-hide-in-safari={index === 1 || index === 2 || index === 3 ? "true" : undefined}
                    >
                      {tab}
                    </div>
                  ))}
                </div>
              </div>
              <div className="ml-auto">
                <div className="inline-flex items-center justify-center rounded-full text-sm font-medium bg-primary text-primary-foreground h-10 px-4 py-2">
                  Save changes
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-16 py-8 pb-16 max-w-[880px] mx-auto">
        <div className="space-y-8">
          <div className="rounded-lg border shadow-sm">
            <div className="p-6">
              <div className="space-y-2 mb-4">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between border-b pb-4 mb-4">
                  <div className="space-y-1">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-64" />
                  </div>
                  <Skeleton className="h-6 w-12 rounded-full" />
                </div>

                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-10 w-full" />
                </div>

                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-24 w-full" />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border shadow-sm">
            <div className="p-6">
              <div className="space-y-2 mb-4">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-4 w-80" />
              </div>

              <Skeleton className="h-40 w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
