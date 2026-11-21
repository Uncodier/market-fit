import { AgentLoadingRegion, AgentSkeletonToolbar } from "@/app/components/agents/agent-loading-region"
import { Card, CardContent } from "@/app/components/ui/card"
import { Skeleton } from "@/app/components/ui/skeleton"

function LogFieldsSkeleton({ rows }: { rows: number }) {
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border border-border/30 bg-muted/40 p-4">
            <Skeleton className="h-12 w-12 shrink-0 rounded-md" />
            <div className="min-w-0 flex-1">
              <Skeleton className="mb-2 h-4 w-24 max-w-full" />
              <Skeleton className="h-5 w-48 max-w-full" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export default function ToolDetailSkeleton() {
  return (
    <AgentLoadingRegion>
      <div data-skeleton-shape="tool-log-detail" className="min-h-screen bg-background">
        <AgentSkeletonToolbar>
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-9 w-20 rounded-full" />)}
        </AgentSkeletonToolbar>
        <div className="container max-w-screen-2xl py-6">
          <div className="flex flex-col gap-6 lg:flex-row">
            <div className="min-w-0 lg:flex-1"><LogFieldsSkeleton rows={3} /></div>
            <div className="min-w-0 lg:w-1/3"><LogFieldsSkeleton rows={4} /></div>
          </div>
        </div>
      </div>
    </AgentLoadingRegion>
  )
}