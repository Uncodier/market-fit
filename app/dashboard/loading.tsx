import { Skeleton } from "@/app/components/ui/skeleton"
import { ReportLoading } from "./ReportLoading"
import { StickyHeader } from "@/app/components/ui/sticky-header"

export default function DashboardLoading() {
  return (
    <div className="flex-1 min-w-0 w-full min-h-[calc(100dvh-var(--topbar-height,64px))] flex flex-col">
      <StickyHeader>
        <div aria-hidden="true" className="mx-auto flex w-full max-w-[1536px] min-w-0 flex-wrap items-center justify-between gap-3 py-2">
          <Skeleton className="h-9 w-64 max-w-full motion-reduce:animate-none" />
          <div className="ml-auto flex items-center gap-2">
            <Skeleton className="h-8 w-8 motion-reduce:animate-none" />
            <Skeleton className="hidden h-9 w-44 md:block motion-reduce:animate-none" />
            <Skeleton className="h-9 w-24 md:w-60 motion-reduce:animate-none" />
          </div>
        </div>
      </StickyHeader>
      <div className="bg-muted/20 flex-1 min-w-0">
        <div className="mx-auto w-full max-w-[1600px] px-4 py-5 md:px-8 md:py-6 space-y-5">
          <Skeleton aria-hidden="true" className="h-4 w-96 max-w-full motion-reduce:animate-none" />
          <ReportLoading />
        </div>
      </div>
    </div>
  )
}
