import { Skeleton } from "@/app/components/ui/skeleton"
import { SectionCard, SectionCardContent, SectionCardFooter, SectionCardHeader } from "@/app/components/ui/section-card"
import { SettingsLoading } from "./settings-loading"

const labels = {
  community: "Loading community skills",
  managed: "Loading your skills",
  system: "Loading Makinari skills",
}

export function SkillsLoading({ kind }: { kind: keyof typeof labels }) {
  return <SettingsLoading label={labels[kind]}>
    {kind === "system" && <Skeleton className="h-5 w-16" />}
    {kind !== "managed" && <Skeleton className={kind === "community" ? "h-7 w-48" : "h-7 w-16"} />}
    {[0, 1].map(row => <SectionCard key={row} data-skeleton-shape={`skill-${kind}`}>
      <SectionCardHeader
        title={<span className="flex min-h-7 flex-wrap items-center gap-x-3 gap-y-1">
          <span className="h-5 w-36 max-w-full animate-pulse rounded-md bg-muted" />
          {kind === "community" && <span className="h-3 w-24 max-w-full animate-pulse rounded-md bg-muted" />}
        </span>}
        description={<span className="inline-block h-3 w-40 max-w-full animate-pulse rounded-md bg-muted" />}
        actions={kind === "managed" && <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-5 w-9 rounded-full" />
        </div>}
      />
      {kind !== "system" && <SectionCardContent>
        <Skeleton className="h-3 w-4/5" />
      </SectionCardContent>}
      <SectionCardFooter>
        {kind === "managed" ? <>
          <Skeleton className="h-9 w-16 rounded-full" />
          <Skeleton className="h-9 w-24 rounded-full" />
        </> : <Skeleton className="h-10 w-36 rounded-full" />}
      </SectionCardFooter>
    </SectionCard>)}
  </SettingsLoading>
}