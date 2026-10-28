"use client"

import { useEffect, useState } from "react"
import { supplierResponse } from "./client"
import { SectionCard, SectionCardHeader, SectionCardContent } from "@/app/components/ui/section-card"
import { ProcurementState } from "@/app/purchases/procurement/ui/workspace"

type Activity = { version: number; action: string; previous_status: string | null; status: string; created_at: string }
export function SupplierActivity({ siteId, id, version }: { siteId: string; id: string; version: number }) {
  const [activity, setActivity] = useState<Activity[]>([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true); setError("")
      try {
        const response = await fetch(`/api/procurement/suppliers/${id}/activity?site_id=${siteId}`, { signal: controller.signal, cache: "no-store" })
        const data = await supplierResponse<{ activity: Activity[] }>(response)
        if (!controller.signal.aborted) setActivity(data.activity)
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Unable to load activity")
      } finally { if (!controller.signal.aborted) setLoading(false) }
    }, 0)
    return () => { clearTimeout(timer); controller.abort() }
  }, [siteId, id, version])
  return <SectionCard>
    <SectionCardHeader title="Activity" description="Supplier revisions and lifecycle changes" />
    <SectionCardContent className="space-y-3">
    <ProcurementState loading={loading} error={error} empty={!loading && !error && !activity.length} emptyTitle="No supplier activity" description="Saved changes will appear here." />
    {!loading && !error && <ol className="space-y-2">{activity.map(event => <li key={event.version} className="border-b py-2 text-sm last:border-0">
      <span className="font-medium">Version {event.version} · {event.action.replaceAll("_", " ")}</span>
      <span className="ml-2 text-muted-foreground">{new Date(event.created_at).toLocaleString("en")}</span>
      <p className="capitalize">{event.previous_status && event.previous_status !== event.status ? `${event.previous_status.replaceAll("_", " ")} → ` : ""}{event.status.replaceAll("_", " ")}</p>
    </li>)}</ol>}
    <p className="text-xs text-muted-foreground">Latest 100 saved changes. This audit records revisions and lifecycle changes, not a full historical copy of contacts or private notes.</p>
    </SectionCardContent>
  </SectionCard>
}