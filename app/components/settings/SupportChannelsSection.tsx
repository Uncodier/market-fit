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
} from "@/app/components/ui/section-card"
import { Button } from "@/app/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { PlusCircle, Trash2, Mail } from "@/app/components/ui/icons"
import { EmptyCard } from "@/app/components/ui/empty-card"
import {
  WhatsAppIcon,
  FacebookIcon,
  TelegramIcon,
  GlobeIcon,
} from "@/app/components/ui/social-icons"
import { toast } from "sonner"
import { v4 as uuidv4 } from "uuid"
import { apiClient } from "@/app/services/api-client-service"
import { TelegramChannelSetup } from "./TelegramChannelSetup"
import { EmailChannelSetup } from "./EmailChannelSetup"

const CHANNEL_TYPES = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "messenger", label: "Messenger" },
  { value: "telegram", label: "Telegram" },
  { value: "email", label: "Email" },
] as const

const PARTNER_LINK_TYPES = new Set(["whatsapp", "messenger"])

function getChannelIcon(type: string | undefined, size = 16) {
  switch (type) {
    case "whatsapp":
      return <WhatsAppIcon size={size} />
    case "messenger":
      return <FacebookIcon size={size} />
    case "telegram":
      return <TelegramIcon size={size} />
    case "email":
      return <Mail size={size} />
    default:
      return <GlobeIcon size={size} />
  }
}

function channelLabel(type: string | undefined) {
  return CHANNEL_TYPES.find((item) => item.value === type)?.label || "New Channel"
}

interface SupportChannelsSectionProps {
  active: boolean
  siteId?: string
  onSave?: (data: SiteFormValues) => void
}

export function SupportChannelsSection({ active, siteId, onSave }: SupportChannelsSectionProps) {
  const form = useFormContext<SiteFormValues>()
  const { fields, prepend, remove, update } = useFieldArray({
    control: form.control,
    name: "channels.connections",
  })
  const connections = form.watch("channels.connections") || []
  const [connectingIndex, setConnectingIndex] = useState<number | null>(null)

  const addChannel = useCallback(() => {
    prepend({
      id: uuidv4(),
      type: "" as any,
      name: "",
      status: "pending",
    })
  }, [prepend])

  const handleConnect = async (index: number) => {
    const channel = form.getValues(`channels.connections.${index}`)
    if (!siteId) {
      toast.error("Please save the site first")
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
      toast.error(error.message || "An error occurred")
    } finally {
      setConnectingIndex(null)
    }
  }

  const handleRemove = (index: number) => {
    remove(index)
    if (onSave) {
      onSave(form.getValues())
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
          const label = channel.name || channelLabel(type)

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
                    onClick={() => handleRemove(index)}
                    className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                    title="Remove Channel"
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
              </SectionCardHeader>

              <SectionCardContent className="space-y-4">
                {!hasType && (
                  <FormField
                    control={form.control}
                    name={`channels.connections.${index}.type`}
                    render={({ field: typeField }) => (
                      <FormItem>
                        <FormLabel>Channel</FormLabel>
                        <Select
                          value={typeField.value}
                          onValueChange={(value) => {
                            typeField.onChange(value)
                            form.setValue(`channels.connections.${index}.name`, channelLabel(value))
                          }}
                        >
                          <FormControl>
                            <SelectTrigger className="h-10 w-full">
                              <SelectValue placeholder="Select Channel" />
                            </SelectTrigger>
                          </FormControl>
                            <SelectContent className="z-[50]">
                              {CHANNEL_TYPES.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                  <div className="flex items-center gap-2 w-full min-w-0 justify-between">
                                    <div className="flex items-center gap-2 min-w-0">
                                      {getChannelIcon(item.value, 16)}
                                      <span className="truncate">{item.label}</span>
                                    </div>
                                    {PARTNER_LINK_TYPES.has(item.value) && (
                                      <div className="text-[10px] font-medium shrink-0 bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-0 px-1.5 rounded">
                                        Partner Link
                                      </div>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {isConnected && hasType && (
                  <div className="flex items-center gap-4 w-full p-4 bg-muted/20 rounded-lg border dark:border-white/5 border-black/5">
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
                )}

                {hasType && type === "email" && siteId && (
                  <EmailChannelSetup
                    siteId={siteId}
                    channel={channel}
                    onUpdated={(payload) => {
                      update(index, { ...channel, ...payload })
                    }}
                  />
                )}

                {hasType && !isConnected && type === "telegram" && siteId && (
                  <TelegramChannelSetup
                    siteId={siteId}
                    channel={channel}
                    onConnected={(payload) => {
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
                )}

                {hasType && !isConnected && type !== "telegram" && type !== "email" && (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-orange-50 dark:bg-orange-900/10 rounded-lg border border-orange-100 dark:border-orange-900/30">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center flex-shrink-0 text-orange-600">
                        {getChannelIcon(type, 20)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate text-orange-800 dark:text-orange-200">
                          Action Required
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {invitationUrl
                            ? "Finish authentication to connect this channel"
                            : "Authenticate to connect this account"}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="default"
                      type="button"
                      onClick={() => handleConnect(index)}
                      disabled={connectingIndex === index}
                      className="whitespace-nowrap bg-orange-600 hover:bg-orange-700 text-white"
                    >
                      {connectingIndex === index
                        ? "Connecting..."
                        : invitationUrl
                          ? "Continue Setup"
                          : "Connect Account"}
                    </Button>
                  </div>
                )}
              </SectionCardContent>
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
    </div>
  )
}
