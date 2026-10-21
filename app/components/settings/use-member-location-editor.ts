"use client"

import { useEffect, useRef, useState } from "react"
import { sameLocationIds, type TeamLocationAccessResponse } from "@/lib/permissions/team-location-access-schema"
import { formRoleToSiteMemberRole, type FormTeamMember } from "./team-types"
import { useTeamLocationAccess } from "./TeamLocationAccess"

export function useMemberLocationEditor({ member, siteId, canManageTeam, disabled = false }: {
  member: FormTeamMember; siteId?: string; canManageTeam: boolean; disabled?: boolean
}) {
  const access = useTeamLocationAccess()
  const [draft, setDraft] = useState<{ base: TeamLocationAccessResponse["members"][number]; ids: string[] } | null>(null)
  const [feedback, setFeedback] = useState<{ error: boolean; message: string; refreshRequired?: boolean } | null>(null)
  const mounted = useRef(true)
  const pending = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const saved = access?.siteId === siteId ? access?.data?.members.find(item => item.id.toLowerCase() === member.id?.toLowerCase()) : undefined
  const savedIds = saved?.restricted_location_ids ?? []
  // Refresh replaces the snapshot, so an older draft never becomes current again.
  const selected = draft?.base === saved ? draft?.ids ?? savedIds : savedIds
  const changed = !!saved && !sameLocationIds(selected, savedIds)
  const persistedExempt = member.is_primary_owner || member.originalRole === "owner" || member.originalRole === "admin" ||
    saved?.is_location_exempt || saved?.role === "owner" || saved?.role === "admin"
  const exempt = persistedExempt || member.role === "admin"
  const roleChanged = saved && formRoleToSiteMemberRole(member.role) !== saved.role
  const busy = !!access?.savingMemberId
  const saveDisabledReason = !member.id ? "Save the invitation before setting location restrictions." :
    !canManageTeam ? "Only team managers can edit location restrictions." :
    persistedExempt ? "Owners and admins are exempt from location restrictions." :
    member.status === "rejected" ? "Only active members and pending invitations can be edited." :
    access?.loading ? "Loading location access…" :
    access?.error ? access.error :
    !saved ? "Location access is unavailable for this member. Refresh before editing." :
    !access?.data?.editing_enabled ? "Location restriction editing is not available yet." : undefined
  const disabledReason = saveDisabledReason || (exempt ? "Owners and admins are exempt from location restrictions." :
    roleChanged ? "Save the member's role before editing location restrictions." : undefined)
  const readOnly = !!disabledReason || disabled || busy || !!feedback?.refreshRequired
  // Existing drafts save under the verified persisted role before a role change.
  const canSave = changed && !saveDisabledReason && !disabled && !busy && !feedback?.refreshRequired
  const locations = access?.siteId === siteId ? access?.data?.locations ?? [] : []
  const replace = (ids: string[]) => {
    if (readOnly || !saved) return
    setDraft({ base: saved, ids })
    setFeedback(null)
  }
  const toggle = (id: string, restricted: boolean) => replace(restricted ? [...selected, id] :
    selected.filter(value => value.toLowerCase() !== id.toLowerCase()))
  const save = async (showSuccess = true) => {
    if (!access || !member.id || !canSave || pending.current) return false
    pending.current = true
    try {
      const result = await access.save(member.id, selected)
      if (!mounted.current || result.status === "stale") return false
      if (result.status === "saved") {
        setDraft(null)
        setFeedback(showSuccess ? { error: false, message: "Location restrictions saved." } : null)
        return true
      }
      setFeedback({ error: true, message: result.message, refreshRequired: result.refreshRequired })
      return false
    } finally { pending.current = false }
  }
  const refresh = () => { access?.refresh(); setFeedback(null) }
  return { saved, selected, changed, exempt, disabledReason, readOnly, canSave, locations, feedback, toggle, replace, save, refresh,
    canRefresh: !!member.id && canManageTeam && !disabled && !busy && !access?.loading }
}

export type MemberLocationEditor = ReturnType<typeof useMemberLocationEditor>