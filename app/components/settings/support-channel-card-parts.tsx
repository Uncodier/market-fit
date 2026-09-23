"use client"

import type { UseFormReturn } from "react-hook-form"
import type { SiteFormValues } from "./form-schema"
import { Button } from "@/app/components/ui/button"
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/app/components/ui/form"
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui/popover"
import { SectionCardHeader, SectionCardTitle } from "@/app/components/ui/section-card"
import { ChannelIcon } from "@/app/components/channels/channel-icon"
import { GlobeIcon, MessengerIcon, TelegramIcon, WhatsAppIcon } from "@/app/components/ui/social-icons"
import {
  ChevronDown,
  Mail,
  MessageSquare,
  Phone,
  Trash2,
} from "@/app/components/ui/icons"
import { getChannelLabel } from "@/lib/site-channels"
import {
  formatPhoneNumber,
  getAssignedPhoneNumber,
} from "./zavu-phone-number-utils"

const CHANNEL_TYPES = [
  { value: "whatsapp", label: "WhatsApp", icon: WhatsAppIcon },
  { value: "messenger", label: "Messenger", icon: MessengerIcon },
  { value: "telegram", label: "Telegram", icon: TelegramIcon },
  { value: "email", label: "Email", icon: Mail },
  { value: "sms", label: "SMS", icon: MessageSquare },
  { value: "voice", label: "Voice / Audio Agent", icon: Phone },
] as const

const PARTNER_LINK_TYPES = new Set(["whatsapp", "messenger"])
const PHONE_CHANNEL_TYPES = new Set(["whatsapp", "sms", "voice"])

export function getSupportChannelIcon(type: string | undefined, size = 16) {
  if (!type) return <GlobeIcon size={size} />
  return <ChannelIcon channel={type} size={size} />
}

export function getSupportChannelLabel(type: string | undefined) {
  if (!type) return "New Channel"
  return CHANNEL_TYPES.find((item) => item.value === type)?.label || getChannelLabel(type)
}

export function getSupportChannelAccountLabel(
  channel: Record<string, any>,
  fallbackLabel: string,
  fetchedPhoneNumber?: string,
) {
  if (channel.type === "telegram") {
    return `@${channel.metadata?.bot_username || "Bot"}`
  }
  if (channel.type === "email") {
    return channel.metadata?.from_address || fallbackLabel
  }
  if (PHONE_CHANNEL_TYPES.has(channel.type)) {
    const phoneNumber = getAssignedPhoneNumber(channel) || fetchedPhoneNumber
    return phoneNumber ? formatPhoneNumber(phoneNumber) : fallbackLabel
  }
  return fallbackLabel
}

export function SupportChannelHeader({
  label,
  type,
  onRemove,
}: {
  label: string
  type?: string
  onRemove: () => void
}) {
  return (
    <SectionCardHeader>
      <div className="flex items-center justify-between">
        <SectionCardTitle className="flex items-center gap-2">
          {getSupportChannelIcon(type, 20)}
          {label}
        </SectionCardTitle>
        <Button
          size="icon"
          variant="ghost"
          type="button"
          onClick={onRemove}
          className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
          title="Remove Channel"
        >
          <Trash2 className="h-5 w-5" />
        </Button>
      </div>
    </SectionCardHeader>
  )
}

export function ConnectedSupportChannelSummary({
  type,
  accountLabel,
}: {
  type: string
  accountLabel: string
}) {
  return (
    <div className="flex w-full flex-col justify-between gap-4 rounded-lg border border-black/5 bg-muted/20 p-4 dark:border-white/5 sm:flex-row sm:items-center">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border border-black/5 bg-muted dark:border-white/5">
          {getSupportChannelIcon(type, 24)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-medium">{accountLabel}</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="inline-flex rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
              Connected
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function SupportChannelTypeSelector({
  form,
  index,
}: {
  form: UseFormReturn<SiteFormValues>
  index: number
}) {
  return (
    <FormField
      control={form.control}
      name={`channels.connections.${index}.type`}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Channel</FormLabel>
          <Popover>
            <FormControl>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="flex h-10 w-full min-w-0 items-center justify-between overflow-hidden rounded-md border border-input bg-background px-3 py-2 text-left font-inter text-sm font-normal"
                >
                  {field.value ? (() => {
                    const selected = CHANNEL_TYPES.find((item) => item.value === field.value)
                    const Icon = selected?.icon
                    return (
                      <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                        {Icon && <Icon size={16} className="flex-shrink-0" />}
                        <span className="truncate">{getSupportChannelLabel(field.value)}</span>
                      </div>
                    )
                  })() : (
                    <span className="text-muted-foreground">Select Channel</span>
                  )}
                  <ChevronDown className="ml-2 h-3.5 w-3.5 flex-shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
            </FormControl>
            <PopoverContent
              className="z-[50] w-[var(--radix-popover-trigger-width)] min-w-[200px] p-1"
              align="start"
            >
              {CHANNEL_TYPES.map((item) => {
                const Icon = item.icon
                return (
                  <PopoverClose asChild key={item.value}>
                    <div
                      onClick={() => {
                        field.onChange(item.value)
                        form.setValue(
                          `channels.connections.${index}.name`,
                          getSupportChannelLabel(item.value),
                        )
                      }}
                      className="flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <Icon size={16} className="flex-shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {PARTNER_LINK_TYPES.has(item.value) && (
                        <div className="shrink-0 rounded border-0 bg-green-100 px-1.5 text-[10px] font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300">
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
  )
}
