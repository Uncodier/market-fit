import type { SupabaseClient } from "@supabase/supabase-js"
import {
  resolveDocumentLocale,
  type DocumentLocale,
} from "@/app/lib/i18n/document-t"

type SiteSettingsRow = {
  default_locale?: string | null
  locations?: unknown
}

async function loadSiteSettings(
  supabase: SupabaseClient,
  siteId: string
): Promise<SiteSettingsRow | null> {
  const withLocale = await supabase
    .from("settings")
    .select("default_locale, locations")
    .eq("site_id", siteId)
    .maybeSingle()

  if (!withLocale.error) {
    return (withLocale.data as SiteSettingsRow | null) || null
  }

  // Fallback when default_locale column is not in schema cache yet
  const locationsOnly = await supabase
    .from("settings")
    .select("locations")
    .eq("site_id", siteId)
    .maybeSingle()

  return (locationsOnly.data as SiteSettingsRow | null) || null
}

export async function loadSiteBranding(supabase: SupabaseClient, siteId: string): Promise<{
  site: { id: string; name: string | null; logo_url: string | null; url: string | null }
  locale: DocumentLocale
  location: any
}> {
  if (!siteId) {
    return {
      site: { id: "", name: null, logo_url: null, url: null },
      locale: "en",
      location: null,
    }
  }

  const [{ data: site }, settings] = await Promise.all([
    supabase.from("sites").select("id, name, logo_url, url").eq("id", siteId).single(),
    loadSiteSettings(supabase, siteId),
  ])

  const locations = settings?.locations
  const primaryLocation =
    Array.isArray(locations) && locations.length > 0 ? locations[0] : null

  return {
    site: site || { id: siteId, name: null, logo_url: null, url: null },
    locale: resolveDocumentLocale(settings?.default_locale),
    location: primaryLocation,
  }
}

export function publicTokenSchemaError(message?: string | null, migrationHint?: string) {
  if (!message) return null
  if (
    /public_access_token|last_emailed_at/i.test(message) &&
    /does not exist|schema cache|PGRST204|42703/i.test(message)
  ) {
    return (
      migrationHint ||
      "Public document links are not set up yet. Apply migration 20260810230000_document_public_access_tokens.sql"
    )
  }
  return null
}
