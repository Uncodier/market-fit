"use client"
import { useCallback, useEffect, useState } from "react"
import { useFormContext, useFieldArray, useWatch } from "react-hook-form"
import { channelsSchema } from "./channel-form-schema"
import { type SiteFormValues } from "./form-schema"
import {
  SectionCard,
  SectionCardContent,
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
  getSupportChannelLabel,
  ConnectedSupportChannelSummary,
  SupportChannelHeader,
  SupportChannelTypeSelector,
} from "./support-channel-card-parts"
import { getSenderPhoneNumberKey, useZavuSenderPhoneNumbers } from "./use-zavu-sender-phone-numbers"
import { countAgentChannels, getAgentChannelLimit, canConnectAgentChannel } from "@/lib/billing-limits"
import { effectiveBillingPlan } from "@/lib/billing/startup-trial"
import { useSite } from "@/app/context/SiteContext"
import { useBillingLimit } from "@/app/context/BillingLimitContext"
import { disconnectZavuChannel, shouldDeleteZavuSender } from "./disconnect-remote-accounts"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { buildSupportChannelNavigation } from "./support-channel-navigation"
import { useEmailConnectionReconciliation } from "./use-email-connection-reconciliation"
import { useAgentChannelActivation } from "./use-agent-channel-activation"
import { isActiveAgentChannel, isManuallyDisabledAgentChannel } from "@/lib/agent-channel-state"
import { PartnerSupportChannelSetup } from "./PartnerSupportChannelSetup"
interface SupportChannelsSectionProps {
  active: boolean
  siteId?: string
  onSave?: (data: SiteFormValues) => void
}
const EMPTY_CONNECTIONS: SiteFormValues["channels"]["connections"] = []
export function SupportChannelsSection({ active, siteId, onSave }: SupportChannelsSectionProps) {
  const form = useFormContext<SiteFormValues>()
  const { currentSite } = useSite()
  const activation = useAgentChannelActivation(siteId)
  const reconcileEmailConnection = useEmailConnectionReconciliation(siteId)
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
      limit: getAgentChannelLimit(effectiveBillingPlan(currentSite?.billing)) + (currentSite?.billing?.addons_count || 0),
    })
  }
  const { fields, prepend, remove, replace, update } = useFieldArray({
    control: form.control,
    name: "channels.connections",
  })
  const connections = useWatch({ control: form.control, name: "channels.connections" }) || EMPTY_CONNECTIONS
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
  const persistConnections = useCallback(async (nextConnections: unknown[]) => {
    form.setValue("channels.connections", channelsSchema.removeDefault().unwrap().shape.connections.parse(nextConnections), { shouldDirty: true })
    if (onSave) {
      await onSave(form.getValues())
    }
  }, [form, onSave])

  const { checkStatus } = useZavuInvitationSync({
    connections,
    enabled: active,
    update: (index, value) => update(index, channelsSchema.removeDefault().unwrap().shape.connections.parse([value])[0]),
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
    const limit = getAgentChannelLimit(effectiveBillingPlan(currentSite?.billing)) + (currentSite?.billing?.addons_count || 0)
    const currentCount = countAgentChannels(currentSite)
    if (!canConnectAgentChannel(currentSite)) {
      showBillingLimit({ kind: "accounts", current: currentCount, limit })
      return
    }

    prepend({
      id: uuidv4(),
      type: "",
      name: "",
      status: "pending",
    })
  }, [prepend, currentSite, showBillingLimit])

  const persistPhoneConnection = useCallback((
    index: number,
    payload: Record<string, unknown>,
  ) => {
    const nextConnections = channelsSchema.removeDefault().unwrap().shape.connections.parse(reconcilePhoneConnections(
      form.getValues("channels.connections") || [],
      index,
      payload,
    ))
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
    const limit = getAgentChannelLimit(effectiveBillingPlan(currentSite?.billing)) + (currentSite?.billing?.addons_count || 0)
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
    } catch (error) {
      if (!showBillingLimitFromError(error)) {
        toast.error(error instanceof Error ? error.message : "An error occurred")
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
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to disconnect channel")
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
          const paused = isManuallyDisabledAgentChannel(channel) || channel.status === "disabled" || channel.status === "license_suspended"
          const isConnected = paused || (isActiveAgentChannel(channel) &&
            (type !== "email" || channel.metadata?.emailChannelActive === true))
          const invitationUrl = channel.metadata?.invitation_url
          const failureReason = channel.metadata?.failure_reason
          const label = channel.name || getSupportChannelLabel(type)
          const accountLabel = getSupportChannelAccountLabel(
            channel,
            label,
            senderPhoneNumbers[getSenderPhoneNumberKey(channel)],
          )

          return (
            <SectionCard key={`${siteId}:${channel.id || field.id}`} id={`support-channel-${index}`}>
              <SupportChannelHeader
                label={label}
                type={type}
                onRemove={() => setChannelToDelete(index)}
                activation={channel.id && (paused || isActiveAgentChannel(channel)) ? {
                  active: isActiveAgentChannel(channel), busy: activation.updatingId !== null,
                  canManage: activation.canManage,
                  onChange: enabled => { if (channel.id) void activation.setEnabled(channel.id, enabled) },
                } : undefined}
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
                      inactiveReason={paused ? channel.status === "license_suspended" ? "Inactive · plan limit" : "Inactive · manually disabled" : undefined}
                    />
                    {channel.status === "license_suspended" && channel.id && activation.canManage && (
                      <Button type="button" variant="outline" size="sm" className="mt-3"
                        disabled={activation.updatingId !== null}
                        onClick={() => { if (channel.id) void activation.setEnabled(channel.id, false) }}>
                        Keep inactive after upgrades
                      </Button>
                    )}
                  </SectionCardContent>
                )}

                {isConnected && !paused && type === "voice" && siteId && (
                  <VoiceChannelSettings
                    siteId={siteId}
                    channel={channel}
                    onUpdated={async (payload) => {
                      await persistPhoneConnection(index, payload)
                    }}
                  />
                )}

                {hasType && !paused && type === "email" && siteId && channel.id && (
                  isConnected || canConnectAgentChannel(currentSite) ? (
                  <EmailChannelSetup
                    key={`${siteId}:${channel.id}`}
                    siteId={siteId}
                    channel={{ ...channel, id: channel.id }}
                    connections={connections}
                    onUpdated={() => reconcileEmailConnection(channel.id!)}
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
                  <PartnerSupportChannelSetup type={type} status={channel.status}
                    invitationUrl={invitationUrl} failureReason={failureReason}
                    connecting={connectingIndex === index} checking={checkingIndex === index}
                    onConnect={() => { void handleConnect(index) }}
                    onCheck={async () => {
                      setCheckingIndex(index)
                      try { await checkStatus() } finally { setCheckingIndex(null) }
                    }} />
                )}
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
