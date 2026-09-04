import type { Site, SiteSettings } from "@/app/context/site-types"
import { getChannelLabel } from "@/lib/site-channels"

type ChannelConnection = NonNullable<NonNullable<SiteSettings["channels"]>["connections"]>[number]

type SocialAccount = {
  id?: string
  platform?: string
  network?: string
  nickname?: string
  username?: string
  handle?: string
  isActive?: boolean | number
  network_unique_id?: string
  customer_social_network_id?: number
}

export type ConnectedAccount = {
  key: string
  kind: "channel" | "social"
  label: string
  platform?: string
}

function isActiveSocial(social: SocialAccount) {
  return social.isActive === true || social.isActive === 1
}

export function channelAccountKey(channel: Pick<ChannelConnection, "id">, index: number) {
  return channel.id || `channel-${index}`
}

export function socialAccountKey(social: SocialAccount, index: number) {
  if (social.id) return `social-${social.id}`
  if (social.network_unique_id) return `social-${social.network_unique_id}`
  if (social.customer_social_network_id != null) return `social-csn-${social.customer_social_network_id}`
  return `social-idx-${index}`
}

export function listConnectedAccounts(site: Partial<Site> | null | undefined): ConnectedAccount[] {
  const connections = site?.settings?.channels?.connections || []
  const channels = connections.flatMap((conn, index) => {
    if (conn.status !== "connected") return []
    return [{
      key: channelAccountKey(conn, index),
      kind: "channel" as const,
      label: conn.name || getChannelLabel(conn.type || "") || "Unnamed Channel",
      platform: conn.type,
    }]
  })

  const socials = (site?.settings?.social_media || []).flatMap((item, index) => {
    const social = item as SocialAccount
    if (!isActiveSocial(social)) return []
    return [{
      key: socialAccountKey(social, index),
      kind: "social" as const,
      label: social.nickname || social.username || social.handle || social.platform || "Social Account",
      platform: social.platform || social.network,
    }]
  })

  return [...channels, ...socials]
}

export function accountsToDisconnect(site: Partial<Site> | null | undefined, keepKeys: string[]) {
  const keep = new Set(keepKeys)
  const connections = site?.settings?.channels?.connections || []
  const channels = connections.flatMap((conn, index) => {
    if (conn.status !== "connected") return []
    const key = channelAccountKey(conn, index)
    if (keep.has(key)) return []
    return [{ key, channel: conn }]
  })

  const socials = (site?.settings?.social_media || []).flatMap((item, index) => {
    const social = item as SocialAccount
    if (!isActiveSocial(social)) return []
    const key = socialAccountKey(social, index)
    if (keep.has(key)) return []
    return [{ key, social }]
  })

  return { channels, socials }
}

export function settingsAfterKeepingAccounts(
  settings: SiteSettings | undefined,
  keepKeys: string[]
): Pick<SiteSettings, "channels" | "social_media"> {
  const keep = new Set(keepKeys)
  const currentConnections = settings?.channels?.connections || []
  const connections = currentConnections.filter((conn, index) => {
    if (conn.status !== "connected") return true
    return keep.has(channelAccountKey(conn, index))
  })

  const socialMedia = (settings?.social_media || []).filter((item, index) => {
    const social = item as SocialAccount
    if (!isActiveSocial(social)) return true
    return keep.has(socialAccountKey(social, index))
  })

  return {
    channels: {
      ...(settings?.channels || {}),
      connections,
    },
    social_media: socialMedia,
  }
}
