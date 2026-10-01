import { Skeleton } from "@/app/components/ui/skeleton"
import { ReportChartFrame } from "./report-chart-frame"
import type { DynamicOptionsLoadingProps } from "next/dynamic"
import { StackedDistributionLayout } from "./stacked-distribution-layout"

export function ReportDistributionLoading({ label = "Loading distribution", rows = 5, decorative = false }: {
  label?: string; rows?: number; decorative?: boolean
}) {
  return <div role={decorative ? undefined : "status"} aria-label={decorative ? undefined : label}
    aria-busy={decorative ? undefined : true} aria-hidden={decorative || undefined} className="flex min-h-0 min-w-0 flex-1 flex-col">
    {!decorative && <span className="sr-only">{label}…</span>}
    <StackedDistributionLayout
      plot={<div aria-hidden="true" className="aspect-square w-40 max-w-full rounded-full border-[24px] border-muted/50 sm:w-48" />}
      rows={<div aria-hidden="true" className="flex h-full min-w-0 flex-col">
        <Skeleton className="mb-2 h-3 w-64 max-w-full shrink-0 motion-reduce:animate-none" />
        {Array.from({ length: rows + 2 }, (_, index) => (
          <div key={index} className={index === 0 || index === rows + 1 ? "flex min-h-10 shrink-0 items-center gap-4 border-b py-3" : "flex min-h-10 flex-1 items-center gap-4 border-b py-3"}>
            <Skeleton className="h-3 min-w-0 flex-1 motion-reduce:animate-none" />
            <Skeleton className="h-3 w-12 max-w-[25%] motion-reduce:animate-none" />
            <Skeleton className="h-3 w-10 max-w-[22%] motion-reduce:animate-none" />
          </div>
        ))}
      </div>}
    />
  </div>
}

export function ReportChartLoading({ fitViewport = true }: DynamicOptionsLoadingProps & { fitViewport?: boolean } = {}) {
  return (
    <ReportChartFrame enabled={fitViewport} role="status" aria-label="Loading chart" aria-busy="true" className="flex h-[300px] min-w-0 flex-col gap-5 py-4 sm:h-[360px]">
      <span className="sr-only">Loading chart…</span>
      <div aria-hidden="true" className="ml-8 flex flex-1 flex-col justify-between border-b border-l px-3 py-2">
        {Array.from({ length: 4 }, (_, index) => <div key={index} className="border-t border-dashed" />)}
      </div>
      <div aria-hidden="true" className="flex justify-center gap-5">
        {[0, 1, 2].map(index => <Skeleton key={index} className="h-3 w-16 motion-reduce:animate-none" />)}
      </div>
    </ReportChartFrame>
  )
}

export function ReportTableLoading({ label = "Loading report" }: { label?: string }) {
  return (
    <div role="status" aria-label={label} aria-busy="true" className="min-w-0 space-y-4 py-3">
      <span className="sr-only">{label}…</span>
      <div aria-hidden="true" className="space-y-4">
        <Skeleton className="h-4 w-40 max-w-full motion-reduce:animate-none" />
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="grid grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] gap-4 border-t pt-3">
            {Array.from({ length: 4 }, (_, column) => <Skeleton key={column} className="h-5 w-full motion-reduce:animate-none" />)}
          </div>
        ))}
      </div>
    </div>
  )
}