import { createServiceClient } from "@/lib/supabase/server";

export function toSiteSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isTransientDbError(error: { message?: string; details?: string } | null | undefined): boolean {
  const msg = `${error?.message || ""} ${error?.details || ""}`;
  return /fetch failed|ENOTFOUND|ECONNRESET|ETIMEDOUT|ECONNREFUSED|socket|network/i.test(msg);
}

function formatDbError(error: { message?: string; details?: string; hint?: string; code?: string } | null | undefined): string {
  if (!error) return "unknown error";
  return [error.message, error.code && `code=${error.code}`, error.details, error.hint]
    .filter(Boolean)
    .join(" | ") || JSON.stringify(error);
}

async function withTransientRetry<T extends { error: any }>(
  run: () => Promise<T>,
  label: string,
  attempts = 3,
): Promise<T> {
  let last: T | undefined;
  for (let attempt = 0; attempt < attempts; attempt++) {
    last = await run();
    if (!last.error) return last;
    if (!isTransientDbError(last.error) || attempt === attempts - 1) {
      if (last.error) {
        console.error(`[${label}] DB Error:`, formatDbError(last.error));
      }
      return last;
    }
    const delayMs = 200 * Math.pow(2, attempt);
    console.warn(
      `[${label}] transient DB error, retrying in ${delayMs}ms (attempt ${attempt + 1}/${attempts}):`,
      formatDbError(last.error),
    );
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return last!;
}

async function loadSiteSettings(supabase: Awaited<ReturnType<typeof createServiceClient>>, siteId: string) {
  const { data } = await supabase
    .from("settings")
    .select("*")
    .eq("site_id", siteId)
    .limit(1)
    .maybeSingle();
  return data || {};
}

export async function resolveSiteInfoBySlug(
  siteSlug: string,
): Promise<{
  id: string
  name: string
  logo_url: string | null
  description?: string | null
  settings?: any
} | null> {
  const supabase = await createServiceClient(true);

  const isUUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      siteSlug,
    );

  if (isUUID) {
    const { data: site } = await withTransientRetry(
      () =>
        supabase
          .from("sites")
          .select("id, name, logo_url, description")
          .eq("id", siteSlug)
          .maybeSingle(),
      "getSiteInfoBySlug/uuid",
    );

    if (site) {
      return {
        ...site,
        settings: await loadSiteSettings(supabase, site.id),
      };
    }
  }

  // Exact ilike first ("pigs" -> "Pigs"), then prefix ("pigs%" -> "Pigs ").
  // Trailing wildcard stays index-friendly; a leading % forces a seq scan and times out.
  const safeSlug = toSiteSlug(siteSlug);
  if (!safeSlug) return null;
  const prefixPattern = `${safeSlug.replace(/-/g, "%")}%`;

  const siteSelect = "id, name, logo_url, description" as const;
  const exact = await withTransientRetry(
    () =>
      supabase
        .from("sites")
        .select(siteSelect)
        .ilike("name", safeSlug)
        .limit(50),
    "getSiteInfoBySlug/slug-exact",
  );

  let candidates = !exact.error && exact.data?.length ? exact.data : null;
  if (!candidates) {
    const prefixed = await withTransientRetry(
      () =>
        supabase
          .from("sites")
          .select(siteSelect)
          .ilike("name", prefixPattern)
          .limit(50),
      "getSiteInfoBySlug/slug-prefix",
    );
    if (prefixed.error || !prefixed.data?.length) {
      if (exact.error || prefixed.error) {
        console.error(
          `[getSiteInfoBySlug] no site for slug=${safeSlug}`,
          exact.error && formatDbError(exact.error),
          prefixed.error && formatDbError(prefixed.error),
        );
      }
      return null;
    }
    candidates = prefixed.data;
  }

  const exactMatch = candidates.find((s) => toSiteSlug(s.name) === safeSlug);

  if (exactMatch) {
    return {
      ...exactMatch,
      settings: await loadSiteSettings(supabase, exactMatch.id),
    };
  }

  return null;
}
