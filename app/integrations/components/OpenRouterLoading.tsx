import { SettingsLoading } from "@/app/components/settings/settings-loading"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { SectionCard, SectionCardContent, SectionCardHeader } from "@/app/components/ui/section-card"
import { Skeleton } from "@/app/components/ui/skeleton"

export function OpenRouterLoading() {
  return <SettingsLoading label="Loading OpenRouter connection">
    <SectionCard id="openrouter-integration" data-skeleton-shape="openrouter-connection">
      <SectionCardHeader><Skeleton className="h-6 w-64 max-w-full" /></SectionCardHeader>
      <SectionCardContent className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/5" />
        </div>
        <Skeleton className="h-20 w-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="flex items-start gap-2">
          <Skeleton className="h-4 w-4 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </div>
      </SectionCardContent>
      <ActionFooter><Skeleton className="h-9 w-40" /></ActionFooter>
    </SectionCard>
  </SettingsLoading>
}

export function OpenRouterModelsLoading() {
  return <SettingsLoading label="Loading OpenRouter models">
    {[0, 1, 2].map(row => <div key={row} className="space-y-3 rounded-md border p-3">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-4 w-3/5" />
      <Skeleton className="h-10 w-full" />
      <div className="flex justify-end"><Skeleton className="h-9 w-32" /></div>
    </div>)}
  </SettingsLoading>
}