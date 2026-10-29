import { TIMEZONE_REGIONS } from "./timezone-regions"
import { validTimeZone } from "./timezone"

const REGION_ALIASES: Record<string, string> = {
  "America/Los_Angeles": "California Washington Oregon Nevada Pacific",
  "America/Denver": "Colorado Utah Montana Wyoming Mountain",
  "America/Phoenix": "Arizona",
  "America/Chicago": "Texas Illinois Central",
  "America/New_York": "New York Florida Eastern",
  "Europe/Madrid": "España Espana Spain mainland península peninsula",
  "Atlantic/Canary": "Canarias Canary Islands",
  "America/Mexico_City": "Ciudad de México Ciudad de Mexico CDMX central",
}

export function timezoneOptions(current: string, locale = "en") {
  const names = [locale, "en", "es"].map(language => new Intl.DisplayNames([language], { type: "region" }))
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }
  const zones = new Map<string, { countries: Set<string>; regions: Set<string> }>()
  const canonical = (zone: string) => new Intl.DateTimeFormat("en", { timeZone: zone }).resolvedOptions().timeZone
  for (const [zone, country, region] of TIMEZONE_REGIONS) {
    if (!validTimeZone(zone)) continue
    const key = canonical(zone)
    const entry = zones.get(key) || { countries: new Set<string>(), regions: new Set<string>() }
    entry.countries.add(country)
    if (region) entry.regions.add(region)
    zones.set(key, entry)
  }
  const supported = intl.supportedValuesOf?.("timeZone") || [...zones.keys()]
  const values = [...new Set([current, "UTC", ...supported])].filter(validTimeZone)
  return values.map(zone => {
    const geography = zones.get(canonical(zone))
    const countries = [...(geography?.countries || [])]
    const country = countries.map(code => names[0].of(code) || code).join(", ")
    const region = [...(geography?.regions || [])].join("; ")
    const label = [country, zone.replace(/_/g, " "), region].filter(Boolean).join(" — ")
    const aliases = countries.flatMap(code => [code, ...names.map(display => display.of(code) || code)])
    return {
      value: zone, label,
      searchText: [label, zone, ...aliases, REGION_ALIASES[zone] || "", REGION_ALIASES[canonical(zone)] || ""].join(" "),
    }
  }).sort((a, b) => a.label.localeCompare(b.label, locale))
}