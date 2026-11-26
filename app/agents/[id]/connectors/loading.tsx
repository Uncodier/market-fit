import { AgentConnectorsSkeleton } from "@/app/agents/agent-detail-skeletons"
import { Skeleton } from "@/app/components/ui/skeleton"

export default function Loading() {
  return <div className="mx-auto w-full min-w-0 max-w-[880px] space-y-6 px-4 py-8 pb-16 md:px-16">
    <Skeleton aria-hidden="true" className="h-9 w-28 rounded-full motion-reduce:animate-none" />
    <AgentConnectorsSkeleton />
  </div>
}