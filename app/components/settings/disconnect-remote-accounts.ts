import { apiClient } from "@/app/services/api-client-service"
import { isDemoModeActive, isDemoSiteId } from "@/lib/demo-utils"

export type ZavuChannelDisconnect = {
  zavu_sender_id?: string
  zavu_invitation_id?: string
}

export type OutstandSocialDisconnect = {
  id?: string
}

function isAlreadyGone(status?: number) {
  return status === 404
}

export async function disconnectZavuChannel(channel: ZavuChannelDisconnect): Promise<void> {
  if (channel.zavu_sender_id) {
    const response = await apiClient.delete(
      `/api/integrations/zavu/senders/${encodeURIComponent(channel.zavu_sender_id)}`
    )
    if (!response.success && !isAlreadyGone(response.status)) {
      throw new Error(response.error?.message || "Failed to disconnect channel from Zavu")
    }
    return
  }

  if (channel.zavu_invitation_id) {
    const response = await apiClient.delete(
      `/api/integrations/zavu/invitations/${encodeURIComponent(channel.zavu_invitation_id)}`
    )
    if (!response.success && !isAlreadyGone(response.status)) {
      throw new Error(response.error?.message || "Failed to cancel Zavu invitation")
    }
  }
}

export async function disconnectOutstandSocial(
  social: OutstandSocialDisconnect,
  siteId?: string
): Promise<void> {
  if (!social.id) return
  if (isDemoModeActive() || isDemoSiteId(siteId)) return

  const url = new URL(`/api/social/accounts/${encodeURIComponent(social.id)}`, window.location.origin)
  if (siteId) url.searchParams.set("tenant_id", siteId)

  const response = await fetch(url.toString(), { method: "DELETE" })
  if (response.ok || response.status === 404) return

  const payload = await response.json().catch(() => ({}))
  const message =
    (typeof payload.error === "string" && payload.error) ||
    payload.error?.message ||
    payload.message ||
    "Failed to disconnect social account from Outstand"
  throw new Error(message)
}
