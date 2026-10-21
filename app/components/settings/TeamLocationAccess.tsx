"use client"

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { useAuthContext } from "@/app/components/auth/auth-context"
import {
  teamLocationAccessResponseSchema, memberLocationReplacementResponseSchema, sameLocationIds,
  type TeamLocationAccessResponse,
} from "@/lib/permissions/team-location-access-schema"
import type { FormTeamMember } from "./team-types"

type SaveResult = { status: "saved" } | { status: "stale" } | { status: "error"; message: string; refreshRequired: boolean }
interface LocationAccessContextValue {
  siteId?: string
  data?: TeamLocationAccessResponse
  loading: boolean
  error?: string
  savingMemberId: string | null
  refresh: () => void
  save: (memberId: string, ids: string[]) => Promise<SaveResult>
}
const LocationAccessContext = createContext<LocationAccessContextValue | null>(null)
export const useTeamLocationAccess = () => useContext(LocationAccessContext)

/** One verified configuration per team, with no cross-account or cross-site cache. */
export function TeamLocationAccess({ siteId, members, canManageTeam, children }: {
  siteId?: string; members: FormTeamMember[]; canManageTeam: boolean; children: ReactNode
}) {
  const { user, isLoading } = useAuthContext()
  const enabled = !!siteId && !!user && !isLoading && canManageTeam
  const membershipVersion = JSON.stringify(members.filter(member => member.id).map(member =>
    [member.id, member.originalRole, member.status, member.manually_disabled, member.license_suspended, member.is_primary_owner]))
  // Remount drafts and abort all old work before another identity can use it.
  return <LocationAccessProvider key={`${siteId}:${user?.id}:${enabled}:${membershipVersion}`}
    siteId={siteId} enabled={enabled}>{children}</LocationAccessProvider>
}

function LocationAccessProvider({ siteId, enabled, children }: { siteId?: string; enabled: boolean; children: ReactNode }) {
  const [state, setState] = useState<{ data?: TeamLocationAccessResponse; loading: boolean; error?: string }>({ loading: enabled })
  const [attempt, setAttempt] = useState(0)
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null)
  const saving = useRef<AbortController | null>(null)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; saving.current?.abort() }
  }, [])
  useEffect(() => {
    if (!enabled || !siteId) return
    const controller = new AbortController()
    let cancelled = false
    const deadline = setTimeout(() => controller.abort(), 20_000)
    const load = async () => {
      try {
        const response = await fetch(`/api/site-members/${encodeURIComponent(siteId)}/location-restrictions`, {
          cache: "no-store", signal: controller.signal,
        })
        const body = await response.json()
        const parsed = teamLocationAccessResponseSchema.safeParse(body)
        if (cancelled) return
        if (controller.signal.aborted) throw new Error("Location access timed out")
        if (response.ok && parsed.success && parsed.data.site_id.toLowerCase() === siteId.toLowerCase()) {
          setState({ data: parsed.data, loading: false })
        } else {
          setState(previous => ({ ...previous, loading: false, error:
            body?.code === "LOCATION_ACCESS_SCHEMA_UNAVAILABLE"
              ? "Location access setup is pending. Existing permissions are unchanged."
              : "Location access could not be verified. Refresh before editing." }))
        }
      } catch {
        if (!cancelled) setState(previous => ({ ...previous, loading: false,
          error: "Location access could not be verified. Refresh before editing." }))
      } finally {
        clearTimeout(deadline)
      }
    }
    void load()
    return () => { cancelled = true; clearTimeout(deadline); controller.abort() }
  }, [siteId, enabled, attempt])

  const refresh = () => {
    if (!enabled || saving.current) return
    setState(previous => ({ ...previous, loading: true, error: undefined }))
    setAttempt(value => value + 1)
  }
  const save = async (memberId: string, ids: string[]): Promise<SaveResult> => {
    if (!mounted.current) return { status: "stale" }
    if (!enabled || !siteId || state.loading || state.error || !state.data?.editing_enabled || saving.current) {
      return { status: "error", message: "Refresh location access before editing.", refreshRequired: true }
    }
    const savedMember = state.data.members.find(member => member.id.toLowerCase() === memberId.toLowerCase())
    if (!savedMember) return { status: 'error', message: 'Refresh location access before editing.', refreshRequired: true }
    const controller = new AbortController()
    const deadline = setTimeout(() => controller.abort(), 20_000)
    saving.current = controller
    setSavingMemberId(memberId)
    const unconfirmed: SaveResult = { status: "error", refreshRequired: true,
      message: "The save could not be confirmed. Refresh location access before trying again." }
    try {
      const response = await fetch(`/api/site-members/${encodeURIComponent(siteId)}/location-restrictions`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, cache: "no-store", signal: controller.signal,
        body: JSON.stringify({ memberId, restricted_location_ids: ids,
          expected_restricted_location_ids: savedMember.restricted_location_ids }),
      })
      const body = await response.json()
      if (!mounted.current) return { status: "stale" }
      if (controller.signal.aborted) return unconfirmed
      if (!response.ok) {
        const code = body?.code
        if (code === "LOCATION_RESTRICTIONS_BUSY") return { status: "error", refreshRequired: false, message: "Membership is being updated. Try again shortly." }
        if (code === 'LOCATION_RESTRICTIONS_CHANGED') return { status: 'error', refreshRequired: true, message: 'Location restrictions changed in another session. Refresh before saving.' }
        if (code === "LOCATION_ACCESS_NOT_READY") return { status: "error", refreshRequired: true, message: "Location restriction editing is not available yet." }
        if (response.status === 401 || response.status === 403) return { status: "error", refreshRequired: true, message: "You no longer have permission to edit location restrictions." }
        if (code === "LOCATION_RESTRICTIONS_REJECTED") return { status: "error", refreshRequired: true, message: "The member or locations changed. Refresh to review your selection." }
        return unconfirmed
      }
      const parsed = memberLocationReplacementResponseSchema.safeParse(body)
      if (!parsed.success || parsed.data.site_id.toLowerCase() !== siteId.toLowerCase() ||
        parsed.data.site_member_id.toLowerCase() !== memberId.toLowerCase() ||
        !sameLocationIds(parsed.data.restricted_location_ids, ids)) return unconfirmed
      setState(previous => ({ ...previous, data: previous.data && { ...previous.data,
        members: previous.data.members.map(member => member.id.toLowerCase() === memberId.toLowerCase()
          ? { ...member, restricted_location_ids: parsed.data.restricted_location_ids } : member),
      } }))
      return { status: "saved" }
    } catch {
      return !mounted.current ? { status: "stale" } : unconfirmed
    } finally {
      clearTimeout(deadline)
      if (mounted.current) { saving.current = null; setSavingMemberId(null) }
    }
  }
  return <LocationAccessContext.Provider value={{ siteId, ...state, savingMemberId, refresh, save }}>
    {children}
  </LocationAccessContext.Provider>
}