"use client"

import { useState } from "react"
import { Button } from "@/app/components/ui/button"
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog"
import { SectionCard, SectionCardHeader, SectionCardTitle, SectionCardContent } from "@/app/components/ui/section-card"
import { EventApprovals } from "../approvals/event-approvals"

export function CommerceApproval({ siteId, targetId, version, event, onChange }: {
  siteId: string; targetId: string; version: number; event: "award" | "order"; onChange: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState("")
  const [generation, setGeneration] = useState(0)
  async function requestApproval() {
    setBusy(true); setError("")
    try {
      const response = await fetch(`/api/procurement/commerce/approvals?site_id=${encodeURIComponent(siteId)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_id: targetId, expected_version: version, event }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Approval request could not be completed")
      setConfirming(false); setGeneration(value => value + 1); onChange()
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Approval request could not be completed") }
    finally { setBusy(false) }
  }
  return <SectionCard><SectionCardHeader><SectionCardTitle>{event === "award" ? "Whole-tender award" : "Purchase order approval"}</SectionCardTitle></SectionCardHeader><SectionCardContent className="space-y-3">
    <ConfirmDialog open={confirming} onOpenChange={setConfirming} loading={busy}
      title={event === "award" ? "Request whole-tender award?" : "Request purchase order?"}
      description={`Confirm the selected document (${targetId}, version ${version}). Current policy, eligibility and evidence are checked again; this does not bypass required human approvals.`}
      onConfirm={requestApproval} />
    <Button variant="outline" disabled={busy} onClick={() => setConfirming(true)}>
      {busy ? "Checking policy…" : event === "award" ? "Request whole-tender award" : "Request purchase order"}
    </Button>
    <p className="text-xs text-muted-foreground">Current policy and eligibility are rechecked. Human approvals remain pending until eligible reviewers decide. Unresolved supplier evidence blocks creation.</p>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <EventApprovals key={generation} siteId={siteId} targetId={targetId} onDecision={onChange} />
  </SectionCardContent></SectionCard>
}