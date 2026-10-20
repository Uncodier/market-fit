import { getChannelLabel, getEnabledSiteChannels, normalizeChannel, type CommunicationChannel, type SiteChannelSource } from "@/lib/site-channels"
import { destinationChannel, publishDestinationKey, publishDestinationMode } from "@/lib/content/publish-destinations"
import { isActiveAgentChannel } from "@/lib/agent-channel-state"

export type PublishOption = { key: string; mode: string; label: string; hint: string }
const MODES = ["mail", "newsletter", "whatsapp", "telegram", "sms", "voice", "voice-agent-call"]
const LABELS: Record<string, string> = {
  mail: "Mail", newsletter: "Newsletter", voice: "Voice Message", "voice-agent-call": "Voice Agent Call",
}
const connected = (status?: string | null) => !!status && ["connected", "active", "synced"].includes(status)
const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : undefined

export function getPublishOptions(site?: SiteChannelSource | null): PublishOption[] {
  const options: PublishOption[] = []
  for (const account of site?.settings?.social_media || []) {
    if (account.license_suspended || account.isActive === false || account.isActive === 0
      || !(account.isActive || account.connectedPages?.length)) continue
    const rawPlatform = account.network || account.platform
    if (!rawPlatform) continue
    const platform = normalizeChannel(rawPlatform) as string
    const addSocial = (id: string | null | undefined, identity?: string) => options.push({
      key: id ? publishDestinationKey(platform, "social", id) : platform, mode: platform,
      label: `${getChannelLabel(platform)}${identity ? ` · ${identity}` : ""}`,
      hint: `Publish to this connected ${getChannelLabel(platform)} account${identity ? ` (${identity})` : ""}.`,
    })
    if (account.connectedPages?.length) {
      for (const page of account.connectedPages) {
        if (!page || page.license_suspended || page.isActive === false || page.isActive === 0 || !page.id) continue
        addSocial(page.id, page.name || page.username || page.id)
      }
    } else {
      const id = account.account_id || account.accountId || account.id
      addSocial(id, account.nickname || account.accountName || account.username || account.handle || id || undefined)
    }
  }
  const channels = site?.settings?.channels
  for (const mode of MODES) {
    const channel = destinationChannel(mode)!
    const label = LABELS[mode] || getChannelLabel(channel)
    const connections = (channels?.connections || []).filter((item) =>
      isActiveAgentChannel(item) && normalizeChannel(item.type) === channel)
    const add = (id: string, identity: string) => options.push({
      key: publishDestinationKey(mode, "connection", id), mode,
      label: `${label} · ${identity}`,
      hint: `Use ${identity} for ${label}. Only this connection will be used.`,
    })
    for (const connection of connections) {
      if (!connection.id) continue
      const metadata = connection.metadata || {}
      const account = connection.connected_account || {}
      const address = text(metadata.email) || text(metadata.email_address) || text(metadata.inbox_id)
        || text(account.email) || text(metadata.phone_number) || text(account.phone_number)
      const name = text(connection.name)
      const identity = name && address ? `${name} (${address})` : address || name || connection.id
      add(connection.id, identity)
    }
    if (channel === "email") {
      if (channels?.email?.enabled && connected(channels.email.status)) {
        add("legacy:email", channels.email.email || "Site email")
      }
      if (channels?.agent_email?.enabled !== false && connected(channels?.agent_email?.status)) {
        const email = channels?.agent_email
        add("legacy:agent_email", email?.inbox_id || email?.data?.inbox_id || email?.username || "Agent email")
      }
    }
    if (channel === "whatsapp") {
      if (channels?.whatsapp?.enabled && connected(channels.whatsapp.status)) {
        add("legacy:whatsapp", channels.whatsapp.number || channels.whatsapp.existingNumber || "Site WhatsApp")
      }
      if (channels?.agent_whatsapp?.enabled !== false && connected(channels?.agent_whatsapp?.status)) add("legacy:agent_whatsapp", "Agent WhatsApp")
    }
    // Old, ID-less connections can still use the existing default route.
    if (!options.some((option) => option.mode === mode) && getEnabledSiteChannels(site).includes(channel as CommunicationChannel)) {
      options.push({ key: mode, mode, label, hint: `Use the connected ${label} channel.` })
    }
  }
  return options.filter((option, index) => options.findIndex((item) => item.key === option.key) === index)
    .map((option) => options.filter((item) => item.label === option.label).length > 1
      ? { ...option, label: `${option.label} · ${decodeURIComponent(option.key.split(":").slice(2).join(":"))}` }
      : option)
}

/** Only resolve old platform-only selections when the account is unambiguous. */
export function resolveLegacyPublishSelections(destinations: string[], options: PublishOption[]): string[] {
  return Array.from(new Set(destinations.map((value) => {
    if (value.includes(":")) return value
    const matches = options.filter((option) => option.mode === publishDestinationMode(value))
    return matches.length === 1 ? matches[0].key : value
  })))
}