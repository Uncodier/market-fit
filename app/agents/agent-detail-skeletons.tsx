import { AgentLoadingRegion, AgentSkeletonToolbar } from "@/app/components/agents/agent-loading-region"
import { SectionCard, SectionCardContent, SectionCardFooter, SectionCardHeader } from "@/app/components/ui/section-card"
import { Skeleton } from "@/app/components/ui/skeleton"

function CardHeading() {
  return <SectionCardHeader><Skeleton className="h-6 w-40 max-w-full" /><Skeleton className="h-4 w-80 max-w-full" /></SectionCardHeader>
}

function CardFooter() {
  return <SectionCardFooter><Skeleton className="h-9 w-28 rounded-full" /></SectionCardFooter>
}

export function ContextFilesSkeleton() {
  return <AgentLoadingRegion><div className="space-y-2">
    {[0, 1, 2].map(i => <div key={i} className="flex min-h-16 items-center gap-3 rounded-lg border p-3">
      <Skeleton className="size-8 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-4 w-40 max-w-full" /><Skeleton className="h-3 w-24 max-w-full" /></div>
      <Skeleton className="h-8 w-16 shrink-0 rounded-full" />
    </div>)}
  </div></AgentLoadingRegion>
}

export function AgentPageSkeleton({ draft = false }: { draft?: boolean }) {
  return <AgentLoadingRegion className="flex-1">
    <AgentSkeletonToolbar>
      <div className="flex min-w-0 max-w-full items-center gap-1 rounded-md bg-muted/50 p-1 md:mx-16">
        <Skeleton className="h-8 w-28 max-w-full bg-background" />
        {!draft && <><Skeleton className="hidden h-8 w-24 sm:block" /><Skeleton className="hidden h-8 w-20 sm:block" />
          <Skeleton className="h-8 w-8 sm:w-20" /></>}
      </div>
    </AgentSkeletonToolbar>
    <div className="mx-auto max-w-[880px] space-y-8 px-4 py-8 pb-16 md:px-16">
      <SectionCard>
        <CardHeading />
        <SectionCardContent>
          <div className="flex items-center justify-between gap-3 border-b pb-4">
            <div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-5 w-28 max-w-full" /><Skeleton className="h-4 w-64 max-w-full" /></div>
            <Skeleton className="h-6 w-11 shrink-0 rounded-full" />
          </div>
          <div className="space-y-2"><Skeleton className="h-4 w-14" /><Skeleton className="h-11 w-full" /></div>
          {draft && <div className="space-y-2"><Skeleton className="h-4 w-16" /><Skeleton className="h-10 w-full" /></div>}
          <div className="space-y-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-11 w-full" /><Skeleton className="h-4 w-60 max-w-full" /></div>
          <div className="space-y-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-20 w-full" /></div>
        </SectionCardContent>
        <CardFooter />
      </SectionCard>
      {["h-56", "h-36"].map(height => <SectionCard key={height}>
        <CardHeading /><SectionCardContent><Skeleton className={`${height} w-full`} /></SectionCardContent>
        {!draft && <CardFooter />}
      </SectionCard>)}
    </div>
  </AgentLoadingRegion>
}