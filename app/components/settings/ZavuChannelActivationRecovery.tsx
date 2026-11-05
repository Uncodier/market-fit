"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/app/components/ui/button"
import { SectionCardContent } from "@/app/components/ui/section-card"
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog"
import { apiClient } from "@/app/services/api-client-service"
import { useBillingLimit } from "@/app/context/BillingLimitContext"
import type { ConnectionLike } from "./zavu-invitation-helpers"

const ACTIVATABLE_CHANNELS = new Set(["whatsapp", "messenger", "instagram", "telegram"])

export function canRecoverZavuActivation(channel: ConnectionLike): boolean {
  if (channel.enabled === false || channel.license_suspended === true || channel._license?.manually_disabled === true) return false
  return Boolean(channel.id && channel.zavu_sender_id && ACTIVATABLE_CHANNELS.has(channel.type || "") &&
    (["pending", "in_progress", "failed"].includes(channel.status || "") ||
      (channel.status === "connected" && channel.metadata?.provider_channel_active !== true)))
}

export function ZavuChannelActivationRecovery({ siteId, channel, onActivated }: {
  siteId?: string
  channel: ConnectionLike
  onActivated: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const { showBillingLimitFromError } = useBillingLimit()
  const activate = async () => {
    if (!siteId || !channel.id || !channel.zavu_sender_id || !channel.type || !canRecoverZavuActivation(channel)) return
    setBusy(true)
    try {
      const response = await apiClient.post(
        `/api/integrations/zavu/senders/${encodeURIComponent(channel.zavu_sender_id)}/channels/${encodeURIComponent(channel.type)}/activate`,
        { siteId, channelId: channel.id },
      )
      if (!response.success) throw new Error(response.error?.message || "Channel activation failed. Please try again.")
      if (response.data?.status !== "connected" || response.data?.activationPending !== false) {
        throw new Error("Channel activation is still pending. Please check again.")
      }
      onActivated()
      toast.success("Channel connected")
    } catch (error) {
      if (!showBillingLimitFromError(error)) {
        toast.error(error instanceof Error ? error.message : "Channel activation failed")
      }
    } finally {
      setBusy(false)
    }
  }

  return <SectionCardContent className="space-y-3 pt-0">
    <p className="text-sm text-muted-foreground">This account is linked, but channel activation has not been confirmed.</p>
    <p className="text-xs text-muted-foreground">Activation may incur Zavu channel fees.</p>
    <Button type="button" disabled={busy || !siteId} onClick={() => setConfirming(true)}>
      {busy ? "Activating..." : channel.status === "connected" ? "Verify activation" : "Activate channel"}
    </Button>
    <ConfirmDialog open={confirming} onOpenChange={setConfirming} title="Activate channel?"
      description="Activation may incur Zavu channel fees. Continue only if you want to activate this linked channel."
      confirmLabel="Confirm activation" onConfirm={activate} />
  </SectionCardContent>
}