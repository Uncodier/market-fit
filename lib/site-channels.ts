export const COMMUNICATION_CHANNELS = [
  "whatsapp",
  "messenger",
  "telegram",
  "instagram",
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
  } | null
}

const CHANNEL_LABELS: Record<string, string> = {
  web: "Web",
  website_chat: "Web",
  email: "Email",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
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
  messenger: "Send via Messenger",
  sms: "Send via SMS",
  telegram: "Send via Telegram",
  voice: "Send via Voice",
}

const CONNECTED_STATUSES = new Set(["connected", "active", "synced"])

export function normalizeChannel(channel?: string | null): CommunicationChannel | string {
  if (!channel) return "web"
  if (channel === "website_chat") return "web"
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

  return COMMUNICATION_CHANNELS.filter((channel) => enabled.includes(channel))
}
