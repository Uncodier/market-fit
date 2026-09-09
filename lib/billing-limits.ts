import { Site } from "@/app/context/site-types"

export function getSocialAccountLimit(plan?: string | null): number {
  if (!plan || plan === 'commission') return 1
  if (plan === 'engine') return 3
  if (plan === 'foundry') return 6
  if (plan === 'enterprise') return 10
  return 1
}

export function getAgentChannelLimit(plan?: string | null): number {
  if (!plan || plan === 'commission') return 0
  if (plan === 'engine') return 1
  if (plan === 'foundry') return 3
  if (plan === 'enterprise') return 10
  return 0
}

export function countSocialAccounts(site: Partial<Site> | null | undefined): number {
  if (!site) return 0
  
  let count = 0
  
  // Count Outstand social media pages
  const socialMedia = site.settings?.social_media || []
  for (const sm of socialMedia) {
    if (sm.isActive === true || sm.isActive === 1) {
      count++
    }
  }

  return count
}

export function countAgentChannels(site: Partial<Site> | null | undefined): number {
  if (!site) return 0
  
  let count = 0

  // Count Zavu connections (WhatsApp, Messenger, etc.)
  const connections = site.settings?.channels?.connections || []
  for (const conn of connections) {
    if (conn.status === 'connected') {
      count++
    }
  }

  return count
}

export function countConnectedAccounts(site: Partial<Site> | null | undefined): number {
  return countSocialAccounts(site) + countAgentChannels(site)
}

export function canConnectSocialAccount(site: Partial<Site> | null | undefined, extra: number = 1): boolean {
  if (!site) return false
  // For validation, we need to know if adding a social account exceeds the combined total allowed
  const required = getRequiredAddons(site)
  const futureRequired = getRequiredAddonsWithExtra(site, extra, 0)
  
  // If the user has enough addons to cover the new accounts, or they haven't reached their plan limits yet
  return futureRequired <= (site.billing?.addons_count || 0)
}

export function canConnectAgentChannel(site: Partial<Site> | null | undefined, extra: number = 1): boolean {
  if (!site) return false
  const required = getRequiredAddons(site)
  const futureRequired = getRequiredAddonsWithExtra(site, 0, extra)
  
  return futureRequired <= (site.billing?.addons_count || 0)
}

function getRequiredAddonsWithExtra(site: Partial<Site> | null | undefined, extraSocial: number, extraAgent: number): number {
  const plan = site?.billing?.plan
  
  const socialLimit = getSocialAccountLimit(plan)
  const agentLimit = getAgentChannelLimit(plan)
  
  const socialCount = countSocialAccounts(site) + extraSocial
  const agentCount = countAgentChannels(site) + extraAgent
  
  const missingSocial = Math.max(0, socialCount - socialLimit)
  const missingAgent = Math.max(0, agentCount - agentLimit)
  
  return missingSocial + missingAgent
}

export function getRequiredAddons(site: Partial<Site> | null | undefined): number {
  return getRequiredAddonsWithExtra(site, 0, 0)
}
