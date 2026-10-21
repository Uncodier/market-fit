"use client"

import { useEffect, useId, useRef, useState } from "react"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { Checkbox } from "@/app/components/ui/checkbox"
import { Input } from "@/app/components/ui/input"
import { Loader, Save, Search } from "@/app/components/ui/icons"
import { sameLocationIds, type TeamLocationAccessResponse } from "@/lib/permissions/team-location-access-schema"
import { formRoleToSiteMemberRole, type FormTeamMember } from "./team-types"
import { useTeamLocationAccess } from "./TeamLocationAccess"

export function MemberLocationRestrictions({ member, siteId, canManageTeam, disabled = false }: {
  member: FormTeamMember; siteId?: string; canManageTeam: boolean; disabled?: boolean
}) {
  const access = useTeamLocationAccess()
  const inputId = useId()
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

  return <section aria-label="Restricted locations" className="rounded-lg border border-border/70 bg-muted/20 p-3 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-medium">Restricted locations</h3>
      {saved && !exempt && <Badge variant="secondary">{selected.length} selected</Badge>}
    </div>
    <p className="text-xs text-muted-foreground">
      Selected branches are denied in addition to existing role, app, and assigned-data permissions.
      An empty list adds no location restrictions. New branches are not restricted automatically.
    </p>
    {disabledReason && <p role="status" className="text-xs text-muted-foreground">{disabledReason}</p>}
    {saved && !exempt && <>
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input aria-label="Search branches" placeholder="Search branches…" value={query}
          onChange={event => setQuery(event.target.value)} className="pl-9" />
      </div>
      <div className="max-h-52 overflow-y-auto space-y-1">
        {matching.map(location => <label key={location.id} htmlFor={`${inputId}-${location.id}`}
          className="flex items-center gap-2 rounded px-1 py-2 text-sm hover:bg-muted/50">
          <Checkbox id={`${inputId}-${location.id}`} disabled={readOnly}
            checked={selected.some(id => id.toLowerCase() === location.id.toLowerCase())}
            onCheckedChange={checked => toggle(location.id, checked === true)} />
          <span>{location.name}{location.is_active === false ? " · inactive" : location.is_active === null ? " · status unknown" : ""}</span>
        </label>)}
        {!matching.length && <p className="text-xs text-muted-foreground py-2">{locations.length ? "No branches match your search." : "No branches configured."}</p>}
      </div>
      {selected.length === 0 && <p className="text-xs text-muted-foreground">No additional location restrictions</p>}
      <p className="text-xs text-muted-foreground">Inactive branches keep their restrictions unless you uncheck them. Save locations separately from member details. Refresh reloads the saved selection.</p>
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
  </section>
}