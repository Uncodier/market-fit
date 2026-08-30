"use client"

import { Mail, Globe, MessageSquare, Phone } from "@/app/components/ui/icons"
import {
  WhatsAppIcon,
  InstagramIcon,
  TelegramIcon,
  MessengerIcon,
} from "@/app/components/ui/social-icons"
import { cn } from "@/lib/utils"
import { getChannelLabel, normalizeChannel } from "@/lib/site-channels"

const CHANNEL_BADGE_CLASS: Record<string, string> = {
  whatsapp: "bg-green-100 dark:bg-green-900/40 hover:bg-green-200 dark:hover:bg-green-800/60",
  messenger: "bg-sky-100 dark:bg-sky-900/40 hover:bg-sky-200 dark:hover:bg-sky-800/60",
  telegram: "bg-sky-100 dark:bg-sky-900/40 hover:bg-sky-200 dark:hover:bg-sky-800/60",
  instagram: "bg-pink-100 dark:bg-pink-900/40 hover:bg-pink-200 dark:hover:bg-pink-800/60",
  sms: "bg-teal-100 dark:bg-teal-900/40 hover:bg-teal-200 dark:hover:bg-teal-800/60",
  email: "bg-blue-100 dark:bg-blue-900/40 hover:bg-blue-200 dark:hover:bg-blue-800/60",
  voice: "bg-orange-100 dark:bg-orange-900/40 hover:bg-orange-200 dark:hover:bg-orange-800/60",
  web: "bg-purple-100 dark:bg-purple-900/40 hover:bg-purple-200 dark:hover:bg-purple-800/60",
}

const CHANNEL_ICON_CLASS: Record<string, string> = {
  whatsapp: "text-green-600 dark:text-green-400",
  messenger: "text-sky-600 dark:text-sky-400",
  telegram: "text-sky-600 dark:text-sky-400",
  instagram: "text-pink-600 dark:text-pink-400",
  sms: "text-teal-600 dark:text-teal-400",
  email: "text-blue-600 dark:text-blue-400",
  voice: "text-orange-600 dark:text-orange-400",
  web: "text-purple-600 dark:text-purple-400",
}

interface ChannelIconProps {
  channel?: string | null
  size?: number
  className?: string
}

export function ChannelIcon({ channel, size = 16, className }: ChannelIconProps) {
  const iconChannel = normalizeChannel(channel)
  const iconClass = cn(CHANNEL_ICON_CLASS[iconChannel], className)

  switch (iconChannel) {
    case "whatsapp":
      return <WhatsAppIcon size={size} className={iconClass} />
    case "instagram":
      return <InstagramIcon size={size} className={iconClass} />
    case "messenger":
      return <MessengerIcon size={size} className={iconClass} />
    case "telegram":
      return <TelegramIcon size={size} className={iconClass} />
    case "sms":
      return <MessageSquare className={iconClass} style={{ width: size, height: size }} />
    case "voice":
      return <Phone className={iconClass} style={{ width: size, height: size }} />
    case "email":
      return <Mail className={iconClass} style={{ width: size, height: size }} />
    case "web":
    default:
      return <Globe className={cn(CHANNEL_ICON_CLASS.web, className)} style={{ width: size, height: size }} />
  }
}

interface ChannelBadgeProps {
  channel: string
  size?: "sm" | "md"
  titleSuffix?: string
}

export function ChannelBadge({ channel, size = "md", titleSuffix }: ChannelBadgeProps) {
  const iconChannel = normalizeChannel(channel)
  const label = getChannelLabel(iconChannel)
  const isSmall = size === "sm"

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full font-inter transition-colors cursor-pointer shadow-sm",
        isSmall ? "w-5 h-5" : "w-8 h-8",
        CHANNEL_BADGE_CLASS[iconChannel] || CHANNEL_BADGE_CLASS.web
      )}
      title={titleSuffix ? `${label} ${titleSuffix}` : label}
    >
      <ChannelIcon channel={iconChannel} size={isSmall ? 10 : 16} />
    </div>
  )
}
