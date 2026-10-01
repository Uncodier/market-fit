import type { ReactNode } from "react"

/** Traffic plots and their loading state share the same full-width vertical tracks. */
export function StackedDistributionLayout({ plot, rows }: { plot: ReactNode; rows: ReactNode }) {
  return <div data-distribution-layout="stacked" className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-5">
    <div data-distribution-plot className="flex w-full shrink-0 items-center justify-center py-2">
      {plot}
    </div>
    <div data-distribution-rows className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-auto">
      {rows}
    </div>
  </div>
}