import { isMakinariInternalReferrerHostname } from "./makinari-internal-referrer"
import { countBucket, recordedLabel, sortedBuckets, text } from "./buckets"
import type { TrafficAttribution, TrafficSession } from "./types"

export const DIRECT_UNKNOWN = "Direct / unknown"
export const INTERNAL_NAVIGATION = "Internal navigation"
const REFERRAL_RESERVED = [DIRECT_UNKNOWN, INTERNAL_NAVIGATION, "Other", "Direct", "Unknown"]

const REFERRER_DOMAINS: Array<[string, string[]]> = [
  ["Google", ["google.com", "google.co.uk", "google.ca", "google.com.au", "google.de", "google.fr", "google.es", "google.co.in", "google.co.jp", "google.com.br", "google.com.mx"]],
  ["Facebook", ["facebook.com", "fb.com"]],
  ["Twitter", ["twitter.com", "t.co", "x.com"]],
  ["LinkedIn", ["linkedin.com"]],
  ["Instagram", ["instagram.com"]],
  ["YouTube", ["youtube.com", "youtu.be"]],
  ["Pinterest", ["pinterest.com"]],
  ["Reddit", ["reddit.com"]],
  ["TikTok", ["tiktok.com"]],
  ["Snapchat", ["snapchat.com"]],
  ["WhatsApp", ["whatsapp.com"]],
  ["Telegram", ["telegram.org", "telegram.me", "t.me"]],
  ["Discord", ["discord.com", "discord.gg"]],
  ["Bing", ["bing.com"]],
  ["Yahoo", ["yahoo.com"]],
  ["DuckDuckGo", ["duckduckgo.com"]],
  ["Baidu", ["baidu.com"]],
  ["Yandex", ["yandex.com", "yandex.ru"]],
]

function webUrl(value: unknown, allowRelative = false): URL | null {
  if (typeof value !== "string" || value.length > 8192) return null
  const raw = text(value)
  if (!raw || raw.length > 8192 || /[\u0000-\u001f\u007f-\u009f\ufffd]/u.test(raw)) return null
  try {
    const relative = allowRelative && (raw.startsWith("/") || raw.startsWith("?"))
    const url = relative ? new URL(raw, "https://relative.invalid") : new URL(raw)
    return url.protocol === "https:" || url.protocol === "http:" ? url : null
  } catch {
    return null
  }
}

function landingParameter(landing: URL | null, key: string): string | null {
  const raw = landing?.searchParams.get(key)
  if (!raw || raw.length > 512 || /[\u0000-\u001f\u007f-\u009f\ufffd]/u.test(raw)) return null
  const value = text(raw)
  // Match ingestion bounds: never resurrect malformed/rejected URL metadata.
  return value
}

function hostname(url: URL): string {
  return url.hostname.toLowerCase().replace(/\.$/, "").replace(/^www\./, "")
}

function domainMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`)
}

function inferredSource(session: TrafficSession, landing: URL | null) {
  if (landingParameter(landing, "gclid")) return { name: "Google Ads", attributed: true }
  if (landingParameter(landing, "msclkid")) return { name: "Microsoft Ads", attributed: true }
  // fbclid identifies a Facebook click, not necessarily paid advertising.
  const referrer = webUrl(session.referrer)
  if (!referrer) return { name: DIRECT_UNKNOWN, attributed: false }
  const host = hostname(referrer)
  const absoluteLanding = webUrl(session.landing_url)
  const landingHost = absoluteLanding ? hostname(absoluteLanding) : null
  const internalMakinari = isMakinariInternalReferrerHostname(host)
    && (!landingHost || isMakinariInternalReferrerHostname(landingHost))
  if (internalMakinari || host === landingHost) return { name: INTERNAL_NAVIGATION, attributed: false }
  const provider = REFERRER_DOMAINS.find(([, domains]) => domains.some(domain => domainMatches(host, domain)))
  return { name: recordedLabel(provider?.[0] ?? host, REFERRAL_RESERVED), attributed: true }
}

/** Session-entry evidence only: never use current_url or CRM campaign guesses. */
export function classifySessionEntry(session: TrafficSession): {
  referral: string
  campaign: string | null
  attributed: boolean
} {
  const landing = webUrl(session.landing_url, true)
  const source = text(session.utm_source) ?? landingParameter(landing, "utm_source")
  const medium = text(session.utm_medium) ?? landingParameter(landing, "utm_medium")
  const campaign = text(session.utm_campaign) ?? landingParameter(landing, "utm_campaign")
  const inferred = inferredSource(session, landing)
  const attributed = Boolean(source) || inferred.attributed

  if (source || medium || campaign) {
    let label = source ?? (inferred.attributed ? inferred.name : medium ? "Unknown source" : "Campaign UTM")
    if (medium) label += ` (${medium})`
    if (campaign) label += ` - ${campaign}`
    return { referral: recordedLabel(label, REFERRAL_RESERVED), campaign, attributed }
  }
  return { referral: inferred.name, campaign, attributed }
}

export function sessionSegment(session: TrafficSession, siteId: string): string | null {
  const leadSegment = session.lead?.site_id === siteId ? session.lead.segment : null
  const visitorSegment = session.visitor?.segment
  for (const segment of [leadSegment, visitorSegment]) {
    if (segment?.site_id === siteId && text(segment.name)) return text(segment.name)
  }
  return null
}

export function buildAttribution(sessions: TrafficSession[], siteId: string): TrafficAttribution {
  const segments = new Map<string, number>()
  const campaigns = new Map<string, number>()
  const coverage = {
    totalSessions: sessions.length,
    attributedSessions: 0,
    unattributedSessions: 0,
    segmentedSessions: 0,
    campaignSessions: 0,
  }

  for (const session of sessions) {
    const entry = classifySessionEntry(session)
    const segment = sessionSegment(session, siteId)
    if (entry.attributed) coverage.attributedSessions++
    else coverage.unattributedSessions++
    if (segment) coverage.segmentedSessions++
    if (entry.campaign) coverage.campaignSessions++
    countBucket(segments, segment ? recordedLabel(segment, ["Unassigned segment", "Other"]) : "Unassigned segment")
    countBucket(campaigns, entry.campaign ? recordedLabel(entry.campaign, ["No campaign", "Other"]) : "No campaign")
  }

  return {
    segments: sortedBuckets(segments, 6, ["Unassigned segment"]),
    campaigns: sortedBuckets(campaigns, 6, ["No campaign"]),
    coverage,
    model: "session_entry",
    segmentMembership: "current",
  }
}

export function buildReferrals(sessions: TrafficSession[]) {
  const counts = new Map<string, number>()
  for (const session of sessions) countBucket(counts, classifySessionEntry(session).referral)
  return sortedBuckets(counts, 10)
}