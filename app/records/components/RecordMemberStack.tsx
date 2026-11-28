import type { RecordItem } from "../actions"
import { recordMemberIds, type RecordCardMembers } from "../hooks/useRecordCardMembers"
import { RecordMemberAvatar } from "./RecordMemberAvatar"
import { cn } from "@/lib/utils"

export function RecordMemberStack({ record, members, compact = false, omit }: {
  record: RecordItem; members: RecordCardMembers; compact?: boolean; omit?: string
}) {
  if (record.site_id !== members.siteId) return null
  const ids = recordMemberIds(record).filter(id => id !== omit)
  if (!ids.length) return null
  const max = compact ? 1 : 3
  const hidden = ids.slice(max)
  const extraLabel = hidden.map(id => members.labels[id] || "Team member").join(", ")
  return (
    <span role="group" aria-label="Assigned team members" className="inline-flex shrink-0 items-center -space-x-1.5">
      {ids.slice(0, max).map(id => <RecordMemberAvatar key={id} name={members.labels[id]}
        src={members.labels[id] ? members.profiles[id]?.avatar_url : undefined} compact={compact} className="ring-1 ring-background" />)}
      {hidden.length > 0 && <span aria-label={`${hidden.length} more: ${extraLabel}`} title={extraLabel}
        className={cn("z-10 flex items-center justify-center rounded-full bg-muted text-[9px] font-medium text-foreground ring-1 ring-background", compact ? "size-5" : "size-6")}>
        +{hidden.length}
      </span>}
    </span>
  )
}