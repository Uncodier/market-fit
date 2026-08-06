"use server";

import { createClient } from "@/lib/supabase/server";
import { CatalogItem, CatalogItemRequirement } from "@/app/types";

/**
 * Ensure a durable 1:1:1 catalog_item ↔ requirement ↔ instance link.
 * Reuses the existing triad so robot process context is not cut.
 */
export async function ensureCatalogItemRequirement(
  catalogItemId: string
): Promise<{ data?: CatalogItemRequirement; error?: string }> {
  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from("catalog_item_requirements")
    .select("*")
    .eq("catalog_item_id", catalogItemId)
    .maybeSingle();

  if (existingError) return { error: existingError.message };
  if (existing) return { data: existing as CatalogItemRequirement };

  const { data: item, error: itemError } = await supabase
    .from("catalog_items")
    .select("id, site_id, name")
    .eq("id", catalogItemId)
    .single();

  if (itemError || !item) {
    return { error: itemError?.message || "Catalog item not found" };
  }

  const { data: site } = await supabase
    .from("sites")
    .select("user_id")
    .eq("id", item.site_id)
    .single();

  const ownerUserId = site?.user_id;
  if (!ownerUserId) return { error: "Site owner not found" };

  const now = new Date().toISOString();
  const title = `Dynamic quote: ${item.name}`.slice(0, 120);
  const description = [
    `Durable quoting requirement for catalog item ${item.name}.`,
    "Keep this requirement and its robot instance for all future quote requests so process context is preserved.",
  ].join("\n");

  const { data: requirement, error: reqError } = await supabase
    .from("requirements")
    .insert({
      title,
      description,
      type: "task",
      priority: "medium",
      status: "backlog",
      completion_status: "pending",
      source: "dynamic_quote",
      site_id: item.site_id,
      user_id: ownerUserId,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (reqError || !requirement) {
    return { error: reqError?.message || "Failed to create requirement" };
  }

  const { data: instance, error: instanceError } = await supabase
    .from("remote_instances")
    .insert({
      name: `Quote: ${item.name}`.slice(0, 120),
      instance_type: "ubuntu",
      status: "pending",
      site_id: item.site_id,
      user_id: ownerUserId,
      created_by: ownerUserId,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (instanceError || !instance) {
    await supabase.from("requirements").delete().eq("id", requirement.id);
    return { error: instanceError?.message || "Failed to create robot instance" };
  }

  const { data: link, error: linkError } = await supabase
    .from("catalog_item_requirements")
    .insert({
      site_id: item.site_id,
      catalog_item_id: item.id,
      requirement_id: requirement.id,
      instance_id: instance.id,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (linkError || !link) {
    await supabase.from("remote_instances").delete().eq("id", instance.id);
    await supabase.from("requirements").delete().eq("id", requirement.id);
    return { error: linkError?.message || "Failed to link catalog item requirement" };
  }

  // Seed requirement_status so robots UI can associate the instance
  await supabase.from("requirement_status").insert({
    site_id: item.site_id,
    instance_id: instance.id,
    requirement_id: requirement.id,
    stage: "dynamic_quote_ready",
    message: "Catalog item linked for dynamic quoting.",
  });

  return { data: link as CatalogItemRequirement };
}

export async function getCatalogItemRequirement(
  catalogItemId: string
): Promise<{ data?: CatalogItemRequirement | null; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalog_item_requirements")
    .select("*")
    .eq("catalog_item_id", catalogItemId)
    .maybeSingle();
  if (error) return { error: error.message };
  return { data: (data as CatalogItemRequirement) || null };
}

export async function ensureCatalogItemRequirementForItem(
  item: Pick<CatalogItem, "id">
) {
  return ensureCatalogItemRequirement(item.id);
}
