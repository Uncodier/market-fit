"use server";

import {
  normalizePosInventoryQuantity,
  type PosInventorySnapshot,
} from "@/app/pos/inventory-availability";
import { requirePosSiteAccess } from "./site-access";

const PAGE_SIZE = 1000;
const LOAD_ERROR = "Failed to load POS inventory availability";

/** Uncached, authorized inventory read. An error is not an empty stock snapshot. */
export async function pullPosInventorySnapshot(
  siteId: string,
): Promise<{ data: PosInventorySnapshot } | { error: string }> {
  if (typeof siteId !== "string" || !siteId.trim()) {
    return { error: "siteId is required" };
  }

  try {
    const access = await requirePosSiteAccess(siteId);
    if (!("supabase" in access)) return { error: access.error };
    const { supabase } = access;
    const { data: settings, error: settingsError } = await supabase
      .from("settings")
      .select("commerce")
      .eq("site_id", siteId)
      .maybeSingle();
    if (settingsError) return { error: LOAD_ERROR };

    const policy = settings?.commerce?.stock_shortage_policy;
    if (policy != null && policy !== "" && !["allow", "warn", "block"].includes(policy)) {
      return { error: LOAD_ERROR };
    }
    const levels: PosInventorySnapshot["levels"] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("inventory_levels")
        .select("catalog_item_id, location_id, quantity")
        .eq("site_id", siteId)
        .order("id", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error || !Array.isArray(data)) return { error: LOAD_ERROR };
      for (const level of data) {
        const validQuantity = (typeof level.quantity === "number" ||
          (typeof level.quantity === "string" && level.quantity.trim() !== "")) &&
          Number.isFinite(Number(level.quantity));
        if (typeof level.catalog_item_id !== "string" || typeof level.location_id !== "string" || !validQuantity) {
          return { error: LOAD_ERROR };
        }
        levels.push({
          catalog_item_id: level.catalog_item_id,
          location_id: level.location_id,
          quantity: normalizePosInventoryQuantity(level.quantity),
        });
      }
      if (data.length < PAGE_SIZE) break;
    }

    return {
      data: {
        levels,
        policy: policy === "block" || policy === "warn" ? policy : "allow",
      },
    };
  } catch {
    return { error: LOAD_ERROR };
  }
}