import { countBucket, record, recordedLabel, sortedBuckets, text } from "./buckets"
import type { TrafficSession } from "./types"

function named(value: unknown): string | null {
  return text(value) ?? text(record(value).name)
}

export function deviceName(session: TrafficSession): string {
  const device = record(session.device)
  const browser = record(session.browser)
  const explicit = text(device.type) ?? text(device.category) ?? text(device.device_type) ?? text(browser.device_type)
  const os = named(device.os)?.toLowerCase() ?? ""
  const model = text(device.model)?.toLowerCase() ?? ""
  const raw = explicit?.toLowerCase() ?? ""
  if (/tablet|ipad/.test(raw)) return "Tablet"
  if (/mobile|phone/.test(raw)) return "Mobile"
  if (/desktop|computer|^pc$/.test(raw)) return "Desktop"
  if (/tv|television/.test(raw)) return "Smart TV"
  if (explicit && raw !== "unknown") return explicit
  if (/tablet|ipad/.test(model) || os.includes("ipados")) return "Tablet"
  if (model.includes("tv")) return "Smart TV"
  if (/android|ios/.test(os) || browser.mobile === true) return "Mobile"
  if (/windows|mac os|macos|ubuntu|chrome os/.test(os)) return "Desktop"
  // No device, unrecognized OS, or an empty browser object is not desktop proof.
  return "Unknown"
}

export function browserName(session: TrafficSession): string {
  const browser = record(session.browser)
  const device = record(session.device)
  const raw = (text(browser.name) ?? named(browser.browser) ?? text(browser.family)
    ?? named(device.browser) ?? text(session.browser) ?? text(browser.userAgent)
    ?? text(device.userAgent))?.toLowerCase() ?? ""
  // Chromium-based user agents contain Chrome/Safari as well. Specific first.
  if (/edge|edg\/|edga\/|edgios\//.test(raw)) return "Edge"
  if (/opera|opr\//.test(raw)) return "Opera"
  if (/samsung/.test(raw)) return "Samsung Internet"
  if (/brave/.test(raw)) return "Brave"
  if (/vivaldi/.test(raw)) return "Vivaldi"
  if (/chrome|crios/.test(raw)) return "Chrome"
  if (/firefox|fxios/.test(raw)) return "Firefox"
  if (/safari/.test(raw)) return "Safari"
  if (/internet explorer|msie|trident/.test(raw)) return "Internet Explorer"
  return text(browser.name) ?? text(browser.family) ?? "Unknown"
}

const COUNTRIES: Record<string, string> = {
  us: "United States", usa: "United States", gb: "United Kingdom", uk: "United Kingdom",
  ca: "Canada", au: "Australia", de: "Germany", fr: "France", es: "Spain", it: "Italy",
  br: "Brazil", in: "India", jp: "Japan", cn: "China", mx: "Mexico", nl: "Netherlands", sg: "Singapore",
}

export function regionName(session: TrafficSession): string {
  const location = record(session.location)
  const name = named(location.country) ?? text(location.countryCode) ?? text(location.country_code)
    ?? named(location.region) ?? named(location.city) ?? "Unknown"
  const key = name.toLowerCase()
  return Object.prototype.hasOwnProperty.call(COUNTRIES, key) ? COUNTRIES[key] : name
}

export function pageNames(session: TrafficSession): string[] {
  const urls = [text(session.landing_url), text(session.current_url)]
    .filter((url): url is string => Boolean(url))
  if (urls.length === 0) return ["Unknown Page"]
  const custom = record(session.custom_data)
  const title = text(custom.page_title) ?? text(custom.title)
  // This legacy breakdown samples landing/current URLs, not session_events.
  return Array.from(new Set(urls)).map(url => {
    if (title) return title
    try {
      const parsed = new URL(url, "https://relative.invalid")
      if (!["http:", "https:"].includes(parsed.protocol)) return "Unknown Page"
      return parsed.pathname.replace(/^\//, "").replace(/\/$/, "")
        .replace(/[-_]/g, " ").replace(/\//g, " > ")
        .replace(/\b\w/g, letter => letter.toUpperCase()) || "Home Page"
    } catch {
      return "Unknown Page"
    }
  })
}

const CLASSIFIERS = { devices: deviceName, browsers: browserName, regions: regionName }

export function buildBreakdown(sessions: TrafficSession[], kind: keyof typeof CLASSIFIERS | "pages") {
  const counts = new Map<string, number>()
  for (const session of sessions) {
    const names = kind === "pages" ? pageNames(session) : [CLASSIFIERS[kind](session)]
    for (const name of names) countBucket(counts, recordedLabel(name, ["Other"]))
  }
  return sortedBuckets(counts, 10)
}