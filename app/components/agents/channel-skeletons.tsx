import { AgentLoadingRegion } from "./agent-loading-region"
import { SectionCard, SectionCardContent, SectionCardHeader } from "@/app/components/ui/section-card"
import { Skeleton } from "@/app/components/ui/skeleton"

/** Shared footprint for the serving agent and per-connection actions. */
export function ChannelAgentRowShape({ profile = false }: { profile?: boolean }) {
  return <div className="mx-5 mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t pt-3">
    <div className="flex min-w-0 items-center gap-2"><Skeleton className="size-4 shrink-0" /><Skeleton className="h-4 w-40 max-w-full" /></div>
    <div className="flex gap-2">{!profile && <Skeleton className="h-8 w-20 rounded-full" />}<Skeleton className="h-8 w-24 rounded-full" /></div>
  </div>
}

export function ChannelCardShape({ profile = false }: { profile?: boolean }) {
  return <SectionCard>
    <SectionCardHeader>
      <div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><Skeleton className="size-5 shrink-0" /><Skeleton className="h-5 w-28 max-w-full" /></div>
        <div className="flex shrink-0 items-center gap-2"><Skeleton className="h-5 w-12 rounded-full" />
          {!profile && <Skeleton className="size-8 rounded-full" />}</div></div>
      {profile && <Skeleton className="h-4 w-36 max-w-full" />}
    </SectionCardHeader>
    <ChannelAgentRowShape profile={profile} />
    {!profile && <SectionCardContent><div className="flex items-center gap-4 rounded-lg border p-4">
      <Skeleton className="size-12 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-5 w-40 max-w-full" /><Skeleton className="h-4 w-16" /></div>
    </div></SectionCardContent>}
  </SectionCard>
}

export function AgentChannelsSkeleton() {
  return <AgentLoadingRegion><div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-7 w-28 max-w-full" /><Skeleton className="h-4 w-64 max-w-full" /></div>
      <Skeleton className="h-9 w-32 rounded-full" />
    </div>
    <div className="space-y-2"><Skeleton className="h-5 w-44 max-w-full" />
      <ChannelCardShape profile /><ChannelCardShape profile /></div>
    <Skeleton className="h-9 w-48 max-w-full rounded-full" />
  </div></AgentLoadingRegion>
}