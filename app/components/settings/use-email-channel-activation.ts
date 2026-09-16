import { useState } from "react"
import { toast } from "sonner"
import { apiClient } from "@/app/services/api-client-service"

interface EmailChannelActivationOptions {
  siteId: string
  channel: any
  metadata: Record<string, any>
  onUpdated: (payload: any) => void
}

interface ActivationResponse {
  chargedCents?: number
  monthlyCents?: number
}

function activationMessage(data: ActivationResponse | undefined) {
  if (!data?.chargedCents) {
    return "Email channel activated"
  }

  return `Email channel activated. $${(data.chargedCents / 100).toFixed(2)} charged.`
}

export function useEmailChannelActivation({
  siteId,
  channel,
  metadata,
  onUpdated,
}: EmailChannelActivationOptions) {
  const [isActivating, setIsActivating] = useState(false)
  const isEmailChannelActive = metadata.emailChannelActive === true

  const activateEmailChannel = async () => {
    if (!channel.zavu_sender_id || isEmailChannelActive) return

    setIsActivating(true)
    try {
      const senderId = encodeURIComponent(channel.zavu_sender_id)
      const response = await apiClient.post(
        `/api/integrations/zavu/senders/${senderId}/channels/email/activate`,
        {
          siteId,
          channelId: channel.id,
        }
      )

      if (!response.success) {
        throw new Error(response.error?.message || "Failed to activate email channel")
      }

      onUpdated({
        ...(channel.status === "connected" ? {} : { status: "connected" }),
        metadata: {
          ...metadata,
          emailChannelActive: true,
        },
      })
      toast.success(activationMessage(response.data as ActivationResponse | undefined))
    } catch (error: any) {
      toast.error(error.message || "An error occurred")
    } finally {
      setIsActivating(false)
    }
  }

  return {
    activateEmailChannel,
    isActivating,
    isEmailChannelActive,
  }
}
