"use client"

import { useCallback, useEffect, useState } from "react"
import { useFormContext, useFieldArray } from "react-hook-form"
import { type SiteFormValues } from "./form-schema"
import {
  SectionCard,
  SectionCardContent,
  SectionCardFooter,
} from "@/app/components/ui/section-card"
import { Button } from "@/app/components/ui/button"
import { Bot, PlusCircle } from "@/app/components/ui/icons"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { GlobeIcon } from "@/app/components/ui/social-icons"
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog"
import { toast } from "sonner"
import { v4 as uuidv4 } from "uuid"
import { apiClient } from "@/app/services/api-client-service"
import { TelegramChannelSetup } from "./TelegramChannelSetup"
import { EmailChannelSetup } from "./EmailChannelSetup"
import { VoiceChannelSetup } from "./VoiceChannelSetup"
import { VoiceChannelSettings } from "./VoiceChannelSettings"
import { SmsChannelSetup } from "./SmsChannelSetup"
import { useZavuInvitationSync } from "./use-zavu-invitation-sync"
import { useZavuPhoneStatusSync } from "./use-zavu-phone-status-sync"
import { reconcilePhoneConnections } from "./zavu-phone-number-utils"
import {
  getSupportChannelAccountLabel,
  getSupportChannelIcon,
  getSupportChannelLabel,
  ConnectedSupportChannelSummary,
  SupportChannelHeader,
  SupportChannelTypeSelector,
} from "./support-channel-card-parts"
import { useZavuSenderPhoneNumbers } from "./use-zavu-sender-phone-numbers"
import { countAgentChannels, getAgentChannelLimit, canConnectAgentChannel } from "@/lib/billing-limits"
import { useSite } from "@/app/context/SiteContext"
import { useBillingLimit } from "@/app/context/BillingLimitContext"
import { disconnectZavuChannel, shouldDeleteZavuSender } from "./disconnect-remote-accounts"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { buildSupportChannelNavigation } from "./support-channel-navigation"
import { reconcileSupportConnectionById } from "./support-channel-connection-utils"
interface SupportChannelsSectionProps {
  active: boolean
  siteId?: string
  onSave?: (data: SiteFormValues) => void
}
export function SupportChannelsSection({ active, siteId, onSave }: SupportChannelsSectionProps) {
  const form = useFormContext<SiteFormValues>()
  const { currentSite } = useSite()
  const router = useRouter()
  const { showBillingLimit, showBillingLimitFromError } = useBillingLimit()
  const handleConfigureAgent = async () => {
    if (!currentSite?.id) return
    try {
      const supabase = createClient()
      const { data: agent } = await supabase
        .from("agents")
        .select("id, name")
        .eq("site_id", currentSite.id)
        .eq("role", "Customer Support")
        .single()

      if (agent?.id) {
        router.push(`/agents/${agent.id}`)
      } else {
        toast.error("Customer Support agent not found")
      }
    } catch (err) {
      console.error(err)
      toast.error("Error finding Customer Support agent")
    }
  }
  const openAccountLimit = () => {
    showBillingLimit({
      kind: "accounts",
      current: countAgentChannels(currentSite),
      limit: getAgentChannelLimit(currentSite?.billing?.plan) + (currentSite?.billing?.addons_count || 0),
    })
  }
  const { fields, prepend, remove, replace, update } = useFieldArray({
    control: form.control,
    name: "channels.connections",
  })
  const connections = form.watch("channels.connections") || []
  const [connectingIndex, setConnectingIndex] = useState<number | null>(null)
  const [checkingIndex, setCheckingIndex] = useState<number | null>(null)
  const [channelToDelete, setChannelToDelete] = useState<number | null>(null)
  useEffect(() => {
    if (!active) return
    const timer = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("supportChannelsUpdated", {
        detail: buildSupportChannelNavigation(connections),
      }))
    }, 0)

    return () => window.clearTimeout(timer)
  }, [active, connections])

  const persistConnections = useCallback(async (nextConnections: any[]) => {
    form.setValue("channels.connections", nextConnections, { shouldDirty: true })
    if (onSave) {
      await onSave(form.getValues())
    }
  }, [form, onSave])

  const { checkStatus } = useZavuInvitationSync({
    connections,
    enabled: active,
    update,
    getValues: form.getValues,
    onSave,
  })
  useZavuPhoneStatusSync({
    connections,
    enabled: active,
    onConnectionsChange: persistConnections,
  })
  const senderPhoneNumbers = useZavuSenderPhoneNumbers({
    connections,
    enabled: active,
  })

  const addChannel = useCallback(() => {
    const limit = getAgentChannelLimit(currentSite?.billing?.plan) + (currentSite?.billing?.addons_count || 0)
    const currentCount = countAgentChannels(currentSite)
    if (!canConnectAgentChannel(currentSite)) {
      showBillingLimit({ kind: "accounts", current: currentCount, limit })
      return
    }

    prepend({
      id: uuidv4(),
      type: "" as any,
      name: "",
      status: "pending",
    })
  }, [prepend, currentSite, connections.length, showBillingLimit])

  const persistPhoneConnection = useCallback((
    index: number,
    payload: any,
  ) => {
    const nextConnections = reconcilePhoneConnections(
      form.getValues("channels.connections") || [],
      index,
      payload,
    )
    replace(nextConnections)
    form.setValue("channels.connections", nextConnections, {
      shouldDirty: false,
    })
  }, [form, replace])

  const handleConnect = async (index: number) => {
    const channel = form.getValues(`channels.connections.${index}`)
    if (!siteId) {
      toast.error("Please save the site first")
      return
    }
    
    // Validate account limits
    const limit = getAgentChannelLimit(currentSite?.billing?.plan) + (currentSite?.billing?.addons_count || 0)
    const currentCount = countAgentChannels(currentSite)
    
    if (channel.status !== "connected" && !canConnectAgentChannel(currentSite)) {
      showBillingLimit({ kind: "accounts", current: currentCount, limit })
      return
    }

    if (!channel?.type) {
      toast.error("Select a channel type first")
      return
    }

    const invitationUrl = channel.metadata?.invitation_url
    if (invitationUrl) {
      window.open(invitationUrl, "_blank")
      return
    }

    setConnectingIndex(index)
    try {
      const response = await apiClient.post("/api/integrations/zavu/invitations", {
        siteId,
        channelId: channel.id,
        connectionType: channel.type === "whatsapp" ? "whatsapp_waba" : "messenger",
        name: channel.name || getSupportChannelLabel(channel.type),
        active: true,
      })

      if (!response.success) {
        throw new Error(response.error?.message || "Failed to create invitation")
      }

      const payload = response.data || {}
      const invitation = payload.invitation || {}
      update(index, {
        ...channel,
        id: payload.channelId || channel.id,
        name: channel.name || getSupportChannelLabel(channel.type),
        status: "pending",
        zavu_invitation_id: invitation.id,
        metadata: {
          ...(channel.metadata || {}),
          invitation_url: invitation.url,
        },
      })

      if (invitation.url) {
        window.open(invitation.url, "_blank")
      }

      if (onSave) {
        await onSave(form.getValues())
      }
    } catch (error: any) {
      if (!showBillingLimitFromError(error)) {
        toast.error(error.message || "An error occurred")
      }
    } finally {
      setConnectingIndex(null)
    }
  }

  const handleRemove = async (index: number) => {
    const channel = form.getValues(`channels.connections.${index}`)
    try {
      if (!channel?.zavu_sender_id || shouldDeleteZavuSender(channel, connections, index)) {
        await disconnectZavuChannel(channel || {})
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to disconnect channel")
      throw error
    }
    remove(index)
    if (onSave) {
      await onSave(form.getValues())
    }
  }

  if (!active) return null

  return (
    <div id="support-channels" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Support Channels</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Connect WhatsApp, Messenger and other channels to your AI Agent
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" type="button" onClick={handleConfigureAgent}>
            <Bot className="mr-2 h-4 w-4" />
            Edit Agent
          </Button>
          <Button variant="outline" size="sm" type="button" onClick={addChannel}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Channel
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {fields.map((field, index) => {
          const channel = connections[index] || field
          const type = channel.type
          const hasType = !!type
          const isConnected =
            channel.status === "connected" &&
            (type !== "email" || channel.metadata?.emailChannelActive === true)
          const invitationUrl = channel.metadata?.invitation_url
          const failureReason = channel.metadata?.failure_reason
          const label = channel.name || getSupportChannelLabel(type)
          const waitingForAuth = !!invitationUrl && channel.status !== "failed"
          const accountLabel = getSupportChannelAccountLabel(
            channel,
            label,
            senderPhoneNumbers[channel.zavu_sender_id || ""],
          )

          return (
            <SectionCard key={field.id} id={`support-channel-${index}`}>
              <SupportChannelHeader
                label={label}
                type={type}
                onRemove={() => setChannelToDelete(index)}
              />

                {!hasType && (
                  <SectionCardContent className="pt-0">
                    <SupportChannelTypeSelector form={form} index={index} />
                  </SectionCardContent>
                )}

                {isConnected && hasType && (
                  <SectionCardContent className="pt-0">
                    <ConnectedSupportChannelSummary
                      type={type}
                      accountLabel={accountLabel}
                    />
                  </SectionCardContent>
                )}

                {isConnected && type === "voice" && siteId && (
                  <VoiceChannelSettings
                    siteId={siteId}
                    channel={channel}
                    onUpdated={async (payload) => {
                      await persistPhoneConnection(index, payload)
                    }}
                  />
                )}

                {hasType && type === "email" && siteId && (
                  isConnected || canConnectAgentChannel(currentSite) ? (
                  <EmailChannelSetup
                    siteId={siteId}
                    channel={channel}
                    onUpdated={async (payload) => {
                      if (payload?.status === "connected" && !canConnectAgentChannel(currentSite)) {
                        openAccountLimit()
                        return
                      }
                      const currentConnections = form.getValues("channels.connections") || []
                      const nextConnections = reconcileSupportConnectionById(
                        currentConnections,
                        channel.id,
                        payload,
                      )
                      if (nextConnections) await persistConnections(nextConnections)
                    }}
                  />
                  ) : (
                    <SectionCardContent className="pt-0">
                      <Button type="button" variant="outline" size="sm" onClick={openAccountLimit}>
                        Upgrade to connect
                      </Button>
                    </SectionCardContent>
                  )
                )}

                {hasType && !isConnected && type === "voice" && siteId && (
                  canConnectAgentChannel(currentSite) ? (
                  <VoiceChannelSetup
                    siteId={siteId}
                    channel={channel}
                    onConnected={async (payload) => {
                      await persistPhoneConnection(index, payload)
                    }}
                  />
                  ) : (
                    <SectionCardContent className="pt-0">
                      <Button type="button" variant="outline" size="sm" onClick={openAccountLimit}>
                        Upgrade to connect
                      </Button>
                    </SectionCardContent>
                  )
                )}

                {hasType && !isConnected && type === "sms" && siteId && (
                  canConnectAgentChannel(currentSite) ? (
                  <SmsChannelSetup
                    siteId={siteId}
                    channel={channel}
                    onConnected={async (payload) => {
                      await persistPhoneConnection(index, payload)
                    }}
                  />
                  ) : (
                    <SectionCardContent className="pt-0">
                      <Button type="button" variant="outline" size="sm" onClick={openAccountLimit}>
                        Upgrade to connect
                      </Button>
                    </SectionCardContent>
                  )
                )}

                {hasType && !isConnected && type === "telegram" && siteId && (
                  canConnectAgentChannel(currentSite) ? (
                  <TelegramChannelSetup
                    siteId={siteId}
                    channel={channel}
                    onConnected={(payload) => {
                      if (!canConnectAgentChannel(currentSite)) {
                        openAccountLimit()
                        return
                      }
                      update(index, {
                        ...channel,
                        status: "connected",
                        zavu_sender_id: payload.senderId,
                        metadata: {
                          ...(channel.metadata || {}),
                          bot_username: payload.telegram?.botUsername,
                          bot_id: payload.telegram?.botId,
                        },
                      })
                    }}
                  />
                  ) : (
                    <SectionCardContent className="pt-0">
                      <Button type="button" variant="outline" size="sm" onClick={openAccountLimit}>
                        Upgrade to connect
                      </Button>
                    </SectionCardContent>
                  )
                )}

                {hasType && !isConnected && type !== "telegram" && type !== "email" && type !== "voice" && type !== "sms" && (
                  <>
                    <SectionCardContent className="pt-0">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-orange-50 dark:bg-orange-900/10 rounded-lg border border-orange-100 dark:border-orange-900/30">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center flex-shrink-0 text-orange-600">
                            {getSupportChannelIcon(type, 20)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate text-orange-800 dark:text-orange-200">
                              {channel.status === "failed" ? "Setup failed" : "Action Required"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {channel.status === "failed"
                                ? failureReason || "Authorization did not finish. You can retry the same link."
                                : waitingForAuth
                                  ? "Waiting for Meta authorization…"
                                  : "Authenticate to connect this account"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </SectionCardContent>
                    <SectionCardFooter className="flex flex-wrap gap-2">
                      <Button
                        variant="default"
                        type="button"
                        onClick={() => handleConnect(index)}
                        disabled={connectingIndex === index || checkingIndex === index}
                      >
                        {connectingIndex === index
                          ? "Connecting..."
                          : invitationUrl
                            ? "Continue Setup"
                            : "Connect Account"}
                      </Button>
                      {invitationUrl && (
                        <Button
                          variant="outline"
                          type="button"
                          disabled={checkingIndex === index}
                          onClick={async () => {
                            setCheckingIndex(index)
                            try {
                              await checkStatus()
                            } finally {
                              setCheckingIndex(null)
                            }
                          }}
                        >
                          {checkingIndex === index ? "Checking..." : "Check setup status"}
                        </Button>
                      )}
                    </SectionCardFooter>
                  </>
                )}
              {/* REMOVED EXTRA SectionCardContent CLOSING TAG */}
            </SectionCard>
          )
        })}

        {fields.length === 0 && (
          <EmptyCard
            icon={<GlobeIcon size={40} />}
            title="No channels connected"
            description="Connect WhatsApp, Messenger and other channels so your AI Agent can reply to customers."
            variant="fancy"
          />
        )}
      </div>

      <ConfirmDialog
        open={channelToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setChannelToDelete(null)
        }}
        title="Delete Channel"
        description="This will remove the channel and disconnect it from your site. This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          if (channelToDelete !== null) await handleRemove(channelToDelete)
        }}
      />
    </div>
  )
}
