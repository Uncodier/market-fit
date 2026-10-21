"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Loader, Save, Search } from "@/app/components/ui/icons"
import { sameLocationIds, type TeamLocationAccessResponse } from "@/lib/permissions/team-location-access-schema"
import { formRoleToSiteMemberRole, type FormTeamMember } from "./team-types"
import { useTeamLocationAccess } from "./TeamLocationAccess"
import { MemberAccessChip, MemberAccessPanel } from "./MemberAccessPanel"

export function MemberLocationRestrictions({ member, siteId, canManageTeam, disabled = false }: {
  member: FormTeamMember; siteId?: string; canManageTeam: boolean; disabled?: boolean
}) {
  const access = useTeamLocationAccess()
  const [query, setQuery] = useState("")
  const [draft, setDraft] = useState<{ base: TeamLocationAccessResponse["members"][number]; ids: string[] } | null>(null)
  const [feedback, setFeedback] = useState<{ error: boolean; message: string; refreshRequired?: boolean } | null>(null)
  const mounted = useRef(true)
  const pending = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const saved = access?.siteId === siteId ? access?.data?.members.find(item => item.id.toLowerCase() === member.id?.toLowerCase()) : undefined
  const savedIds = saved?.restricted_location_ids ?? []
  // A successful refresh supplies a new snapshot. Never resurrect an older draft
  // if another editor later restores the same list of UUIDs.
  const selected = draft?.base === saved ? draft?.ids ?? savedIds : savedIds
  const changed = !!saved && !sameLocationIds(selected, savedIds)
  const exempt = member.is_primary_owner || member.originalRole === "owner" || member.originalRole === "admin" ||
    member.role === "admin" || saved?.is_location_exempt || saved?.role === "owner" || saved?.role === "admin"
  const roleChanged = saved && formRoleToSiteMemberRole(member.role) !== saved.role
  const busy = !!access?.savingMemberId
  const disabledReason = !member.id ? "Save the invitation before setting location restrictions." :
    !canManageTeam ? "Only team managers can edit location restrictions." :
    exempt ? "Owners and admins are exempt from location restrictions." :
    member.status === "rejected" ? "Only active members and pending invitations can be edited." :
    roleChanged ? "Save the member's role before editing location restrictions." :
    access?.loading ? "Loading location access…" :
    access?.error ? access.error :
    !saved ? "Location access is unavailable for this member. Refresh before editing." :
    !access?.data?.editing_enabled ? "Location restriction editing is not available yet." : undefined
  const readOnly = !!disabledReason || disabled || busy || feedback?.refreshRequired
  const locations = access?.siteId === siteId ? access?.data?.locations ?? [] : []
  const matching = locations.filter(location => location.name.toLowerCase().includes(query.trim().toLowerCase()))
  const restricted = new Set(selected.map(id => id.toLowerCase()))
  const preview = locations.filter(location => restricted.has(location.id.toLowerCase())).map(location => location.name).slice(0, 2)
  const allRestricted = locations.length > 0 && locations.every(location => restricted.has(location.id.toLowerCase()))
  const toggle = (id: string, checked: boolean) => {
    if (readOnly || !saved) return
    setDraft({ base: saved, ids: checked ? [...selected, id] : selected.filter(value => value.toLowerCase() !== id.toLowerCase()) })
    setFeedback(null)
  }
  const save = async () => {
    if (!access || !member.id || readOnly || !changed || pending.current) return
    pending.current = true
    setFeedback(null)
    const result = await access.save(member.id, selected)
    pending.current = false
    if (!mounted.current || result.status === "stale") return
    if (result.status === "saved") {
      setDraft(null)
      setFeedback({ error: false, message: "Location restrictions saved." })
    } else setFeedback({ error: true, message: result.message, refreshRequired: result.refreshRequired })
  }

  return <MemberAccessPanel key={saved?.id ?? "unavailable"} title="Location access"
    count={saved && !exempt ? selected.length : 0} countLabel="restricted" preview={preview}
    summary={exempt || !saved ? disabledReason ?? "Not available" : "No additional location restrictions"}
    initialOpen={!!saved && selected.length > 0 && !exempt}>
    <p className="text-xs text-muted-foreground">
      Selected branches are denied in addition to existing role, app, and assigned-data permissions.
      An empty list adds no location restrictions. New branches are not restricted automatically.
    </p>
    {disabledReason && saved && !exempt && <p role="status" className="text-xs text-muted-foreground">{disabledReason}</p>}
    {saved && !exempt && <>
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input aria-label="Search branches" placeholder="Search branches…" value={query}
          onChange={event => setQuery(event.target.value)} className="pl-9" />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">Branches</p>
          <button type="button" disabled={readOnly || !locations.length}
            className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
            onClick={() => {
              if (readOnly || !saved) return
              setDraft({ base: saved, ids: allRestricted ? [] : locations.map(location => location.id) })
              setFeedback(null)
            }}>{allRestricted ? "Allow all" : "Restrict all"}</button>
        </div>
        <div className="flex max-h-52 flex-wrap gap-1.5 overflow-y-auto">
          {matching.map(location => {
            const isRestricted = restricted.has(location.id.toLowerCase())
            return <MemberAccessChip key={location.id} restricted={isRestricted} disabled={readOnly}
              title={isRestricted ? "Allow this location" : "Restrict this location"}
              onClick={() => toggle(location.id, !isRestricted)}>
              {location.name}{location.is_active === false ? " · inactive" : location.is_active === null ? " · status unknown" : ""}
            </MemberAccessChip>
          })}
          {!matching.length && <p className="text-xs text-muted-foreground py-2">{locations.length ? "No branches match your search." : "No branches configured."}</p>}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Inactive branches keep their restrictions unless you allow them. Save locations separately from member details. Refresh reloads the saved selection.</p>
    </>}
    {feedback && <p role={feedback.error ? "alert" : "status"} className={`text-xs ${feedback.error ? "text-destructive" : "text-muted-foreground"}`}>{feedback.message}</p>}
    <div className="flex flex-wrap gap-2">
      {member.id && canManageTeam && !exempt && <Button type="button" size="sm" onClick={() => void save()}
        disabled={readOnly || !changed} data-permission="allow">
        {access?.savingMemberId === member.id ? <Loader className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
        {access?.savingMemberId === member.id ? "Saving locations…" : "Save location restrictions"}
      </Button>}
      {member.id && canManageTeam && <Button type="button" size="sm" variant="ghost" disabled={busy || access?.loading}
        onClick={() => { access?.refresh(); setFeedback(null) }}>Refresh location access</Button>}
    </div>
  </MemberAccessPanel>
}