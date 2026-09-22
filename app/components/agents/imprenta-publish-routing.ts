import {
  getChannelRoutingMetadata,
  getEnabledSiteChannels,
  type SiteChannelSource,
} from "@/lib/site-channels"

const DISTRIBUTION_DESTINATIONS = new Set([
  "mail",
  "newsletter",
  "whatsapp",
  "telegram",
  "sms",
  "voice",
  "voice-agent-call",
])

function destinationChannel(destination: string): string | undefined {
  if (destination === "mail" || destination === "newsletter") return "email"
  if (destination === "voice-agent-call") return "voice"
  if (DISTRIBUTION_DESTINATIONS.has(destination)) return destination
  return undefined
}

export type PublishVoiceMode = "tts" | "agent_call"

export function getPublishVoiceMode(destinations: string[]): PublishVoiceMode | undefined {
  if (destinations.includes("voice-agent-call")) return "agent_call"
  if (destinations.includes("voice")) return "tts"
  return undefined
}

export function togglePublishDestination(
  destinations: string[],
  destination: string
): string[] {
  if (destinations.includes(destination)) {
    return destinations.filter((item) => item !== destination)
  }

  const nextDestinations = destination === "voice-agent-call"
    ? destinations.filter((item) => !DISTRIBUTION_DESTINATIONS.has(item))
    : DISTRIBUTION_DESTINATIONS.has(destination)
      ? destinations.filter(
          (item) => item !== "voice-agent-call" && (
            destination !== "voice" || item !== "voice"
          )
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
  const effectiveDestinations = destinations.includes("voice-agent-call")
    ? destinations.filter(
        (destination) =>
          destination === "voice-agent-call"
          || !DISTRIBUTION_DESTINATIONS.has(destination)
      )
    : destinations
  const voiceMode = getPublishVoiceMode(effectiveDestinations)
  const deliveryChannels = Array.from(
    new Set(effectiveDestinations.map(destinationChannel).filter((channel): channel is string => !!channel))
  )
  const socialAccounts = effectiveDestinations.filter(
    (destination) => destination !== "blog" && !DISTRIBUTION_DESTINATIONS.has(destination)
  )
  const channelRouting = Object.fromEntries(
    deliveryChannels
      .map((channel) => [channel, getChannelRoutingMetadata(site, channel)] as const)
      .filter(([, routing]) => routing)
  )
  const bulkMessageOverride: Record<string, unknown> = {}
  const publishOverride: Record<string, unknown> = {}

  if (socialAccounts.length > 0) {
    publishOverride.social_accounts = socialAccounts
  }

  // The existing bulk-message tool accepts one channel per invocation. Only
  // force it when exactly one delivery channel was selected. With multiple
  // channels, Temporal uses publish_channels to invoke the tool once per route.
  if (deliveryChannels.length === 1) {
    bulkMessageOverride.channel = deliveryChannels[0]
    publishOverride.channel = deliveryChannels[0]
    if (deliveryChannels[0] === "email") {
      const audienceEmailMode = effectiveDestinations.includes("newsletter")
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
    channelRouting,
    distributionModes: {
      mail: effectiveDestinations.includes("mail"),
      newsletter: effectiveDestinations.includes("newsletter"),
      whatsapp: effectiveDestinations.includes("whatsapp"),
      telegram: effectiveDestinations.includes("telegram"),
      sms: effectiveDestinations.includes("sms"),
      voice: effectiveDestinations.includes("voice"),
      voiceAgentCall: effectiveDestinations.includes("voice-agent-call"),
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
