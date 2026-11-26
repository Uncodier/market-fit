import { AgentLoadingRegion, AgentSkeletonToolbar } from "@/app/components/agents/agent-loading-region"
import { SectionCard, SectionCardContent, SectionCardFooter, SectionCardHeader } from "@/app/components/ui/section-card"
import { Skeleton } from "@/app/components/ui/skeleton"

function CardHeading() {
  return <SectionCardHeader><Skeleton className="h-6 w-40 max-w-full" /><Skeleton className="h-4 w-80 max-w-full" /></SectionCardHeader>
}

function CardFooter() {
  return <SectionCardFooter><Skeleton className="h-[34px] w-40 max-w-full rounded-full" /></SectionCardFooter>
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

export function AgentConnectorsSkeleton() {
  return <AgentLoadingRegion><div className="space-y-6">
    <div className="flex flex-wrap justify-between gap-3">
      <div className="min-w-0 space-y-2"><Skeleton className="h-7 w-28" /><Skeleton className="h-5 w-64 max-w-full" /></div>
      <Skeleton className="h-9 w-32 rounded-full" />
    </div>
    {[0, 1, 2].map(row => <div key={row} className="flex min-h-[72px] items-center gap-3 rounded-xl border px-4">
      <Skeleton className="size-8 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-5 w-40 max-w-full" /><Skeleton className="h-4 w-24 max-w-full" /></div>
      <Skeleton className="size-4 shrink-0" />
    </div>)}
  </div></AgentLoadingRegion>
}

export function AgentPageSkeleton({ draft = false }: { draft?: boolean }) {
  return <AgentLoadingRegion className="flex-1">
    <AgentSkeletonToolbar>
      <div className="flex h-10 min-w-0 max-w-full items-center rounded-md bg-muted p-1 md:mx-16">
        <Skeleton className="h-[30px] w-32 max-w-full bg-background" />
        {!draft && <>
          <Skeleton className="mx-3 h-3.5 w-16" />
          <Skeleton className="mx-3 hidden h-3.5 w-14 md:block" />
          <Skeleton className="mx-3 hidden h-3.5 w-14 md:block" />
          <Skeleton className="mx-3 hidden h-3.5 w-[70px] md:block" />
          <Skeleton className="mx-3 size-3.5 md:hidden" />
        </>}
      </div>
    </AgentSkeletonToolbar>
    <div className="mx-auto max-w-[880px] space-y-8 px-4 py-8 pb-16 pt-10 md:px-16">
      <SectionCard>
        <CardHeading />
        <SectionCardContent>
          <div className="flex items-center justify-between gap-3 border-b pb-4">
            <div className="min-w-0 flex-1 space-y-1"><Skeleton className="h-6 w-28 max-w-full" /><Skeleton className="h-5 w-64 max-w-full" /></div>
            <Skeleton className="h-6 w-11 shrink-0 rounded-full" />
          </div>
          <div className="space-y-2"><Skeleton className="h-5 w-14" /><Skeleton className="h-11 w-full" /></div>
          {draft && <div className="space-y-2"><Skeleton className="h-5 w-16" /><Skeleton className="h-11 w-full" /></div>}
          <div className="space-y-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-11 w-full" /><Skeleton className="h-5 w-60 max-w-full" /></div>
          <div className="space-y-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-20 w-full" /></div>
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