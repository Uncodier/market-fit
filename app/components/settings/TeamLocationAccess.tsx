"use client"

import { useEffect, useState } from "react"
import { Button } from "@/app/components/ui/button"
import { Badge } from "@/app/components/ui/badge"
import { teamLocationAccessResponseSchema, type TeamLocationAccessResponse } from "@/lib/permissions/team-location-access-schema"
import { LOCATION_ACCESS_ROLLOUT_MESSAGE } from "@/lib/permissions/location-access-rollout"
import type { FormTeamMember } from "./team-types"

/** Read-only readiness panel. No restriction can be edited before security rollout is complete. */
export function TeamLocationAccess({ siteId, members }: { siteId: string; members: FormTeamMember[] }) {
  const [state, setState] = useState<{
    siteId: string; data?: TeamLocationAccessResponse; failed?: boolean; schemaUnavailable?: boolean
  } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const membershipVersion = JSON.stringify(members.map(member => [member.id, member.role, member.originalRole, member.status]))
  useEffect(() => {
    const controller = new AbortController()
    setState(null)
    const load = async () => {
      try {
        const response = await fetch(`/api/site-members/${encodeURIComponent(siteId)}/location-restrictions`, {
          cache: "no-store", signal: controller.signal,
        })
        const body = await response.json()
        if (response.status === 503 && body?.code === "LOCATION_ACCESS_SCHEMA_UNAVAILABLE") {
          if (!controller.signal.aborted) setState({ siteId, schemaUnavailable: true })
          return
        }
        const parsed = teamLocationAccessResponseSchema.safeParse(body)
        if (!response.ok || !parsed.success || parsed.data.site_id !== siteId) throw new Error("Unverified scope")
        if (!controller.signal.aborted) setState({ siteId, data: parsed.data })
      } catch {
        if (!controller.signal.aborted) setState({ siteId, failed: true })
      }
    }
    void load()
    return () => controller.abort()
  }, [siteId, attempt, membershipVersion])

  const current = state?.siteId === siteId ? state : null
  const names = new Map(current?.data?.locations.map(location => [location.id, location]) || [])
  return (
    <section aria-label="Team location access" className="rounded-lg border border-border/70 bg-muted/20 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium">Restricted locations</h3>
        <Badge variant="outline">Editing unavailable</Badge>
      </div>
      <p className="text-xs text-muted-foreground">{LOCATION_ACCESS_ROLLOUT_MESSAGE}</p>
      <p className="text-xs text-muted-foreground">An empty restriction list preserves existing role, app, and assigned-data permissions. New locations are not restricted automatically.</p>
      {!current && <p role="status" className="text-xs">Checking location access…</p>}
      {current?.schemaUnavailable && <p role="status" className="text-xs">Location access database setup is pending or its schema is unavailable. Existing member permissions are unchanged.</p>}
      {current?.failed && <p role="status" className="text-xs text-destructive">Location access could not be verified. No restriction list is available.</p>}
      {current?.data && <ul className="space-y-2 text-xs">
        {current.data.members.map(member => {
          const displayed = members.find(candidate => candidate.id === member.id)
          const isManager = member.is_location_exempt
          return <li key={member.id} className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{displayed?.name || displayed?.email || "Team member"}</span>
            {isManager ? <span className="text-muted-foreground">Owner/admin · location restrictions do not apply</span> :
              member.restricted_location_ids.length === 0 ? <span className="text-muted-foreground">No additional location restrictions</span> :
                member.restricted_location_ids.map(id => {
                  const location = names.get(id)
                  return <Badge key={id} variant="secondary">{location?.name || "Unresolved location"}{location?.is_active === false ? " · inactive" : location?.is_active === null ? " · status unknown" : ""}</Badge>
                })}
          </li>
        })}
      </ul>}
      <Button type="button" variant="ghost" size="sm" onClick={() => setAttempt(value => value + 1)}>Refresh location access</Button>
    </section>
  )
}