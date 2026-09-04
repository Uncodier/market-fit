import { Site } from "@/app/context/site-types"

export function getAccountLimit(plan?: string | null, addonsCount: number = 0): number {
  if (!plan || plan === 'commission') return 0 + addonsCount
  if (plan === 'starter') return 1 + addonsCount
  if (plan === 'startup') return 3 + addonsCount
  if (plan === 'enterprise') return 10 + addonsCount
  return 0 + addonsCount
}

export function countConnectedAccounts(site: Partial<Site> | null | undefined): number {
  if (!site) return 0
  
  let count = 0

  // Count Zavu connections (WhatsApp, Messenger, etc.)
  const connections = site.settings?.channels?.connections || []
  for (const conn of connections) {
    if (conn.status === 'connected') {
      count++
    }
  }

  // Count Outstand social media pages
  const socialMedia = site.settings?.social_media || []
  for (const sm of socialMedia) {
    // Only count active integrations
    if (sm.isActive === true || sm.isActive === 1) {
      count++
    }
  }

  return count
}

export function canConnectAccounts(site: Partial<Site> | null | undefined, extra: number = 1): boolean {
  if (!site) return false
  const limit = getAccountLimit(site.billing?.plan, site.billing?.addons_count)
  const current = countConnectedAccounts(site)
  return current + extra <= limit
}

export function getRequiredAddons(site: Partial<Site> | null | undefined): number {
  const included = getAccountLimit(site?.billing?.plan, 0)
  const connected = countConnectedAccounts(site)
  return Math.max(0, connected - included)
}
