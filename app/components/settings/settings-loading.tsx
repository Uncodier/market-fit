import type { ReactNode } from "react"
import { Skeleton } from "../ui/skeleton"
import { SectionCard, SectionCardContent, SectionCardFooter, SectionCardHeader } from "../ui/section-card"
import { TEAM_ROLES } from "./team-types"

export function SettingsLoading({ label, children, className = "space-y-4" }: {
  label: string
  children: ReactNode
  className?: string
}) {
  return <div role="status" aria-label={label} aria-busy="true" className={className}>
    <span className="sr-only">{label}...</span>
    <div aria-hidden="true" className={className}>{children}</div>
  </div>
}

function TextLines() {
  return <div className="min-w-0 flex-1 space-y-2">
    <Skeleton className="h-4 w-40 max-w-full" />
    <Skeleton className="h-3 w-64 max-w-full" />
  </div>
}

function Field({ tall = false }: { tall?: boolean }) {
  return <div className="space-y-2">
    <Skeleton className="h-4 w-28" />
    <Skeleton className={tall ? "h-64 w-full" : "h-10 w-full"} />
  </div>
}

export function SettingsSelectionLoading({ label, variant = "checkbox" }: {
  label: string
  variant?: "checkbox" | "mining" | "phone"
}) {
  return <SettingsLoading label={label} className="space-y-3">
    {variant === "phone" && <Skeleton className="h-4 w-48 max-w-full" />}
    {[0, 1, 2].map(row => <div key={row} className={variant === "checkbox" ? "space-y-2" : "space-y-2 rounded-md border p-3"}>
      <div className="flex items-center gap-2">
        <Skeleton className={`h-4 w-4 shrink-0 ${variant === "phone" ? "rounded-full" : ""}`} />
        {variant === "phone" ? <TextLines /> : <Skeleton className="h-4 w-48 max-w-full" />}
        {variant === "phone" && <Skeleton className="h-5 w-14 shrink-0" />}
      </div>
      {variant === "mining" && <>
        <Skeleton className="h-3 w-64 max-w-full" />
        <Skeleton className="h-1.5 w-full" />
      </>}
    </div>)}
  </SettingsLoading>
}

export function SettingsCardsLoading({ kind }: { kind: "skills" | "team" | "copywriting" }) {
  const labels = { skills: "Loading Makinari skills", team: "Loading team members", copywriting: "Loading copywriting" }
  return <SettingsLoading label={labels[kind]} className="space-y-6">
    <SettingsCardsSkeletonContent kind={kind} />
  </SettingsLoading>
}

export function SettingsCardsSkeletonContent({ kind }: { kind: "skills" | "team" | "copywriting" }) {
  return <>
    {kind === "copywriting" && <div className="flex items-center justify-between gap-4">
      <TextLines /><Skeleton className="h-9 w-32" />
    </div>}
    {[0, 1].map(row => <SectionCard key={row} data-skeleton-shape={kind === "team" ? "list" : kind}>
      <SectionCardHeader className={kind === "team" ? "border-b border-border/70" : ""}>
      <div className="flex items-center gap-3">
        {kind !== "skills" && <Skeleton className={kind === "team" ? "h-10 w-10 rounded-full" : "h-5 w-5"} />}
        <TextLines />
        {kind !== "skills" && <Skeleton className={kind === "team" ? "h-6 w-11 rounded-full" : "h-5 w-5"} />}
      </div>
      </SectionCardHeader>
      {kind === "team" && <SectionCardContent className="pt-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2" data-team-detail-fields>
          <Field /><Field />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <div className="grid grid-cols-2 gap-1 md:grid-cols-4" data-team-role-tabs>
            {TEAM_ROLES.map(role => <Skeleton key={role.value} className="h-10 w-full" />)}
          </div>
        </div>
      </SectionCardContent>}
      {kind !== "copywriting" && <SectionCardFooter>
        <Skeleton className="h-9 w-36" />
      </SectionCardFooter>}
    </SectionCard>)}
  </>
}

export function SettingsSecretsLoadingRows() {
  return <>{[0, 1, 2].map(row => <tr key={row} aria-hidden="true">
    <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
    <td className="px-4 py-3"><Skeleton className="h-5 w-20" /></td>
    <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
    <td className="px-4 py-3"><div className="flex justify-end gap-2">
      <Skeleton className="h-8 w-8" /><Skeleton className="h-8 w-8" />
    </div></td>
  </tr>)}</>
}

export function VisitsSettingsLoading() {
  return <SettingsLoading label="Loading visit settings">
    <VisitsSettingsSkeletonContent />
  </SettingsLoading>
}

export function VisitsSettingsSkeletonContent() {
  return <>
    <SectionCard data-settings-section="visits-channels">
      <SectionCardHeader><TextLines /></SectionCardHeader>
      <SectionCardContent className="space-y-5">
        {[0, 1, 2, 3, 4].map(row => <div key={row} className="flex items-center justify-between gap-4">
          <TextLines /><Skeleton className="h-6 w-11 rounded-full" />
        </div>)}
        <div className="max-w-xs"><Field /></div>
      </SectionCardContent>
      <SectionCardFooter><Skeleton className="h-9 w-24" /></SectionCardFooter>
    </SectionCard>
    <SectionCard data-settings-section="visits-terms">
      <SectionCardHeader><TextLines /></SectionCardHeader>
      <SectionCardContent><Skeleton className="h-64 w-full" /><Skeleton className="h-3 w-64 max-w-full" /></SectionCardContent>
      <SectionCardFooter><Skeleton className="h-9 w-24" /></SectionCardFooter>
    </SectionCard>
  </>
}

export function VoiceOptionsLoading() {
  return <SettingsLoading label="Loading voice options" className="space-y-3">
    <div className="grid gap-3 sm:grid-cols-2"><Field /><Field /></div>
    <Skeleton className="h-3 w-full" />
  </SettingsLoading>
}