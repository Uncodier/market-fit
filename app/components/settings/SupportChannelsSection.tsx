"use client"

import { useCallback, useState } from "react"
import { useFormContext, useFieldArray } from "react-hook-form"
import { type SiteFormValues } from "./form-schema"
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "../ui/form"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardContent,
  SectionCardFooter,
} from "@/app/components/ui/section-card"
import { Button } from "@/app/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger, PopoverClose } from "@/app/components/ui/popover"
import { ChevronDown } from "@/app/components/ui/icons"
import { PlusCircle, Trash2 } from "@/app/components/ui/icons"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { GlobeIcon } from "@/app/components/ui/social-icons"
import { ChannelIcon } from "@/app/components/channels/channel-icon"
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog"
import { getChannelLabel } from "@/lib/site-channels"
import { toast } from "sonner"
import { v4 as uuidv4 } from "uuid"
import { apiClient } from "@/app/services/api-client-service"
import { TelegramChannelSetup } from "./TelegramChannelSetup"
import { EmailChannelSetup } from "./EmailChannelSetup"
import { VoiceChannelSetup } from "./VoiceChannelSetup"
import { SmsChannelSetup } from "./SmsChannelSetup"
import { useZavuInvitationSync } from "./use-zavu-invitation-sync"
import { WhatsAppIcon, MessengerIcon, TelegramIcon } from "@/app/components/ui/social-icons"
import { Mail, MessageSquare, Phone, Bot } from "@/app/components/ui/icons"

import { countAgentChannels, getAgentChannelLimit, canConnectAgentChannel } from "@/lib/billing-limits"
import { useSite } from "@/app/context/SiteContext"
import { useBillingLimit } from "@/app/context/BillingLimitContext"
import { disconnectZavuChannel } from "./disconnect-remote-accounts"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

const CHANNEL_TYPES = [
  { value: "whatsapp", label: "WhatsApp", icon: WhatsAppIcon },
  { value: "messenger", label: "Messenger", icon: MessengerIcon },
  { value: "telegram", label: "Telegram", icon: TelegramIcon },
  { value: "email", label: "Email", icon: Mail },
  { value: "sms", label: "SMS", icon: MessageSquare },
  { value: "voice", label: "Voice / Audio Agent", icon: Phone },
] as const

const PARTNER_LINK_TYPES = new Set(["whatsapp", "messenger"])

function getChannelIcon(type: string | undefined, size = 16) {
  if (!type) return <GlobeIcon size={size} />
  return <ChannelIcon channel={type} size={size} />
}

