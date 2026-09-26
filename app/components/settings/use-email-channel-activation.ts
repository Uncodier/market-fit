import { useState } from "react"
import { toast } from "sonner"
import { apiClient } from "@/app/services/api-client-service"
import { isEmailChannelActive as isEmailChannelActiveResponse } from "./email-channel-utils"

interface EmailChannelActivationOptions {
  siteId: string
  channel: any
  metadata: Record<string, any>
  onUpdated: (payload: any) => void | Promise<void>
}

interface ActivationResponse {
  activated?: boolean
  chargedCents?: number
  monthlyCents?: number
  sender?: {
    channels?: unknown
  }
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

  const activateEmailChannel = async (): Promise<boolean> => {
    if (!channel.zavu_sender_id) return false
    if (isEmailChannelActive) return true

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
      if (!isEmailChannelActiveResponse(response.data)) {
        throw new Error("Zavu did not confirm email channel activation")
      }

      await onUpdated({
        ...(channel.status === "connected" ? {} : { status: "connected" }),
        metadata: {
          ...metadata,
          emailChannelActive: true,
        },
      })
      toast.success(activationMessage(response.data as ActivationResponse | undefined))
      return true
    } catch (error: any) {
      toast.error(error.message || "An error occurred")
      return false
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
