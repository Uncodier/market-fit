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
])

function destinationChannel(destination: string): string | undefined {
  if (destination === "mail" || destination === "newsletter") return "email"
  if (DISTRIBUTION_DESTINATIONS.has(destination)) return destination
  return undefined
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
  const deliveryChannels = Array.from(
    new Set(destinations.map(destinationChannel).filter((channel): channel is string => !!channel))
  )
  const socialAccounts = destinations.filter(
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
    if (deliveryChannels[0] === "email") {
      bulkMessageOverride.audience_email_mode = destinations.includes("newsletter")
        ? "newsletter"
        : "mail"
    }
  }

  return {
    deliveryChannels,
    channelRouting,
    distributionModes: {
      mail: destinations.includes("mail"),
      newsletter: destinations.includes("newsletter"),
      whatsapp: destinations.includes("whatsapp"),
      telegram: destinations.includes("telegram"),
      sms: destinations.includes("sms"),
      voice: destinations.includes("voice"),
    },
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
