"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CatalogItem } from "@/app/types";

export async function listVariantChildren(parentId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("catalog_items")
      .select("*")
      .eq("parent_id", parentId)
      .neq("status", "archived")
      .order("name", { ascending: true });

    if (error) return { data: [], error: error.message };
    return { data: data as CatalogItem[] };
  } catch (error: any) {
    return { data: [], error: error.message };
  }
}

function cartesianOptionCombos(
  axes: Array<{ id: string; values: Array<{ id: string; label: string }> }>
): Array<{ option_values: Record<string, string>; labels: string[] }> {
  if (!axes.length) return [];
  let combos: Array<{ option_values: Record<string, string>; labels: string[] }> = [
    { option_values: {}, labels: [] },
  ];
  for (const axis of axes) {
    if (!axis.values?.length) continue;
    const next: typeof combos = [];
    for (const combo of combos) {
      for (const value of axis.values) {
        next.push({
          option_values: { ...combo.option_values, [axis.id]: value.id },
          labels: [...combo.labels, value.label],
        });
      }
    }
    combos = next;
  }
  return combos;
}

function optionValuesKey(optionValues: Record<string, string>): string {
  return Object.keys(optionValues)
    .sort()
    .map((k) => `${k}=${optionValues[k]}`)
    .join("|");
}

/**
 * Sync child SKU rows for each variant combination on a parent item.
 * Creates missing children, archives obsolete ones, leaves matched children intact.
 */
export async function syncVariantChildren(parentId: string) {
  try {
    const supabase = await createClient();
    const { data: parent, error: parentError } = await supabase
      .from("catalog_items")
      .select("*")
      .eq("id", parentId)
      .single();

    if (parentError || !parent) {
      return { error: parentError?.message || "Parent item not found" };
    }

    const axes = (parent.metadata as any)?.variant_axes || [];
    const hasAxes = Array.isArray(axes) && axes.length > 0;

    await supabase
      .from("catalog_items")
      .update({
        is_purchasable: !hasAxes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parentId);

    const { data: existingChildren } = await supabase
      .from("catalog_items")
      .select("*")
      .eq("parent_id", parentId);

    const children = (existingChildren || []) as CatalogItem[];

    if (!hasAxes) {
      for (const child of children) {
        if (child.status !== "archived") {
          await supabase
            .from("catalog_items")
            .update({ status: "archived", updated_at: new Date().toISOString() })
            .eq("id", child.id);
        }
      }
      revalidatePath(`/catalog`);
      revalidatePath(`/catalog/${parentId}`);
      return { data: [] as CatalogItem[] };
    }

    const combos = cartesianOptionCombos(axes);
    const existingByKey = new Map<string, CatalogItem>();
    for (const child of children) {
      const ov = (child.metadata as any)?.option_values;
      if (ov && typeof ov === "object") {
        existingByKey.set(optionValuesKey(ov), child);
      }
    }

    const keepKeys = new Set<string>();
    const upserted: CatalogItem[] = [];

    for (const combo of combos) {
      const key = optionValuesKey(combo.option_values);
      keepKeys.add(key);
      const existing = existingByKey.get(key);
      const variantName = `${parent.name} / ${combo.labels.join(" / ")}`;

      if (existing) {
        const { data: updated } = await supabase
          .from("catalog_items")
          .update({
            name: variantName,
            status: "active",
            is_purchasable: true,
            kind: parent.kind,
            digital_subtype: parent.digital_subtype,
            is_pos_available: parent.is_pos_available,
            is_recurring: parent.is_recurring,
            is_reservation: parent.is_reservation,
            currency: parent.currency,
            metadata: {
              ...(existing.metadata || {}),
              option_values: combo.option_values,
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .select()
          .single();
        if (updated) upserted.push(updated as CatalogItem);
      } else {
        const { data: created, error: createError } = await supabase
          .from("catalog_items")
          .insert({
            site_id: parent.site_id,
            parent_id: parentId,
            name: variantName,
            description: parent.description,
            image_url: parent.image_url,
            kind: parent.kind,
            digital_subtype: parent.digital_subtype,
            category_id: parent.category_id,
            target_sale_price: parent.target_sale_price,
            cost: parent.cost,
            currency: parent.currency,
            track_inventory: parent.track_inventory,
            availability_mode: parent.availability_mode,
            availability_status: "available",
            status: "active",
            is_purchasable: true,
            is_pos_available: parent.is_pos_available,
            is_recurring: parent.is_recurring,
            is_reservation: parent.is_reservation,
            is_marketplace_listed: false,
            metadata: {
              option_values: combo.option_values,
              delivery_options: (parent.metadata as any)?.delivery_options,
              payment_options: (parent.metadata as any)?.payment_options,
            },
          })
          .select()
          .single();

        if (createError) {
          console.error("Failed to create variant child:", createError);
          continue;
        }
        if (created) upserted.push(created as CatalogItem);
      }
    }

    for (const child of children) {
      const ov = (child.metadata as any)?.option_values;
      const key = ov ? optionValuesKey(ov) : "";
      if (!keepKeys.has(key) && child.status !== "archived") {
        await supabase
          .from("catalog_items")
          .update({ status: "archived", updated_at: new Date().toISOString() })
          .eq("id", child.id);
      }
    }

    revalidatePath(`/catalog`);
    revalidatePath(`/catalog/${parentId}`);
    revalidatePath(`/pos`);

    return { data: upserted };
  } catch (error: any) {
    return { error: error.message };
  }
}
