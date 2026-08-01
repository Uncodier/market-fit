"use server";

import { createClient } from "@/lib/supabase/server";
import { CatalogItem, CatalogRelatedItem } from "@/app/types";

type PlanIncludeRow = {
  plan_catalog_item_id: string;
  digital_catalog_item: CatalogRelatedItem | CatalogRelatedItem[] | null;
};

type PassRedeemRow = {
  pass_catalog_item_id: string;
  reservable_catalog_item: CatalogRelatedItem | CatalogRelatedItem[] | null;
};

function asRelatedItem(
  value: CatalogRelatedItem | CatalogRelatedItem[] | null | undefined
): CatalogRelatedItem | null {
  if (!value) return null;
  const item = Array.isArray(value) ? value[0] : value;
  if (!item?.id || !item?.name) return null;
  return {
    id: item.id,
    name: item.name,
    kind: item.kind,
    digital_subtype: item.digital_subtype ?? null,
  };
}

/**
 * Attaches plan→digital-asset and pass→reservable-service links for table display.
 */
export async function attachCatalogRelationSummaries(
  items: CatalogItem[]
): Promise<CatalogItem[]> {
  if (items.length === 0) return items;

  const planIds = items.filter((i) => i.is_recurring).map((i) => i.id);
  const passIds = items
    .filter((i) => i.digital_subtype === "pass")
    .map((i) => i.id);

  if (planIds.length === 0 && passIds.length === 0) return items;

  const supabase = await createClient();
  const includesByPlan = new Map<string, CatalogRelatedItem[]>();
  const redeemsByPass = new Map<string, CatalogRelatedItem[]>();

  if (planIds.length > 0) {
    const { data, error } = await supabase
      .from("subscription_plan_items")
      .select(
        "plan_catalog_item_id, digital_catalog_item:catalog_items!digital_catalog_item_id(id, name, kind, digital_subtype)"
      )
      .in("plan_catalog_item_id", planIds);

    if (error) {
      console.error("Error fetching plan includes:", error);
    } else {
      for (const row of (data || []) as PlanIncludeRow[]) {
        const related = asRelatedItem(row.digital_catalog_item);
        if (!related) continue;
        const list = includesByPlan.get(row.plan_catalog_item_id) || [];
        list.push(related);
        includesByPlan.set(row.plan_catalog_item_id, list);
      }
    }
  }

  if (passIds.length > 0) {
    const { data, error } = await supabase
      .from("pass_redeemable_items")
      .select(
        "pass_catalog_item_id, reservable_catalog_item:catalog_items!reservable_catalog_item_id(id, name, kind, digital_subtype)"
      )
      .in("pass_catalog_item_id", passIds);

    if (error) {
      console.error("Error fetching pass redeemables:", error);
    } else {
      for (const row of (data || []) as PassRedeemRow[]) {
        const related = asRelatedItem(row.reservable_catalog_item);
        if (!related) continue;
        const list = redeemsByPass.get(row.pass_catalog_item_id) || [];
        list.push(related);
        redeemsByPass.set(row.pass_catalog_item_id, list);
      }
    }
  }

  return items.map((item) => ({
    ...item,
    plan_includes: includesByPlan.get(item.id) || undefined,
    pass_redeems: redeemsByPass.get(item.id) || undefined,
  }));
}
