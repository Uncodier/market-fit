import {
  getChannelRoutingMetadata,
  getEnabledSiteChannels,
  type SiteChannelSource,
} from "@/lib/site-channels"
import {
  DISTRIBUTION_DESTINATIONS, destinationChannel, effectivePublishDestinations,
  parsePublishDestination, publishDestinationMode,
} from "@/lib/content/publish-destinations"

function socialAccountSelector(destination: string, site?: SiteChannelSource | null): string {
  const normalize = (value: string) => {
    const network = value.trim().toLowerCase()
    return network === "twitter" ? "x" : network
  }
  const accounts = (site?.settings?.social_media || []).filter((account) =>
    (account.isActive === true || account.isActive === 1)
    && normalize(account.network || account.platform || "") === normalize(destination)
  )
  // Cached settings are only a hint. The server validates every target against
  // the provider's site-scoped inventory and rejects missing/ambiguous matches.
  if (accounts.length === 1 && accounts[0].id?.trim()) return accounts[0].id
  return destination
}

export type PublishVoiceMode = "tts" | "agent_call"

export function getPublishVoiceMode(destinations: string[]): PublishVoiceMode | undefined {
  if (destinations.some((value) => publishDestinationMode(value) === "voice-agent-call")) return "agent_call"
  if (destinations.some((value) => publishDestinationMode(value) === "voice")) return "tts"
  return undefined
}

export function togglePublishDestination(
  destinations: string[],
  destination: string
): string[] {
  if (destinations.includes(destination)) {
    return destinations.filter((item) => item !== destination)
  }

  const mode = publishDestinationMode(destination)
  const nextDestinations = mode === "voice-agent-call"
    ? destinations.filter((item) => !DISTRIBUTION_DESTINATIONS.has(publishDestinationMode(item)) || publishDestinationMode(item) === mode)
    : DISTRIBUTION_DESTINATIONS.has(mode)
      ? destinations.filter(
          (item) => publishDestinationMode(item) !== "voice-agent-call"
        )
      : destinations

  return [...nextDestinations, destination]
}

export function getPublishChannelAvailability(site?: SiteChannelSource | null) {
  const enabled = new Set(getEnabledSiteChannels(site))
  return {
    email: enabled.has("email"),
    whatsapp: enabled.has("whatsapp"),
    telegram: enabled.has("telegram"),
    sms: enabled.has("sms"),
    voice: enabled.has("voice"),
  }
}

export function buildPublishRouting(
  destinations: string[],
  site?: SiteChannelSource | null
) {
  const effectiveDestinations = effectivePublishDestinations(destinations)
  const parsed = effectiveDestinations.map(parsePublishDestination)
  const modes = parsed.map((value) => value.mode)
  const voiceMode = getPublishVoiceMode(effectiveDestinations)
  const deliveryChannels = Array.from(
    new Set(modes.map(destinationChannel).filter((channel): channel is string => !!channel))
  )
  const socialAccounts = parsed.filter(
    (destination) => destination.mode !== "blog" && !DISTRIBUTION_DESTINATIONS.has(destination.mode)
  )
  const deliveryRoutes = parsed.flatMap((destination) => {
    const channel = destinationChannel(destination.mode)
    if (!channel) return []
    return [{
      channel,
      ...(destination.id ? { connection_id: destination.id } : {}),
      ...(channel === "email" ? { audience_email_mode: destination.mode === "newsletter" ? "newsletter" : "mail" } : {}),
      ...(channel === "voice" ? { voice_mode: destination.mode === "voice-agent-call" ? "agent_call" : "tts" } : {}),
    }]
  })
  const channelRouting = Object.fromEntries(
    deliveryChannels
      .map((channel) => {
        const routes = deliveryRoutes.filter((route) => route.channel === channel)
        return [channel, routes.length === 1 ? getChannelRoutingMetadata(site, channel, routes[0].connection_id) : undefined] as const
      })
      .filter(([, routing]) => routing)
  )
  const bulkMessageOverride: Record<string, unknown> = {}
  const publishOverride: Record<string, unknown> = {}

  if (socialAccounts.length > 0) {
    publishOverride.social_accounts = Array.from(new Set(
      socialAccounts.map((destination) => destination.id || socialAccountSelector(destination.mode, site))
    ))
    const targets = socialAccounts.filter((destination) => destination.kind === "social")
      .map((destination) => ({ id: destination.id!, network: destination.mode }))
    if (targets.length) publishOverride.social_account_targets = targets
  }

  // Exact selections travel as separate routes, including multiple accounts
  // of the same channel. Legacy generic multi-channel context stays compatible.
  if (deliveryRoutes.length > 1 && parsed.some((value) => value.kind === "connection")) {
    bulkMessageOverride.delivery_routes = deliveryRoutes
    publishOverride.delivery_routes = deliveryRoutes
  } else if (deliveryChannels.length === 1) {
    bulkMessageOverride.channel = deliveryChannels[0]
    publishOverride.channel = deliveryChannels[0]
    if (deliveryRoutes[0].connection_id) {
      bulkMessageOverride.connection_id = deliveryRoutes[0].connection_id
      publishOverride.connection_id = deliveryRoutes[0].connection_id
    }
    if (deliveryChannels[0] === "email") {
      const audienceEmailMode = modes.includes("newsletter")
        ? "newsletter"
        : "mail"
      bulkMessageOverride.audience_email_mode = audienceEmailMode
      publishOverride.audience_email_mode = audienceEmailMode
    }
    if (deliveryChannels[0] === "voice" && voiceMode) {
      bulkMessageOverride.voice_mode = voiceMode
      publishOverride.voice_mode = voiceMode
    }
  }

  return {
    deliveryChannels,
    deliveryRoutes,
    channelRouting,
    distributionModes: {
      mail: modes.includes("mail"),
      newsletter: modes.includes("newsletter"),
      whatsapp: modes.includes("whatsapp"),
      telegram: modes.includes("telegram"),
      sms: modes.includes("sms"),
      voice: modes.includes("voice"),
      voiceAgentCall: modes.includes("voice-agent-call"),
    },
    voiceMode,
    bulkMessageOverride,
    publishOverride,
  }
}

export function getTestRecipient(
  deliveryChannels: string[],
  destinations: Record<string, string>
): string | undefined {
  if (deliveryChannels.length !== 1) return undefined
  return deliveryChannels[0] === "email" ? destinations.email : destinations.phone
}