function channelLabel(type: string | undefined) {
  if (!type) return "New Channel"
  return CHANNEL_TYPES.find((item) => item.value === type)?.label || getChannelLabel(type)
}

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
  const { fields, prepend, remove, update } = useFieldArray({
    control: form.control,
    name: "channels.connections",
  })
  const connections = form.watch("channels.connections") || []
  const [connectingIndex, setConnectingIndex] = useState<number | null>(null)
  const [checkingIndex, setCheckingIndex] = useState<number | null>(null)
  const [channelToDelete, setChannelToDelete] = useState<number | null>(null)
  const { checkStatus } = useZavuInvitationSync({
    connections,
    enabled: active,
    update,
    getValues: form.getValues,
    onSave,
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
        name: channel.name || channelLabel(channel.type),
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
        name: channel.name || channelLabel(channel.type),
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
      await disconnectZavuChannel(channel || {})
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
        <Button variant="outline" size="sm" type="button" onClick={addChannel}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Channel
        </Button>
      </div>

      <div className="space-y-6">
        {fields.map((field, index) => {
          const channel = connections[index] || field
          const type = channel.type
          const hasType = !!type
          const isConnected = channel.status === "connected"
          const invitationUrl = channel.metadata?.invitation_url
          const failureReason = channel.metadata?.failure_reason
          const label = channel.name || channelLabel(type)
          const waitingForAuth = !!invitationUrl && channel.status !== "failed"

          return (
            <SectionCard key={field.id} id={`support-channel-${index}`}>
              <SectionCardHeader>
                <div className="flex items-center justify-between">
                  <SectionCardTitle className="flex items-center gap-2">
                    {getChannelIcon(type, 20)}
                    {label}
                  </SectionCardTitle>
                  <Button
                    size="icon"
                    variant="ghost"
                    type="button"
                    onClick={() => setChannelToDelete(index)}
                    className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                    title="Remove Channel"
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
              </SectionCardHeader>

                {!hasType && (
                  <SectionCardContent className="pt-0">
                    <FormField
                      control={form.control}
                      name={`channels.connections.${index}.type`}
                      render={({ field: typeField }) => (
                        <FormItem>
                          <FormLabel>Channel</FormLabel>
                          <Popover>
                            <FormControl>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className="flex h-10 w-full min-w-0 font-inter items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm text-left overflow-hidden font-normal"
                                >
                                  {typeField.value ? (() => {
                                    const selectedItem = CHANNEL_TYPES.find(item => item.value === typeField.value)
                                    const Icon = selectedItem?.icon
                                    return (
                                      <div className="flex items-center gap-2 overflow-hidden">
                                        {Icon && <Icon size={16} className="flex-shrink-0" />}
                                        <span className="truncate">{channelLabel(typeField.value)}</span>
                                      </div>
                                    )
                                  })() : (
                                    <span className="text-muted-foreground">Select Channel</span>
                                  )}
                                  <ChevronDown className="h-3.5 w-3.5 opacity-50 flex-shrink-0 ml-2" />
                                </Button>
                              </PopoverTrigger>
                            </FormControl>
                            <PopoverContent className="z-[50] w-[var(--radix-popover-trigger-width)] min-w-[200px] p-1" align="start">
                              {CHANNEL_TYPES.map((item) => {
                                const Icon = item.icon
                                return (
                                  <PopoverClose asChild key={item.value}>
                                    <div
                                      onClick={() => {
                                        typeField.onChange(item.value)
                                        form.setValue(`channels.connections.${index}.name`, channelLabel(item.value))
                                      }}
                                      className="cursor-pointer flex items-center justify-between w-full min-w-0 gap-2 px-2 py-1.5 rounded-sm hover:bg-accent hover:text-accent-foreground text-sm"
                                    >
                                      <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <Icon size={16} className="flex-shrink-0" />
                                        <span className="truncate">{item.label}</span>
                                      </div>
                                      {PARTNER_LINK_TYPES.has(item.value) && (
                                        <div className="text-[10px] font-medium shrink-0 bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-0 px-1.5 rounded">
                                          Partner Link
                                        </div>
                                      )}
                                    </div>
                                  </PopoverClose>
                                )
                              })}
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </SectionCardContent>
                )}

                {isConnected && hasType && (
                  <SectionCardContent className="pt-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full p-4 bg-muted/20 rounded-lg border dark:border-white/5 border-black/5 justify-between">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center flex-shrink-0 border dark:border-white/5 border-black/5">
                          {getChannelIcon(type, 24)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-base font-medium truncate">
                            {type === "telegram"
                              ? `@${channel.metadata?.bot_username || "Bot"}`
                              : type === "email"
                                ? channel.metadata?.from_address || label
                                : label}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              Connected
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" type="button" onClick={handleConfigureAgent} className="w-full sm:w-auto shrink-0">
                        <Bot className="w-4 h-4 mr-2" />
                        Edit Agent
                      </Button>
                    </div>
                  </SectionCardContent>
                )}

                {hasType && type === "email" && siteId && (
                  isConnected || canConnectAgentChannel(currentSite) ? (
                  <EmailChannelSetup
                    siteId={siteId}
                    channel={channel}
                    onUpdated={(payload) => {
                      if (payload?.status === "connected" && !canConnectAgentChannel(currentSite)) {
                        openAccountLimit()
                        return
                      }
                      update(index, { ...channel, ...payload })
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
                    onConnected={(payload) => {
                      if (!canConnectAgentChannel(currentSite)) {
                        openAccountLimit()
                        return
                      }
                      update(index, {
                        ...channel,
                        status: "connected",
                        zavu_sender_id: payload.senderId,
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

                {hasType && !isConnected && type === "sms" && siteId && (
                  canConnectAgentChannel(currentSite) ? (
                  <SmsChannelSetup
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
                            {getChannelIcon(type, 20)}
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
