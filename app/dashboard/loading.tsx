import { Skeleton } from "@/app/components/ui/skeleton"
import { ReportLoading } from "./ReportLoading"

export default function DashboardLoading() {
  return (
    <div className="mx-auto flex-1 min-w-0 w-full max-w-[1600px] px-4 py-5 md:px-8 md:py-6 space-y-5">
      <div aria-hidden="true" className="space-y-3 border-b pb-4">
        <Skeleton className="h-3 w-24 motion-reduce:animate-none" />
        <Skeleton className="h-7 w-48 max-w-full motion-reduce:animate-none" />
        <Skeleton className="h-4 w-96 max-w-full motion-reduce:animate-none" />
      </div>
      <ReportLoading />
    </div>
  )
}
