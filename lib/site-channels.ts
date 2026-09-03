export const COMMUNICATION_CHANNELS = [
  "whatsapp",
  "messenger",
  "telegram",
  "instagram",
  "facebook",
  "threads",
  "linkedin",
  "x",
  "youtube",
  "sms",
  "email",
  "voice",
  "web",
] as const

export type CommunicationChannel = (typeof COMMUNICATION_CHANNELS)[number]

export type SiteChannelSource = {
  tracking?: { enable_chat?: boolean } | null
  settings?: {
    channels?: {
      email?: { enabled?: boolean; status?: string }
      whatsapp?: { enabled?: boolean; status?: string }
      agent_email?: { status?: string }
      agent_whatsapp?: { status?: string }
      website?: { enable_chat?: boolean }
      connections?: Array<{ type?: string | null; status?: string | null }>
    } | null
    social_media?: Array<{ platform?: string | null; network?: string | null; isActive?: boolean | number }> | null
  } | null
}

const CHANNEL_LABELS: Record<string, string> = {
  web: "Web",
  website_chat: "Web",
  email: "Email",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
  threads: "Threads",
  linkedin: "LinkedIn",
  x: "X",
  youtube: "YouTube",
  messenger: "Messenger",
  sms: "SMS",
  telegram: "Telegram",
  voice: "Voice",
}

const CHANNEL_DESCRIPTIONS: Record<string, string> = {
  web: "Send via web chat",
  website_chat: "Send via web chat",
  email: "Send via email",
  whatsapp: "Send via WhatsApp",
  instagram: "Send via Instagram",
  facebook: "Send via Facebook",
  threads: "Send via Threads",
  linkedin: "Send via LinkedIn",
  x: "Send via X",
  youtube: "Send via YouTube",
  messenger: "Send via Messenger",
  sms: "Send via SMS",
  telegram: "Send via Telegram",
  voice: "Send via Voice",
}

const CONNECTED_STATUSES = new Set(["connected", "active", "synced"])

export function normalizeChannel(channel?: string | null): CommunicationChannel | string {
  if (!channel) return "web"
  if (channel === "website_chat") return "web"
  if (channel.toLowerCase() === "twitter") return "x"
  return channel
}

export function getChannelLabel(channel?: string | null): string {
  const normalized = normalizeChannel(channel)
  if (CHANNEL_LABELS[normalized]) return CHANNEL_LABELS[normalized]
  if (!normalized) return "Web"
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

export function getChannelDescription(channel?: string | null): string {
  const normalized = normalizeChannel(channel)
  if (CHANNEL_DESCRIPTIONS[normalized]) return CHANNEL_DESCRIPTIONS[normalized]
  return `Send via ${getChannelLabel(normalized)}`
}

function addChannel(channels: CommunicationChannel[], channel: CommunicationChannel) {
  if (!channels.includes(channel)) {
    channels.push(channel)
  }
}

function isConnectedStatus(status?: string | null) {
  return !!status && CONNECTED_STATUSES.has(status)
}

export function getEnabledSiteChannels(site?: SiteChannelSource | null): CommunicationChannel[] {
  const enabled: CommunicationChannel[] = []
  const settings = site?.settings?.channels

  if (settings?.whatsapp?.enabled && isConnectedStatus(settings.whatsapp.status)) {
    addChannel(enabled, "whatsapp")
  }
  if (isConnectedStatus(settings?.agent_whatsapp?.status)) {
    addChannel(enabled, "whatsapp")
  }

  if (settings?.email?.enabled && isConnectedStatus(settings.email.status)) {
    addChannel(enabled, "email")
  }
  if (isConnectedStatus(settings?.agent_email?.status)) {
    addChannel(enabled, "email")
  }

  if (site?.tracking?.enable_chat || settings?.website?.enable_chat) {
    addChannel(enabled, "web")
  }

  for (const connection of settings?.connections || []) {
    const type = normalizeChannel(connection.type)
    if (!isConnectedStatus(connection.status)) continue
    if ((COMMUNICATION_CHANNELS as readonly string[]).includes(type)) {
      addChannel(enabled, type as CommunicationChannel)
    }
  }

  const SUPPORTED_SOCIAL_NETWORKS = new Set(["facebook", "instagram", "threads", "linkedin", "x", "youtube"])
  for (const account of site?.settings?.social_media || []) {
    if (!account.isActive) continue
    const type = normalizeChannel(account.network || account.platform)
    if (SUPPORTED_SOCIAL_NETWORKS.has(type as string) && (COMMUNICATION_CHANNELS as readonly string[]).includes(type)) {
      addChannel(enabled, type as CommunicationChannel)
    }
  }

  return COMMUNICATION_CHANNELS.filter((channel) => enabled.includes(channel))
}

export function leadHasChannel(lead: any, channel: string): boolean {
  if (!lead) return false
  const c = normalizeChannel(channel)
  
  if (c === "web") return true
  if (c === "email") return !!lead.email
  if (c === "whatsapp" || c === "sms" || c === "voice") return !!lead.phone
  
  const sn = lead.social_networks || {}
  
  if (c === "instagram") return !!sn.instagram
  if (c === "messenger") return !!sn.facebook || !!sn.messenger
  if (c === "telegram") return !!lead.phone || !!sn.telegram
  if (c === "facebook" || c === "threads" || c === "linkedin" || c === "youtube") return !!sn[c]
  if (c === "x") return !!sn.twitter || !!sn.x
  
  return false
}
