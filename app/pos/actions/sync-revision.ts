"use server";

import { createHash } from "node:crypto";
import { hashRedisKeyPart } from "@/lib/redis/control-plane";
import { readThroughJsonCache } from "@/lib/redis/json-cache";
import { requirePosSiteAccess } from "./site-access";

type PosClient = Extract<Awaited<ReturnType<typeof requirePosSiteAccess>>, { supabase: unknown }>["supabase"];
const REVISION_ERROR = "Failed to fetch catalog revision";

async function tableRevision(supabase: PosClient, siteId: string, table: string, column: string) {
  const [latest, count] = await Promise.all([
    supabase.from(table).select(column).eq("site_id", siteId).order(column, { ascending: false }).limit(1),
    supabase.from(table).select("id", { count: "exact", head: true }).eq("site_id", siteId),
  ]);
  if (latest.error || count.error || !Array.isArray(latest.data) || !Number.isFinite(count.count)) {
    throw new Error(REVISION_ERROR);
  }
  return `${latest.data[0]?.[column] || "0"}:${count.count}`;
}

/** Some stock writers do not advance updated_at; include quantities themselves. */
async function contentRevision(supabase: PosClient, siteId: string, table: string, columns: string) {
  const hash = createHash("sha256");
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from(table).select(columns)
      .eq("site_id", siteId).order("id", { ascending: true }).range(offset, offset + 999);
    if (error || !Array.isArray(data)) throw new Error(REVISION_ERROR);
    for (const row of data) hash.update(JSON.stringify(row));
    if (data.length < 1000) break;
  }
  return hash.digest("hex");
}

export async function getPosCatalogRevision(siteId: string): Promise<{ data: string } | { error: string }> {
  if (typeof siteId !== "string" || !siteId.trim()) return { error: "siteId is required" };
  try {
    const access = await requirePosSiteAccess(siteId);
    if (!("supabase" in access)) return { error: access.error };
    const siteHash = await hashRedisKeyPart(siteId);

    const cached = await readThroughJsonCache({
      key: `cache:v2:pos-catalog-revision:${siteHash}`,
      ttlSeconds: 20,
      lockTtlMs: 10_000,
      compute: async () => {
        const { supabase } = access;
        const [stamps, inventory, locations, settings] = await Promise.all([
          Promise.all([
            ["catalog_items", "updated_at"],
            ["catalog_categories", "updated_at"],
            ["price_lists", "updated_at"],
            ["promotions", "updated_at"],
            ["modifier_groups", "updated_at"],
            ["catalog_item_modifier_groups", "created_at"],
            ["modifier_group_items", "created_at"],
            ["inventory_levels", "updated_at"],
            ["locations", "updated_at"],
          ].map(([table, column]) => tableRevision(supabase, siteId, table, column))),
          contentRevision(supabase, siteId, "inventory_levels", "id, catalog_item_id, location_id, quantity, updated_at"),
          contentRevision(supabase, siteId, "locations", "id, name, is_active, is_default, updated_at"),
          supabase.from("settings").select("commerce").eq("site_id", siteId).maybeSingle(),
        ]);
        if (settings.error) throw new Error(REVISION_ERROR);
        const commerce = createHash("sha256").update(JSON.stringify(settings.data?.commerce ?? null)).digest("hex");
        return [...stamps, inventory, locations, commerce].join("|");
      },
    });

    if (cached.status === "busy") {
      return { error: "Catalog revision is being refreshed" };
    }
    return { data: cached.value };
  } catch {
    return { error: REVISION_ERROR };
  }
}
