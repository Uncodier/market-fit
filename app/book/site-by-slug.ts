import { createServiceClient } from "@/lib/supabase/server";

export function toSiteSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
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

  // Narrow candidates with ilike ("my-shop" -> "my%shop") then exact-match slugified names.
  // Avoids scanning the full sites table (slow and more prone to transient network failures).
  const safeSlug = siteSlug.toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!safeSlug) return null;
  const likePattern = safeSlug.replace(/-/g, "%");
  const { data: sites, error } = await withTransientRetry(
    () =>
      supabase
        .from("sites")
        .select("id, name, logo_url, description")
        .ilike("name", likePattern)
        .limit(50),
    "getSiteInfoBySlug/slug",
  );

  if (error || !sites?.length) {
    return null;
  }

  const exactMatch = sites.find((s) => toSiteSlug(s.name) === safeSlug);

  if (exactMatch) {
    return {
      ...exactMatch,
      settings: await loadSiteSettings(supabase, exactMatch.id),
    };
  }

  return null;
}
