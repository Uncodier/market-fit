"use client"

import { useEffect, useRef, useState } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useOptionalPermissions } from "@/app/context/PermissionContext"
import { withTimeout } from "@/app/services/request-timeout"
import { emergencyGraceGrantSchema, type EmergencyGraceGrant } from "@/lib/billing/emergency-grace"
import { Button } from "../ui/button"
import { SectionCard, SectionCardContent, SectionCardFooter, SectionCardHeader } from "../ui/section-card"
import { useTemporaryWorkspaceLicenseClock } from "./temporary-workspace-license-notice"

type Props = {
  siteId: string
  actorId: string
  eligibleHint: boolean
  temporaryAccessEndsAt?: string
  refreshBilling: (siteId: string) => Promise<void>
}

/** An offer is only a display hint. The authenticated RPC decides every grant. */
export function EmergencyWorkspaceAccess(props: Props) {
  const permission = useOptionalPermissions()
  if (permission?.siteId !== props.siteId || permission.capabilities?.role !== "owner") return null
  return <EmergencyWorkspaceAccessAction key={JSON.stringify([props.actorId, props.siteId])} {...props} />
}

const messages = {
  GRACE_INELIGIBLE: "ineligible",
  GRACE_LIMIT_REACHED: "limitReached",
} as const

function EmergencyWorkspaceAccessAction({ siteId, eligibleHint, temporaryAccessEndsAt, refreshBilling }: Props) {
  const { t, locale } = useLocalization()
  const text = (key: string, vars?: Record<string, string>) => t(`billing.emergencyAccess.${key}`, vars)
  const request = useRef<AbortController | null>(null)
  const [busy, setBusy] = useState(false)
  const [grant, setGrant] = useState<EmergencyGraceGrant | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshWarning, setRefreshWarning] = useState(false)
  const now = useTemporaryWorkspaceLicenseClock(grant?.ends_at ?? temporaryAccessEndsAt)
  const hasTemporaryAccess = Date.parse(temporaryAccessEndsAt ?? "") > now
  const confirmed = grant && Date.parse(grant.ends_at) > now ? grant : null

  useEffect(() => () => {
    request.current?.abort()
    request.current = null
  }, [])

  async function run(activate: boolean) {
    if (request.current || (activate && (!eligibleHint || hasTemporaryAccess || confirmed))) return
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    setError(null)
    if (activate) setRefreshWarning(false)
    try {
      if (activate) {
        const result = await withTimeout((async () => {
          const response = await fetch("/api/billing/emergency-grace", {
            method: "POST",
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ site_id: siteId }),
          })
          return { ok: response.ok, status: response.status, body: await response.json() }
        })(), 12_000, "Emergency access request timed out")
        if (request.current !== controller) return
        if (!result.ok) {
          const code: unknown = result.body?.error?.code
          setError(result.status === 409 && (code === "GRACE_INELIGIBLE" || code === "GRACE_LIMIT_REACHED")
            ? messages[code] : "unconfirmed")
          return
        }
        setGrant(emergencyGraceGrantSchema.parse(result.body))
      }
      try {
        await refreshBilling(siteId)
        if (request.current === controller) setRefreshWarning(false)
      } catch {
        if (request.current === controller) setRefreshWarning(true)
      }
    } catch {
      if (request.current === controller) setError("unconfirmed")
    } finally {
      controller.abort()
      if (request.current === controller) {
        request.current = null
        setBusy(false)
      }
    }
  }

  if (!eligibleHint || (!confirmed && hasTemporaryAccess)) return null
  const formattedEnd = confirmed && new Date(confirmed.ends_at).toLocaleString(locale || "en", { dateStyle: "medium", timeStyle: "short" })

  return <SectionCard className="mb-6">
    <SectionCardHeader title={text("title")} />
    <SectionCardContent className="space-y-2 text-sm">
      {confirmed && formattedEnd
        ? <p role="status">{text("confirmed", { date: formattedEnd })}</p>
        : <p>{text("description")}</p>}
      {error && <p role="alert">{text(error)}</p>}
      {confirmed && refreshWarning && <p role="alert">{text("refreshWarning")}</p>}
    </SectionCardContent>
    {(!confirmed || refreshWarning) && <SectionCardFooter>
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void run(!confirmed)}>
        {text(busy ? "working" : confirmed ? "reload" : "request")}
      </Button>
    </SectionCardFooter>}
  </SectionCard>
}