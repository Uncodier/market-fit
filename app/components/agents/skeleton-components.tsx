import { AgentLoadingRegion, AgentSkeletonToolbar } from "./agent-loading-region"
import { Skeleton } from "@/app/components/ui/skeleton"
import { TableCell, TableRow } from "@/app/components/ui/table"

function AgentCardShape() {
  return <div className="min-w-0 rounded-2xl border bg-card shadow-sm">
    <div className="flex items-center gap-2 p-3 sm:p-4">
      <Skeleton className="size-7 shrink-0 rounded-full sm:size-9" />
      <div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-3.5 w-3/4" /><Skeleton className="h-3 w-full" /></div>
      <Skeleton className="hidden h-4 w-12 rounded-full sm:block" />
    </div>
    <div className="flex gap-2 px-3 pb-3 sm:px-4"><Skeleton className="h-7 flex-1 rounded-xl" /><Skeleton className="h-7 flex-1 rounded-xl" /></div>
    <div className="flex justify-center border-t py-2"><Skeleton className="h-3 w-1/3" /></div>
  </div>
}

function BoardShape() {
  return <div className="mx-auto flex min-h-[600px] w-full max-w-6xl flex-col items-center justify-center overflow-hidden px-4 sm:px-8" style={{ height: "calc(100vh - 135px)" }}>
    <Skeleton className="mb-4 h-5 w-40" />
    {[0, 1].map(i => <div key={i} className="flex w-48 max-w-full flex-col sm:w-60">
      <AgentCardShape /><div className="mx-auto h-6 w-px bg-border" />
    </div>)}
    <div className="grid w-full grid-cols-2 gap-x-3 sm:grid-cols-4 sm:gap-x-5">
      {[0, 1, 2, 3].map(i => <div key={i} className={i > 1 ? "hidden min-w-0 sm:block" : "min-w-0"}>
        <div className="mx-auto h-5 w-px bg-border" /><AgentCardShape />
      </div>)}
    </div>
  </div>
}

export function AgentBoardSkeleton() {
  return <AgentLoadingRegion><BoardShape /></AgentLoadingRegion>
}

export function AgentDirectorySkeleton() {
  return <AgentLoadingRegion className="flex-1">
    <AgentSkeletonToolbar>
      <Skeleton className="h-9 w-48 max-w-full rounded-md sm:w-64" />
      <Skeleton className="hidden h-9 w-40 rounded-full md:block" />
      <Skeleton className="ml-auto h-8 w-16 rounded-md" />
    </AgentSkeletonToolbar>
    <div className="py-4"><BoardShape /></div>
  </AgentLoadingRegion>
}

/** Remains a real table row with the same six columns as GridAgentRow. */
export function GridAgentRowSkeleton() {
  return <TableRow aria-hidden="true" className="motion-reduce:[&_.animate-pulse]:animate-none">
    <TableCell className="space-y-2 py-3.5 pl-4 sm:pl-6"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-3/4" /></TableCell>
    <TableCell><Skeleton className="h-3 w-14" /></TableCell>
    <TableCell><div className="flex items-center gap-2"><Skeleton className="size-2 rounded-full" /><Skeleton className="h-3 w-12" /></div></TableCell>
    <TableCell><div className="flex gap-1"><Skeleton className="size-5 rounded-full" /><Skeleton className="size-5 rounded-full" /></div></TableCell>
    <TableCell><Skeleton className="ml-auto h-3 w-16" /></TableCell>
    <TableCell className="pr-4 sm:pr-6"><div className="flex justify-end gap-1"><Skeleton className="size-7 rounded-full" /><Skeleton className="size-7 rounded-full" /></div></TableCell>
  </TableRow>
}