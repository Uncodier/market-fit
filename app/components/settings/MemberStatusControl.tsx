"use client"

import { Badge } from "../ui/badge"
import { CheckCircle2, Clock, Loader } from "../ui/icons"
import { Switch } from "../ui/switch"
import type { FormTeamMember } from "./team-types"

interface MemberStatusControlProps {
  member: FormTeamMember
  disabled: boolean
  isUpdating: boolean
  onEnabledChange: (enabled: boolean) => void
}

export function MemberStatusControl({ member, disabled, isUpdating, onEnabledChange }: MemberStatusControlProps) {
  if (member.originalRole === "owner" || member.is_primary_owner) {
    return (
      <Badge className="bg-green-50 text-green-700 hover:bg-green-100 border-green-200">
        <CheckCircle2 className="h-3 w-3 mr-1" /> Owner
      </Badge>
    )
  }

  const pending = member.status === "pending"
  const canToggle = !!member.id && (member.status === "active" || pending)
  const enabled = !member.license_suspended && !member.manually_disabled
  const name = member.name || member.email
  const switchId = `member-enabled-${member.id}`

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
      {pending && (
        <Badge className="bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-200">
          <Clock className="h-3 w-3 mr-1" /> Pending
        </Badge>
      )}
      {member.status === "rejected" && <Badge variant="outline">Rejected</Badge>}
      {canToggle && (
        <div className="flex items-center gap-2" aria-busy={isUpdating}>
          {isUpdating && <Loader className="h-3 w-3 animate-spin" aria-hidden={true} />}
          <label htmlFor={switchId} className="text-sm text-muted-foreground">
            {enabled ? "Active" : "Inactive"}
          </label>
          <Switch
            id={switchId}
            checked={enabled}
            disabled={disabled || isUpdating}
            onCheckedChange={onEnabledChange}
            aria-label={`Member license for ${name}`}
            title={enabled
              ? "Deactivate to release this member's license without deleting their records."
              : "Reactivate this member if the site license has capacity."}
          />
        </div>
      )}
    </div>
  )
}