"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { apiClient } from "@/app/services/api-client-service"
import { resolveEmailReceivingEnabled } from "./email-channel-utils"

interface EmailReceivingUpdateOptions {
  siteId: string
  channel: any
  metadata: Record<string, any>
  channelActive: boolean
  activateChannel: () => Promise<boolean>
  onUpdated: (payload: any) => void | Promise<void>
}

export function useEmailReceivingUpdate({
  siteId,
  channel,
  metadata,
  channelActive,
  activateChannel,
  onUpdated,
}: EmailReceivingUpdateOptions) {
  const persistedEnabled = metadata.emailReceivingEnabled === true
  const [receivingEnabled, setReceivingEnabled] = useState(persistedEnabled)
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => setReceivingEnabled(persistedEnabled), [persistedEnabled])

  const saveReceiving = async () => {
    if (!channel.zavu_sender_id) return
    setIsUpdating(true)
    try {
      let active = channelActive
      if (receivingEnabled && !active) {
        active = await activateChannel()
        if (!active) return
      }

      const response = await apiClient.put("/api/integrations/zavu/channels/email", {
        siteId,
        channelId: channel.id,
        senderId: channel.zavu_sender_id,
        emailReceivingEnabled: receivingEnabled,
      })
      if (!response.success) {
        if (receivingEnabled) setReceivingEnabled(false)
        throw new Error(response.error?.message || "Failed to update receiving status")
      }

      const applied = resolveEmailReceivingEnabled(response.data)
      if (applied === undefined) {
        throw new Error("Zavu did not confirm the email receiving status")
      }
      if (receivingEnabled && !applied) {
        setReceivingEnabled(false)
        throw new Error("Zavu could not enable receiving. Verify that the MX record has propagated.")
      }

      setReceivingEnabled(applied)
      await onUpdated({
        metadata: {
          ...metadata,
          emailChannelActive: active,
          emailReceivingEnabled: applied,
        },
      })
      toast.success(`Email receiving ${applied ? "enabled" : "disabled"}`)
    } catch (error: any) {
      toast.error(error.message || "An error occurred")
    } finally {
      setIsUpdating(false)
    }
  }

  return { isUpdating, receivingEnabled, setReceivingEnabled, saveReceiving }
}