"use client"

import { useState } from "react"
import { Button } from "@/app/components/ui/button"
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog"
import { SectionCard, SectionCardHeader, SectionCardTitle, SectionCardContent } from "@/app/components/ui/section-card"
import { EventApprovals } from "../approvals/event-approvals"
import { useProcurementI18n } from '../i18n/use-procurement-i18n'
import { isProcurementDemo as isDemoSiteId } from '../ui/is-demo'

export function CommerceApproval({ siteId, targetId, version, event, onChange }: {
  siteId: string; targetId: string; version: number; event: "award" | "order"; onChange: () => void
}) {
  const { t, message, formatNumber } = useProcurementI18n()
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState("")
  const [generation, setGeneration] = useState(0)
  async function requestApproval() {
    if (isDemoSiteId(siteId)) return
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
  return <SectionCard><SectionCardHeader><SectionCardTitle>{t(event === 'award' ? 'procurement.partners.commerce.awardTitle' : 'procurement.partners.commerce.orderApproval')}</SectionCardTitle></SectionCardHeader><SectionCardContent className="space-y-3">
    <ConfirmDialog open={confirming} onOpenChange={setConfirming} loading={busy}
      title={t(event === 'award' ? 'procurement.partners.commerce.requestAwardTitle' : 'procurement.partners.commerce.requestOrderTitle')}
      description={t('procurement.partners.commerce.confirmHint', { id: targetId, version: formatNumber(version) })}
      confirmLabel={t('procurement.common.confirm')} cancelLabel={t('procurement.common.cancel')}
      onConfirm={requestApproval} />
    <Button variant="outline" disabled={busy || isDemoSiteId(siteId)} onClick={() => setConfirming(true)}>
      {t(busy ? 'procurement.partners.commerce.checking' : event === 'award' ? 'procurement.partners.commerce.requestAward' : 'procurement.partners.commerce.requestOrder')}
    </Button>
    <p className="text-xs text-muted-foreground">{t('procurement.partners.commerce.approvalHint')}</p>
    {error && <p role="alert" className="text-destructive">{error === 'Approval request could not be completed' ? t('procurement.partners.errors.approvalRequest') : message(error)}</p>}
    <EventApprovals key={generation} siteId={siteId} targetId={targetId} onDecision={onChange} />
  </SectionCardContent></SectionCard>
}